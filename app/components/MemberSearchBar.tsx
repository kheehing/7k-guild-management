import { useMemo } from "react";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
}

interface MemberSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  allMembers: Member[];
  enteredMembers: Member[];
  isEditMode?: boolean;
  onAddMember: (memberId: string) => void;
  onScoreChange: (memberId: string, score: string) => void;
  onEntryCountChange?: (memberId: string, count: string) => void;
  placeholder?: string;
}

export default function MemberSearchBar({
  searchQuery,
  onSearchChange,
  allMembers,
  enteredMembers,
  isEditMode = false,
  onAddMember,
  onScoreChange,
  onEntryCountChange,
  placeholder = "Quick entry: type member name, add space + score, press Enter"
}: MemberSearchBarProps) {
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Calculate search results inline
      // Pattern: name OR name score OR name score entryCount
      const queryWithoutNumbers = searchQuery.replace(/\s+\d+(\s+\d+)?$/, '').toLowerCase().trim();
      const results = allMembers.filter((m) => 
        (isEditMode || !m.kicked) && 
        m.name.toLowerCase().includes(queryWithoutNumbers)
      );
      
      if (results.length === 1) {
        const member = results[0];
        const isAlreadyEntered = enteredMembers.find(m => m.id === member.id);
        
        // Auto-add member if not already entered
        if (!isAlreadyEntered) {
          onAddMember(member.id);
        }
        
        // Check for score and optional entry count in search query
        // Pattern: "name 1000 5" means score=1000, entryCount=5
        const twoNumberMatch = searchQuery.match(/\s+(\d+)\s+(\d+)$/);
        const oneNumberMatch = searchQuery.match(/\s+(\d+)$/);
        
        if (twoNumberMatch && onEntryCountChange) {
          // Has both score and entry count
          const score = twoNumberMatch[1];
          const entryCount = twoNumberMatch[2];
          onScoreChange(member.id, score);
          onEntryCountChange(member.id, entryCount);
          onSearchChange("");
        } else if (oneNumberMatch) {
          // Has only score
          const score = oneNumberMatch[1];
          onScoreChange(member.id, score);
          onSearchChange("");
        }
      }
    }
  };

  // Search results for quick entry - only shows when searching
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const queryWithoutNumbers = searchQuery.replace(/\s+\d+(\s+\d+)?$/, '').toLowerCase().trim();
    const filtered = allMembers.filter((m) => 
      // In edit mode, always show all members (including kicked)
      // In add mode, only show active members
      (isEditMode || !m.kicked) && 
      m.name.toLowerCase().includes(queryWithoutNumbers)
    );
    
    return filtered;
  }, [allMembers, searchQuery, isEditMode]);

  const twoNumberMatch = searchQuery.match(/\s+(\d+)\s+(\d+)$/);
  const oneNumberMatch = searchQuery.match(/\s+(\d+)$/);
  const numberMatch = twoNumberMatch || oneNumberMatch;
  const isReadyToSubmit = searchResults.length === 1 && !!numberMatch;
  const isSingleResult = searchResults.length === 1 && !numberMatch;

  return (
    <div className="mb-3 relative">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded border text-sm"
        style={{
          background: "rgba(128, 128, 128, 0.1)",
          borderColor: isReadyToSubmit ? "#22C55E" : isSingleResult ? "#FBBF24" : "var(--color-border)",
          color: isReadyToSubmit ? "#22C55E" : isSingleResult ? "#FBBF24" : "var(--color-foreground)",
        }}
      />

      {/* Search results dropdown - only show when searching */}
      {searchQuery && searchResults.length > 0 && (
        <div 
          className="border rounded-lg overflow-auto absolute z-50 w-full mt-1"
          style={{ 
            borderColor: "var(--color-border)",
            maxHeight: "200px",
            backgroundColor: "var(--color-surface)",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)"
          }}
        >
          {searchResults.map((member) => {
            const isAlreadyEntered = enteredMembers.find(m => m.id === member.id);
            const isItemReadyToSubmit = searchResults.length === 1 && !!numberMatch;
            const isItemSingleResult = searchResults.length === 1 && !numberMatch;
            
            return (
              <div
                key={member.id}
                onClick={() => {
                  if (!isAlreadyEntered) {
                    onAddMember(member.id);
                  }
                  if (twoNumberMatch && onEntryCountChange) {
                    onScoreChange(member.id, twoNumberMatch[1]);
                    onEntryCountChange(member.id, twoNumberMatch[2]);
                    onSearchChange("");
                  } else if (oneNumberMatch) {
                    onScoreChange(member.id, oneNumberMatch[1]);
                    onSearchChange("");
                  }
                }}
                className="px-3 py-2 cursor-pointer border-b"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: isItemReadyToSubmit ? "rgba(34, 197, 94, 0.1)" : isItemSingleResult ? "rgba(251, 191, 36, 0.1)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isItemReadyToSubmit ? "rgba(34, 197, 94, 0.2)" : isItemSingleResult ? "rgba(251, 191, 36, 0.2)" : "rgba(128, 128, 128, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isItemReadyToSubmit ? "rgba(34, 197, 94, 0.1)" : isItemSingleResult ? "rgba(251, 191, 36, 0.1)" : "transparent";
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {member.name}
                    {isAlreadyEntered && (
                      <span className="ml-1 text-xs" style={{ color: member.kicked ? "#ef4444" : "#22C55E" }}>
                        ({member.kicked ? "kicked" : "active"})
                      </span>
                    )}
                    {!isAlreadyEntered && member.kicked && <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>(kicked)</span>}
                  </span>
                  {isItemReadyToSubmit && numberMatch && (
                    <span className="text-xs font-semibold" style={{ color: "#22C55E" }}>
                      {twoNumberMatch ? (
                        <>Score: {parseInt(twoNumberMatch[1], 10).toLocaleString()} | Entries: {parseInt(twoNumberMatch[2], 10)}</>
                      ) : (
                        <>Score: {parseInt(numberMatch[1], 10).toLocaleString()}</>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
