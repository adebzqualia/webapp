from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def uuid4_str() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CountryStatus(str, enum.Enum):
    NO_FILE = "NO_FILE"
    IMPORTED = "IMPORTED"
    ANALYZING = "ANALYZING"
    COMPLIANT = "COMPLIANT"
    COMPLIANT_WITH_WARNINGS = "COMPLIANT_WITH_WARNINGS"
    NON_COMPLIANT = "NON_COMPLIANT"
    READ_ERROR = "READ_ERROR"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TableStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"


class StructureMode(str, enum.Enum):
    STRICT = "STRICT"
    SEMI_DYNAMIC = "SEMI_DYNAMIC"


class AnomalySeverity(str, enum.Enum):
    BLOCKING = "BLOCKING"
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class AnomalyStatus(str, enum.Enum):
    NEW = "NEW"
    CONFIRMED = "CONFIRMED"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    ACCEPTED_EXCEPTION = "ACCEPTED_EXCEPTION"
    FIXED = "FIXED"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("organization_id", "external_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(320))
    display_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Template(Base):
    __tablename__ = "templates"
    __table_args__ = (UniqueConstraint("organization_id", "name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    latest_version: Mapped[int] = mapped_column(Integer, default=0)
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    versions: Mapped[list[TemplateVersion]] = relationship(
        back_populates="template", cascade="all, delete-orphan", order_by="TemplateVersion.version"
    )


class TemplateVersion(Base):
    __tablename__ = "template_versions"
    __table_args__ = (UniqueConstraint("template_id", "version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    template_id: Mapped[str] = mapped_column(ForeignKey("templates.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    mapping_version: Mapped[int] = mapped_column(Integer, default=1)
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_key: Mapped[str] = mapped_column(String(700), unique=True)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    sheet_count: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), default="IMPORTED")
    workbook_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    imported_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    template: Mapped[Template] = relationship(back_populates="versions")
    sheets: Mapped[list[SheetDefinition]] = relationship(
        back_populates="template_version",
        cascade="all, delete-orphan",
        order_by="SheetDefinition.original_index",
    )


class SheetDefinition(Base):
    __tablename__ = "sheet_definitions"
    __table_args__ = (UniqueConstraint("template_version_id", "name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    template_version_id: Mapped[str] = mapped_column(ForeignKey("template_versions.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    original_index: Mapped[int] = mapped_column(Integer)
    visibility: Mapped[str] = mapped_column(String(30), default="visible")
    max_row: Mapped[int] = mapped_column(Integer, default=0)
    max_column: Mapped[int] = mapped_column(Integer, default=0)
    ignored: Mapped[bool] = mapped_column(Boolean, default=False)
    mapping_status: Mapped[str] = mapped_column(String(40), default="PENDING")
    merged_ranges: Mapped[list[str]] = mapped_column(JSON, default=list)
    formula_cells: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    native_tables: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    named_ranges: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    structural_signature: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    template_version: Mapped[TemplateVersion] = relationship(back_populates="sheets")
    tables: Mapped[list[TableDefinition]] = relationship(
        back_populates="sheet", cascade="all, delete-orphan"
    )


class TableDefinition(Base):
    __tablename__ = "table_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    sheet_definition_id: Mapped[str] = mapped_column(ForeignKey("sheet_definitions.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    range_ref: Mapped[str] = mapped_column(String(60))
    header_rows: Mapped[list[int]] = mapped_column(JSON, default=list)
    data_start_row: Mapped[int] = mapped_column(Integer)
    data_end_row: Mapped[int | None] = mapped_column(Integer)
    data_end_rule: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    key_columns: Mapped[list[str]] = mapped_column(JSON, default=list)
    value_columns: Mapped[list[str]] = mapped_column(JSON, default=list)
    total_rows: Mapped[list[int]] = mapped_column(JSON, default=list)
    computed_columns: Mapped[list[str]] = mapped_column(JSON, default=list)
    structure_mode: Mapped[str] = mapped_column(String(30), default=StructureMode.STRICT.value)
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    variable_rows: Mapped[list[int]] = mapped_column(JSON, default=list)
    variable_columns: Mapped[list[str]] = mapped_column(JSON, default=list)
    ignored_rows: Mapped[list[int]] = mapped_column(JSON, default=list)
    ignored_columns: Mapped[list[str]] = mapped_column(JSON, default=list)
    required_cells: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    required_formulas: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    tolerate_blank_rows_columns: Mapped[bool] = mapped_column(Boolean, default=False)
    orientation: Mapped[str] = mapped_column(String(20), default="ROWS")
    status: Mapped[str] = mapped_column(String(30), default=TableStatus.DRAFT.value)
    signature: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    sheet: Mapped[SheetDefinition] = relationship(back_populates="tables")
    columns: Mapped[list[TableColumnDefinition]] = relationship(
        back_populates="table", cascade="all, delete-orphan", order_by="TableColumnDefinition.ordinal"
    )


class TableColumnDefinition(Base):
    __tablename__ = "table_column_definitions"
    __table_args__ = (UniqueConstraint("table_definition_id", "excel_column"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    table_definition_id: Mapped[str] = mapped_column(ForeignKey("table_definitions.id"), index=True)
    excel_column: Mapped[str] = mapped_column(String(5))
    name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str] = mapped_column(String(255))
    data_type: Mapped[str] = mapped_column(String(40), default="unknown")
    role: Mapped[str] = mapped_column(String(30), default="VALUE")
    ordinal: Mapped[int] = mapped_column(Integer)
    required: Mapped[bool] = mapped_column(Boolean, default=True)

    table: Mapped[TableDefinition] = relationship(back_populates="columns")


class Country(Base):
    __tablename__ = "countries"
    __table_args__ = (UniqueConstraint("organization_id", "name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str | None] = mapped_column(String(30))
    template_id: Mapped[str] = mapped_column(ForeignKey("templates.id"), index=True)
    status: Mapped[str] = mapped_column(String(40), default=CountryStatus.NO_FILE.value)
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    files: Mapped[list[CountryFile]] = relationship(back_populates="country", cascade="all, delete-orphan")


class CountryFile(Base):
    __tablename__ = "country_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    country_id: Mapped[str] = mapped_column(ForeignKey("countries.id"), index=True)
    latest_version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    country: Mapped[Country] = relationship(back_populates="files")
    versions: Mapped[list[CountryFileVersion]] = relationship(
        back_populates="country_file", cascade="all, delete-orphan", order_by="CountryFileVersion.version"
    )


class CountryFileVersion(Base):
    __tablename__ = "country_file_versions"
    __table_args__ = (UniqueConstraint("country_file_id", "version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    country_file_id: Mapped[str] = mapped_column(ForeignKey("country_files.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_key: Mapped[str] = mapped_column(String(700), unique=True)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), default=CountryStatus.IMPORTED.value)
    workbook_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    imported_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    country_file: Mapped[CountryFile] = relationship(back_populates="versions")
    analysis_jobs: Mapped[list[AnalysisJob]] = relationship(back_populates="file_version")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    file_version_id: Mapped[str] = mapped_column(ForeignKey("country_file_versions.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default=JobStatus.PENDING.value)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    report: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    error_log: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    requested_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    file_version: Mapped[CountryFileVersion] = relationship(back_populates="analysis_jobs")
    anomalies: Mapped[list[Anomaly]] = relationship(back_populates="analysis_job", cascade="all, delete-orphan")
    extracted_tables: Mapped[list[ExtractedTable]] = relationship(back_populates="analysis_job", cascade="all, delete-orphan")


class Anomaly(Base):
    __tablename__ = "anomalies"
    __table_args__ = (
        Index("ix_anomalies_filters", "organization_id", "category", "severity", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    analysis_job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id"), index=True)
    country_id: Mapped[str] = mapped_column(ForeignKey("countries.id"), index=True)
    file_version_id: Mapped[str] = mapped_column(ForeignKey("country_file_versions.id"), index=True)
    sheet_name: Mapped[str | None] = mapped_column(String(255), index=True)
    table_definition_id: Mapped[str | None] = mapped_column(ForeignKey("table_definitions.id"), index=True)
    table_name: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(60), index=True)
    severity: Mapped[str] = mapped_column(String(30), index=True)
    description: Mapped[str] = mapped_column(Text)
    expected: Mapped[Any | None] = mapped_column(JSON)
    actual: Mapped[Any | None] = mapped_column(JSON)
    expected_coordinates: Mapped[str | None] = mapped_column(String(100))
    actual_coordinates: Mapped[str | None] = mapped_column(String(100))
    suggestion: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default=AnomalyStatus.NEW.value)
    confidence: Mapped[float | None] = mapped_column(Float)
    match_reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    candidates: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    expected_preview: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    actual_preview: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    analysis_job: Mapped[AnalysisJob] = relationship(back_populates="anomalies")
    decisions: Mapped[list[AnomalyDecision]] = relationship(back_populates="anomaly", cascade="all, delete-orphan")


class AnomalyDecision(Base):
    __tablename__ = "anomaly_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    anomaly_id: Mapped[str] = mapped_column(ForeignKey("anomalies.id"), index=True)
    previous_status: Mapped[str] = mapped_column(String(40))
    decision: Mapped[str] = mapped_column(String(40))
    comment: Mapped[str | None] = mapped_column(Text)
    decided_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    anomaly: Mapped[Anomaly] = relationship(back_populates="decisions")


class ExtractedTable(Base):
    __tablename__ = "extracted_tables"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    analysis_job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id"), index=True)
    country_id: Mapped[str] = mapped_column(ForeignKey("countries.id"), index=True)
    table_definition_id: Mapped[str] = mapped_column(ForeignKey("table_definitions.id"), index=True)
    sheet_name: Mapped[str] = mapped_column(String(255))
    table_name: Mapped[str] = mapped_column(String(255))
    source_range: Mapped[str] = mapped_column(String(100))
    headers: Mapped[list[str]] = mapped_column(JSON, default=list)
    rows: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    cell_coordinates: Mapped[list[list[str]]] = mapped_column(JSON, default=list)
    formulas: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list)

    analysis_job: Mapped[AnalysisJob] = relationship(back_populates="extracted_tables")


class ConsolidationJob(Base):
    __tablename__ = "consolidation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default=JobStatus.PENDING.value)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    request_options: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    report: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    requested_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    workbook: Mapped[ConsolidatedWorkbook | None] = relationship(
        back_populates="job", cascade="all, delete-orphan", uselist=False
    )


class ConsolidatedWorkbook(Base):
    __tablename__ = "consolidated_workbooks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    consolidation_job_id: Mapped[str] = mapped_column(
        ForeignKey("consolidation_jobs.id"), unique=True, index=True
    )
    stored_key: Mapped[str] = mapped_column(String(700), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    job: Mapped[ConsolidationJob] = relationship(back_populates="workbook")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_org_created", "organization_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(36))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
