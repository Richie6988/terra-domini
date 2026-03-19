FROM python:3.12-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    gcc g++ libpq-dev \
    gdal-bin libgdal-dev \
    python3-gdal \
    libgeos-dev \
    curl netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

CMD ["gunicorn", "terra_domini.asgi:application", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
