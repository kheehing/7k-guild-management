"use client";

import { useState, useRef, useEffect } from "react";

interface CaptureData {
  playerName: string;
  score: number;
}

interface GameCaptureProps {
  captureType: "castle-rush" | "advent";
  onDataExtracted: (data: CaptureData[]) => void;
}

interface ExtractedPlayer {
  playerName: string;
  score: number;
}

interface SavedEntry {
  playerName: string;
  score: number;
  timestamp: number;
}

const OCR_SERVICE_URL = 'http://127.0.0.1:5000';

export default function GameCapture({ captureType, onDataExtracted }: GameCaptureProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [extractedPlayers, setExtractedPlayers] = useState<ExtractedPlayer[]>([]);
  const [autoExtract, setAutoExtract] = useState(false);
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);
  const [castleName, setCastleName] = useState<string>('');
  const [guildMembers, setGuildMembers] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoExtractIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check OCR service health
  useEffect(() => {
    const checkService = async () => {
      try {
        const response = await fetch(`${OCR_SERVICE_URL}/health`);
        if (response.ok) {
          setServiceStatus('online');
        } else {
          setServiceStatus('offline');
        }
      } catch (error) {
        setServiceStatus('offline');
      }
    };
    
    checkService();
    const interval = setInterval(checkService, 10000); // Check every 10s
    
    return () => clearInterval(interval);
  }, []);

  // Load guild members on mount
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await fetch('/api/members');
        const data = await response.json();
        setGuildMembers(data.members.map((m: any) => m.name));
      } catch (error) {
        console.error('Failed to load guild members:', error);
      }
    };
    loadMembers();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (autoExtractIntervalRef.current) {
        clearInterval(autoExtractIntervalRef.current);
      }
    };
  }, []);

  // Handle paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            if (isCapturing) stopScreenCapture();
            
            const reader = new FileReader();
            reader.onload = (event) => {
              setImagePreview(event.target?.result as string);
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isCapturing]);

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
        } as MediaTrackConstraints,
        audio: false,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        systemAudio: 'exclude',
        surfaceSwitching: 'exclude',
      } as any);
      
      console.log('Stream obtained:', stream);
      console.log('Video tracks:', stream.getVideoTracks());
      
      streamRef.current = stream;
      setIsCapturing(true);
      setImagePreview(null);
      
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          console.log('Setting srcObject');
          videoRef.current.srcObject = streamRef.current;
          
          videoRef.current.onloadedmetadata = () => {
            console.log('Metadata loaded, attempting play');
            videoRef.current?.play().catch(err => console.error('Play failed:', err));
          };
        }
      }, 100);

      stream.getVideoTracks()[0].addEventListener('ended', stopScreenCapture);
    } catch (error) {
      console.error('Screen capture error:', error);
      alert('Failed to start screen capture.');
      setIsCapturing(false);
    }
  };

  const stopScreenCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (autoExtractIntervalRef.current) {
      clearInterval(autoExtractIntervalRef.current);
      autoExtractIntervalRef.current = null;
    }
    setIsCapturing(false);
    setAutoExtract(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    setImagePreview(imageData);
    stopScreenCapture();
  };

  const extractFromLiveStream = async () => {
    if (!videoRef.current || !canvasRef.current || processing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const fullImage = canvas.toDataURL('image/png');
    
    // Extract top-left corner for castle name (10% of width, 5% of height)
    const img = new Image();
    img.src = fullImage;
    await new Promise((resolve) => { img.onload = resolve; });
    
    const topLeftCanvas = document.createElement('canvas');
    const topLeftCtx = topLeftCanvas.getContext('2d');
    if (!topLeftCtx) return;
    
    const topLeftWidth = img.width * 0.1;
    const topLeftHeight = img.height * 0.05;
    topLeftCanvas.width = topLeftWidth;
    topLeftCanvas.height = topLeftHeight;
    
    topLeftCtx.drawImage(
      img,
      0, 0, topLeftWidth, topLeftHeight,
      0, 0, topLeftWidth, topLeftHeight
    );
    
    const topLeftImage = topLeftCanvas.toDataURL('image/png');
    
    // Extract right half for player data
    const halfCanvas = document.createElement('canvas');
    const halfCtx = halfCanvas.getContext('2d');
    if (!halfCtx) return;
    
    const halfWidth = img.width / 2;
    halfCanvas.width = halfWidth;
    halfCanvas.height = img.height;
    
    halfCtx.drawImage(
      img,
      halfWidth, 0, halfWidth, img.height,
      0, 0, halfWidth, img.height
    );
    
    const rightHalfImage = halfCanvas.toDataURL('image/png');
    
    try {
      setProcessing(true);
      
      // Extract castle name from top-left
      const castleResponse = await fetch(`${OCR_SERVICE_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: topLeftImage,
          captureType: 'castle-name',
          memberNames: [],
        }),
      });

      if (castleResponse.ok) {
        const castleResult = await castleResponse.json();
        if (castleResult.success && castleResult.castle_name) {
          setCastleName(castleResult.castle_name);
        }
      }
      
      // Extract player data
      const response = await fetch(`${OCR_SERVICE_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: rightHalfImage,
          captureType: captureType,
          memberNames: guildMembers,
        }),
      });

      if (!response.ok) {
        throw new Error(`OCR service error: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.players && result.players.length > 0) {
        // Filter to only guild members
        const guildPlayers = result.players.filter((p: ExtractedPlayer) => 
          guildMembers.includes(p.playerName)
        );
        
        // Update saved entries - one entry per player name
        const timestamp = Date.now();
        
        setSavedEntries(prev => {
          const updated = [...prev];
          
          for (const player of guildPlayers) {
            const existingIndex = updated.findIndex(e => e.playerName === player.playerName);
            
            if (existingIndex >= 0) {
              // Update existing entry with new score
              updated[existingIndex] = {
                playerName: player.playerName,
                score: player.score,
                timestamp
              };
            } else {
              // Add new entry
              updated.push({
                playerName: player.playerName,
                score: player.score,
                timestamp
              });
            }
          }
          
          return updated;
        });
        
        setExtractedPlayers(guildPlayers);
        if (guildPlayers.length > 0) {
          onDataExtracted(guildPlayers);
        }
        console.log(`[AUTO-EXTRACT] Found ${guildPlayers.length} guild members`);
      }
    } catch (error) {
      console.error("[AUTO-EXTRACT] Error:", error);
    } finally {
      setProcessing(false);
    }
  };

  const toggleAutoExtract = () => {
    if (!autoExtract) {
      setAutoExtract(true);
      autoExtractIntervalRef.current = setInterval(() => {
        extractFromLiveStream();
      }, 3000); // Extract every 3 seconds
    } else {
      setAutoExtract(false);
      if (autoExtractIntervalRef.current) {
        clearInterval(autoExtractIntervalRef.current);
        autoExtractIntervalRef.current = null;
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (isCapturing) stopScreenCapture();
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async () => {
    if (!imagePreview) return;

    if (serviceStatus === 'offline') {
      alert('OCR service is offline. Please start the Python service:\n\ncd python\npython ocr_service.py');
      return;
    }

    setProcessing(true);
    try {
      console.log('[OCR] Sending image to Python service...');
      
      // Create an image to get dimensions
      const img = new Image();
      img.src = imagePreview;
      await new Promise((resolve) => { img.onload = resolve; });
      
      // Create canvas to extract right half
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      
      // Use only right half for OCR
      const halfWidth = img.width / 2;
      canvas.width = halfWidth;
      canvas.height = img.height;
      
      ctx.drawImage(
        img,
        halfWidth, 0, halfWidth, img.height, // Source: right half
        0, 0, halfWidth, img.height          // Destination: full canvas
      );
      
      const rightHalfImage = canvas.toDataURL('image/png');
      
      // Fetch member names from database
      const membersResponse = await fetch('/api/members');
      const membersData = await membersResponse.json();
      const memberNames = membersData.members.map((m: any) => m.name);
      
      const response = await fetch(`${OCR_SERVICE_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: rightHalfImage,
          captureType: captureType,
          memberNames: memberNames,
        }),
      });

      if (!response.ok) {
        throw new Error(`OCR service error: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('[OCR] Extracted data:', result);

      if (result.success && result.players) {
        setExtractedPlayers(result.players);
        onDataExtracted(result.players);
      } else {
        throw new Error(result.error || 'Failed to extract data');
      }
    } catch (error) {
      console.error("[OCR] Error:", error);
      alert(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = () => {
    setImagePreview(null);
    setExtractedPlayers([]);
    stopScreenCapture();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePasteAreaDoubleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Service Status */}
      <div className="flex items-center gap-2 text-sm">
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: serviceStatus === 'online' ? '#22c55e' : serviceStatus === 'offline' ? '#ef4444' : '#eab308',
        }} />
        <span style={{ color: 'var(--color-muted)' }}>
          {serviceStatus === 'online' ? 'OCR Service Online' : serviceStatus === 'offline' ? 'OCR Service Offline' : 'Checking service...'}
        </span>
        {castleName && (
          <>
            <span style={{ color: 'var(--color-muted)' }}>•</span>
            <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
              Castle: {castleName}
            </span>
          </>
        )}
        {savedEntries.length > 0 && (
          <>
            <span style={{ color: 'var(--color-muted)' }}>•</span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
              Saved: {savedEntries.length}
            </span>
          </>
        )}
      </div>

      {/* Live Capture Controls */}
      {!isCapturing && !imagePreview && (
        <div className="flex gap-2">
          <button
            onClick={startScreenCapture}
            className="px-4 py-2 rounded flex items-center gap-2"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "white",
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Start Live Capture
          </button>
        </div>
      )}

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Combined Paste/Preview/Live Capture Area */}
      <div
        className="border rounded flex items-center justify-center"
        style={{
          borderColor: isCapturing ? "var(--color-primary)" : "var(--color-border)",
          backgroundColor: isCapturing ? '#1a1a1a' : "rgba(128, 128, 128, 0.05)",
          borderWidth: isCapturing ? "3px" : "1px",
          overflow: "hidden",
          minHeight: '400px',
          width: '100%',
          position: 'relative',
        }}
      >
        {isCapturing ? (
          <div style={{ 
            width: '100%', 
            height: '100%',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}>
            <div style={{
              width: '100%',
              maxWidth: '800px',
              border: '2px solid var(--color-primary)',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#000',
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ 
                  width: '100%', 
                  height: 'auto',
                  minHeight: '300px',
                  maxHeight: '600px',
                  display: 'block',
                  backgroundColor: '#000',
                  objectFit: 'contain',
                }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
                  console.log('Video ready state:', video.readyState);
                  console.log('Video paused:', video.paused);
                  console.log('Video srcObject:', video.srcObject);
                }}
                onCanPlay={(e) => {
                  console.log('Video can play');
                  e.currentTarget.play().catch(err => console.error('Auto play failed:', err));
                }}
                onPlay={() => {
                  console.log('Video is now playing!');
                }}
              />
            </div>
            <div className="flex gap-2 p-4 justify-center">
              <button
                onClick={toggleAutoExtract}
                className="px-4 py-2 rounded"
                style={{
                  backgroundColor: autoExtract ? "var(--color-accent)" : "var(--color-primary)",
                  color: "white",
                }}
              >
                {autoExtract ? "⏸ Stop Auto-Extract" : "▶ Start Auto-Extract"}
              </button>
              <button
                onClick={captureFrame}
                className="px-4 py-2 rounded border"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                  backgroundColor: "var(--color-surface)",
                }}
              >
                Capture Frame
              </button>
              <button
                onClick={stopScreenCapture}
                className="px-4 py-2 rounded border"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              >
                Stop Capture
              </button>
            </div>
          </div>
        ) : imagePreview ? (
          <div 
            className="relative w-full p-4"
            tabIndex={0}
            onDoubleClick={handlePasteAreaDoubleClick}
            style={{
              cursor: 'pointer',
              outline: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="max-w-full max-h-[400px] object-contain mx-auto"
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              draggable={false}
            />
            <div style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--color-muted)',
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              pointerEvents: 'none',
            }}>
              Double-click to change image
            </div>
          </div>
        ) : (
          <div
            tabIndex={0}
            onDoubleClick={handlePasteAreaDoubleClick}
            className="w-full h-full min-h-[300px] flex items-center justify-center cursor-pointer transition-colors p-6"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(107, 33, 168, 0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div style={{ color: "var(--color-muted)" }} className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="font-medium">Press Ctrl+V to paste</p>
              <p className="text-sm mt-1">Or double-click to browse files</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={processImage}
          disabled={!imagePreview || processing}
          className="px-4 py-2 rounded"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "white",
            opacity: (!imagePreview || processing) ? 0.5 : 1,
          }}
        >
          {processing ? "Processing..." : "Process Screenshot"}
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 rounded border"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-foreground)",
          }}
        >
          Clear
        </button>
      </div>

      {/* Extracted Players Display */}
      {extractedPlayers.length > 0 && (
        <div
          className="border rounded p-4"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "rgba(34, 197, 94, 0.05)",
          }}
        >
          <h4 className="font-semibold mb-3" style={{ color: "var(--color-foreground)" }}>
            Current View - Guild Members ({extractedPlayers.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {extractedPlayers.map((player, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 rounded"
                style={{
                  backgroundColor: "rgba(128, 128, 128, 0.1)",
                  borderLeft: "3px solid var(--color-primary)",
                }}
              >
                <span style={{ color: "var(--color-foreground)", fontWeight: 500 }}>
                  {player.playerName}
                </span>
                <span style={{ color: "var(--color-accent)", fontFamily: 'monospace' }}>
                  {player.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Entries Display */}
      {savedEntries.length > 0 && (
        <div
          className="border rounded p-4"
          style={{
            borderColor: "var(--color-primary)",
            backgroundColor: "rgba(107, 33, 168, 0.05)",
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold" style={{ color: "var(--color-foreground)" }}>
              Saved Entries ({savedEntries.length})
            </h4>
            <button
              onClick={() => setSavedEntries([])}
              className="px-3 py-1 text-xs rounded"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-muted)",
                border: "1px solid",
              }}
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {savedEntries.map((entry, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 rounded"
                style={{
                  backgroundColor: "rgba(107, 33, 168, 0.1)",
                  borderLeft: "3px solid var(--color-accent)",
                }}
              >
                <span style={{ color: "var(--color-foreground)", fontWeight: 500 }}>
                  {entry.playerName}
                </span>
                <span style={{ color: "var(--color-accent)", fontFamily: 'monospace' }}>
                  {entry.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div
        className="border rounded p-4"
        style={{
          borderColor: "var(--color-border)",
          backgroundColor: "rgba(128, 128, 128, 0.05)",
        }}
      >
        <h4 className="font-semibold mb-2" style={{ color: "var(--color-foreground)" }}>
          Setup Instructions:
        </h4>
        <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: "var(--color-muted)" }}>
          <li>Install Python dependencies: <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '3px' }}>cd python && pip install -r requirements.txt</code></li>
          <li>Start OCR service: <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '3px' }}>python ocr_service.py</code></li>
          <li>Take a screenshot of {captureType === "castle-rush" ? "Castle Rush" : "Advent Expedition"} results</li>
          <li>Double-click to upload, paste (Ctrl+V), or use Live Capture</li>
          <li>Click "Process Screenshot" for ML-powered text extraction</li>
        </ol>
      </div>
    </div>
  );
}
