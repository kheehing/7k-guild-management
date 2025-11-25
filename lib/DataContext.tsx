"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
  created_at?: string;
}

interface DataContextType {
  members: Member[];
  loading: boolean;
  refreshMembers: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, role, kicked, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      // Error loading members
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const refreshMembers = useCallback(async () => {
    await loadMembers();
  }, [loadMembers]);

  return (
    <DataContext.Provider value={{ members, loading, refreshMembers }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
