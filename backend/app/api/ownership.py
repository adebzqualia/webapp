from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..dependencies import Principal
from ..errors import DomainError
from ..models import (
    AnalysisJob,
    ConsolidationJob,
    Country,
    CountryFile,
    CountryFileVersion,
    SheetDefinition,
    TableDefinition,
    Template,
    TemplateVersion,
)


def owned_template(db: Session, principal: Principal, template_id: str) -> Template:
    item = db.scalar(
        select(Template)
        .where(
            Template.id == template_id,
            Template.organization_id == principal.organization.id,
        )
        .options(
            selectinload(Template.versions)
            .selectinload(TemplateVersion.sheets)
            .selectinload(SheetDefinition.tables)
            .selectinload(TableDefinition.columns)
        )
    )
    if item is None:
        raise DomainError("TEMPLATE_NOT_FOUND", "Template not found", status_code=404)
    return item


def owned_country(db: Session, principal: Principal, country_id: str) -> Country:
    item = db.scalar(
        select(Country)
        .where(
            Country.id == country_id,
            Country.organization_id == principal.organization.id,
        )
        .options(selectinload(Country.files).selectinload(CountryFile.versions))
    )
    if item is None:
        raise DomainError("COUNTRY_NOT_FOUND", "Country not found", status_code=404)
    return item


def owned_country_file(db: Session, principal: Principal, file_id: str) -> CountryFile:
    item = db.scalar(
        select(CountryFile)
        .join(Country)
        .where(
            CountryFile.id == file_id,
            Country.organization_id == principal.organization.id,
        )
        .options(
            selectinload(CountryFile.versions).selectinload(CountryFileVersion.analysis_jobs),
            selectinload(CountryFile.country),
        )
    )
    if item is None:
        item = db.scalar(
            select(CountryFile)
            .join(Country)
            .join(CountryFileVersion)
            .where(
                CountryFileVersion.id == file_id,
                Country.organization_id == principal.organization.id,
            )
            .options(
                selectinload(CountryFile.versions).selectinload(
                    CountryFileVersion.analysis_jobs
                ),
                selectinload(CountryFile.country),
            )
        )
    if item is None:
        raise DomainError("COUNTRY_FILE_NOT_FOUND", "Country file not found", status_code=404)
    return item


def owned_analysis(db: Session, principal: Principal, job_id: str) -> AnalysisJob:
    item = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.id == job_id,
            AnalysisJob.organization_id == principal.organization.id,
        )
    )
    if item is None:
        raise DomainError("ANALYSIS_NOT_FOUND", "Analysis not found", status_code=404)
    return item


def owned_consolidation(
    db: Session, principal: Principal, job_id: str
) -> ConsolidationJob:
    item = db.scalar(
        select(ConsolidationJob)
        .where(
            ConsolidationJob.id == job_id,
            ConsolidationJob.organization_id == principal.organization.id,
        )
        .options(selectinload(ConsolidationJob.workbook))
    )
    if item is None:
        raise DomainError("CONSOLIDATION_NOT_FOUND", "Consolidation not found", status_code=404)
    return item
