FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Pré-télécharge les poids dans l'image : le premier message modéré ne paie pas
# le téléchargement (~1,1 Go) et le conteneur démarre sans réseau.
ARG PRELOAD_MODEL=true
ENV HF_HOME=/app/.cache/huggingface
RUN if [ "$PRELOAD_MODEL" = "true" ]; then \
      python -c "from detoxify import Detoxify; Detoxify('multilingual')"; \
    fi

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
