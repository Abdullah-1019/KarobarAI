from fastapi import FastAPI

from app.routers import health, listing, ollama

app = FastAPI(title="KarobarAI AI Service", version="0.0.0")

app.include_router(health.router)
app.include_router(listing.router)
app.include_router(ollama.router, prefix="/internal")
