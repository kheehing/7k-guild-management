# Render Deployment Guide for Python OCR Service

## Step-by-Step Setup

### 1. Create Render Account
- Go to https://render.com
- Click "Get Started for Free"
- Sign up with GitHub (recommended) or email

### 2. Create New Web Service
1. Click "New +" button (top right)
2. Select "Web Service"
3. Click "Connect account" to authorize GitHub access
4. Find and select your repository: `7k-guild-management`

### 3. Configure Service Settings

**Name:**
```
7k-ocr-service
```
(or any name you prefer)

**Region:**
```
Oregon (US West)
```
(or closest to your users)

**Branch:**
```
main
```

**Root Directory:** ⚠️ **CRITICAL**
```
python
```
(This tells Render to only look in the python folder)

**Runtime:**
```
Python 3
```

**Build Command:**
```
pip install -r requirements.txt
```

**Start Command:**
```
gunicorn -b 0.0.0.0:$PORT ocr_service:app
```

**Native Environment (Advanced Settings):**
- Scroll down to "Advanced" section
- Add Native Environment: `tesseract`

(This installs Tesseract OCR at the system level)

**Instance Type:**
```
Free
```

### 4. Environment Variables (Optional)
You can skip this section - the Python OCR service doesn't need database access.

### 5. Deploy!
1. Click "Create Web Service"
2. Wait 3-5 minutes for deployment
3. Render will:
   - Install Tesseract OCR
   - Install Python packages
   - Start the service

### 6. Get Your Service URL
After deployment completes, you'll see:
```
Your service is live at https://7k-ocr-service.onrender.com
```

Copy this URL!

### 7. Update Your Environment Variables

**For Local Development (.env.local):**
```
NEXT_PUBLIC_OCR_SERVICE_URL=https://7k-ocr-service.onrender.com
```

**For Vercel (Production):**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - Name: `NEXT_PUBLIC_OCR_SERVICE_URL`
   - Value: `https://7k-ocr-service.onrender.com`
   - Environments: ✓ Production ✓ Preview ✓ Development
5. Click "Save"
6. Redeploy your Vercel app

### 8. Test the Service
Visit your Render service URL:
```
https://7k-ocr-service.onrender.com/health
```

You should see:
```json
{
  "status": "healthy",
  "service": "OCR Service",
  "tesseract": "available"
}
```

## Troubleshooting

### Build Fails
- Check that Root Directory is set to `python`
- Verify `requirements.txt` exists in python folder
- Check build logs for specific errors

### Service Times Out
- Free tier spins down after 15 minutes
- First request takes 30-60 seconds (cold start)
- Use the OCRWarmup component we added to keep it warm

### OCR Not Working
1. Check service is online: visit `/health` endpoint
2. Verify environment variable in Vercel
3. Check browser console for errors
4. Verify Render logs for errors

## Cost
- **Free tier:** 750 hours/month (enough for hobby projects)
- Service spins down after 15 min inactivity
- Upgrade to Hobby ($7/mo) for always-on service

## Next Steps After Deployment
1. Copy your Render service URL
2. Update NEXT_PUBLIC_OCR_SERVICE_URL in:
   - `.env.local` (for local dev)
   - Vercel environment variables (for production)
3. Redeploy Vercel app
4. Test screen capture feature!
