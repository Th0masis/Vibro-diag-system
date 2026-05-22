FROM python:3.11-slim

# Zamezení cachování výstupu Pythonu v kontejneru
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instalace systémových knihoven pro OpenCV / zpracování obrazu a signálů
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Explicitní příprava adresáře pro baseline modely
RUN mkdir -p /app/models

# Kopírování zdrojových kódů a složky models (pokud existuje lokálně)
COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]