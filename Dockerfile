# Stage 1: Build the Next.js frontend into static files
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python runtime — serves the static frontend + API
FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies (cached layer — only re-runs when pyproject.toml changes)
COPY backend/pyproject.toml .
RUN uv pip install --system .

# Copy backend source
COPY backend/ .

# Copy the Next.js static export into the directory FastAPI serves
COPY --from=frontend-build /frontend/out/ ./static/

# Volume mount point for SQLite persistence
RUN mkdir -p /data

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
