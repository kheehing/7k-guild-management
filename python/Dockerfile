FROM python:3.11-slim

# Install Tesseract OCR and language packs
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-chi-sim \
    tesseract-ocr-chi-tra \
    tesseract-ocr-tha \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Set environment variable for Tesseract
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata/

# Run with gunicorn for production (Render uses $PORT env var)
CMD gunicorn -b 0.0.0.0:$PORT ocr_service:app --timeout 120 --workers 2
