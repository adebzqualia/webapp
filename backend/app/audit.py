from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .dependencies import Principal
from .models import AuditLog


def record_audit(
    db: Session,
    principal: Principal,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            organization_id=principal.organization.id,
            user_id=principal.user.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
        )
    )
