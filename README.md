# Healthcare Appointment & Follow-up Manager

A full-stack web application designed for clinic appointment booking, patient symptom triage, and medical consultation summaries. It includes separate portals for admins, doctors, and patients.

## Live Application
The hosted application is live at: [https://healthcare-frontend-i4v0.onrender.com](https://healthcare-frontend-i4v0.onrender.com)

---

## Database Schema (Prisma)

The application uses PostgreSQL with Prisma Client. Below is the relational structure:

### Enums
- **Role**: `PATIENT`, `DOCTOR`, `ADMIN`
- **AppointmentStatus**: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`
- **LlmStatus**: `PENDING`, `DONE`, `FAILED`, `SKIPPED`
- **NotificationType**: `BOOKING_CONFIRMATION`, `APPOINTMENT_REMINDER`, `CANCELLATION`, `POST_VISIT_SUMMARY`, `MEDICATION_REMINDER`
- **NotificationChannel**: `EMAIL`, `CALENDAR`
- **NotificationStatus**: `PENDING`, `SENT`, `FAILED`

### Models
1. **User**: Manages credentials, names, emails, and phone numbers. Relates 1:1 to Patient or Doctor profiles.
2. **Patient**: Stores DOB, blood group, allergies, and has many Appointments.
3. **Doctor**: Stores specialization, slot duration (default 30 min), working hours configuration (JSON), and Google Calendar OAuth tokens.
4. **DoctorLeave**: Manages leave dates with a unique constraint on `[doctorId, date]`.
5. **Appointment**: Tracks patient, doctor, date/time, symptoms, AI pre-visit summary JSON, clinical notes, prescriptions JSON, AI post-visit care text, and Google Calendar event IDs.
6. **NotificationLog**: Keeps audit logs of outbound emails/reminders, including retry counts and error strings.

---

## LLM Usage and Prompts

The system integrates with OpenAI (GPT-4o-mini). If the API key is missing or fails, the application falls back gracefully to standard triage.

### 1. Pre-Visit Triage Summary
Runs automatically when a patient registers symptom text.
* **Prompt**:
  ```text
  Analyse these symptoms and return a JSON object with exactly these fields:
  - "urgency": one of "Low", "Medium", or "High"
  - "chiefComplaint": a one-sentence summary of the main problem
  - "suggestedQuestions": an array of exactly 3 questions the doctor should ask

  Respond with valid JSON only, no extra text.
  Symptoms: <symptoms>
  ```

### 2. Post-Visit Patient Summary
Runs when a doctor logs the consultation notes and prescription list.
* **Prompt**:
  ```text
  Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps. Keep it simple and clear.
  Notes: <notes>
  ```

---

## Google Calendar OAuth 2.0 Integration Setup

Doctors can connect their Google Calendar for real-time 2-way sync:

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a Project and enable the **Google Calendar API**.
3. Configure the **OAuth Consent Screen** (specify User Type: External, add Test Users if in sandbox).
4. Go to **Credentials** ➔ **Create Credentials** ➔ **OAuth Client ID**.
5. Set the Application Type to **Web Application** and add the Authorized Redirect URI:
   `http://localhost:3000/api/calendar/callback` (or your production URL).
6. Copy the `Client ID` and `Client Secret` to your backend `.env` variables (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`).

---

## REST API Reference Summary
All protected endpoints require an `Authorization: Bearer <accessToken>` header.

- `POST /api/auth/register` - Register a patient.
- `POST /api/auth/login` - Authenticate any role.
- `GET /api/doctors` - Find doctors by specialty.
- `GET /api/doctors/:id/slots?date=YYYY-MM-DD` - Get available slots.
- `POST /api/appointments` - Book a slot (requires symptoms).
- `POST /api/doctor/consultations/:id` - Submit clinical visit notes.
- `POST /api/admin/doctors/:id/leaves` - Register doctor leave.

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
