export default function OverviewTab() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Overview</h1>
      <p className="text-lg" style={{ color: "var(--color-muted)" }}>
        Welcome to the guild management dashboard. Here you can view statistics and recent activity.
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          className="p-6 rounded-lg"
          style={{ 
            backgroundColor: "var(--color-surface)", 
            border: "1px solid var(--color-border)" 
          }}
        >
          <div className="text-sm" style={{ color: "var(--color-muted)" }}>Total Members</div>
          <div className="text-2xl font-bold mt-2">24</div>
        </div>
        <div 
          className="p-6 rounded-lg"
          style={{ 
            backgroundColor: "var(--color-surface)", 
            border: "1px solid var(--color-border)" 
          }}
        >
          <div className="text-sm" style={{ color: "var(--color-muted)" }}>Active Today</div>
          <div className="text-2xl font-bold mt-2">12</div>
        </div>
        <div 
          className="p-6 rounded-lg"
          style={{ 
            backgroundColor: "var(--color-surface)", 
            border: "1px solid var(--color-border)" 
          }}
        >
          <div className="text-sm" style={{ color: "var(--color-muted)" }}>Events This Week</div>
          <div className="text-2xl font-bold mt-2">5</div>
        </div>
      </div>
    </div>
  );
}
