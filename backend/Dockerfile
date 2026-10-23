FROM python:3.11-slim

WORKDIR /app

# System dependencies (including headless graphics & XCB libraries for RapidOCR / OpenCV)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev curl \
    libgl1 \
    libglib2.0-0 \
    libxcb1 \
    libx11-xcb1 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Pre-install lightweight CPU-only PyTorch (180MB vs 4.5GB CUDA) to prevent "No space left on device"
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
