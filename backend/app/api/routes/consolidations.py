from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ...audit import record_audit
from ...database import get_db
from ...dependencies import Principal, get_principal
from ...errors import DomainError
from ...models import (
    AnalysisJob,
    Anomaly,
    AnomalyStatus,
    ConsolidatedWorkbook,
    ConsolidationJob,
    Country,
    CountryFile,
    CountryFileVersion,
    CountryStatus,
    JobStatus,
)
from ...schemas import ConsolidationCreate, ConsolidationJobOut
from ...services.consolidator import ConsolidationSource, OpenpyxlWorkbookConsolidator
from ...services.runtime import get_storage
from ..ownership import owned_consolidation

router = APIRouter(prefix="/consolidations", tags=["consolidations"])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("", response_model=ConsolidationJobOut, status_code=status.HTTP_201_CREATED)
def create_consolidation(
    body: ConsolidationCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> ConsolidationJob:
    request_options = body.model_dump(mode="json", by_alias=True)
    job = ConsolidationJob(
        organization_id=principal.organization.id,
        status=JobStatus.PENDING.value,
        request_options=request_options,
        requested_by_id=principal.user.id,
    )
    db.add(job)
    db.flush()
    record_audit(
        db,
        principal,
        "CONSOLIDATION_REQUESTED",
        "ConsolidationJob",
        job.id,
        request_options,
    )
    db.commit()

    job.status = JobStatus.RUNNING.value
    job.progress = 5
    job.started_at = utcnow()
    db.commit()
    exclusions: list[dict] = []
    try:
        query = (
            select(Country)
            .where(Country.organization_id == principal.organization.id)
            .options(
                selectinload(Country.files)
                .selectinload(CountryFile.versions)
                .selectinload(CountryFileVersion.analysis_jobs)
                .selectinload(AnalysisJob.anomalies)
            )
        )
        if body.country_ids:
            query = query.where(Country.id.in_(body.country_ids))
        countries = list(db.scalars(query.order_by(Country.name)))
        if body.country_ids:
            found = {country.id for country in countries}
            unknown = sorted(set(body.country_ids) - found)
            if unknown:
                raise DomainError(
                    "COUNTRIES_NOT_FOUND",
                    "One or more selected countries do not exist in this organization",
                    status_code=404,
                    details={"countryIds": unknown},
                )
        sources: list[ConsolidationSource] = []
        for country in countries:
            if not country.files or not country.files[0].versions:
                exclusions.append(
                    {"countryId": country.id, "country": country.name, "reason": "NO_FILE"}
                )
                continue
            country_file = country.files[0]
            version = max(country_file.versions, key=lambda item: item.version)
            jobs = version.analysis_jobs
            completed_jobs = [item for item in jobs if item.status == JobStatus.COMPLETED.value]
            if not completed_jobs:
                exclusions.append(
                    {
                        "countryId": country.id,
                        "country": country.name,
                        "reason": "NO_COMPLETED_ANALYSIS",
                    }
                )
                continue
            analysis = max(completed_jobs, key=lambda item: item.created_at)
            blocking = [item for item in analysis.anomalies if item.severity == "BLOCKING"]
            unresolved_blocking = [
                item
                for item in blocking
                if item.status
                not in {
                    AnomalyStatus.FALSE_POSITIVE.value,
                    AnomalyStatus.FIXED.value,
                    AnomalyStatus.ACCEPTED_EXCEPTION.value,
                }
            ]
            accepted_blocking = [
                item
                for item in blocking
                if item.status == AnomalyStatus.ACCEPTED_EXCEPTION.value
            ]
            if unresolved_blocking:
                exclusions.append(
                    {
                        "countryId": country.id,
                        "country": country.name,
                        "reason": "UNRESOLVED_BLOCKING_ANOMALY",
                        "count": len(unresolved_blocking),
                    }
                )
                continue
            if accepted_blocking and not body.include_accepted_blocking:
                exclusions.append(
                    {
                        "countryId": country.id,
                        "country": country.name,
                        "reason": "ACCEPTED_BLOCKING_NOT_SELECTED",
                        "count": len(accepted_blocking),
                    }
                )
                continue
            if body.only_compliant and country.status != CountryStatus.COMPLIANT.value:
                exclusions.append(
                    {
                        "countryId": country.id,
                        "country": country.name,
                        "reason": "NOT_STRICTLY_COMPLIANT",
                    }
                )
                continue
            if (
                not body.include_warnings
                and country.status == CountryStatus.COMPLIANT_WITH_WARNINGS.value
            ):
                exclusions.append(
                    {
                        "countryId": country.id,
                        "country": country.name,
                        "reason": "WARNINGS_NOT_SELECTED",
                    }
                )
                continue
            sources.append(
                ConsolidationSource(
                    country_id=country.id,
                    country_name=country.name,
                    country_code=country.code,
                    file_version_id=version.id,
                    original_filename=version.original_filename,
                    path=get_storage().resolve(version.stored_key),
                )
            )

        job.progress = 25
        db.commit()
        data, report, filename = OpenpyxlWorkbookConsolidator().consolidate(sources)
        job.progress = 85
        key = get_storage().put_bytes(
            principal.organization.id, "consolidations", "xlsx", data
        )
        output = report["output"]
        workbook = ConsolidatedWorkbook(
            consolidation_job_id=job.id,
            stored_key=key,
            filename=filename,
            sha256=output["sha256"],
            size_bytes=output["sizeBytes"],
        )
        db.add(workbook)
        job.report = {**report, "countriesExcluded": exclusions}
        job.status = JobStatus.COMPLETED.value
        job.progress = 100
        job.completed_at = utcnow()
        record_audit(
            db,
            principal,
            "CONSOLIDATION_COMPLETED",
            "ConsolidationJob",
            job.id,
            {
                "countriesIncluded": len(sources),
                "countriesExcluded": len(exclusions),
                "sha256": output["sha256"],
            },
        )
        db.commit()
    except Exception as exc:
        domain_error = exc if isinstance(exc, DomainError) else None
        db.rollback()
        job = db.get(ConsolidationJob, job.id)
        if job is not None:
            job.status = JobStatus.FAILED.value
            job.progress = 100
            job.completed_at = utcnow()
            job.error_message = (
                exc.message if isinstance(exc, DomainError) else "The consolidation could not be completed"
            )
            job.report = {"countriesExcluded": exclusions}
            db.commit()
        if domain_error is not None:
            raise domain_error
    return owned_consolidation(db, principal, job.id)


@router.get("", response_model=list[ConsolidationJobOut])
def list_consolidations(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> list[ConsolidationJob]:
    return list(
        db.scalars(
            select(ConsolidationJob)
            .where(ConsolidationJob.organization_id == principal.organization.id)
            .options(selectinload(ConsolidationJob.workbook))
            .order_by(ConsolidationJob.created_at.desc())
        )
    )


@router.get("/{job_id}", response_model=ConsolidationJobOut)
def get_consolidation(
    job_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> ConsolidationJob:
    return owned_consolidation(db, principal, job_id)


@router.get("/{job_id}/download", response_class=FileResponse)
def download_consolidation(
    job_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> FileResponse:
    job = owned_consolidation(db, principal, job_id)
    if job.status != JobStatus.COMPLETED.value or job.workbook is None:
        raise DomainError(
            "CONSOLIDATION_NOT_READY",
            "The consolidated workbook is not ready for download",
            status_code=409,
        )
    path = get_storage().resolve(job.workbook.stored_key)
    record_audit(
        db,
        principal,
        "CONSOLIDATION_DOWNLOADED",
        "ConsolidatedWorkbook",
        job.workbook.id,
        {"jobId": job.id},
    )
    db.commit()
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=job.workbook.filename,
    )
