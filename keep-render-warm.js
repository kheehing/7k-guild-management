// Keep Render OCR service warm by pinging it every 14 minutes
// Run this script locally: node keep-render-warm.js

const OCR_SERVICE_URL = 'https://sevenk-guild-management.onrender.com';
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

async function pingService() {
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/health`);
    const timestamp = new Date().toLocaleTimeString();
    if (response.ok) {
      console.log(`[${timestamp}] ✅ Service is warm`);
    } else {
      console.log(`[${timestamp}] ⚠️ Service responded with status ${response.status}`);
    }
  } catch (error) {
    console.log(`[${timestamp}] ❌ Failed to ping service:`, error.message);
  }
}

console.log('🔥 Starting Render keep-warm service...');
console.log(`📍 Target: ${OCR_SERVICE_URL}`);
console.log(`⏰ Interval: Every 14 minutes\n`);

// Ping immediately
pingService();

// Then ping every 14 minutes
setInterval(pingService, PING_INTERVAL);
