from __future__ import annotations
import asyncio
import json
from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)

    async def send_personal(self, client_id: str, data: dict):
        ws = self.active_connections.get(client_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(client_id)

    async def broadcast(self, data: dict):
        dead = []
        for cid, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(cid)
        for cid in dead:
            self.disconnect(cid)

    async def broadcast_batch(self, updates: list[dict]):
        """Send all updates as a single batch frame per client."""
        if not updates or not self.active_connections:
            return
        msg = json.dumps({"type": "batch", "updates": updates})
        dead = []
        for cid, ws in self.active_connections.items():
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(cid)
        for cid in dead:
            self.disconnect(cid)


ws_manager = WebSocketManager()
