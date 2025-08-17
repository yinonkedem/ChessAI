# ---- build stage ----
FROM python:3.11-slim AS base

# Install Stockfish engine for Linux
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      stockfish \
      build-essential \
      cython3 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# ---- runtime ---
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
ENV STOCKFISH_BIN=/usr/bin/stockfish


CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT