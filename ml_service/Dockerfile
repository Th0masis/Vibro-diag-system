FROM python:3.11-slim
WORKDIR /app
# Zde je opravený řádek (libgl1 a libglib2.0-0)
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Port 8001 pro ml_service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]