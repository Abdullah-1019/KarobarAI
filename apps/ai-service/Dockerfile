# Dev-mode image (hot reload). Never exposed on the host or via Nginx (TRD §8) —
# only reachable from the api container over the internal Docker network.
FROM python:3.11-slim

WORKDIR /app

COPY apps/ai-service/requirements.txt apps/ai-service/requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY apps/ai-service .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
