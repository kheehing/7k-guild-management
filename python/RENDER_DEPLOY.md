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
     - **Name:** `7k-ocr-service`
     - **Root Directory:** `python`
     - **Runtime:** `Python 3`
     - **Build Command:** 
       ```
       apt-get update && apt-get install -y tesseract-ocr && pip install -r requirements.txt
       ```
     - **Start Command:** 
       ```
       gunicorn -b 0.0.0.0:$PORT ocr_service:app
       ```
     - **Plan:** `Free`

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
