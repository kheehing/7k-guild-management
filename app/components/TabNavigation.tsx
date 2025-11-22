interface Tab {
  id: string;
  label: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div 
      className="flex gap-1 border-b mb-6"
      style={{ borderColor: "var(--color-border)" }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className="px-4 py-2 text-sm font-medium transition-colors relative"
          style={{
            color: activeTab === tab.id ? "white" : "rgba(255, 255, 255, 0.6)",
            borderBottom: activeTab === tab.id ? "2px solid var(--color-primary)" : "2px solid transparent",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
