# DwellPass - Event Management & Attendance Tracking System

**Complete Technical Documentation for Full Application Recreation**

---

## 📋 Executive Summary

**DwellPass** is a sophisticated, production-ready event management and attendance tracking application designed for churches, community organizations, venues, and event coordinators. It features a **local-first architecture** powered by TanStack DB, providing instant reactivity and offline-capable operation while seamlessly syncing with backend APIs.

### Core Capabilities
- **Event Management**: Full CRUD operations for creating, scheduling, and managing events with calendar visualization
- **Member/Patron Management**: Comprehensive user database with loyalty tier tracking
- **Real-time Attendance Tracking**: Check-in/check-out system with live statistics
- **Loyalty System**: Points-based rewards program with tier progression (Bronze → Silver → Gold → Platinum)
- **Analytics Dashboard**: Interactive charts and metrics with draggable, resizable panels
- **Responsive Dark UI**: Neon lime (#d4ff00) accent design with professional enterprise-grade components

### Technology Philosophy
- **Local-First with TanStack DB**: Client-side reactive database with live queries, optimistic updates, and automatic server synchronization
- **Offline-Capable**: Full application functionality without network connectivity, syncs when reconnected
- **Type-Safe**: End-to-end TypeScript with Zod schema validation
- **Cloud-Ready**: Flexible backend with PostgreSQL support for production deployment
- **Modern Stack**: React 19, Hono API, Drizzle ORM, TailwindCSS 4, AG Grid

---

## 🏗️ Architecture Overview

### System Design

```
┌──────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Browser)                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  React 19.2.1 + TanStack Router 1.140.5                        │  │
│  │                                                                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │  │
│  │  │ TanStack DB  │  │ Collections  │  │ Zustand Store        │ │  │
│  │  │ (Live Query) │  │ (CRUD)       │  │ (UI State)           │ │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘ │  │
│  └─────────┼──────────────────┼─────────────────────────────────── │  │
│            │                  │ HTTP Fetch API (/api/*)            │  │
└────────────┼──────────────────┼────────────────────────────────────┘
             │                  ↓
┌────────────┼──────────────────────────────────────────────────────────┐
│            │          SERVER (Bun Runtime)                            │
│  ┌─────────┴──────────────────────────────────────────────────────┐  │
│  │  Hono v4.10.7 API Server (Port 3000)                           │  │
│  │                                                                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │  Users   │  │  Events  │  │Attendance│  │  Loyalty     │  │  │
│  │  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes      │  │  │
│  │  │          │  │          │  │          │  │              │  │  │
│  │  │ GET/POST │  │ GET/POST │  │ GET/POST │  │ GET/POST     │  │  │
│  │  │ PUT/DEL  │  │ PUT/DEL  │  │ CHECKIN  │  │ AWARD POINTS │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │  │
│  └───────┼─────────────┼─────────────┼───────────────┼──────────┘  │
│          │             │             │               │              │
│          └─────────────┴─────────────┴───────────────┘              │
│                               ↓                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Drizzle ORM v0.45.1 (PostgreSQL Dialect)                     │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Schema Definitions (Single Source of Truth)             │ │ │
│  │  │  - Zod Schemas (Validation)                              │ │ │
│  │  │  - TypeScript Types (Type Safety)                        │ │ │
│  │  │  - Drizzle Tables (Database Operations)                  │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────────┼─────────────────────────────────────┘
                                 ↓
┌────────────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL (Flexible Configuration)                             │ │
│  │  ───────────────────────────────────                             │ │
│  │  - Embedded database for local development                       │ │
│  │  - Hosted PostgreSQL for production (Vercel, Neon, Supabase)    │ │
│  │  - Cloud-native options (Cloudflare D1 compatible)              │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Local-First Architecture

The application uses **TanStack DB** as its primary data layer, providing:
- **Client-Side Database**: Full reactive data store in the browser
- **Live Queries**: Components automatically re-render when data changes
- **Optimistic Updates**: Instant UI feedback before server confirmation
- **Automatic Sync**: Background synchronization with backend APIs
- **Offline Support**: Continue working without network, sync when reconnected
- **Conflict Resolution**: Built-in handling for concurrent modifications

The backend API serves as the source of truth and persistence layer, with flexible database options (embedded or hosted PostgreSQL).

---

## 📦 Technology Stack

### Frontend Framework & Libraries

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 19.2.1 | Core UI library with React 19 compiler |
| **TanStack Router** | 1.140.5 | Type-safe file-based routing |
| **TanStack DB** | 0.1.60 | Reactive local database with live queries |
| **TanStack React Query** | 5.90.12 | Server state management |
| **TanStack React Form** | 1.27.7 | Form state management with validation |
| **Zustand** | 5.0.9 | Global UI state (sidebars, modals) |
| **TailwindCSS** | 4.1.18 | Utility-first CSS framework |
| **shadcn/ui** | 3.6.2 | Accessible component primitives |
| **AG Grid Community** | 35.0.0 | Enterprise-grade data grid |
| **FullCalendar** | 6.1.19 | Interactive calendar with drag/drop |
| **Recharts** | 3.6.0 | Declarative charting library |
| **React Grid Layout** | 2.0.0 | Draggable, resizable dashboard panels |
| **Lucide React** | 0.562.0 | Icon library |
| **Zod** | 4.1.13 | Schema validation |

### Backend Framework & Database

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Bun** | >=1.3.0 | JavaScript runtime (server & package manager) |
| **Hono** | 4.10.7 | Lightweight web framework |
| **Drizzle ORM** | 0.45.1 | TypeScript ORM for SQL databases |
| **PostgreSQL** | 14+ | Production database (flexible: embedded or hosted) |
| **Drizzle Kit** | 0.31.8 | Schema migration tool |

### Build Tools & Development

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Vite (Rolldown)** | 7.3.0 | Ultra-fast build tool (Rust-based) |
| **TypeScript** | 5.9.3 | Static type checking |
| **ESLint** | 9.39.1 | Code linting |
| **Babel React Compiler** | 1.0.0 | React auto-memoization |

---

## 🗄️ Database Architecture

### Entity Relationship Diagram

```
┌─────────────────────────┐
│        users            │
├─────────────────────────┤
│ id         UUID (PK)    │◄───┐
│ email      TEXT UNIQUE  │    │
│ firstName  TEXT         │    │   ┌─────────────────────────┐
│ lastName   TEXT         │    │   │       events            │
│ phone      TEXT?        │    │   ├─────────────────────────┤
│ createdAt  TIMESTAMPTZ  │    │   │ id          UUID (PK)   │
│ updatedAt  TIMESTAMPTZ  │    │   │ name        TEXT        │
└─────────────────────────┘    │   │ description TEXT?       │
        │                      │   │ status      ENUM        │
        │                      │   │ startTime   TIMESTAMPTZ │
        │                      │   │ endTime     TIMESTAMPTZ │
        │                      └───┤ hostId      UUID (FK)   │
        │                          │ location    TEXT        │
        │                          │ capacity    INT?        │
        │                          │ createdAt   TIMESTAMPTZ │
        │                          │ updatedAt   TIMESTAMPTZ │
        │                          └────────┬────────────────┘
        │                                   │
        ├───────────┬───────────────────────┘
        │           │
        ↓           ↓
┌─────────────────────────┐        ┌─────────────────────────┐
│      attendance         │        │       loyalty           │
├─────────────────────────┤        ├─────────────────────────┤
│ id           UUID (PK)  │        │ id          UUID (PK)   │
│ eventId      UUID (FK)  │        │ patronId    UUID (FK)   │
│ patronId     UUID (FK)  │        │ description TEXT        │
│ attended     BOOLEAN    │        │ tier        ENUM?       │
│ checkInTime  TIMESTAMPTZ│        │ points      INT         │
│ checkOutTime TIMESTAMPTZ│        │ reward      TEXT?       │
└─────────────────────────┘        │ issuedAt    TIMESTAMPTZ │
                                   │ expiresAt   TIMESTAMPTZ?│
                                   └─────────────────────────┘
```

### Table Definitions

#### **users** Table
- Stores all members/patrons who can attend events
- Fields: id, email (unique), firstName, lastName, phone, createdAt, updatedAt
- Indexed on: email, createdAt
- Referenced by: attendance, loyalty, events (as host)

#### **events** Table
- Stores all events with scheduling information
- Fields: id, name, description, status, startTime, endTime, location, capacity, hostId, createdAt, updatedAt
- Status Enum: `draft | scheduled | ongoing | completed | cancelled`
- Indexed on: status, hostId, startTime
- References: users (hostId)

#### **attendance** Table
- Tracks attendance records with check-in/check-out timestamps
- Fields: id, eventId, patronId, attended, checkInTime, checkOutTime
- Business Logic: One attendance record per patron per event
- Indexed on: eventId, patronId, attended, (eventId + patronId) composite
- Cascade deletes when event or user is deleted

#### **loyalty** Table
- Tracks loyalty points, tiers, and rewards
- Fields: id, patronId, description, tier, points, reward, issuedAt, expiresAt
- Tier Calculation: Bronze (0-1999) → Silver (2000-4999) → Gold (5000-9999) → Platinum (10000+)
- Indexed on: patronId, tier
- References: users (patronId)

---

## 🔌 Backend API Architecture

### Server Setup

- **Runtime**: Bun 1.3.0+ 
- **Framework**: Hono v4.10.7
- **Port**: 3000 (configurable via process.env.PORT)
- **Middleware**: Logger, CORS, Optional throttle for testing
- **API Routes**: Users, Events, Attendance, Loyalty

### API Endpoints Reference

#### **Users API** (`/api/users`)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/users` | List all users | - | `User[]` |
| GET | `/api/users/:id` | Get user by ID | - | `User` |
| POST | `/api/users` | Create new user | `{ email, firstName, lastName, phone? }` | `User` (201) |
| PUT | `/api/users/:id` | Update user | Partial user fields | `User` |
| DELETE | `/api/users/:id` | Delete user | - | `{ success: true }` |

**Validation**: Zod schema validation, email uniqueness enforced

#### **Events API** (`/api/events`)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/events` | List all events (filterable by status, hostId) | - | `Event[]` |
| GET | `/api/events/:id` | Get event by ID | - | `Event` |
| POST | `/api/events` | Create new event | `{ name, status, startTime, endTime, location, capacity?, hostId }` | `Event` (201) |
| PUT | `/api/events/:id` | Update event | Partial event fields | `Event` |
| PATCH | `/api/events/:id/status` | Update event status only | `{ status }` | `Event` |
| DELETE | `/api/events/:id` | Delete event | - | `{ success: true }` |

**Query Parameters**: `?status=`, `?hostId=`

#### **Attendance API** (`/api/attendance`)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/attendance` | List all attendance | Query: `?eventId=`, `?patronId=` | `Attendance[]` |
| GET | `/api/attendance/:id` | Get attendance by ID | - | `Attendance` |
| GET | `/api/attendance/event/:eventId/stats` | Get event statistics | - | `AttendanceStats` |
| POST | `/api/attendance` | Create attendance record | `CreateAttendanceSchema` | `Attendance` (201) |
| POST | `/api/attendance/checkin` | Check-in to event | `{ eventId, patronId }` | `Attendance` |
| POST | `/api/attendance/checkout` | Check-out from event | `{ eventId, patronId }` | `Attendance` |
| PUT | `/api/attendance/:id` | Update attendance | `UpdateAttendanceSchema` | `Attendance` |
| DELETE | `/api/attendance/:id` | Delete attendance | - | `{ success: true }` |

**AttendanceStats Response**:{ email, firstName, lastName, phone? }` | `User` (201) |
| PUT | `/api/users/:id` | Update user | Partial user fields | `User` |
| DELETE | `/api/users/:id` | Delete user | - | `{ success: true }` |

**Validation**: Zod schema validation, email uniqueness enforced
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/loyalty` | List all loyalty record(filterable by eventId, patronId) | - | `Attendance[]` |
| GET | `/api/attendance/:id` | Get attendance by ID | - | `Attendance` |
| GET | `/api/attendance/event/:eventId/stats` | Get event statistics | - | `{ total, attended, checkedIn, checkedOut }` |
| POST | `/api/attendance` | Create attendance record | `{ eventId, patronId, attended?, checkInTime?, checkOutTime? }` | `Attendance` (201) |
| POST | `/api/attendance/checkin` | Check-in to event | `{ eventId, patronId }` | `Attendance` |
| POST | `/api/attendance/checkout` | Check-out from event | `{ eventId, patronId }` | `Attendance` |
| PUT | `/api/attendance/:id` | Update attendance | Partial attendance fields | `Attendance` |
| DELETE | `/api/attendance/:id` | Delete attendance | - | `{ success: true }` |

**Check-in/Check-out Logic**: Automatically creates or updates records with timestamps

## 🎨 Frontend Architecture

### Routing Structure (TanStack Router)

```
/                           → HomePage (Analytics + Members grid)
├── /members                → MembersPage (AG Grid table)
├── /events                 → EventsPage (FullCalendar)
├── /analytics              → Analytics (Charts & metrics)
├── /database               → TablesPage (Database viewer)
└── /component-example      → ComponentExample (UI showcase)
```

**Layout Structure**:
```tsx
<RootLayout>                 // Persistent layout wrapper
  ├── <LeftSidebar>          // Navigation menu
  │   ├── Team Switcher(filterable by patronId, tier) | - | `Loyalty[]` |
| GET | `/api/loyalty/:id` | Get loyalty record by ID | - | `Loyalty` |
| GET | `/api/loyalty/patron/:patronId/points` | Get patron's total active points | - | `{ patronId, totalPoints }` |
| GET | `/api/loyalty/patron/:patronId/tier` | Calculate patron's tier | - | `{ patronId, tier, totalPoints }` |
| POST | `/api/loyalty` | Create loyalty record | `{ patronId, description, tier?, points?, reward?, expiresAt? }` | `Loyalty` (201) |
| POST | `/api/loyalty/award-points` | Award points to patron | `{ patronId, points, description }` | `Loyalty` (201) |
| POST | `/api/loyalty/award-reward` | Award reward to patron | `{ patronId, reward, description, expiresAt? }` | `Loyalty` (201) |
| PUT | `/api/loyalty/:id` | Update loyalty record | Partial loyalty fields | `Loyalty` |
| DELETE | `/api/loyalty/:id` | Delete loyalty record | - | `{ success: true }` |
```

**Collections Defined**:
- `userCollection` - User/member data
- `eventCollection` - Event data with date transformations

#### 2. **UI State - Zustand Stores**

```typescript
// App Store (src/store.ts). Each collection (users, events) handles:
- Fetching data via `queryFn`
- Optimistic mutations (insert/update/delete)
- Automatic background sync with backend API
- Live queries that reactively update components

Components use `useLiveQuery((q) => q.from({ collection }))` to subscribe to real-time data changes.

#### 2. **UI State - Zustand Stores**

- **AppStore**: Sidebar visibility, global UI events
- **LauncherStore**: Modal management (open/close, content injection)
- Redux DevTools integration for debugging Total Members
  - Events This Month
  - Avg Attendance
  - Active Streaks
- **Charts**:
  - Monthly Attendance Trend (Bar Chart - Recharts)
  - Attendance Distribution (Pie Chart - Recharts)
- **Interactivity**:
  - Drag handles (⋮⋮) on each panel
  - Responsive breakpoints: lg, md, sm, xs, xxs
  - Grid configuration: `rowHeight: 40px`, `cols: {lg: 12, md: 10, sm: 6}`

---

## 🎨 Design System

### Color Palette (Dark Theme)

- **Primary**: Neon Lime (#d4ff00) - OKLCH(93.604% 0.22511 121.257)
- **Background**: Almost black - OKLCH(0.145 0 0)
- **Card**: Slightly lighter - OKLCH(0.205 0 0)
- **Foreground**: Off-white text - OKLCH(0.985 0 0)
- **Border**: Subtle white - OKLCH(1 0 0 / 10%)
- **Destructive**: Red for errors - OKLCH(0.704 0.191 22.216)

### Typography

- **Font**: Inter Variable (sans-serif)
- **Sizes**: Title (32px), Header (24px), Card (18px), Body (14px), Small (13px)

### Component Styling Patterns

#### **AG Grid Theme Customization**
```typescript
const theme = themeMaterial.withParams({
  backgroundColor: 'var(--background)',
  headerBackgroundColor: 'var(--background-darker)',
  headerTextColor: 'var(--primary)',
  oddRowBackgroundColor: 'var(--card)',
  rowHoverColor: 'rgba(212, 255, 0, 0.05)',      // 5% lime overlay
  selectedRowBackgroundColor: 'rgba(212, 255, 0, 0.1)',
  borderColor: 'var(--border)',
  foregroundColor: 'var(--foreground)',
  browserColorScheme: "dark",
  checkboxUncheckedBackgroundColor: 'var(--primary)',
  checkboxCheckedBackgroundColor: 'var(--primary)',
  fontSize: 13,
  headerFontSize: 12,
  spacing: 4
});
```


### UI Component Library (shadcn/ui)

**Installed Components**:
- Button
- Input
- Card (CardHeader, CardTitle, CardDescription, CardContent)
- Field (FieldGroup, FieldLabel, FieldDescription, FieldError)
- Dialog (Modal implementation via @base-ui/react)
- Chart (ChartContainer, ChartTooltip, ChartLegend)

Components are configured via `components.json` with path aliases and style presets for consistent usage across the application.

---

## 🧩 Core Components Deep Dive

### **GridTable Component** (`src/components/grid-table/index.tsx`)

Enterprise-grade data table wrapper around AG Grid:

```typescript
interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  action: () => void;
  disabled?: boolean;
}

interface GridTableProps extends AgGridReactProps {
  title?: string;
  subtitle?: string;
  menu?: MenuItem[];
  loading?: boolean;
}
```

**Features**:
- Custom theme with dark mode support
- Action menu in header
- Default column configuration (sortable, resizable, editable)
- Row selection (single row, click-to-select)
- Loading states
- Custom cell renderers support

**Usage Example**:
```tsx
<GridTable
  title="Member Attendance Records"
  subtitle={`${rowData.length} total members`}
  menu={[
    { id: 'filter', label: 'Filter', icon: <Filter />, action: () => {...} },
    { id: 'add', label: 'Create User', icon: <PlusCircle />, action: () => {...} },
  ]}
  columnDefs={columnDefs}
  rowData={rowData}
  onRowClicked={(e) => handleRowClick(e)}
/>
```


**Step 2**: Generate and apply migration
```bash
bun run db:generate  # Creates SQL migration file
bun run db:migrate   # Applies to database
```

**Step 3**: Create API routes in `src/routes/`
- Implement GET, POST, PUT, DELETE endpoints
- Add Zod validation middleware
- Mount routes in `server.ts`

**Step 4**: Create TanStack DB collection in `src/server/collections/`
- Define queryFn, onInsert, onUpdate, onDelete

**Step 5**: Use in components via `useLiveQuery`

---

## 🏭 Production Deployment

### Build Process

```bash
# 1. TypeScript compilation
tsc -b

# 2. Vite production build
vite build
# Output: ./dist/ (index.html, assets/*.js, assets/*.css)

# 3. Code splitting result:
dist/
├── index.html
└── assets/
    ├── index-<hash>.js          # Main bundle (~50KB)
    ├── react-vendor-<hash>.js   # React core (~150KB)
    ├── ag-grid-community-<hash>.js  (~500KB)
    ├── ag-grid-react-<hash>.js      (~50KB)
    ├── ui-vendor-<hash>.js      # Lucide, Zustand (~100KB)
    └── vendor-<hash>.js         # Other libs (~200KB)
```

### Deployment Platforms

#### **Vercel** (Recommended)

```bash
# 1. Install Vercel CLI
bun add -g vercel

# 2. Link project
vercel link

# 3. Add environment variable
vercel env add DATABASE_URL
# Enter: postgresql://user:password@host:5432/dbname

# 4. Deploy
vercel --prod
```

**Environment Variables Required**:
- `DATABASE_URL` - PostgreSQL connection string (Vercel Postgres)
- `NODE_ENV` - Set to "production"

#### **Netlify**

```toml
# netlify.toml
[build]
  command = "bun run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### **Cloudflare Workers**

- Create Zod schema (validation)
- Define TypeScript types
- Define Drizzle table with indexes
- Define relations if needed

**Step 2**: Generate and apply migration
```bash
bun run db:generate  # Creates SQL migration file
bun run db:migrate   # Applies to database
```

**Step 3**: Create API routes in `src/routes/`
- Implement GET, POST, PUT, DELETE endpoints
- Add Zod validation middleware
- Mount routes in `server.ts`

**Step 4**: Create TanStack DB collection in `src/server/collections/`
- Define queryFn, onInsert, onUpdate, onDelete

**Step 5**: Use in components via `useLiveQuery` for reactive queries

---

## 🚨 Common Issues & Solutions

### Issue: "Database not found" error on startup

**Solution**: Ensure PostgreSQL is running and configured correctly with proper connection credentials.

### Issue: TanStack DB queries not updating reactively

**Solution**: 
- Verify collections are properly configured in [collections directory](src/server/collections)
- Ensure all CRUD handlers (onInsert, onUpdate, onDelete) are defined and async
- Use `useLiveQuery` hook for reactive data updates

---

## 📚 Key Dependencies Documentation

| Package | Documentation |
|---------|--------------|
| Hono | https://hono.dev/ |
| Drizzle ORM | https://orm.drizzle.team/ |
| TanStack Router | https://tanstack.com/router/latest |
| TanStack DB | https://tanstack.com/db/latest |
| TanStack Query | https://tanstack.com/query/latest |
| TanStack Form | https://tanstack.com/form/latest |
| AG Grid | https://www.ag-grid.com/ |
| FullCalendar | https://fullcalendar.io/ |
| Recharts | https://recharts.org/ |
| React Grid Layout | https://github.com/react-grid-layout/react-grid-layout |
| shadcn/ui | https://ui.shadcn.com/ |
| Zod | https://zod.dev/ |
| Bun | https://bun.sh/docs |

---

## 🎯 Future Enhancements

### Planned Features
1. **Real-time Updates**: WebSocket support for live attendance tracking
2. **Authentication**: User login with JWT/session management
3. **Role-Based Access Control**: Admin, organizer, member permissions
4. **Reporting**: PDF export for attendance reports
5. **Email Notifications**: Event reminders, loyalty milestones
6. **Mobile App**: React Native companion app
7. **QR Code Check-in**: Camera-based attendance scanning
8. **Multi-tenant**: Support multiple organizations in one instance

### Potential Improvements
- **Performance**: Implement virtual scrolling for large datasets (AG Grid)
- **Offline Mode**: Service Worker for PWA capabilities
- **Backup/Restore**: Database snapshot functionality
- **Analytics**: More advanced metrics (retention rates, cohort analysis)
- **Integrations**: Google Calendar sync, Stripe payments for events

---

## 📝 License

This project is private and proprietary. All rights reserved.

---

## 🤝 Contributing

This is a personal/organizational project. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📧 Contact

For questions or support, please open an issue in the repository.

---

## 🎓 Learning Resources

If you're trying to recreate this application, study these concepts in order:

1. **Database Design**: PostgreSQL, Drizzle ORM, migrations
2. **API Development**: RESTful APIs, Hono framework, Zod validation
3. **React Fundamentals**: Components, hooks, state management
4. **TanStack Ecosystem**: Router, Query, DB, Form
5. **UI Frameworks**: TailwindCSS, shadcn/ui components
6. **Advanced React Patterns**: Optimistic updates, live queries
7. **Build Tools**: Vite, TypeScript, Bun runtime

---

**Created with ❤️ using Bun, React, and TypeScript**

Test endpoints using:
- Browser DevTools Network tab
- Postman or Thunder Client
- curl commands for automated testing
- Drizzle Studio for direct database inspection (`bun run db:studio`)

### Issue: Date serialization errors in API responses

**Solution**: Transform date strings to Date objects in collection `queryFn` handlers using proper date parsing.