# Healthcare App REST API Reference

Base URL: `/api`

All protected endpoints require an `Authorization: Bearer <accessToken>` header.

---

## 1. Authentication (`/api/auth`)

### `POST /auth/register`
Registers a new Patient user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "phone": "+1 555 0192",
  "dob": "1990-05-15",
  "gender": "Male",
  "bloodGroup": "O+",
  "address": "123 Health Way",
  "emergencyContact": "+1 555 9999"
}
```

**Response (`201 Created`):**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "PATIENT",
    "patient": { "id": "patient-uuid" }
  }
}
```

---

### `POST /auth/login`
Authenticates any registered user (Patient, Doctor, or Admin).

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

---

### `POST /auth/refresh`
Renews an expired access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

---

## 2. Doctor Discovery & Slot Availability (`/api/doctors`)

### `GET /doctors`
Searches doctors, optionally filtered by specialization.

**Query Parameters:**
- `specialisation` *(optional)*: Case-insensitive specialty string (e.g. `Cardiology`).

---

### `GET /doctors/:doctorId`
Returns the doctor profile and consultation slot duration.

---

### `GET /doctors/:doctorId/slots`
Calculates real-time available time slots for a given date.

**Query Parameters:**
- `date` *(required)*: `YYYY-MM-DD`

**Response (`200 OK`):**
```json
{
  "date": "2030-05-20",
  "onLeave": false,
  "slots": [
    { "time": "09:00", "datetime": "2030-05-20T09:00:00.000Z" },
    { "time": "09:30", "datetime": "2030-05-20T09:30:00.000Z" }
  ]
}
```

---

## 3. Appointments (`/api/appointments`)

### `POST /appointments`
Books a consultation slot. *(Patient only)*

**Request Body:**
```json
{
  "doctorId": "doctor-uuid",
  "scheduledAt": "2030-05-20T09:00:00.000Z",
  "symptoms": "Fever and sore throat for 3 days"
}
```

**Responses:**
- `201 Created`: Appointment confirmed.
- `409 Conflict`: Slot unavailable or doctor on leave.

---

### `GET /appointments`
Returns appointments relevant to the authenticated user's role:
- **Patient**: Own appointments.
- **Doctor**: Consultations assigned to this doctor.
- **Admin**: All clinic appointments.

---

### `GET /appointments/:appointmentId`
Returns full appointment details including symptoms, AI pre-visit assessment, doctor clinical notes, and prescriptions.

---

### `PATCH /appointments/:appointmentId/symptoms`
Updates patient symptoms and triggers an asynchronous AI pre-visit clinical assessment. *(Patient only)*

**Request Body:**
```json
{
  "symptoms": "Persistent headache worsening in mornings with mild nausea"
}
```

---

### `PATCH /appointments/:appointmentId/reschedule`
Reschedules an appointment to a new available slot using advisory lock protection. *(Patient / Admin)*

**Request Body:**
```json
{
  "scheduledAt": "2030-05-22T14:30:00.000Z"
}
```

---

### `PATCH /appointments/:appointmentId/cancel`
Cancels an appointment and triggers Google Calendar cancellation flag. *(Patient / Doctor / Admin)*

---

### `PATCH /appointments/:appointmentId/notes`
Saves clinical notes and structured prescriptions, marks appointment as `COMPLETED`, and triggers the AI patient summary. *(Doctor only)*

**Request Body:**
```json
{
  "postVisitNotes": "Patient diagnosed with mild pharyngitis. Throat inflamed, no exudate.",
  "prescriptions": [
    {
      "medication": "Amoxicillin",
      "dose": "500mg",
      "frequency": "Twice daily after meals",
      "days": 5
    }
  ]
}
```

---

## 4. Administration (`/api/admin`)

### `POST /admin/doctors`
Onboards a new doctor. *(Admin only)*

**Request Body:**
```json
{
  "name": "Dr. Sarah Jenkins",
  "email": "sarah@clinic.com",
  "password": "TemporaryPassword123!",
  "specialisation": "Pediatrics",
  "slotDuration": 30,
  "workingHours": {
    "mon": { "start": "09:00", "end": "17:00" },
    "tue": { "start": "09:00", "end": "17:00" },
    "wed": { "start": "09:00", "end": "17:00" },
    "thu": { "start": "09:00", "end": "17:00" },
    "fri": { "start": "09:00", "end": "17:00" },
    "sat": null,
    "sun": null
  }
}
```

---

### `POST /admin/doctors/:doctorId/leaves`
Schedules doctor leave and automatically cancels conflicting booked appointments. *(Admin only)*

**Request Body:**
```json
{
  "date": "2030-06-15",
  "reason": "Attending Medical Symposium"
}
```

---

### `DELETE /admin/doctors/:doctorId/leaves/:leaveId`
Removes a doctor leave. *(Admin only)*

---

## 5. Google Calendar (`/api/calendar`)

### `GET /calendar/connect`
Returns Google OAuth 2.0 consent URL for doctor authentication. *(Doctor only)*

### `GET /calendar/callback`
OAuth redirect handler exchanging authorization code for permanent refresh tokens.

### `GET /calendar/status`
Checks if the authenticated doctor has linked their Google account. *(Doctor only)*

### `DELETE /calendar/disconnect`
Disconnects Google Calendar by clearing stored tokens. *(Doctor only)*
