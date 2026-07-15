from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol


class WorkbookReader(Protocol):
    def inspect_workbook(self, file_path: Path) -> dict[str, Any]: ...

    def get_grid(
        self, file_path: Path, sheet_name: str, range_ref: str | None = None
    ) -> dict[str, Any]: ...


class TableDetector(Protocol):
    def detect_candidates(
        self, file_path: Path, sheet_names: list[str] | None = None
    ) -> list[dict[str, Any]]: ...


class StructureComparator(Protocol):
    def compare(self, *args: Any, **kwargs: Any) -> dict[str, Any]: ...


class WorkbookConsolidator(Protocol):
    def consolidate(self, *args: Any, **kwargs: Any) -> dict[str, Any]: ...
