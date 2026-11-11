from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import AssistantRequest
from app.services import assistant_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/status")
def status():
    from app.core.config import settings

    return {
        "llm_configured": settings.llm_configured,
        "mode": "llm" if settings.llm_configured else "rules",
        "read_only": True,
        "model": settings.llm_model if settings.llm_configured else None,
        "suggestions": assistant_service.SUGGESTIONS,
        "note": (
            "An OpenAI-compatible LLM endpoint is configured. Answers stay grounded on the live operational snapshot."
            if settings.llm_configured
            else "No LLM key configured. The grounded rules engine answers from live database facts."
        ),
    }


@router.post("/chat")
def chat(payload: AssistantRequest, db: Session = Depends(get_db)):
    history = [{"role": row.role, "content": row.content} for row in payload.history]
    return assistant_service.answer(db, payload.message, history)
