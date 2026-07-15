from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...audit import record_audit
from ...database import get_db
from ...dependencies import Principal, get_principal
from ...errors import DomainError
from ...models import (
    AnalysisJob,
    Anomaly,
    AnomalyDecision,
    AnomalySeverity,
    AnomalyStatus,
    Country,
    CountryFile,
    CountryFileVersion,
    CountryStatus,
)
from ...schemas import AnomalyDashboard, AnomalyOut, AnomalyPatch

router = APIRouter(tags=["anomalies"])


def _filtered_query(
    principal: Principal,
    *,
    country_id: str | None = None,
    sheet: str | None = None,
    table: str | None = None,
    category: str | None = None,
    severity: str | None = None,
    anomaly_status: str | None = None,
):
    query = select(Anomaly).where(
        Anomaly.organization_id == principal.organization.id
    )
    if country_id:
        query = query.where(Anomaly.country_id == country_id)
    if sheet:
        query = query.where(Anomaly.sheet_name == sheet)
    if table:
        query = query.where(Anomaly.table_name == table)
    if category:
        query = query.where(Anomaly.category == category)
    if severity:
        query = query.where(Anomaly.severity == severity)
    if anomaly_status:
        query = query.where(Anomaly.status == anomaly_status)
    return query


@router.get("/anomalies", response_model=list[AnomalyOut])
def list_anomalies(
    country_id: str | None = Query(default=None, alias="countryId"),
    sheet: str | None = None,
    table: str | None = None,
    category: str | None = None,
    severity: str | None = None,
    anomaly_status: str | None = Query(default=None, alias="status"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> list[Anomaly]:
    query = _filtered_query(
        principal,
        country_id=country_id,
        sheet=sheet,
        table=table,
        category=category,
        severity=severity,
        anomaly_status=anomaly_status,
    )
    return list(
        db.scalars(query.order_by(Anomaly.created_at.desc()).offset(offset).limit(limit))
    )


@router.get("/countries/{country_id}/anomalies", response_model=list[AnomalyOut])
def list_country_anomalies(
    country_id: str,
    category: str | None = None,
    severity: str | None = None,
    anomaly_status: str | None = Query(default=None, alias="status"),
    history: bool = Query(default=False),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> list[Anomaly]:
    country = db.scalar(
        select(Country).where(
            Country.id == country_id,
            Country.organization_id == principal.organization.id,
        )
    )
    if country is None:
        raise DomainError("COUNTRY_NOT_FOUND", "Country not found", status_code=404)
    query = _filtered_query(
        principal,
        country_id=country_id,
        category=category,
        severity=severity,
        anomaly_status=anomaly_status,
    )
    if not history:
        latest_job = db.scalar(
            select(AnalysisJob)
            .join(AnalysisJob.file_version)
            .join(CountryFileVersion.country_file)
            .where(CountryFile.country_id == country_id)
            .order_by(AnalysisJob.created_at.desc())
            .limit(1)
        )
        if latest_job is None:
            return []
        query = query.where(Anomaly.analysis_job_id == latest_job.id)
    return list(db.scalars(query.order_by(Anomaly.created_at.desc())))


@router.patch("/anomalies/{anomaly_id}", response_model=AnomalyOut)
def decide_anomaly(
    anomaly_id: str,
    body: AnomalyPatch,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> Anomaly:
    anomaly = db.scalar(
        select(Anomaly).where(
            Anomaly.id == anomaly_id,
            Anomaly.organization_id == principal.organization.id,
        )
    )
    if anomaly is None:
        raise DomainError("ANOMALY_NOT_FOUND", "Anomaly not found", status_code=404)
    previous = anomaly.status
    new_status = body.status.value if hasattr(body.status, "value") else body.status
    anomaly.status = new_status
    db.add(
        AnomalyDecision(
            anomaly_id=anomaly.id,
            previous_status=previous,
            decision=new_status,
            comment=body.comment,
            decided_by_id=principal.user.id,
        )
    )
    record_audit(
        db,
        principal,
        "ANOMALY_DECIDED",
        "Anomaly",
        anomaly.id,
        {"previousStatus": previous, "status": new_status, "comment": body.comment},
    )
    db.flush()
    _refresh_country_status(db, anomaly.country_id, anomaly.analysis_job_id)
    db.commit()
    return anomaly


def _refresh_country_status(db: Session, country_id: str, analysis_job_id: str) -> None:
    country = db.get(Country, country_id)
    if country is None:
        return
    anomalies = list(
        db.scalars(select(Anomaly).where(Anomaly.analysis_job_id == analysis_job_id))
    )
    active = [
        item
        for item in anomalies
        if item.status
        not in {
            AnomalyStatus.FALSE_POSITIVE.value,
            AnomalyStatus.FIXED.value,
            AnomalyStatus.ACCEPTED_EXCEPTION.value,
        }
    ]
    if any(item.severity in {"BLOCKING", "ERROR"} for item in active):
        country.status = CountryStatus.NON_COMPLIANT.value
    elif any(item.severity == "WARNING" for item in active):
        country.status = CountryStatus.COMPLIANT_WITH_WARNINGS.value
    else:
        country.status = CountryStatus.COMPLIANT.value


@router.get("/anomalies/dashboard", response_model=AnomalyDashboard)
def anomaly_dashboard(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
) -> dict:
    countries = list(
        db.scalars(
            select(Country).where(
                Country.organization_id == principal.organization.id
            )
        )
    )
    anomalies = list(
        db.scalars(
            select(Anomaly).where(
                Anomaly.organization_id == principal.organization.id,
                Anomaly.status.not_in(
                    [AnomalyStatus.FALSE_POSITIVE.value, AnomalyStatus.FIXED.value]
                ),
            )
        )
    )
    severity_counts = Counter(item.severity for item in anomalies)
    status_counts = Counter(item.status for item in anomalies)
    return {
        "countries": len(countries),
        "compliantCountries": sum(
            item.status == CountryStatus.COMPLIANT.value for item in countries
        ),
        "warningCountries": sum(
            item.status == CountryStatus.COMPLIANT_WITH_WARNINGS.value
            for item in countries
        ),
        "nonCompliantCountries": sum(
            item.status in {CountryStatus.NON_COMPLIANT.value, CountryStatus.READ_ERROR.value}
            for item in countries
        ),
        "totalAnomalies": len(anomalies),
        "blockingAnomalies": severity_counts[AnomalySeverity.BLOCKING.value],
        "bySeverity": dict(severity_counts),
        "byStatus": dict(status_counts),
    }
