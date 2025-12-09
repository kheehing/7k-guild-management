# Python OCR Service Deployment Guide

## Overview

The Castle Rush Capture feature requires a Python Flask backend (`python/ocr_service.py`) to run OCR processing. Since Vercel only hosts the Next.js frontend, you need to deploy the Python service separately.

## Deployment Options

### Option 1: Railway (Recommended - Easy & Reliable)

**Pros:**
- Simple setup with GitHub integration
- Automatic deployments on push
- $5/month hobby plan (500 hours)
- Built-in environment variables
- Good for Python services

**Steps:**
1. Sign up at [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub repo
3. Select `python` folder as root directory
4. Railway auto-detects `requirements.txt`
5. Add environment variable: `PORT=5000`
6. Install Tesseract buildpack or use Docker:

**Dockerfile** (create in `python/` folder):
```dockerfile
FROM python:3.11-slim

# Install Tesseract and language packs
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-chi-sim \
    tesseract-ocr-chi-tra \
    tesseract-ocr-tha \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "ocr_service.py"]
```

7. Get your Railway URL: `https://your-service.railway.app`

---

### Option 2: Render (Free Tier Available)

**Pros:**
- Free tier with 750 hours/month
- Easy Docker deployment
- Auto-deploys from Git

**Steps:**
1. Sign up at [render.com](https://render.com)
2. Create new Web Service
3. Connect your GitHub repository
4. Configure:
   - Root Directory: `python`
   - Environment: Docker
   - Docker Command: (auto-detected from Dockerfile above)
5. Add environment variable: `PORT=5000`
6. Deploy

**Note:** Free tier spins down after 15 minutes of inactivity (cold starts ~30s).

---

### Option 3: Fly.io (Free Tier Available)

**Pros:**
- Free allowance: 3 shared CPUs, 3GB RAM
- Global deployment
- Fast cold starts

**Steps:**
1. Install flyctl CLI: `brew install flyctl` (Mac) or `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"` (Windows)
2. Sign up: `flyctl auth signup`
3. Navigate to `python/` folder
4. Initialize: `flyctl launch`
   - Name your app
   - Select region
   - Don't add PostgreSQL/Redis
5. Edit `fly.toml` to expose port 5000:
```toml
[[services]]
  internal_port = 5000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```
6. Deploy: `flyctl deploy`
7. Get URL: `https://your-app.fly.dev`

---

### Option 4: AWS Lambda + API Gateway (Advanced)

**Pros:**
- Pay per use (very cheap for low traffic)
- Serverless scaling

**Cons:**
- Complex setup
- Cold starts can be slow
- Lambda has size limits (requires Lambda Layers for dependencies)

**Not recommended** unless you have AWS experience and need serverless scaling.

---

## Updating Your Frontend

After deploying the Python service, update your Next.js app:

### 1. Add Environment Variable

Create/update `.env.local`:
```env
NEXT_PUBLIC_OCR_SERVICE_URL=http://127.0.0.1:5000  # Development
```

Add to Vercel environment variables:
```env
NEXT_PUBLIC_OCR_SERVICE_URL=https://your-service.railway.app  # Production
```

### 2. Update CaptureEntryModal.tsx

Replace hardcoded URL:
```typescript
// OLD:
const OCR_SERVICE_URL = 'http://127.0.0.1:5000';

// NEW:
const OCR_SERVICE_URL = process.env.NEXT_PUBLIC_OCR_SERVICE_URL || 'http://127.0.0.1:5000';
```

### 3. Update CORS in ocr_service.py

```python
# python/ocr_service.py
from flask_cors import CORS

app = Flask(__name__)

# Allow your Vercel domain
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",  # Local dev
            "https://your-app.vercel.app",  # Production
            "https://*.vercel.app"  # All Vercel preview deployments
        ]
    }
})
```

---

## Testing Production Deployment

1. Deploy Python service
2. Update Vercel env var with production URL
3. Redeploy Next.js app (Vercel auto-deploys on push)
4. Test capture feature:
   - Open Castle Rush tab
   - Click "Capture" button
   - Start screen capture
   - Check OCR service status (should show "Online")

---

## Troubleshooting

### OCR Service shows "Offline"
- Check if Python service is running (visit `https://your-service.railway.app/health`)
- Verify CORS configuration allows your Vercel domain
- Check browser console for CORS errors

### Language Packs Not Found
- Ensure Dockerfile installs all Tesseract languages:
  ```dockerfile
  tesseract-ocr-eng \
  tesseract-ocr-chi-sim \
  tesseract-ocr-chi-tra \
  tesseract-ocr-tha
  ```
- Test on deployed service: `tesseract --list-langs`

### Slow Extraction
- Railway/Render free tier may have limited CPU
- Consider upgrading to paid tier
- Optimize image size before sending (already at 2x upscaling)

### Cold Starts (Render Free Tier)
- First request after 15 min inactivity takes ~30s
- Upgrade to paid tier for always-on service
- Or use Railway (always-on on $5/month plan)

---

## Cost Comparison

| Platform | Free Tier | Paid Plan | Best For |
|----------|-----------|-----------|----------|
| **Railway** | ❌ None | $5/month (500hrs) | Production use |
| **Render** | ✅ 750hrs/month | $7/month (always-on) | Testing/Low traffic |
| **Fly.io** | ✅ 3 CPUs, 3GB RAM | ~$2/month (if over free) | Global deployment |
| **AWS Lambda** | ✅ 1M requests/month | Pay per use | High scale |

**Recommendation:** Start with **Railway** ($5/month) for reliable always-on service, or **Render Free** for testing.

---

## Next Steps

1. Choose deployment platform
2. Create Dockerfile (if using Railway/Render)
3. Deploy Python service
4. Get production URL
5. Update `NEXT_PUBLIC_OCR_SERVICE_URL` in Vercel
6. Test capture feature in production

---

## Alternative: Cloud OCR API

If Python hosting is too complex, consider using cloud OCR APIs:

- **Google Cloud Vision API**: $1.50 per 1000 images (first 1000/month free)
- **AWS Textract**: $1.50 per 1000 pages
- **Azure Computer Vision**: $1 per 1000 transactions

**Trade-offs:**
- ✅ No server hosting needed
- ✅ High accuracy
- ❌ API costs per request
- ❌ Requires cloud account setup
- ❌ May need to rewrite extraction logic

**Stick with Python service** unless API costs are preferable to hosting.
