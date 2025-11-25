"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FaTrophy, FaDragon, FaCalendarAlt } from "react-icons/fa";

interface CastleRushRecord {
  id: string;
  castle: string;
  date: string;
  total_score: number;
  attendance_count: number;
  grade: string;
  color: string;
}

interface AdventRecord {
  id: string;
  date: string;
  total_score: number;
  attendance_count: number;
  grade: string;
  color: string;
}

function getScoreGrade(score: number): { grade: string; color: string } {
  if (score >= 100000000) return { grade: "EX+", color: "#FF1493" };
  if (score >= 75000000) return { grade: "EX", color: "#4169E1" };
  if (score >= 50000000) return { grade: "SSS", color: "#8B7355" };
  if (score >= 30000000) return { grade: "SS", color: "#B8860B" };
  if (score >= 15000000) return { grade: "S", color: "#8B0000" };
  if (score >= 10000000) return { grade: "A", color: "#4B0082" };
  if (score >= 7500000) return { grade: "B", color: "#2F4F4F" };
  if (score >= 5000000) return { grade: "C", color: "#006400" };
  if (score >= 2500000) return { grade: "D", color: "#4A5568" };
  return { grade: "F", color: "#8B4513" };
}

function getAdventGrade(score: number): { grade: string; color: string } {
  if (score >= 400000000) return { grade: "EX+", color: "#FF1493" };
  if (score >= 300000000) return { grade: "EX", color: "#4169E1" };
  if (score >= 200000000) return { grade: "SSS", color: "#8B7355" };
  if (score >= 150000000) return { grade: "SS", color: "#B8860B" };
  if (score >= 100000000) return { grade: "S", color: "#8B0000" };
  if (score >= 75000000) return { grade: "A", color: "#4B0082" };
  if (score >= 50000000) return { grade: "B", color: "#2F4F4F" };
  if (score >= 25000000) return { grade: "C", color: "#006400" };
  if (score >= 10000000) return { grade: "D", color: "#4A5568" };
  return { grade: "F", color: "#8B4513" };
}

export default function ViewPage() {
  const [castleRushRecords, setCastleRushRecords] = useState<CastleRushRecord[]>([]);
  const [adventRecords, setAdventRecords] = useState<AdventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'castle' | 'advent'>('castle');

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    try {
      // Fetch Castle Rush records (last 30)
      const { data: crData } = await supabase
        .from('castle_rush')
        .select(`
          id,
          castle,
          date,
          castle_rush_entry (
            score,
            attendance
          )
        `)
        .order('date', { ascending: false })
        .limit(30);

      const crProcessed: CastleRushRecord[] = (crData || []).map((cr: any) => {
        const entries = cr.castle_rush_entry || [];
        const total_score = entries.reduce((sum: number, e: any) => sum + (e.score || 0), 0);
        const attendance_count = entries.filter((e: any) => e.attendance).length;
        const gradeInfo = getScoreGrade(total_score);
        
        return {
          id: cr.id,
          castle: cr.castle,
          date: cr.date,
          total_score,
          attendance_count,
          grade: gradeInfo.grade,
          color: gradeInfo.color,
        };
      });

      setCastleRushRecords(crProcessed);

      // Fetch Advent records (last 30)
      const { data: aeData } = await supabase
        .from('advent_expedition')
        .select(`
          id,
          date,
          advent_expedition_entry (
            total_score,
            attendance
          )
        `)
        .order('date', { ascending: false })
        .limit(30);

      const aeProcessed: AdventRecord[] = (aeData || []).map((ae: any) => {
        const entries = ae.advent_expedition_entry || [];
        const attendedEntries = entries.filter((e: any) => e.attendance);
        const total_score = attendedEntries.reduce((sum: number, e: any) => sum + (e.total_score || 0), 0);
        const attendance_count = attendedEntries.length;
        const gradeInfo = getAdventGrade(total_score);
        
        return {
          id: ae.id,
          date: ae.date,
          total_score,
          attendance_count,
          grade: gradeInfo.grade,
          color: gradeInfo.color,
        };
      });

      setAdventRecords(aeProcessed);
    } catch (error) {
      // Error loading records
    } finally {
      setLoading(false);
    }
  }

  const formatScore = (score: number) => {
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score.toFixed(0);
  };

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: "var(--color-bg)",
        color: "var(--color-foreground)",
      }}
    >
      {/* Header */}
      <div 
        className="border-b sticky top-0 z-10"
        style={{ 
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Ap0theosis Guild Records</h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Seven Knights - Public View
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div 
        className="border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('castle')}
              className="px-6 py-3 font-medium transition-colors flex items-center gap-2"
              style={{
                color: activeTab === 'castle' ? "var(--color-primary)" : "var(--color-muted)",
                borderBottom: activeTab === 'castle' ? "2px solid var(--color-primary)" : "2px solid transparent",
              }}
            >
              <FaTrophy />
              Castle Rush
            </button>
            <button
              onClick={() => setActiveTab('advent')}
              className="px-6 py-3 font-medium transition-colors flex items-center gap-2"
              style={{
                color: activeTab === 'advent' ? "var(--color-primary)" : "var(--color-muted)",
                borderBottom: activeTab === 'advent' ? "2px solid var(--color-primary)" : "2px solid transparent",
              }}
            >
              <FaDragon />
              Advent Expedition
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-lg" style={{ color: "var(--color-muted)" }}>
              Loading records...
            </div>
          </div>
        ) : (
          <>
            {/* Castle Rush Records */}
            {activeTab === 'castle' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent Castle Rush Records</h2>
                  <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                    {castleRushRecords.length} records
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {castleRushRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 rounded-lg border transition-all hover:shadow-lg"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{record.castle}</h3>
                          <div className="text-xs flex items-center gap-1 mt-1" style={{ color: "var(--color-muted)" }}>
                            <FaCalendarAlt size={10} />
                            {new Date(record.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div
                          className="px-3 py-1 rounded font-bold text-sm"
                          style={{
                            backgroundColor: record.color,
                            color: "white",
                          }}
                        >
                          {record.grade}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "var(--color-muted)" }}>Total Score</span>
                          <span className="font-bold">{formatScore(record.total_score)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "var(--color-muted)" }}>Attendance</span>
                          <span className="font-bold">{record.attendance_count} members</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {castleRushRecords.length === 0 && (
                  <div className="text-center py-12">
                    <FaTrophy size={48} style={{ color: "var(--color-muted)", margin: "0 auto 16px" }} />
                    <div style={{ color: "var(--color-muted)" }}>
                      No Castle Rush records found
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Advent Expedition Records */}
            {activeTab === 'advent' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent Advent Expedition Records</h2>
                  <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                    {adventRecords.length} records
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adventRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 rounded-lg border transition-all hover:shadow-lg"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="mb-3">
                        <h3 className="font-bold text-lg">Advent Expedition</h3>
                        <div className="text-xs flex items-center gap-1 mt-1" style={{ color: "var(--color-muted)" }}>
                          <FaCalendarAlt size={10} />
                          {new Date(record.date).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "var(--color-muted)" }}>Total Score</span>
                          <span className="font-bold">{formatScore(record.total_score)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "var(--color-muted)" }}>Participants</span>
                          <span className="font-bold">{record.attendance_count} members</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {adventRecords.length === 0 && (
                  <div className="text-center py-12">
                    <FaDragon size={48} style={{ color: "var(--color-muted)", margin: "0 auto 16px" }} />
                    <div style={{ color: "var(--color-muted)" }}>
                      No Advent Expedition records found
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div 
        className="border-t mt-12"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm" style={{ color: "var(--color-muted)" }}>
          <p>Ap0theosis Guild - Seven Knights</p>
          <p className="mt-1">Read-only public view • Login for full access</p>
        </div>
      </div>
    </div>
  );
}
