from typing import Callable

from fastapi import Depends, Header, Request

from app.core.database import get_db
from app.models import User
from app.services.common import actor_from_user
from app.services.serializers import event_out
from app.websocket.manager import publish_event, publish_invalidate


def current_actor(
    request: Request,
    x_actor: str | None = Header(default=None, alias="X-Actor"),
    db=Depends(get_db),
) -> str:
    user = getattr(request.state, "user", None)
    if user is not None:
        return user.name
    return actor_from_user(db, x_actor)


def paginate(query, page: int, page_size: int, serializer: Callable, *, include_total: bool = True) -> dict:
    total = query.count() if include_total else None
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    payload = {"items": [serializer(row) for row in rows], "page": page, "page_size": page_size}
    if include_total:
        payload["total"] = total
        payload["pages"] = max(1, (total + page_size - 1) // page_size)
    return payload


def notify(event=None, topics: list[str] | None = None) -> None:
    topics = topics or []
    if event is not None:
        publish_event(event_out(event), topics)
    if topics:
        publish_invalidate(topics)


def public_user(user: User) -> dict:
    return {"id": user.id, "code": user.code, "name": user.name, "role": user.role, "email": user.email}
