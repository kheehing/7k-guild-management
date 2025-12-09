# Render Deployment Instructions

## Deploy OCR Service to Render

1. **Push to GitHub:**
   ```bash
   git add python/
   git commit -m "Add Render deployment config"
   git push
   ```

2. **Create Render Account:**
   - Go to https://render.com
   - Sign up with GitHub

3. **Deploy Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name:** `7k-ocr-service` (or any name you prefer)
     - **Region:** Choose closest to your users (e.g., Oregon US West)
     - **Branch:** `main`
     - **Root Directory:** `python` ⚠️ **CRITICAL - Must be set!**
     - **Runtime/Language:** `Python 3`
     - **Build Command:** 
       ```
       pip install -r requirements.txt
       ```
     - **Start Command:** 
       ```
       gunicorn -b 0.0.0.0:$PORT ocr_service:app
       ```
     - **Instance Type:** `Free`
   
   - **Important**: Leave Advanced Settings as default for now
   
   - Click **"Create Web Service"**

   ⚠️ **Note about Tesseract**: If the build fails due to missing Tesseract, you'll need to use a Docker-based deployment instead of native Python. For now, try deploying - Render's Python environment may have Tesseract pre-installed.

4. **Get Service URL:**
   - After deployment completes, copy the URL (e.g., `https://7k-ocr-service.onrender.com`)

5. **Update Vercel Environment Variable:**
   - Go to Vercel dashboard → Your project → Settings → Environment Variables
   - Add:
     - **Name:** `NEXT_PUBLIC_OCR_SERVICE_URL`
     - **Value:** `https://7k-ocr-service.onrender.com` (your Render URL)
   - Redeploy your Next.js app

## Test Locally

Your app already uses environment variables, so no code changes needed!

**Local (development):**
```bash
# No .env.local needed - defaults to http://127.0.0.1:5000
npm run dev
```

**Production (Vercel):**
```bash
# Automatically uses NEXT_PUBLIC_OCR_SERVICE_URL from Vercel env vars
```

## Notes

- ⏱️ Free tier spins down after 15 min inactivity (30-60s cold start)
- 🔄 First OCR request after cold start may take ~1 minute
- 💚 No credit card required
- 🔒 SSL included (HTTPS)

## Troubleshooting

### If Tesseract is not found:

You may need to use a **Dockerfile** approach instead. Create `python/Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install Tesseract OCR
RUN apt-get update && apt-get install -y tesseract-ocr && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Start gunicorn
CMD gunicorn -b 0.0.0.0:$PORT ocr_service:app
```

Then in Render:
- Change **Runtime** to `Docker`
- **Dockerfile Path**: `python/Dockerfile`
- Leave Build Command empty
- Leave Start Command empty (uses CMD from Dockerfile)
