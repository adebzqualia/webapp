from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import AnomalySeverity, AnomalyStatus, StructureMode, TableStatus


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        use_enum_values=True,
    )


class HealthResponse(ApiModel):
    status: str
    version: str
    database: str


class ColumnDefinitionInput(ApiModel):
    excel_column: str
    name: str
    data_type: str = "unknown"
    role: Literal["KEY", "VALUE", "CALCULATED", "LABEL", "IGNORE"] = "VALUE"
    ordinal: int = Field(ge=0)
    required: bool = True

    @field_validator("excel_column")
    @classmethod
    def valid_excel_column(cls, value: str) -> str:
        value = value.upper().strip()
        if not re.fullmatch(r"[A-Z]{1,3}", value):
            raise ValueError("Invalid Excel column")
        return value


class TableDefinitionCreate(ApiModel):
    sheet_id: str
    name: str = Field(min_length=1, max_length=255)
    range_ref: str
    header_rows: list[int] = Field(min_length=1)
    data_start_row: int = Field(ge=1)
    data_end_row: int | None = Field(default=None, ge=1)
    data_end_rule: dict[str, Any] | None = None
    key_columns: list[str] = Field(default_factory=list)
    value_columns: list[str] = Field(default_factory=list)
    total_rows: list[int] = Field(default_factory=list)
    computed_columns: list[str] = Field(default_factory=list)
    structure_mode: StructureMode = StructureMode.STRICT
    required: bool = True
    variable_rows: list[int] = Field(default_factory=list)
    variable_columns: list[str] = Field(default_factory=list)
    ignored_rows: list[int] = Field(default_factory=list)
    ignored_columns: list[str] = Field(default_factory=list)
    required_cells: list[dict[str, Any]] = Field(default_factory=list)
    required_formulas: list[dict[str, Any]] = Field(default_factory=list)
    tolerate_blank_rows_columns: bool = False
    orientation: Literal["ROWS", "COLUMNS"] = "ROWS"
    columns: list[ColumnDefinitionInput] = Field(default_factory=list)

    @field_validator("range_ref")
    @classmethod
    def valid_range(cls, value: str) -> str:
        value = value.upper().replace("$", "").strip()
        if not re.fullmatch(r"[A-Z]{1,3}[1-9][0-9]*:[A-Z]{1,3}[1-9][0-9]*", value):
            raise ValueError("rangeRef must be a rectangular Excel range such as B7:H24")
        return value

    @field_validator("key_columns", "value_columns", "computed_columns", "variable_columns", "ignored_columns")
    @classmethod
    def normalize_columns(cls, values: list[str]) -> list[str]:
        result = [value.strip().upper() for value in values]
        if any(not re.fullmatch(r"[A-Z]{1,3}", value) for value in result):
            raise ValueError("Invalid Excel column")
        return list(dict.fromkeys(result))

    @model_validator(mode="after")
    def validate_rows(self) -> TableDefinitionCreate:
        if self.data_end_row is None and not self.data_end_rule:
            raise ValueError("dataEndRow or dataEndRule is required")
        if self.data_end_row is not None and self.data_end_row < self.data_start_row:
            raise ValueError("dataEndRow must be at or after dataStartRow")
        if max(self.header_rows) >= self.data_start_row:
            raise ValueError("headerRows must precede dataStartRow")
        return self


class TableDefinitionUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    range_ref: str | None = None
    header_rows: list[int] | None = None
    data_start_row: int | None = Field(default=None, ge=1)
    data_end_row: int | None = Field(default=None, ge=1)
    data_end_rule: dict[str, Any] | None = None
    key_columns: list[str] | None = None
    value_columns: list[str] | None = None
    total_rows: list[int] | None = None
    computed_columns: list[str] | None = None
    structure_mode: StructureMode | None = None
    required: bool | None = None
    variable_rows: list[int] | None = None
    variable_columns: list[str] | None = None
    ignored_rows: list[int] | None = None
    ignored_columns: list[str] | None = None
    required_cells: list[dict[str, Any]] | None = None
    required_formulas: list[dict[str, Any]] | None = None
    tolerate_blank_rows_columns: bool | None = None
    orientation: Literal["ROWS", "COLUMNS"] | None = None
    columns: list[ColumnDefinitionInput] | None = None

    @field_validator("range_ref")
    @classmethod
    def valid_range(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return TableDefinitionCreate.valid_range(value)


class TableColumnOut(ApiModel):
    id: str
    excel_column: str
    name: str
    normalized_name: str
    data_type: str
    role: str
    ordinal: int
    required: bool


class TableDefinitionOut(ApiModel):
    id: str
    sheet_definition_id: str
    name: str
    range_ref: str
    header_rows: list[int]
    data_start_row: int
    data_end_row: int | None
    data_end_rule: dict[str, Any] | None
    key_columns: list[str]
    value_columns: list[str]
    total_rows: list[int]
    computed_columns: list[str]
    structure_mode: str
    required: bool
    variable_rows: list[int]
    variable_columns: list[str]
    ignored_rows: list[int]
    ignored_columns: list[str]
    required_cells: list[dict[str, Any]]
    required_formulas: list[dict[str, Any]]
    tolerate_blank_rows_columns: bool
    orientation: str
    status: str
    signature: dict[str, Any]
    columns: list[TableColumnOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class SheetOut(ApiModel):
    id: str
    name: str
    original_index: int
    visibility: str
    max_row: int
    max_column: int
    ignored: bool
    mapping_status: str
    merged_ranges: list[str]
    formula_cells: list[dict[str, Any]]
    native_tables: list[dict[str, Any]]
    named_ranges: list[dict[str, Any]]
    tables: list[TableDefinitionOut] = Field(default_factory=list)


class TemplateVersionOut(ApiModel):
    id: str
    version: int
    mapping_version: int
    original_filename: str
    sha256: str
    size_bytes: int
    sheet_count: int
    status: str
    workbook_metadata: dict[str, Any]
    imported_at: datetime
    sheets: list[SheetOut] = Field(default_factory=list)


class TemplateOut(ApiModel):
    id: str
    name: str
    latest_version: int
    created_at: datetime
    updated_at: datetime
    versions: list[TemplateVersionOut] = Field(default_factory=list)


class TemplateSummary(ApiModel):
    id: str
    name: str
    latest_version: int
    original_filename: str | None = None
    sha256: str | None = None
    sheet_count: int = 0
    configured_sheets: int = 0
    table_count: int = 0
    status: str = "IMPORTED"
    imported_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class MappingProgress(ApiModel):
    detected_sheets: int
    configured_sheets: int
    remaining_sheets: int
    validated_tables: int
    percent: int


class SheetIgnoreInput(ApiModel):
    ignored: bool = True


class GridCell(ApiModel):
    coordinate: str
    row: int
    column: int
    value: Any | None = None
    formula: str | None = None
    data_type: str | None = None
    number_format: str | None = None
    style: dict[str, Any] = Field(default_factory=dict)
    merged_range: str | None = None


class SheetGrid(ApiModel):
    sheet_id: str
    sheet_name: str
    range_ref: str
    min_row: int
    max_row: int
    min_column: int
    max_column: int
    cells: list[GridCell]
    merged_ranges: list[str]


class CandidatePreview(ApiModel):
    headers: list[str]
    rows: list[list[Any]]


class TableCandidate(ApiModel):
    id: str
    sheet_id: str
    sheet_name: str
    range_ref: str
    confidence: float
    reasons: list[str]
    source: str
    preview: CandidatePreview


class DetectTablesInput(ApiModel):
    sheet_id: str | None = None
    minimum_confidence: float = Field(default=0.35, ge=0, le=1)


class StructuredPreview(ApiModel):
    sheet_name: str
    range_ref: str
    headers: list[str]
    estimated_types: list[str]
    rows: list[dict[str, Any]]
    coordinates: list[list[str]]
    formula_cells: list[dict[str, Any]]
    empty_cells: list[str]
    duplicate_keys: list[dict[str, Any]]
    detected_total_rows: list[int]


class PreviewInput(ApiModel):
    sheet_id: str
    range_ref: str
    header_rows: list[int]
    data_start_row: int
    data_end_row: int | None = None
    key_columns: list[str] = Field(default_factory=list)


class CountryCreate(ApiModel):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=30)
    template_id: str


class CountryOut(ApiModel):
    id: str
    name: str
    code: str | None
    template_id: str
    status: str
    template_name: str | None = None
    current_file: dict[str, Any] | None = None
    current_version: int | None = None
    last_imported_at: datetime | None = None
    anomaly_count: int = 0
    blocking_count: int = 0
    created_at: datetime
    updated_at: datetime


class CountryFileVersionOut(ApiModel):
    id: str
    country_file_id: str
    version: int
    original_filename: str
    sha256: str
    size_bytes: int
    status: str
    workbook_metadata: dict[str, Any]
    imported_at: datetime


class CountryFileOut(ApiModel):
    id: str
    country_id: str
    latest_version: int
    version: int
    status: str
    original_filename: str
    sha256: str
    size_bytes: int
    imported_at: datetime
    current_version: CountryFileVersionOut
    created_at: datetime
    versions: list[CountryFileVersionOut] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def add_current_version(cls, value: Any) -> Any:
        if isinstance(value, dict):
            return value
        versions = list(getattr(value, "versions", []))
        if not versions:
            return value
        current = max(versions, key=lambda item: item.version)
        return {
            "id": value.id,
            "country_id": value.country_id,
            "latest_version": value.latest_version,
            "version": current.version,
            "status": current.status,
            "original_filename": current.original_filename,
            "sha256": current.sha256,
            "size_bytes": current.size_bytes,
            "imported_at": current.imported_at,
            "current_version": current,
            "created_at": value.created_at,
            "versions": versions,
        }


class AnalysisJobOut(ApiModel):
    id: str
    file_version_id: str
    status: str
    progress: int
    report: dict[str, Any]
    error_log: list[dict[str, Any]]
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class ExtractedTableOut(ApiModel):
    id: str
    country_id: str
    table_definition_id: str
    sheet_name: str
    table_name: str
    source_range: str
    headers: list[str]
    rows: list[dict[str, Any]]
    cell_coordinates: list[list[str]]
    formulas: list[dict[str, Any]]
    warnings: list[str]


class AnomalyOut(ApiModel):
    id: str
    analysis_job_id: str
    country_id: str
    file_version_id: str
    sheet_name: str | None
    table_definition_id: str | None
    table_name: str | None
    category: str
    severity: str
    description: str
    expected: Any | None
    actual: Any | None
    expected_coordinates: str | None
    actual_coordinates: str | None
    suggestion: str | None
    status: str
    confidence: float | None
    match_reasons: list[str]
    candidates: list[dict[str, Any]]
    expected_preview: dict[str, Any] | None
    actual_preview: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class AnomalyPatch(ApiModel):
    status: AnomalyStatus
    comment: str | None = Field(default=None, max_length=2_000)


class AnalysisDetail(ApiModel):
    job: AnalysisJobOut
    anomalies: list[AnomalyOut]
    extracted_tables: list[ExtractedTableOut]


class AnomalyDashboard(ApiModel):
    countries: int
    compliant_countries: int
    warning_countries: int
    non_compliant_countries: int
    total_anomalies: int
    blocking_anomalies: int
    by_severity: dict[str, int]
    by_status: dict[str, int]


class ConsolidationCreate(ApiModel):
    country_ids: list[str] = Field(default_factory=list)
    latest_versions_only: bool = True
    only_compliant: bool = False
    include_warnings: bool = True
    include_accepted_blocking: bool = False


class ConsolidatedWorkbookOut(ApiModel):
    id: str
    filename: str
    sha256: str
    size_bytes: int
    created_at: datetime


class ConsolidationJobOut(ApiModel):
    id: str
    status: str
    progress: int
    request_options: dict[str, Any]
    report: dict[str, Any]
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    workbook: ConsolidatedWorkbookOut | None = None


class MappingExport(ApiModel):
    template_id: str
    template_version: int
    mapping_version: int
    workbook_hash: str
    sheets: list[dict[str, Any]]


class ErrorBody(ApiModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
