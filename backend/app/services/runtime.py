from __future__ import annotations

from functools import lru_cache

from fastapi import UploadFile

from ..config import Settings, get_settings
from ..errors import DomainError
from ..storage import LocalFileStorage
from .excel_reader import OpenpyxlWorkbookReader
from .file_security import XlsxSecurityValidator
from .table_detector import HeuristicTableDetector


@lru_cache
def get_storage() -> LocalFileStorage:
    return LocalFileStorage(get_settings().storage_root)


@lru_cache
def get_workbook_reader() -> OpenpyxlWorkbookReader:
    return OpenpyxlWorkbookReader(get_settings().max_grid_cells)


@lru_cache
def get_security_validator() -> XlsxSecurityValidator:
    return XlsxSecurityValidator(get_settings())


@lru_cache
def get_table_detector() -> HeuristicTableDetector:
    return HeuristicTableDetector()


async def read_upload_limited(upload: UploadFile, settings: Settings | None = None) -> bytes:
    settings = settings or get_settings()
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(min(1024 * 1024, settings.max_upload_bytes + 1))
        if not chunk:
            break
        total += len(chunk)
        if total > settings.max_upload_bytes:
            raise DomainError(
                "FILE_TOO_LARGE",
                "The uploaded file exceeds the configured size limit",
                status_code=413,
                details={"maximumBytes": settings.max_upload_bytes},
            )
        chunks.append(chunk)
    return b"".join(chunks)
