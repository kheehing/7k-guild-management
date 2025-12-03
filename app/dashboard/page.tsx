"use client";

import { useState, useEffect, useCallback, lazy, Suspense, memo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "../components/Sidebar";
import TabNavigation from "../components/TabNavigation";
import MemberProfile from "../components/MemberProfile";

// Lazy load tab components for better performance
const OverviewTab = lazy(() => import("../components/tabs/OverviewTab"));
const MembersTab = lazy(() => import("../components/tabs/MembersTab"));
const AnalysisTab = lazy(() => import("../components/tabs/AnalysisTab"));
const CastleRushTab = lazy(() => import("../components/tabs/CastleRushTab"));
const ExportTab = lazy(() => import("../components/tabs/ExportTab"));
const AdventTab = lazy(() => import("../components/tabs/AdventTab"));

interface Member {
  id: string;
  name: string;
  role?: string;
  created_at?: string;
  kicked?: boolean;
}

export default function Page() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  // All hooks must be called before any conditional returns
  const handleOpenProfile = useCallback((e: CustomEvent) => {
    setSelectedMember(e.detail);
  }, []);

  const handleBackFromProfile = useCallback(() => {
    setSelectedMember(null);
  }, []);

  const handleUpdateMember = useCallback((updatedMember: Member) => {
    setSelectedMember(updatedMember);
    // Trigger a refresh of the sidebar member list
    window.dispatchEvent(new CustomEvent("memberUpdated"));
  }, []);

  // Check authentication on mount and set up auth listener
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) {
        if (!user) {
          router.push("/");
        } else {
          setLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for auth state changes (including session expiry)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        router.push("/");
      } else if (!session) {
        router.push("/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    window.addEventListener("openProfile", handleOpenProfile as EventListener);
    return () => window.removeEventListener("openProfile", handleOpenProfile as EventListener);
  }, [handleOpenProfile]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
        <div className="text-sm" style={{ color: "var(--color-muted)" }}>Loading...</div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "members", label: "Members" },
    { id: "analysis", label: "Analysis" },
    { id: "CastleRush", label: "CastleRush" },
    { id: "advent", label: "Advent" },
    { id: "export", label: "Export" },
  ];

  return (
    <div className="flex h-screen">
      <Sidebar>
        {selectedMember ? (
          <MemberProfile 
            member={selectedMember} 
            onBack={handleBackFromProfile}
            onUpdate={handleUpdateMember}
          />
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
                {activeTab === "analysis" && <AnalysisTab />}
                {activeTab === "CastleRush" && <CastleRushTab />}
                {activeTab === "advent" && <AdventTab />}
                {activeTab === "export" && <ExportTab />}
              </Suspense>
            </div>
          </>
        )}
      </Sidebar>
    </div> 
  );
}
