from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ...audit import record_audit
from ...config import Settings, get_settings
from ...database import get_db
from ...dependencies import Principal, get_principal
from ...errors import DomainError
from ...models import (
    AnalysisJob,
    Anomaly,
    Country,
    CountryFile,
    CountryFileVersion,
    CountryStatus,
    ExtractedTable,
    JobStatus,
    Template,
)
from ...schemas import (
    AnalysisDetail,
    AnalysisJobOut,
    AnomalyOut,
    CountryCreate,
    CountryFileOut,
    CountryOut,
)
from ...services.analysis import AnalysisRunner
from ...services.comparator import WorkbookStructureComparator
from ...services.runtime import (
    get_security_validator,
    get_storage,
    get_table_detector,
    get_workbook_reader,
    read_upload_limited,
)
from ..ownership import owned_analysis, owned_country, owned_country_file

router = APIRouter(tags=["countries"])


def _country_payload(db: Session, country: Country) -> dict[str, Any]:
    template = db.get(Template, country.template_id)
    current_file = country.files[0] if country.files else None
    current_version = (
        max(current_file.versions, key=lambda item: item.version)
        if current_file and current_file.versions
        else None
    )
    anomalies: list[Anomaly] = []
    if current_version and current_version.analysis_jobs:
        latest_job = max(current_version.analysis_jobs, key=lambda item: item.created_at)
        anomalies = list(
            db.scalars(select(Anomaly).where(Anomaly.analysis_job_id == latest_job.id))
        )
    return {
        "id": country.id,
        "name": country.name,
        "code": country.code,
        "templateId": country.template_id,
        "templateName": template.name if template else None,
        "status": country.status,
        "currentFile": (
            CountryFileOut.model_validate(current_file).model_dump(mode="json", by_alias=True)
            if current_file and current_version
            else None
        ),
        "currentVersion": current_version.version if current_version else None,
        "lastImportedAt": current_version.imported_at if current_version else None,
        "anomalyCount": len(anomalies),
        "blockingCount": sum(item.severity == "BLOCKING" for item in anomalies),
        "createdAt": country.created_at,
        "updatedAt": country.updated_at,
    }


@router.post("/countries", response_model=CountryOut, status_code=status.HTTP_201_CREATED)
def create_country(
    body: CountryCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> dict[str, Any]:
    template = db.scalar(
        select(Template).where(
            Template.id == body.template_id,
            Template.organization_id == principal.organization.id,
        )
    )
    if template is None:
        raise DomainError("TEMPLATE_NOT_FOUND", "Template not found", status_code=404)
    duplicate = db.scalar(
        select(Country).where(
            Country.organization_id == principal.organization.id,
            Country.name == body.name.strip(),
        )
    )
    if duplicate is not None:
        raise DomainError(
            "COUNTRY_NAME_EXISTS",
            "A country with this name already exists in the organization",
            status_code=409,
        )
    country = Country(
        organization_id=principal.organization.id,
        name=body.name.strip(),
        code=body.code.strip().upper() if body.code else None,
        template_id=template.id,
        created_by_id=principal.user.id,
    )
    db.add(country)
    db.flush()
    record_audit(db, principal, "COUNTRY_CREATED", "Country", country.id)
    db.commit()
    return _country_payload(db, owned_country(db, principal, country.id))


@router.get("/countries", response_model=list[CountryOut])
def list_countries(
    db: Session = Depends(get_db), principal: Principal = Depends(get_principal)
) -> list[dict[str, Any]]:
    countries = list(
        db.scalars(
            select(Country)
            .where(Country.organization_id == principal.organization.id)
            .options(
                selectinload(Country.files)
                .selectinload(CountryFile.versions)
                .selectinload(CountryFileVersion.analysis_jobs)
            )
            .order_by(Country.name)
        )
    )
    return [_country_payload(db, country) for country in countries]


@router.get("/countries/{country_id}", response_model=CountryOut)
def get_country(
    country_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> dict[str, Any]:
    return _country_payload(db, owned_country(db, principal, country_id))


@router.get("/countries/{country_id}/files", response_model=list[CountryFileOut])
def list_country_files(
    country_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> list[CountryFile]:
    return owned_country(db, principal, country_id).files


@router.post(
    "/countries/{country_id}/files",
    response_model=CountryFileOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_country_file(
    country_id: str,
    file: Annotated[UploadFile, File(...)],
    auto_analyze: Annotated[bool | None, Form(alias="autoAnalyze")] = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
    settings: Settings = Depends(get_settings),
) -> CountryFile:
    country = owned_country(db, principal, country_id)
    filename = file.filename or "workbook.xlsx"
    data = await read_upload_limited(file, settings)
    security = get_security_validator().validate(filename, data)
    storage = get_storage()
    key = storage.put_bytes(principal.organization.id, "country-files", "xlsx", data)
    try:
        metadata = get_workbook_reader().inspect_workbook(storage.resolve(key))
    except Exception:
        storage.delete(key)
        raise
    metadata["security"] = {
        "zipEntries": security.zip_entries,
        "uncompressedBytes": security.uncompressed_bytes,
        "warnings": security.warnings,
    }
    if country.files:
        country_file = min(country.files, key=lambda item: item.created_at)
    else:
        country_file = CountryFile(country_id=country.id)
        db.add(country_file)
        db.flush()
    next_version = country_file.latest_version + 1
    version = CountryFileVersion(
        country_file_id=country_file.id,
        version=next_version,
        original_filename=filename[:255],
        stored_key=key,
        sha256=security.sha256,
        size_bytes=security.size_bytes,
        status=CountryStatus.IMPORTED.value,
        workbook_metadata=metadata,
        imported_by_id=principal.user.id,
    )
    db.add(version)
    db.flush()
    country_file.latest_version = next_version
    country.status = CountryStatus.IMPORTED.value
    record_audit(
        db,
        principal,
        "COUNTRY_FILE_IMPORTED",
        "CountryFileVersion",
        version.id,
        {
            "countryId": country.id,
            "countryFileId": country_file.id,
            "version": next_version,
            "sha256": security.sha256,
        },
    )
    db.commit()
    db.refresh(country_file)
    should_analyze = settings.analysis_auto_run if auto_analyze is None else auto_analyze
    if should_analyze:
        runner = AnalysisRunner(
            storage,
            WorkbookStructureComparator(get_table_detector()),
        )
        # Ensure the relationship includes the just-created version.
        country_file = owned_country_file(db, principal, country_file.id)
        runner.run(db, principal, country_file)
        country_file = owned_country_file(db, principal, country_file.id)
    return country_file


@router.get("/country-files/{file_id}", response_model=CountryFileOut)
def get_country_file(
    file_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> CountryFile:
    return owned_country_file(db, principal, file_id)


@router.post("/country-files/{file_id}/analyze", response_model=AnalysisJobOut)
def analyze_country_file(
    file_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> AnalysisJob:
    country_file = owned_country_file(db, principal, file_id)
    runner = AnalysisRunner(
        get_storage(), WorkbookStructureComparator(get_table_detector())
    )
    target_version_id = next(
        (version.id for version in country_file.versions if version.id == file_id), None
    )
    return runner.run(db, principal, country_file, target_version_id)


def _latest_job(country_file: CountryFile, requested_id: str | None = None) -> AnalysisJob:
    version = next(
        (item for item in country_file.versions if item.id == requested_id), None
    ) or max(country_file.versions, key=lambda item: item.version)
    if not version.analysis_jobs:
        raise DomainError("ANALYSIS_NOT_FOUND", "No analysis exists for this file", status_code=404)
    return max(version.analysis_jobs, key=lambda item: item.created_at)


@router.get("/country-files/{file_id}/analysis", response_model=AnalysisDetail)
def get_file_analysis(
    file_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> dict[str, Any]:
    job = _latest_job(owned_country_file(db, principal, file_id), file_id)
    anomalies = list(
        db.scalars(select(Anomaly).where(Anomaly.analysis_job_id == job.id).order_by(Anomaly.created_at))
    )
    extracted = list(
        db.scalars(
            select(ExtractedTable).where(ExtractedTable.analysis_job_id == job.id)
        )
    )
    return {"job": job, "anomalies": anomalies, "extractedTables": extracted}


@router.get("/analysis-jobs/{job_id}", response_model=AnalysisJobOut)
def get_analysis_job(
    job_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> AnalysisJob:
    return owned_analysis(db, principal, job_id)


@router.get("/country-files/{file_id}/anomalies", response_model=list[AnomalyOut])
def get_file_anomalies(
    file_id: str,
    category: str | None = None,
    severity: str | None = None,
    anomaly_status: str | None = Query(default=None, alias="status"),
    sheet: str | None = None,
    table: str | None = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> list[Anomaly]:
    job = _latest_job(owned_country_file(db, principal, file_id), file_id)
    query = select(Anomaly).where(Anomaly.analysis_job_id == job.id)
    if category:
        query = query.where(Anomaly.category == category)
    if severity:
        query = query.where(Anomaly.severity == severity)
    if anomaly_status:
        query = query.where(Anomaly.status == anomaly_status)
    if sheet:
        query = query.where(Anomaly.sheet_name == sheet)
    if table:
        query = query.where(Anomaly.table_name == table)
    return list(db.scalars(query.order_by(Anomaly.created_at)))
