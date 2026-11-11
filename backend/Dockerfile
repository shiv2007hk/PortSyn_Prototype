FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY requirements.txt requirements-postgres.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt -r requirements-postgres.txt

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN chown -R app:app /app
USER app

EXPOSE 8010

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010", "--proxy-headers"]
