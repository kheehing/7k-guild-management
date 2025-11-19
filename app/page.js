"use client";

export default function Page() {
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
    <button onClick={submit}>Submit Progress</button>
  );
}
