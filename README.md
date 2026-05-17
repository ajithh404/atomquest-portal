# AtomQuest — Goal Setting & Tracking Portal

An in-house goal setting, tracking, and governance portal built for Atomberg Technologies' AtomQuest Hackathon 1.0.

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router, TypeScript) |
| **Database + Auth** | Supabase (PostgreSQL + Supabase Auth) |
| **UI** | shadcn/ui + Tailwind CSS |
| **Hosting** | Vercel |
| **Charts** | Recharts |
| **Export** | SheetJS (xlsx) |
| **Notifications** | Resend |

## 🏗️ Architecture

```
┌──────────────────┐     ┌──────────────────────────────┐
│   Next.js App    │────▶│    Supabase                  │
│   (Vercel)       │     │  ┌─────────────────────────┐ │
│                  │     │  │ PostgreSQL (data)        │ │
│  - App Router    │     │  │ Auth (email + password)  │ │
│  - API Routes    │     │  │ Row Level Security       │ │
│  - shadcn/ui     │     │  └─────────────────────────┘ │
└──────────────────┘     └──────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │   Resend     │
  │   (Email)    │
  └──────────────┘
```

**Monthly cost: $0** (all services on free tiers)

## 👥 User Roles

| Role | Capabilities |
|------|-------------|
| **Employee** | Create goal sheets, submit for approval, log quarterly achievements, view progress |
| **Manager** | Review & approve goal sheets, edit targets, add check-in comments, push shared goals |
| **Admin / HR** | Full org visibility, manage thrust areas, open/close quarterly windows, unlock goals, audit trail, export reports |

## 🔧 Local Setup

### Prerequisites
- Node.js 18+
- npm
- A Supabase project

### Steps

1. **Clone the repo:**
   ```bash
   git clone https://github.com/ajithh404/atomquest-portal.git
   cd atomquest-portal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase URL and anon key
   ```

4. **Run database migration:**
   - Open your Supabase SQL Editor
   - Paste the contents of `supabase/migration.sql`
   - Click "Run"

5. **Start dev server:**
   ```bash
   npm run dev
   ```

6. **Open:** [http://localhost:3000](http://localhost:3000)

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Employee | employee@demo.com | Demo@1234 |
| Manager | manager@demo.com | Demo@1234 |
| Admin | admin@demo.com | Demo@1234 |

## 📁 Project Structure

```
/src
  /app
    /(auth)/login         → Login page
    /(protected)
      /goals              → Employee goal management
      /goals/progress     → Achievement tracking
      /team               → Manager team view
      /team/checkins      → Manager check-ins
      /dashboard          → Admin dashboard
      /dashboard/org      → Org hierarchy
      /dashboard/thrust-areas → Thrust area config
      /dashboard/cycles   → Quarterly window management
      /dashboard/reports  → Export reports
      /dashboard/audit    → Audit trail
      /profile            → User profile
  /components
    /ui                   → shadcn/ui components
    app-sidebar.tsx       → Role-based sidebar navigation
    profile-provider.tsx  → Auth context provider
  /lib
    /supabase             → Supabase client configurations
    auth.ts               → Role helpers
    types.ts              → TypeScript type definitions
/supabase
  migration.sql           → Full database schema + seed data
```

## 📋 Validation Rules

- Total weightage across all goals in one sheet = exactly **100%**
- Minimum weightage per goal: **10%**
- Maximum goals per sheet: **8**
- Shared goals: recipients can only edit weightage
- Goals locked after manager approval (admin can unlock with audit trail)
- Quarterly achievement entry restricted to open windows

## 📊 Progress Score Formulas

| UoM Type | Formula | Example |
|----------|---------|---------|
| **Min** (higher is better) | `actual ÷ target` | Sales: 42/50 = 84% |
| **Max** (lower is better) | `target ÷ actual` | TAT: 24/28 = 85.7% |
| **Timeline** (date-based) | `1` if on time, else prorated | Deadline compliance |
| **Zero** (zero = success) | `1` if actual == 0, else `0` | Zero defects |

All scores capped at **100%**.

## 📄 License

Private — Built for AtomQuest Hackathon 1.0
