from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="KarobarAI AI Service", version="0.0.0")

app.include_router(health.router)
