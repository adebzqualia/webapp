FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

COPY alembic.ini ./
COPY alembic ./alembic
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/data/storage /app/storage && \
    chown -R nobody:nogroup /app/data /app/storage && \
    chmod +x /app/docker-entrypoint.sh
USER nobody

EXPOSE 8000
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
