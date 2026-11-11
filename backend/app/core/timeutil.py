from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC timestamp, consistent across SQLite and PostgreSQL storage."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
