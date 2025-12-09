"use client";

import { useEffect } from "react";

const OCR_SERVICE_URL = process.env.NEXT_PUBLIC_OCR_SERVICE_URL || 'http://127.0.0.1:5000';

export default function OCRWarmup() {
  useEffect(() => {
    // Immediately ping OCR service when app loads
    const warmupService = async () => {
      try {
        await fetch(`${OCR_SERVICE_URL}/health`, {
          method: 'GET',
          cache: 'no-store',
        });
        console.log('[OCR Warmup] Service pinged successfully');
      } catch (error) {
        console.log('[OCR Warmup] Service warming up...');
      }
    };

    warmupService();

    // Keep pinging every 10 minutes while user is on the site
    const interval = setInterval(warmupService, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null; // This component doesn't render anything
}
