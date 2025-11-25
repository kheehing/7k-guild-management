# 7K Guild Management System

A modern, high-performance guild management platform built for the **Ap0theosis** guild in Seven Knights. This application provides comprehensive member tracking, event management, performance analytics, and data export capabilities for guild leaders.

## ✨ Key Features

### 📊 Dashboard & Analytics
- **Overview Dashboard**: Real-time guild statistics with activity feed
  - Quick stats cards (active members, guild health, avg performance, at-risk count)
  - Recent activity feed (last 7 events from Castle Rush + Advent)
  - Guild summary and performance indicators
  - Quick navigation tips

- **Analysis Tab**: Comprehensive performance insights
  - **Insights View**: Guild metrics with 4 strategic panels
    - Top Performers (attendance ≥80% + above average)
    - At-Risk Members (attendance <60% or inactive 3+ days)
    - Most Consistent Players (low score variance)
    - Recently Inactive Members
  - **Table View**: Detailed 9-column member breakdown
    - Attendance rates with progress bars
    - CR/Advent participation breakdown
    - Consistency scores and badges
    - Weekly activity heatmaps
  - Filter by: All, Top Performers, At-Risk, Inactive

### 👥 Member Management
- **Member Roster**: Complete member database with search and filtering
  - Add/import members (individual or bulk CSV)
  - Role and status management
  - Show/hide kicked members toggle
  - Sortable by role and name

- **Member Profiles**: Individual performance tracking
  - 7-day performance trend indicator (improvement/decline %)
  - Attendance stats (overall + CR/Advent breakdown)
  - Score metrics (average, peak, recent vs previous)
  - Weekly activity heatmap
  - Score history chart (last 30 events)
  - Inactive member alerts

### 🏰 Event Tracking
- **Castle Rush Tab**: Calendar-based entry management
  - Monthly calendar view with grade badges
  - Add/edit/delete Castle Rush entries
  - Historical entries modal
  - Score grading system (F to EX+)
  - Attendance tracking per castle

- **Advent Expedition Tab**: Boss-based scoring
  - Track all 4 bosses (Teo, Kyle, Yeonhee, Karma)
  - Individual member scores per boss
  - Aggregate performance metrics
  - Grade badges (F to EX+)
  - Add/edit/delete expedition entries

### 📤 Export Functionality
- **Export Tab**: Centralized data export for Discord and backup
  - Last 20 Castle Rush events
  - Last 20 Advent Expedition events
  - **Discord Export**: Markdown format with emojis
    - Guild performance summary
    - Top 10 performers with medals (🥇🥈🥉)
    - Copy to clipboard
  - **JSON Export**: Structured data download
    - Complete event metadata
    - Summary statistics
    - Sorted member entries

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Custom Properties
- **Database**: Supabase PostgreSQL with Row-Level Security
- **Authentication**: Supabase Auth
- **Icons**: react-icons (Font Awesome)
- **Deployment**: Optimized for Vercel

## ⚡ Performance Optimizations

### Load Time Improvements (60-75% faster)
- **Parallel Data Fetching**: All queries run simultaneously with `Promise.all()`
- **Optimized Queries**: Select only needed fields, filter at database level
- **Smart Limits**: Pagination and date-range filtering
- **Direct Supabase Access**: Eliminated API middleman for faster queries
- **Reduced Payloads**: 40-60% smaller data transfers

### Performance Metrics
- Overview Tab: **800ms → 200ms** (75% faster)
- Analysis Tab: **1200ms → 400ms** (67% faster)
- Member Profile: **600ms → 150ms** (75% faster)
- Sidebar: **400ms → 100ms** (75% faster)

See [PERFORMANCE.md](PERFORMANCE.md) for detailed optimization guide and database indexes.

## 🎨 Design System

**Royal Dark Theme** with customizable CSS variables:
- **Backgrounds**: Near-black (#070709) with elevated surfaces
- **Primary**: Royal purple (#3b2b60)
- **Accents**: Aged gold (#b8862f)
- **Semantic Colors**: Alert red, muted gray, success green
- **Typography**: Inter font family with hierarchical sizing

**Edit 5 seed colors** in `app/globals.css` to customize the entire theme.

## 📊 Database Schema

### Core Tables
- `members` - Guild member roster (id, name, role, kicked, created_at)
- `logger` - Audit trail for all changes
- `castle_rush` - Castle Rush events (id, castle, date)
- `castle_rush_entry` - Member participation (member_id, score, attendance)
- `advent_expedition` - Advent Expedition events (id, date)
- `advent_expedition_entry` - Boss-based scores (member_id, boss, total_score, attendance)

**Foreign Keys**: All entries link to logger for audit tracking.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kheehing/7k-guild-management.git
   cd 7k-guild-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...   # Public anon key
   SUPABASE_URL=https://xxx.supabase.co        # Server-side
   SUPABASE_SECRET_KEY=eyJhbGc...              # Service role JWT
   ```

4. **Run database indexes** (optional but recommended)
   
   Execute SQL from [PERFORMANCE.md](PERFORMANCE.md) in Supabase SQL editor.

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

### Build for Production

```bash
npm run build
npm start
```

## 📖 Usage Guide

### Adding Members
1. Click **+** button in sidebar
2. Fill in name, role, groups
3. Submit to add to roster

### Recording Castle Rush
1. Navigate to **Castle Rush** tab
2. Click date on calendar or **+ Add Entry** button
3. Select castle, enter member scores
4. Submit to save

### Recording Advent Expedition
1. Navigate to **Advent** tab
2. Click **+ Add Entry**
3. Select date, enter scores for each boss
4. Submit to save

### Viewing Analytics
1. Go to **Analysis** tab
2. Switch between **Insights** and **Table** views
3. Filter by performance category
4. Click member name in sidebar for detailed profile

### Exporting Data
1. Navigate to **Export** tab
2. Find desired event in list
3. Click **Discord** to copy formatted message
4. Click **JSON** to download structured data

## 🔐 Security Features

- Row-Level Security (RLS) policies on all tables
- Service role separation for admin operations
- Authenticated routes with session management
- Environment variable protection
- Audit logging via logger table

## 📈 Key Metrics Tracked

- **Attendance Rate**: Participation percentage across all events
- **Average Score (7d)**: Rolling 7-day average performance
- **Consistency Score**: Score variance measurement (100 = perfect consistency)
- **Castle Rush Attendance**: CR-specific participation rate
- **Advent Attendance**: Expedition-specific participation rate
- **Days Since Active**: Inactivity tracking for member engagement
- **Weekly Activity**: 7-day participation heatmap
- **Score Trends**: Recent vs previous 7-day comparison

## 🎯 Grading System

### Castle Rush Grades
- **EX+**: ≥100M (Pink gradient)
- **EX**: ≥75M (Blue gradient)
- **SSS**: ≥50M (Bronze gradient)
- **SS**: ≥30M (Gold gradient)
- **S**: ≥15M (Red gradient)
- **A**: ≥10M (Purple gradient)
- **B**: ≥7.5M (Teal gradient)
- **C**: ≥5M (Green gradient)
- **D**: ≥2.5M (Gray gradient)
- **F**: <2.5M (Brown gradient)

### Advent Expedition Grades
- **EX+**: ≥400M
- **EX**: ≥300M
- **SSS**: ≥200M
- **SS**: ≥150M
- **S**: ≥100M
- **A**: ≥75M
- **B**: ≥50M
- **C**: ≥25M
- **D**: ≥10M
- **F**: <10M

## 🗂️ Project Structure

```
7k-guild-management/
├── app/
│   ├── api/                    # API routes (members, castle-rush, advent)
│   ├── components/
│   │   ├── tabs/               # Tab components (Overview, Analysis, etc.)
│   │   ├── Sidebar.tsx         # Main navigation
│   │   └── Modals...           # Entry modals
│   ├── dashboard/              # Main dashboard & member profiles
│   ├── globals.css             # Theme CSS variables
│   └── page.tsx                # Login page
├── lib/
│   ├── supabaseClient.ts       # Supabase client setup
│   └── DataContext.tsx         # Shared data context
├── PERFORMANCE.md              # Optimization guide
└── README.md
```

## 🤝 Contributing

This is a private guild management tool. For feature requests or bug reports, please contact the repository owner.

## 📝 License

[MIT License](LICENSE)

---

**Built for Ap0theosis Guild** | Seven Knights  
Developed with ❤️ by kheehing
