from fastapi import FastAPI, WebSocket, HTTPException
from app.api.v1.endpoints import games, ai

app = FastAPI(title="Chess-AI Backend")

app.include_router(games.router, prefix="/api/v1/games", tags=["games"])
app.include_router(ai.router,    prefix="/api/v1/ai",    tags=["ai"])

@app.get("/health")
async def health():
    return {"status": "ok"}

# Simple WebSocket echo to verify real-time works
@app.websocket("/ws/echo")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    while True:
        data = await ws.receive_text()
        await ws.send_text(f"echo: {data}")
