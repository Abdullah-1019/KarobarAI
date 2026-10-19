# Dev-mode image (hot reload). Never exposed on the host or via Nginx (TRD §8) —
# only reachable from the api container over the internal Docker network.
FROM python:3.11-slim

# Task 1's internal-network completion/embedding smoke checks use curl.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/ai-service/requirements.txt apps/ai-service/requirements-dev.txt ./
# Install the CPU wheel explicitly; PyPI's Linux wheel may pull CUDA libraries.
RUN pip install --no-cache-dir torch==2.5.1+cpu --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY apps/ai-service .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/app"]
