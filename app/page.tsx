"use client";

import { useEffect } from "react";
import Sidebar from "./components/Sidebar";

export default function Page() {
  useEffect(() => {
    document.title = "Ap0theosis";
  }, []);

  async function submit() {
    await fetch("/api/progress", {
      method: "POST",
      body: JSON.stringify({
        member_id: "uuid-here",
        date: "2024-11-19",
        power_level: 23456
      })
    });
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar>
      <h1 className="text-3xl font-bold">Welcome to My Dashboard sadasdasdadads</h1>
      <p className="mt-4">You can put any page content here.</p>
      </Sidebar>

    </div> 
  );
}
