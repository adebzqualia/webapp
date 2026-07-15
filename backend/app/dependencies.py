from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .database import get_db
from .errors import DomainError
from .models import Organization, User


@dataclass(frozen=True)
class Principal:
    organization: Organization
    user: User


def _clean_identity(value: str, label: str) -> str:
    value = value.strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._@+-]{0,199}", value):
        raise DomainError("INVALID_IDENTITY", f"Invalid {label} header", status_code=400)
    return value


def get_principal(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    organization_header: str | None = Header(default=None, alias="X-Organization-Id"),
    user_header: str | None = Header(default=None, alias="X-User-Id"),
    api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> Principal:
    if settings.auth_api_key and api_key != settings.auth_api_key:
        raise DomainError("UNAUTHORIZED", "Missing or invalid API key", status_code=401)

    organization_slug = _clean_identity(
        organization_header or settings.default_organization, "organization"
    )
    external_user_id = _clean_identity(user_header or settings.default_user, "user")

    organization = db.scalar(select(Organization).where(Organization.slug == organization_slug))
    if organization is None:
        organization = Organization(slug=organization_slug, name=organization_slug)
        db.add(organization)
        db.flush()

    user = db.scalar(
        select(User).where(
            User.organization_id == organization.id,
            User.external_id == external_user_id,
        )
    )
    if user is None:
        user = User(
            organization_id=organization.id,
            external_id=external_user_id,
            display_name=external_user_id,
        )
        db.add(user)
        db.commit()
        db.refresh(organization)
        db.refresh(user)

    return Principal(organization=organization, user=user)
