# AI Agent Instructions for 7K Guild Management

## Architecture Overview

This is a **Next.js 15 App Router** application for managing 7K game guild members, tracking Castle Rush and Advent Expedition events. The architecture separates:
- **Client components** (`"use client"`) for interactive UI (Sidebar, tabs, modals)
- **Server components** for static content and initial data loading
- **API routes** (`app/api/**/route.ts`) using Supabase service role key for database operations

## Database & Data Flow

**Supabase PostgreSQL** with two client patterns:
- `lib/supabaseClient.ts` exports:
  - `supabase` — client-side with anon key (respects RLS)
  - `supabaseAdmin` — server-side with service role key (bypasses RLS)

**Key tables**:
- `logger` — audit trail (id, logged_by, created_at)
- `members` — guild members (id, name, role, kicked, kick_date, logger_id, created_at)
  - `kicked` (boolean, default false): member status
  - `kick_date` (date, nullable): date member was kicked
  - Foreign key to logger for audit tracking
- `castle_rush` — event records (id, castle, date, logger_id, created_at)
  - Foreign key to logger
- `castle_rush_entry` — member participation (id, member_id, castle_rush_id, attendance, score, logger_id, created_at)
  - Foreign keys to members, castle_rush, and logger
- `advent_expedition` — expedition events (id, date, logger_id, created_at)
  - Foreign key to logger
- `advent_expedition_entry` — expedition participation (id, advent_expedition_id, member_id, date, boss, attendance, total_score, logger_id, created_at)
  - Foreign keys to advent_expedition, members, and logger

**Critical pattern**: Always fetch via API routes (`/api/members`, `/api/castle-rush-entry`, `/api/dev/castle-rush-entries`) from client components. Direct Supabase queries are only in API routes or tabs using `supabase.from()` with proper joins. For member status, always join and select `kicked` and `kick_date` fields from `members`.

## Theme System (CSS Variables)

**Royal dark theme** built with CSS custom properties in `app/globals.css`:
- Edit **5 seed colors** at top of `:root` to change entire theme
- Semantic tokens: `--color-primary`, `--color-surface`, `--color-foreground`, `--color-border`, `--color-muted`
- Dark mode overrides in `@media (prefers-color-scheme: dark)`
- Use inline styles: `style={{ backgroundColor: "var(--color-surface)" }}` (not Tailwind classes for theme colors)

## Development Workflow

```bash
npm run dev          # Start dev server (Next.js 15)
npm run build        # Production build
npm run lint         # ESLint check
```

**Environment setup** (`.env.local` — never commit):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...   # Public anon key
SUPABASE_URL=https://xxx.supabase.co        # Server-side (same URL)
SUPABASE_SECRET_KEY=eyJhbGc...              # Service role JWT (long token, not sb_secret_*)
```

**Common debugging**: If API returns `{"members":[]}` but DB has data, check RLS policies. Service role should bypass RLS, but if using wrong key format (e.g., `sb_secret_*` instead of JWT), queries fail silently.

## Code Conventions

**Component patterns**:
- Tab components (`app/components/tabs/*Tab.tsx`) fetch data directly via `supabase.from()` using client
- Reusable UI components use props and callbacks, not direct data fetching
- Modals toggle via local state (`isAddOpen`) with backdrop overlay pattern
- Loading states: Set to false immediately after fetching members for faster UI, background operations async
- **Entry modals** use search-based quick entry system (type name + space + score + Enter)

**Modal entry patterns** (CastleRushEntryModal, HistoricalCastleRushModal):
- **New entries**: Blank canvas, no members shown initially
- **Edit mode**: Shows only previously saved members (excludes kicked in display, but searchable)
- **Search system**: 
  - Type member name → dropdown appears with all members (including kicked)
  - Add space + score → green border indicates ready
  - Press Enter → auto-adds member and sets score
  - Dropdown shows status: "(active)" green, "(kicked)" red for entered members
- **Quick entry workflow**: Members automatically added when score entered via search
- **Member management**: Add/Delete buttons, entries object tracks scores separately from member list
- **State structure**:
  - `allMembers`: Full roster for searching
  - `enteredMembers`: Currently entered participants
  - `entries`: Score mapping `{ memberId: "score" }`
  - `searchQuery`: Current search text
  - `isEditMode`: Boolean flag for edit vs. add mode
  - For member status, use `kicked` and `kick_date` from `members` table. Display kicked status in all edit/admin views.

**Data fetching**:
```tsx
// In client components (tabs):
const { data, error } = await supabase.from('members').select('*');

// In API routes:
const { data, error } = await supabaseAdmin.from('members').select('*');

// For castle rush entry admin/dev API:
const { data, error } = await supabaseAdmin
  .from('castle_rush_entry')
  .select(`
    id,
    member_id,
    score,
    attendance,
    castle_rush_id,
    created_at,
    members (
      name,
      kicked,
      kick_date
    )
  `)
```

**Styling**:
- Use CSS variables for colors: `style={{ color: "var(--color-foreground)" }}`
- Tailwind for layout/spacing: `className="p-4 rounded-lg"`
- Hover states: inline `onMouseEnter/onMouseLeave` for dynamic `backgroundColor`

## Analytics Logic (AnalysisTab)

**Key metrics calculation**:
- **Attendance rate**: `(attended entries / total entries) * 100`
- **Average score (7d)**: Sum all scores from entries in last 7 **days** (not 7 entries), divide by entry count
- **Weekly activity**: Count attended entries per day for last 7 days
- **Last active**: Days since most recent entry, show "Up to date" if ≤1 day

**Filtering**: Exclude `kicked: true` members from analysis tables. For admin/dev views, display `kicked` and `kick_date` status for each member.

## Common Patterns

**Add member flow**:
1. Sidebar → Plus button → Modal with form
2. POST `/api/members` with `{ name, role, groups, log_by: "web" }`
3. On success, prepend new member to local state, close modal

**Error handling**: Log to console, show error message in UI state. API routes return `NextResponse.json({ error: message }, { status: 500 })`.

**Authentication**: Login page (`app/page.tsx`) uses `supabase.auth.signInWithPassword()`. On success, redirects to `/dashboard` via `router.push()`.

## File Structure Quick Reference

```
app/
  api/members/route.ts          # GET/POST members (uses supabaseAdmin)
  components/
    Sidebar.tsx                 # Left nav with member list, search, add button
    tabs/
      OverviewTab.tsx           # Guild stats, last entry, weekly summary
      AnalysisTab.tsx           # Member performance metrics table
      MembersTab.tsx            # Member management CRUD
  page.tsx                      # Login page (sign in only, no sign up)
  dashboard/page.tsx            # Main authenticated view
  globals.css                   # Theme CSS variables (5 seed colors)
lib/
  supabaseClient.ts             # Dual client exports (public + admin)
```

## Critical "Gotchas"

1. **RLS policies**: If queries return empty but data exists, add policy: `CREATE POLICY "service_role_full_access" ON table FOR ALL TO service_role USING (true);`
2. **Env var format**: `SUPABASE_SECRET_KEY` must be full JWT (starts with `eyJhbGc`), not `sb_secret_*` format
3. **Dark mode**: Changes in `globals.css` `@media (prefers-color-scheme: dark)` block, not component-level
4. **Weekly activity**: Counts attendance=true only, not all entries
5. **Average score (7d)**: Includes entries with score=0 in calculation (Option 2 pattern)

---

**When in doubt**: Check existing tab components for data fetching patterns, API routes for server-side query structure, and `globals.css` for theming tokens.
