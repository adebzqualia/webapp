from __future__ import annotations

import hashlib
import io
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from ..config import Settings
from ..errors import DomainError


@dataclass(frozen=True)
class ValidatedWorkbook:
    sha256: str
    size_bytes: int
    zip_entries: int
    uncompressed_bytes: int
    warnings: list[str] = field(default_factory=list)


class XlsxSecurityValidator:
    REQUIRED_PARTS = {"[Content_Types].xml", "xl/workbook.xml"}

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def validate(self, filename: str, data: bytes) -> ValidatedWorkbook:
        if Path(filename).suffix.lower() != ".xlsx":
            raise DomainError(
                "UNSUPPORTED_FORMAT",
                "Only .xlsx workbooks are supported",
                status_code=415,
            )
        if not data:
            raise DomainError("EMPTY_FILE", "The uploaded file is empty")
        if len(data) > self.settings.max_upload_bytes:
            raise DomainError(
                "FILE_TOO_LARGE",
                "The uploaded file exceeds the configured size limit",
                status_code=413,
                details={"maximumBytes": self.settings.max_upload_bytes},
            )
        if not data.startswith(b"PK\x03\x04"):
            raise DomainError(
                "INVALID_FILE_SIGNATURE",
                "The file content is not a valid XLSX ZIP package",
                status_code=415,
            )

        warnings: list[str] = []
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                infos = archive.infolist()
                if len(infos) > self.settings.max_zip_entries:
                    raise DomainError(
                        "ZIP_BOMB_DETECTED",
                        "The workbook package contains too many entries",
                    )
                names = {info.filename for info in infos}
                missing = self.REQUIRED_PARTS - names
                if missing:
                    raise DomainError(
                        "INVALID_XLSX_PACKAGE",
                        "The ZIP package is not an XLSX workbook",
                        status_code=415,
                        details={"missingParts": sorted(missing)},
                    )

                total_compressed = 0
                total_uncompressed = 0
                for info in infos:
                    member_path = PurePosixPath(info.filename)
                    if member_path.is_absolute() or ".." in member_path.parts:
                        raise DomainError(
                            "MALICIOUS_ZIP_PATH",
                            "The workbook package contains an unsafe path",
                        )
                    if info.flag_bits & 0x1:
                        raise DomainError(
                            "ENCRYPTED_WORKBOOK_UNSUPPORTED",
                            "Encrypted XLSX packages are not supported",
                            status_code=415,
                        )
                    total_compressed += info.compress_size
                    total_uncompressed += info.file_size
                    ratio = info.file_size / max(1, info.compress_size)
                    if ratio > self.settings.max_zip_compression_ratio and info.file_size > 1_000_000:
                        raise DomainError(
                            "ZIP_BOMB_DETECTED",
                            "The workbook package has a suspicious compression ratio",
                        )

                if total_uncompressed > self.settings.max_zip_uncompressed_bytes:
                    raise DomainError(
                        "ZIP_BOMB_DETECTED",
                        "The uncompressed workbook exceeds the configured safety limit",
                        details={
                            "maximumUncompressedBytes": self.settings.max_zip_uncompressed_bytes
                        },
                    )
                aggregate_ratio = total_uncompressed / max(1, total_compressed)
                if aggregate_ratio > self.settings.max_zip_compression_ratio:
                    raise DomainError(
                        "ZIP_BOMB_DETECTED",
                        "The workbook package has a suspicious aggregate compression ratio",
                    )
                lower_names = {name.lower() for name in names}
                if any(name.endswith("vbaproject.bin") for name in lower_names):
                    raise DomainError(
                        "MACROS_NOT_ALLOWED",
                        "Macro-enabled workbook content is not accepted",
                        status_code=415,
                    )
                if any(name.startswith("xl/externallinks/") for name in lower_names):
                    warnings.append("External workbook links were detected and will never be followed")
                if any("activex" in name for name in lower_names):
                    warnings.append("ActiveX content was detected and will not be copied")
                if any(name.startswith("xl/embeddings/") for name in lower_names):
                    warnings.append("Embedded objects were detected and will not be copied")
        except DomainError:
            raise
        except (zipfile.BadZipFile, OSError, RuntimeError) as exc:
            raise DomainError(
                "FILE_CORRUPTED", "The workbook package is corrupted or unreadable", status_code=422
            ) from exc

        return ValidatedWorkbook(
            sha256=hashlib.sha256(data).hexdigest(),
            size_bytes=len(data),
            zip_entries=len(infos),
            uncompressed_bytes=total_uncompressed,
            warnings=warnings,
        )
