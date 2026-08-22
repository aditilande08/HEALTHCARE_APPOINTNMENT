# Healthcare Appointment & Follow-up Manager

A full-stack web application designed for clinic appointment booking, patient symptom triage, and medical consultation summaries. It includes separate portals for admins, doctors, and patients.

## Features

### Role-Based Portals
- **Patient**: Register, login, find doctors by specialty, pick open slots, submit symptoms, reschedule/cancel bookings, and view post-visit summaries.
- **Doctor**: View consultation schedule, check AI-generated pre-visit triage, write clinical notes, prescribe medication, and sync settings with Google Calendar.
- **Admin**: Onboard new doctors, configure slot duration and weekly schedules, and manage doctor leaves.

### Booking Security & Concurrency
- Prevents double-booking by using database transactional advisory locks (`pg_advisory_xact_lock`) on the combination of `(doctorId, scheduledAt)`.
- Handled atomic leave management where registering doctor leave automatically cancels and notifies patients with conflicting appointments.

### AI Clinical Summaries (GPT-4o-mini)
- Pre-visit triage converts patient symptom text into urgency level, chief complaint, and suggested diagnostic questions.
- Post-visit notes are translated from clinical jargon to simple instructions and medication schedules.
- System operates LLM tasks asynchronously in background queues so external API failures never block core scheduling.

### Notifications & Syncing
- Google Calendar API OAuth integration for 2-way event syncing.
- Cron background jobs for daily medication reminders and automatic email retries.

---

## Directory Structure

```
healthcare-app/
├── backend/                  # Node.js + Express + Prisma + PostgreSQL
│   ├── src/
│   │   ├── controllers/      # Route controllers
│   │   ├── jobs/             # Scheduled background workers
│   │   └── services/         # Core business logic & external integrations
│   └── tests/                # Jest tests
└── frontend/                 # React 19 + Vite + Vanilla CSS
    └── src/
        ├── components/       # Common layouts & UI
        ├── context/          # State & authentication
        └── pages/            # Patient, Doctor, and Admin dashboards
```

---

## Getting Started

### Prerequisites
- Node.js v18 or v20
- PostgreSQL database instance

### Backend Setup
1. Go to the backend folder and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```
3. Set your variables in `.env` (including database URL, JWT keys, and optional OpenAI/Google client IDs).
4. Run DB migrations and generate the client:
   ```bash
   npm run db:generate
   npx prisma db push
   ```
5. Seed the default admin account:
   ```bash
   npm run db:seed
   ```
   *Default Admin:*
   - **Email**: `admin@clinic.com`
   - **Password**: `admin123456`
6. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Go to the frontend folder and install dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## Running Tests
Run the test suite in the backend folder:
```bash
cd backend
npm test
```

## License
MIT
