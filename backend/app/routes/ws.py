from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws_manager import ws_manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = websocket.query_params.get("client_id", "anon")
    await ws_manager.connect(websocket, client_id)
    try:
        while True:
            # Keep connection alive, receive pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(client_id)
    except Exception:
        ws_manager.disconnect(client_id)
