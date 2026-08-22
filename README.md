# Healthcare Appointment & Follow-up Manager

A full-stack, enterprise-grade healthcare management platform featuring patient self-scheduling, real-time double-booking prevention, LLM-powered clinical visit summaries, structured medication tracking, and Google Calendar 2-way synchronization.

---

## 🌟 Key Features

### 1. Role-Based Portals & Authentication
- **Patient Portal**: Doctor discovery by specialty, live slot picker, pre-visit symptom intake, rescheduling/cancellation, and post-visit health summaries with medication schedules.
- **Doctor Portal**: Daily consultation schedule, AI pre-visit clinical triage (urgency level, chief complaint, diagnostic question prompts), post-visit clinical notes with multi-medicine prescription writer, and Google Calendar integration.
- **Admin Portal**: Doctor onboarding with configurable consultation slot durations (15/30/45/60 min), weekly working hours JSON configuration, and doctor leave management with atomic conflicting appointment cancellation.
- **JWT Security**: Dual-token architecture (short-lived access tokens + long-lived refresh tokens) with automatic client-side transparent token renewal.

### 2. Concurrency & Double-Booking Prevention
- **PostgreSQL Advisory Locks (`pg_advisory_xact_lock`)**: Uses transactional advisory locks keyed to `hash(doctorId, scheduledAt)`. Simultaneous requests for the exact same slot serialize at the database level, guaranteeing that only one booking succeeds while the concurrent request receives a clean `409 Conflict`.
- **Cancelled Slot Reusability**: Application-level status checks inside transactions allow previously cancelled slots to be freely rebooked.

### 3. AI-Powered Clinical Intelligence (OpenAI GPT-4o-mini)
- **Pre-Visit Clinical Assessment**: Automatically converts patient symptom descriptions into a structured triage report (`Low` / `Medium` / `High` urgency, concise chief complaint, and 3 recommended diagnostic questions for the doctor).
- **Post-Visit Patient Summary**: Translates doctor's medical jargon and structured prescriptions into clear, plain-language patient care instructions.
- **Graceful Failure State Machine**: All LLM operations execute asynchronously outside the core booking transactions (fire-and-forget). API latency and database locks are never blocked by LLM response times or upstream OpenAI errors.

### 4. Background Jobs & Notification Pipeline
- **Cron Scheduler (`node-cron`)**:
  - Hourly job dispatching automated appointment reminders for consultations within the next 24 hours.
  - Daily job (8:00 AM UTC) dispatching active medication regimen reminders.
  - 5-minute exponential backoff retry worker processing pending/failed emails up to 3 attempts.
- **Google Calendar 2-Way Sync**: Offline OAuth 2.0 integration with automatic token refresh persistence and status updates.

---

## 🏗️ Architecture & Tech Stack

```
healthcare-app/
├── backend/                  # Node.js + Express + Prisma + PostgreSQL
│   ├── prisma/
│   │   ├── schema.prisma     # Relational database schema
│   │   └── seed.js           # Default admin seed script
│   ├── src/
│   │   ├── config/           # Environment and DB singleton
│   │   ├── controllers/      # HTTP request handlers
│   │   ├── jobs/             # node-cron background workers
│   │   ├── middleware/       # JWT auth & role authorization
│   │   ├── routes/           # REST API endpoints
│   │   ├── services/         # Core business logic & integrations
│   │   └── app.js            # Express server entry point
│   └── tests/                # Jest integration test suites
│
├── frontend/                 # React 19 + Vite + Vanilla CSS Design System
│   ├── src/
│   │   ├── components/       # Navbar, ProtectedRoute
│   │   ├── context/          # AuthContext with token refresh
│   │   ├── pages/            # Patient, Doctor, Admin portals & Auth
│   │   ├── services/         # ApiClient with refresh queue
│   │   ├── index.css         # Modern medical UI design system
│   │   └── App.jsx           # Client-side router
│   └── vite.config.js        # Vite dev server with /api proxy
│
└── docs/                     # Technical architecture documentation
    ├── SYSTEM_DESIGN.md      # Deep dive into concurrency & state machines
    └── API.md                # Complete REST API reference
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ or v20+
- **PostgreSQL**: v14+ (running locally or on a cloud provider like Supabase/Neon/Railway)

---

### Backend Setup

1. **Navigate to the backend directory and install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your configuration:
   ```env
   PORT=3000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:password@localhost:5432/healthcare_db"
   JWT_SECRET="your_jwt_secret_key"
   JWT_REFRESH_SECRET="your_refresh_secret_key"
   OPENAI_API_KEY="sk-..."                     # Optional: LLM features will gracefully skip if missing
   SMTP_HOST="smtp.gmail.com"                  # Optional: For email notifications
   SMTP_PORT=587
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-app-password"
   EMAIL_FROM="Healthcare Clinic <no-reply@healthcare.com>"
   GOOGLE_CLIENT_ID=""                         # Optional: For Google Calendar sync
   GOOGLE_CLIENT_SECRET=""
   GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/callback"
   FRONTEND_URL="http://localhost:5173"
   ```

3. **Initialize Database Schema & Generate Prisma Client**:
   ```bash
   npm run db:generate
   npx prisma db push
   ```

4. **Seed Default Admin Account**:
   ```bash
   npm run db:seed
   ```
   *Default Admin Credentials:*
   - **Email**: `admin@clinic.com`
   - **Password**: `admin123456`

5. **Start Backend Server**:
   ```bash
   npm run dev
   ```
   The backend API will run on `http://localhost:3000`.

---

### Frontend Setup

1. **Navigate to the frontend directory and install dependencies**:
   ```bash
   cd ../frontend
   npm install
   ```

2. **Start Vite Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🧪 Running Tests

The backend includes test suites covering authentication, admin management, doctor search & slot generation, appointment concurrency simulation, LLM error handling, email queues, background jobs, and calendar sync:

```bash
cd backend
npm test
```

---

## 🔒 Default Role Workflow

1. **Admin (`admin@clinic.com` / `admin123456`)**:
   - Log in and navigate to **Manage Doctors & Leave**.
   - Click **Onboard New Doctor** to register a doctor with specific specialty and consultation hours.
   - Schedule doctor leave days to test automatic conflict cancellation.
2. **Doctor**:
   - Log in using credentials created by the Admin.
   - View scheduled consultation queue, review patient symptoms & AI triage summaries.
   - Click **Start / Document Consultation** to record clinical notes and build prescriptions.
   - Go to **Google Calendar** settings to link Google Calendar for 2-way sync.
3. **Patient**:
   - Register a new patient account at `/register`.
   - Search doctors by specialty, pick a consultation slot, and enter symptoms.
   - View confirmed visits, update symptoms, reschedule, cancel, or review completed post-visit summaries.

---

## 📄 License
This project is licensed under the MIT License.
