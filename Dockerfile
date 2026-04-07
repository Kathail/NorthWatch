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
COPY start.sh .
RUN chmod +x start.sh
EXPOSE 8080
ENTRYPOINT ["./start.sh"]
