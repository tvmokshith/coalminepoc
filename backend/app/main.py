import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.config import settings
from app.data_engine import run_data_engine
from app.routes import auth, mines, kpi, equipment, advisory, subsystems, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start synthetic data engine
    task = asyncio.create_task(run_data_engine())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Astrikos Coal Mining Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router)
app.include_router(mines.router)
app.include_router(kpi.router)
app.include_router(equipment.router)
app.include_router(advisory.router)
app.include_router(subsystems.router)
app.include_router(ws.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "platform": "Astrikos Coal Mining Intelligence"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
