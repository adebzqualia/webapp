from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..audit import record_audit
from ..dependencies import Principal
from ..models import (
    AnalysisJob,
    Anomaly,
    Country,
    CountryFile,
    CountryStatus,
    ExtractedTable,
    JobStatus,
    SheetDefinition,
    TableDefinition,
    Template,
    TemplateVersion,
)
from ..storage.base import FileStorage
from .comparator import WorkbookStructureComparator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AnalysisRunner:
    def __init__(
        self,
        storage: FileStorage,
        comparator: WorkbookStructureComparator | None = None,
    ) -> None:
        self.storage = storage
        self.comparator = comparator or WorkbookStructureComparator()

    def run(
        self,
        db: Session,
        principal: Principal,
        country_file: CountryFile,
        target_version_id: str | None = None,
    ) -> AnalysisJob:
        if target_version_id is None:
            file_version = max(country_file.versions, key=lambda item: item.version)
        else:
            file_version = next(
                (item for item in country_file.versions if item.id == target_version_id),
                None,
            )
            if file_version is None:
                raise ValueError("Requested file version does not belong to this country file")
        country = country_file.country
        job = AnalysisJob(
            organization_id=principal.organization.id,
            file_version_id=file_version.id,
            status=JobStatus.PENDING.value,
            progress=0,
            requested_by_id=principal.user.id,
        )
        db.add(job)
        db.flush()
        record_audit(
            db,
            principal,
            "COUNTRY_FILE_ANALYSIS_REQUESTED",
            "AnalysisJob",
            job.id,
            {"countryFileId": country_file.id, "fileVersionId": file_version.id},
        )
        db.commit()
        job.status = JobStatus.RUNNING.value
        job.progress = 10
        job.started_at = utcnow()
        country.status = CountryStatus.ANALYZING.value
        file_version.status = CountryStatus.ANALYZING.value
        db.commit()
        try:
            template = db.scalar(
                select(Template)
                .where(
                    Template.id == country.template_id,
                    Template.organization_id == principal.organization.id,
                )
                .options(
                    selectinload(Template.versions)
                    .selectinload(TemplateVersion.sheets)
                    .selectinload(SheetDefinition.tables)
                    .selectinload(TableDefinition.columns)
                )
            )
            if template is None or not template.versions:
                raise RuntimeError("Associated template version not found")
            template_version = max(template.versions, key=lambda item: item.version)
            result = self.comparator.compare(
                template_version,
                self.storage.resolve(file_version.stored_key),
                file_version.workbook_metadata,
            )
            job.progress = 75
            db.flush()
            for item in result["anomalies"]:
                db.add(
                    Anomaly(
                        organization_id=principal.organization.id,
                        analysis_job_id=job.id,
                        country_id=country.id,
                        file_version_id=file_version.id,
                        sheet_name=item.get("sheetName"),
                        table_definition_id=item.get("tableDefinitionId"),
                        table_name=item.get("tableName"),
                        category=item["category"],
                        severity=item["severity"],
                        description=item["description"],
                        expected=item.get("expected"),
                        actual=item.get("actual"),
                        expected_coordinates=item.get("expectedCoordinates"),
                        actual_coordinates=item.get("actualCoordinates"),
                        suggestion=item.get("suggestion"),
                        confidence=item.get("confidence"),
                        match_reasons=item.get("matchReasons", []),
                        candidates=item.get("candidates", []),
                        expected_preview=item.get("expectedPreview"),
                        actual_preview=item.get("actualPreview"),
                    )
                )
            for item in result["extractedTables"]:
                db.add(
                    ExtractedTable(
                        analysis_job_id=job.id,
                        country_id=country.id,
                        table_definition_id=item["tableDefinitionId"],
                        sheet_name=item["sheetName"],
                        table_name=item["tableName"],
                        source_range=item["sourceRange"],
                        headers=item["headers"],
                        rows=item["rows"],
                        cell_coordinates=item["cellCoordinates"],
                        formulas=item["formulas"],
                        warnings=item["warnings"],
                    )
                )
            summary = result["summary"]
            job.report = {
                **summary,
                "templateId": template.id,
                "templateVersion": template_version.version,
                "mappingVersion": template_version.mapping_version,
                "countryId": country.id,
                "fileVersion": file_version.version,
            }
            if summary["blockingCount"] or summary["errorCount"]:
                final_status = CountryStatus.NON_COMPLIANT.value
            elif summary["warningCount"]:
                final_status = CountryStatus.COMPLIANT_WITH_WARNINGS.value
            else:
                final_status = CountryStatus.COMPLIANT.value
            country.status = final_status
            file_version.status = final_status
            job.status = JobStatus.COMPLETED.value
            job.progress = 100
            job.completed_at = utcnow()
            record_audit(
                db,
                principal,
                "COUNTRY_FILE_ANALYZED",
                "AnalysisJob",
                job.id,
                {"status": final_status, **summary},
            )
            db.commit()
        except Exception as exc:
            job_id = job.id
            country_id = country.id
            file_version_id = file_version.id
            db.rollback()
            job = db.get(AnalysisJob, job_id)
            country = db.get(Country, country_id)
            from ..models import CountryFileVersion

            file_version = db.get(CountryFileVersion, file_version_id)
            if job is not None:
                job.status = JobStatus.FAILED.value
                job.progress = 100
                job.completed_at = utcnow()
                job.error_log = [
                    {
                        "code": "ANALYSIS_FAILED",
                        "message": "The structural analysis could not be completed",
                        "errorType": type(exc).__name__,
                    }
                ]
            if country is not None:
                country.status = CountryStatus.READ_ERROR.value
            if file_version is not None:
                file_version.status = CountryStatus.READ_ERROR.value
            db.commit()
        return job
