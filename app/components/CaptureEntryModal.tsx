"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FaTimes, FaStop, FaVideo, FaTrash } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import MemberSearchBar from "./MemberSearchBar";

interface CaptureEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Member {
  id: string;
  name: string;
  kicked?: boolean;
}

interface CastleInfo {
  day: string;
  boss: string;
  castle: string;
}

const CASTLE_SCHEDULE: Record<number, CastleInfo> = {
  1: { day: "Monday", boss: "Rudy", castle: "Guardian's Castle" },
  2: { day: "Tuesday", boss: "Eileene", castle: "Fodina Castle" },
  3: { day: "Wednesday", boss: "Rachel", castle: "Immortal Castle" },
  4: { day: "Thursday", boss: "Dellons", castle: "Death Castle" },
  5: { day: "Friday", boss: "Jave", castle: "Ancient Dragon's Castle" },
  6: { day: "Saturday", boss: "Spike", castle: "Blizzard Castle" },
  0: { day: "Sunday", boss: "Kris", castle: "Hell Castle" }
};

const OCR_SERVICE_URL = process.env.NEXT_PUBLIC_OCR_SERVICE_URL || 'http://127.0.0.1:5000';

export default function CaptureEntryModal({ isOpen, onClose }: CaptureEntryModalProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [castleInfo, setCastleInfo] = useState<CastleInfo | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoExtract, setAutoExtract] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [castleName, setCastleName] = useState<string>('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [enteredMembers, setEnteredMembers] = useState<Member[]>([]);
  const [nonParticipatingMembers, setNonParticipatingMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoExtractIntervalRef = useRef<number | null>(null);
  const lastFrameRef = useRef<string>('');

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
    const interval = setInterval(checkService, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load guild members
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch("/api/members");
        if (res.ok) {
          const data = await res.json();
          setAllMembers(data.members || []);
        }
      } catch (error) {
        console.error("Failed to load members:", error);
      }
    };
    loadMembers();
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset all state to initial values
      setEnteredMembers([]);
      setNonParticipatingMembers([]);
      setEntries({});
      setCastleName('');
      setSearchQuery('');
      setSubmitting(false);
      
      // Set today's date
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    }
  }, [isOpen]);

  // Update castle info when date changes
  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = date.getDay();
      setCastleInfo(CASTLE_SCHEDULE[dayOfWeek]);
    }
  }, [selectedDate]);

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

      streamRef.current = stream;
      setIsCapturing(true);
      setAutoExtract(true); // Auto-start extraction

      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => console.error('Play failed:', err));
          };
        }
      }, 100);

      stream.getVideoTracks()[0].addEventListener('ended', stopScreenCapture);
    } catch (error) {
      console.error('Screen capture error:', error);
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
    lastFrameRef.current = '';
  };

  const extractFromLiveStream = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const fullImage = canvas.toDataURL('image/png');
    
    // Check if frame has changed
    if (fullImage === lastFrameRef.current) {
      return; // Skip if same frame
    }
    lastFrameRef.current = fullImage;
    
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
        const castleData = await castleResponse.json();
        if (castleData.success && castleData.castle_name) {
          setCastleName(castleData.castle_name);
        }
      }

      // Extract player data from right half
      const playerResponse = await fetch(`${OCR_SERVICE_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: rightHalfImage,
          captureType: 'castle-rush',
          memberNames: allMembers.map(m => m.name),
        }),
      });

      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        
        if (playerData.success && playerData.players && playerData.players.length > 0) {
          // Filter to only guild members
          const guildPlayers = playerData.players.filter((p: { playerName: string; score: number }) => 
            allMembers.some(m => m.name.toLowerCase() === p.playerName.toLowerCase())
          );
          
          // Update entries - one entry per member
          setEnteredMembers(prev => {
            const updated = [...prev];
            
            for (const player of guildPlayers) {
              // Find matching guild member
              const member = allMembers.find(m => 
                m.name.toLowerCase() === player.playerName.toLowerCase()
              );
              
              if (member) {
                const existingIndex = updated.findIndex(em => em.id === member.id);
                
                if (existingIndex < 0) {
                  // Add new member if not exists
                  updated.push(member);
                }
                
                // Update score (always update to latest)
                setEntries(prev => ({
                  ...prev,
                  [member.id]: player.score.toString()
                }));
              }
            }
            
            return updated;
          });
          
          console.log(`[AUTO-EXTRACT] Found ${guildPlayers.length} guild members`);
        }
      }
    } catch (error) {
      console.error("Error extracting from stream:", error);
    } finally {
      setProcessing(false);
    }
  }, [processing, allMembers]);

  // Auto-extract every 0.5 seconds
  useEffect(() => {
    if (autoExtract && isCapturing) {
      autoExtractIntervalRef.current = window.setInterval(() => {
        extractFromLiveStream();
      }, 500);
    } else if (autoExtractIntervalRef.current) {
      clearInterval(autoExtractIntervalRef.current);
      autoExtractIntervalRef.current = null;
    }

    return () => {
      if (autoExtractIntervalRef.current) {
        clearInterval(autoExtractIntervalRef.current);
      }
    };
  }, [autoExtract, isCapturing, extractFromLiveStream]);

  const handleScoreChange = (memberId: string, score: string) => {
    setEntries(prev => ({
      ...prev,
      [memberId]: score
    }));
  };

  const handleDeleteEntry = (memberId: string) => {
    setEnteredMembers(prev => prev.filter(m => m.id !== memberId));
    setEntries(prev => {
      const newEntries = { ...prev };
      delete newEntries[memberId];
      return newEntries;
    });
  };

  const handleAddMemberToEntry = (memberId: string) => {
    const memberToAdd = allMembers.find(m => m.id === memberId);
    if (!memberToAdd) return;
    
    // Check if member already exists - only allow one entry per member
    if (enteredMembers.find(m => m.id === memberId)) {
      console.log(`[Add Member] ${memberToAdd.name} already added`);
      setSearchQuery("");
      return;
    }
    
    setEnteredMembers(prev => [...prev, memberToAdd]);
    setSearchQuery("");
  };

  const handleAddNonParticipating = (memberId: string) => {
    const memberToAdd = allMembers.find(m => m.id === memberId);
    if (!memberToAdd) return;
    
    // Check if already in either list
    if (enteredMembers.find(m => m.id === memberId) || 
        nonParticipatingMembers.find(m => m.id === memberId)) {
      return;
    }
    
    setNonParticipatingMembers(prev => [...prev, memberToAdd]);
  };

  const handleRemoveNonParticipating = (memberId: string) => {
    setNonParticipatingMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleSubmit = async () => {
    if (!selectedDate || enteredMembers.length === 0) {
      alert("Please select a date and capture at least one entry");
      return;
    }

    if (!castleInfo) {
      alert("Castle information not available for selected date");
      return;
    }

    setSubmitting(true);
    try {
      // First, create a logger entry
      const { data: logger, error: loggerError } = await supabase
        .from('logger')
        .insert({
          logged_by: 'screen_capture'
        })
        .select()
        .single();

      if (loggerError) throw loggerError;

      // Create castle rush entry with logger_id
      const { data: castleRush, error: crError } = await supabase
        .from('castle_rush')
        .insert({
          date: selectedDate,
          castle: castleInfo.castle,
          logger_id: logger.id
        })
        .select()
        .single();

      if (crError) throw crError;

      // Create entries for attending members
      const attendingEntries = enteredMembers.map(member => ({
        castle_rush_id: castleRush.id,
        member_id: member.id,
        score: parseInt(entries[member.id] || '0'),
        attendance: true,
        logger_id: logger.id
      }));

      // Create entries for non-participating members
      const nonAttendingEntries = nonParticipatingMembers.map(member => ({
        castle_rush_id: castleRush.id,
        member_id: member.id,
        score: 0,
        attendance: false,
        logger_id: logger.id
      }));

      const allEntries = [...attendingEntries, ...nonAttendingEntries];

      if (allEntries.length > 0) {
        const { error: entryError } = await supabase
          .from('castle_rush_entry')
          .insert(allEntries);

        if (entryError) throw entryError;
      }

      // Success - close modal and reset
      stopScreenCapture();
      setEnteredMembers([]);
      setNonParticipatingMembers([]);
      setEntries({});
      setCastleName('');
      setSelectedDate('');
      onClose();
    } catch (error) {
      console.error("Error submitting entries:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        alert(`Failed to submit entries: ${error.message}`);
      } else {
        alert("Failed to submit entries. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    stopScreenCapture();
    setEnteredMembers([]);
    setNonParticipatingMembers([]);
    setEntries({});
    setCastleName('');
    setSelectedDate('');
    onClose();
  };

  // Sort entered members by score
  const displayedEntries = enteredMembers.sort((a, b) => {
    const scoreA = parseInt(entries[a.id] || '0');
    const scoreB = parseInt(entries[b.id] || '0');
    
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  // Calculate total score
  const totalScore = Object.values(entries)
    .filter(score => score && score.trim() !== '')
    .reduce((sum, score) => sum + (parseInt(score) || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0" 
        style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
      />

      {/* Modal */}
      <div 
        className="relative rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 border-b"
          style={{
            borderColor: "var(--color-border)",
          }}
        >
          <h2 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>
            Capture Castle Rush Entry
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:opacity-80"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-foreground)",
            }}
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Date Selection */}
          <div>
            <label className="block mb-2 font-medium" style={{ color: "var(--color-foreground)" }}>
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
                colorScheme: "dark",
              }}
            />
            {castleInfo && (
              <div 
                className="mt-2 p-3 rounded"
                style={{ 
                  backgroundColor: "rgba(128, 128, 128, 0.1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div style={{ color: "var(--color-muted)" }}>Day</div>
                    <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                      {castleInfo.day}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-muted)" }}>Boss</div>
                    <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                      {castleInfo.boss}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-muted)" }}>Castle</div>
                    <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                      {castleInfo.castle}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* OCR Service Status */}
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: serviceStatus === 'online' ? '#10b981' : 
                               serviceStatus === 'offline' ? '#ef4444' : '#eab308'
              }}
            />
            <span style={{ color: "var(--color-foreground)" }}>
              OCR Service: {serviceStatus === 'online' ? 'Online' : 
                          serviceStatus === 'offline' ? 'Offline' : 'Checking...'}
            </span>
          </div>

          {/* Capture Controls */}
          <div className="flex gap-4">
            {!isCapturing ? (
              <button
                onClick={startScreenCapture}
                disabled={serviceStatus !== 'online'}
                className="flex items-center gap-2 px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                }}
              >
                <FaVideo />
                Start Screen Capture
              </button>
            ) : (
              <button
                onClick={stopScreenCapture}
                className="flex items-center gap-2 px-6 py-3 rounded-lg hover:opacity-90"
                style={{
                  backgroundColor: "#ef4444",
                  color: "white",
                }}
              >
                <FaStop />
                Stop Capture
              </button>
            )}
          </div>

          {/* Video Preview */}
          {isCapturing && (
            <div>
              <div className="mb-2 flex justify-between items-center">
                <h3 className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                  Live Preview
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  {castleName && (
                    <div style={{ color: "var(--color-muted)" }}>
                      Castle: <span style={{ color: "var(--color-foreground)" }}>{castleName}</span>
                    </div>
                  )}
                  <div style={{ color: "var(--color-muted)" }}>
                    Entries: <span className="font-bold" style={{ color: "var(--color-primary)" }}>
                      {enteredMembers.length}
                    </span>
                  </div>
                  {autoExtract && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: "#10b981" }}
                      />
                      <span style={{ color: "#10b981" }}>Auto-extracting</span>
                    </div>
                  )}
                </div>
              </div>
              <div 
                className="rounded-lg overflow-hidden"
                style={{
                  backgroundColor: "#000",
                  border: "2px solid var(--color-border)",
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: 'auto',
                    minHeight: '300px',
                    maxHeight: '500px',
                    display: 'block',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Manual Add Member */}
          <div>
            <label className="block mb-2 font-medium" style={{ color: "var(--color-foreground)" }}>
              Add Member Manually
            </label>
            <MemberSearchBar
              allMembers={allMembers}
              onAddMember={handleAddMemberToEntry}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              enteredMembers={enteredMembers}
              onScoreChange={handleScoreChange}
              placeholder="Quick entry: type member name, add space + score, press Enter"
            />
          </div>

          {/* Entered Members List */}
          {enteredMembers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                  Entries ({enteredMembers.length})
                </h3>
                {totalScore > 0 && (
                  <div className="text-sm font-mono font-semibold" style={{ color: "var(--color-primary)" }}>
                    Total: {totalScore.toLocaleString()}
                  </div>
                )}
              </div>
              <div 
                className="rounded-lg p-4 max-h-96 overflow-y-auto space-y-2"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {displayedEntries.map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded"
                    style={{
                      backgroundColor: "rgba(128, 128, 128, 0.05)",
                    }}
                  >
                    <div 
                      className="flex items-center justify-center font-bold text-sm"
                      style={{
                        width: "40px",
                        height: "40px",
                        backgroundColor: "rgba(128, 128, 128, 0.2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "4px",
                        color: "var(--color-foreground)",
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span style={{ color: "var(--color-foreground)" }}>
                        {member.name}
                        {member.kicked && (
                          <span className="ml-2 text-xs" style={{ color: "#ef4444" }}>
                            (kicked)
                          </span>
                        )}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={entries[member.id] || ''}
                      onChange={(e) => handleScoreChange(member.id, e.target.value)}
                      placeholder="Score"
                      className="w-32 px-3 py-2 rounded"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-foreground)",
                      }}
                    />
                    <button
                      onClick={() => handleDeleteEntry(member.id)}
                      className="p-2 rounded hover:opacity-80"
                      style={{
                        backgroundColor: "#ef4444",
                        color: "white",
                      }}
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-Participating Members Section */}
          {enteredMembers.length > 0 && enteredMembers.length < allMembers.filter(m => !m.kicked).length && (
            <button
              onClick={() => {
                const membersToAdd = allMembers.filter(m => 
                  !m.kicked && !enteredMembers.find(em => em.id === m.id)
                );
                setNonParticipatingMembers(membersToAdd);
              }}
              className="w-full px-4 py-2 rounded text-sm"
              style={{
                border: "1px dashed var(--color-border)",
                color: "var(--color-muted)",
                backgroundColor: "rgba(128, 128, 128, 0.03)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(128, 128, 128, 0.1)";
                e.currentTarget.style.color = "var(--color-foreground)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(128, 128, 128, 0.03)";
                e.currentTarget.style.color = "var(--color-muted)";
              }}
            >
              + Add members who did not participate (score: 0)
            </button>
          )}

          {nonParticipatingMembers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                  Non-Participating Members ({nonParticipatingMembers.length})
                </label>
                <button
                  onClick={() => setNonParticipatingMembers([])}
                  className="px-3 py-1 rounded text-xs hover:opacity-80"
                  style={{
                    backgroundColor: "#ef4444",
                    color: "white",
                  }}
                >
                  Clear All
                </button>
              </div>
              <div 
                className="border rounded-lg overflow-auto max-h-48"
                style={{ 
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="p-3 space-y-2">
                  {nonParticipatingMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-3 py-2 rounded"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                      }}
                    >
                      <span style={{ color: "var(--color-foreground)" }}>
                        {member.name}
                        {member.kicked && (
                          <span className="ml-2 text-xs" style={{ color: "#ef4444" }}>
                            (kicked)
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveNonParticipating(member.id)}
                        className="p-2 rounded hover:opacity-80"
                        style={{
                          backgroundColor: "#ef4444",
                          color: "white",
                        }}
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="flex justify-end gap-3 p-4 border-t"
          style={{
            borderColor: "var(--color-border)",
          }}
        >
          <button
            onClick={handleClose}
            className="px-6 py-2 rounded-lg hover:opacity-80"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || enteredMembers.length === 0}
            className="px-6 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "white",
            }}
          >
            {submitting ? "Submitting..." : `Submit ${enteredMembers.length + nonParticipatingMembers.length} Entries`}
          </button>
        </div>
      </div>
    </div>
  );
}
