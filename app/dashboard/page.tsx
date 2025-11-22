"use client";

import { useState, useEffect, useCallback, lazy, Suspense, memo } from "react";
import Sidebar from "../components/Sidebar";
import TabNavigation from "../components/TabNavigation";
import MemberProfile from "../components/MemberProfile";

// Lazy load tab components for better performance
const OverviewTab = lazy(() => import("../components/tabs/OverviewTab"));
const MembersTab = lazy(() => import("../components/tabs/MembersTab"));
const CastleRushTab = lazy(() => import("../components/tabs/CastleRushTab"));
const SettingsTab = lazy(() => import("../components/tabs/SettingsTab"));
const AdventTab = lazy(() => import("../components/tabs/AdventTab"));

interface Member {
  id: string;
  name: string;
  role?: string;
  created_at?: string;
  kicked?: boolean;
}

export default function Page() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const handleOpenProfile = useCallback((e: CustomEvent) => {
    setSelectedMember(e.detail);
  }, []);

  const handleBackFromProfile = useCallback(() => {
    setSelectedMember(null);
  }, []);

  useEffect(() => {
    window.addEventListener("openProfile", handleOpenProfile as EventListener);
    return () => window.removeEventListener("openProfile", handleOpenProfile as EventListener);
  }, [handleOpenProfile]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "members", label: "Members" },
    { id: "CastleRush", label: "CastleRush" },
    { id: "advent", label: "Advent" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex h-screen">
      <Sidebar>
        {selectedMember ? (
          <MemberProfile member={selectedMember} onBack={handleBackFromProfile} />
        ) : (
          <>
            <TabNavigation 
              tabs={tabs} 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
            />

            <div className="flex-1">
              <Suspense fallback={
                <div className="p-8">
                  <div className="text-sm" style={{ color: "var(--color-muted)" }}>Loading...</div>
                </div>
              }>
                {activeTab === "overview" && <OverviewTab />}
                {activeTab === "members" && <MembersTab />}
                {activeTab === "CastleRush" && <CastleRushTab />}
                {activeTab === "advent" && <AdventTab />}
                {activeTab === "settings" && <SettingsTab />}
              </Suspense>
            </div>
          </>
        )}
      </Sidebar>
    </div> 
  );
}
