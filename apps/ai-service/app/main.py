from fastapi import FastAPI

from app.routers import health, listing, ollama, return_inspection, store_description

app = FastAPI(title="KarobarAI AI Service", version="0.0.0")

app.include_router(health.router)
app.include_router(listing.router)
app.include_router(store_description.router, prefix="/internal")
app.include_router(return_inspection.router, prefix="/internal")
app.include_router(ollama.router, prefix="/internal")
