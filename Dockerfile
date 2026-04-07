FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
COPY --from=frontend /app/static/dist app/static/dist
ENV PORT=8080
EXPOSE 8080
CMD gunicorn "app:create_app()" --bind 0.0.0.0:$PORT --workers 2 --timeout 120
