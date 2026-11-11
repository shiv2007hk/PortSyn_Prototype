import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger("portsync.ws")


class ConnectionManager:
    """Fan-out hub for operational events and twin updates."""

    def __init__(self) -> None:
        self.active: set[WebSocket] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.discard(ws)

    def publish(self, message: dict) -> None:
        """Thread-safe publish from sync request handlers / background work."""
        if not self.active or self.loop is None:
            return
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(message), self.loop)
        except Exception:  # pragma: no cover - defensive, never break a request
            logger.exception("websocket publish failed")


manager = ConnectionManager()


def publish_event(event: dict, topics: list[str] | None = None) -> None:
    manager.publish({"type": "event", "data": event, "topics": topics or []})


def publish_invalidate(topics: list[str]) -> None:
    manager.publish({"type": "invalidate", "data": {"topics": topics}})


def publish_twin(twin: dict) -> None:
    manager.publish({"type": "twin", "data": twin})
