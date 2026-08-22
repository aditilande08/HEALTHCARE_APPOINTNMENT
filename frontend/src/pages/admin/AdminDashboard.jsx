import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { UserPlus, CalendarX, Stethoscope, Clock, AlertTriangle, CheckCircle2, AlertCircle, Plus, Trash2, Calendar, ShieldCheck } from 'lucide-react';

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('doctors'); // 'doctors' | 'leaves'
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Doctor Creation Modal state
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    email: '',
    password: '',
    specialisation: 'General',
    slotDuration: 30,
    workingDays: {
      mon: { active: true, start: '09:00', end: '17:00' },
      tue: { active: true, start: '09:00', end: '17:00' },
      wed: { active: true, start: '09:00', end: '17:00' },
      thu: { active: true, start: '09:00', end: '17:00' },
      fri: { active: true, start: '09:00', end: '17:00' },
      sat: { active: false, start: '09:00', end: '13:00' },
      sun: { active: false, start: '09:00', end: '13:00' },
    },
  });

  // Leave Form state
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctorLeaves, setDoctorLeaves] = useState([]);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/doctors');
      setDoctors(data);
      if (data.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(data[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaves = async (docId) => {
    if (!docId) return;
    try {
      const data = await api.get(`/admin/doctors/${docId}/leaves`);
      setDoctorLeaves(data);
    } catch (err) {
      console.error('Failed to load leaves', err);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (selectedDoctorId) {
      fetchLeaves(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  const handleWorkingDayToggle = (day) => {
    setDoctorForm((prev) => ({
      ...prev,
      workingDays: {
        ...prev.workingDays,
        [day]: {
          ...prev.workingDays[day],
          active: !prev.workingDays[day].active,
        },
      },
    }));
  };

  const handleWorkingHourChange = (day, field, value) => {
    setDoctorForm((prev) => ({
      ...prev,
      workingDays: {
        ...prev.workingDays,
        [day]: {
          ...prev.workingDays[day],
          [field]: value,
        },
      },
    }));
  };

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Format workingHours JSON as required by backend schema: { mon: { start, end } | null }
    const formattedWorkingHours = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      const dayConfig = doctorForm.workingDays[key];
      if (dayConfig.active) {
        formattedWorkingHours[key] = { start: dayConfig.start, end: dayConfig.end };
      } else {
        formattedWorkingHours[key] = null;
      }
    });

    try {
      await api.post('/admin/doctors', {
        name: doctorForm.name,
        email: doctorForm.email,
        password: doctorForm.password,
        specialisation: doctorForm.specialisation,
        slotDuration: parseInt(doctorForm.slotDuration, 10),
        workingHours: formattedWorkingHours,
      });

      setSuccess(`Dr. ${doctorForm.name} successfully registered and configured!`);
      setShowDoctorModal(false);
      setDoctorForm({
        name: '',
        email: '',
        password: '',
        specialisation: 'General',
        slotDuration: 30,
        workingDays: {
          mon: { active: true, start: '09:00', end: '17:00' },
          tue: { active: true, start: '09:00', end: '17:00' },
          wed: { active: true, start: '09:00', end: '17:00' },
          thu: { active: true, start: '09:00', end: '17:00' },
          fri: { active: true, start: '09:00', end: '17:00' },
          sat: { active: false, start: '09:00', end: '13:00' },
          sun: { active: false, start: '09:00', end: '13:00' },
        },
      });
      await fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to create doctor');
    }
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId || !leaveDate) return;

    try {
      setLeaveSubmitting(true);
      setError('');
      setSuccess('');
      const res = await api.post(`/admin/doctors/${selectedDoctorId}/leaves`, {
        date: leaveDate,
        reason: leaveReason.trim() || undefined,
      });

      setSuccess(
        `Leave registered for ${leaveDate}. ${
          res.cancelledAppointmentsCount > 0
            ? `⚠️ ${res.cancelledAppointmentsCount} conflicting booked appointment(s) were automatically cancelled and notified.`
            : 'No booked appointments were affected.'
        }`
      );
      setLeaveDate('');
      setLeaveReason('');
      await fetchLeaves(selectedDoctorId);
    } catch (err) {
      setError(err.message || 'Failed to register leave');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to remove this scheduled leave?')) return;

    try {
      setError('');
      await api.delete(`/admin/doctors/${selectedDoctorId}/leaves/${leaveId}`);
      setSuccess('Leave removed successfully.');
      await fetchLeaves(selectedDoctorId);
    } catch (err) {
      setError(err.message || 'Failed to delete leave');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Clinic Administration Portal</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage doctor onboarding, clinical hours, and leave schedules</p>
        </div>

        <button onClick={() => setShowDoctorModal(true)} className="btn btn-primary">
          <UserPlus size={18} />
          Onboard New Doctor
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'doctors' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('doctors')}
        >
          <Stethoscope size={16} /> Doctor Staff & Working Hours ({doctors.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'leaves' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('leaves')}
        >
          <CalendarX size={16} /> Doctor Leave Management & Conflicts
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading doctor records...</div>
      ) : activeTab === 'doctors' ? (
        /* Doctors Directory Grid */
        <div className="grid-2">
          {doctors.map((doc) => (
            <div key={doc.id} className="card">
              <div className="card-header" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {doc.user?.name?.replace('Dr. ', '')[0] || 'D'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem' }}>Dr. {doc.user?.name}</h3>
                    <span style={{ color: 'var(--primary-600)', fontSize: '0.875rem', fontWeight: 600 }}>
                      {doc.specialisation}
                    </span>
                  </div>
                </div>

                <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)' }}>
                  {doc.slotDuration} min slots
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Email: <strong>{doc.user?.email}</strong>
              </div>

              <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <strong>Weekly Schedule:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const hours = doc.workingHours?.[key];
                    return (
                      <div key={key} style={{ color: hours ? 'var(--text-main)' : 'var(--text-subtle)' }}>
                        <strong>{key.toUpperCase()}:</strong> {hours ? `${hours.start} - ${hours.end}` : 'Off'}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Leave Management Tab */
        <div className="grid-2" style={{ gap: '2rem', alignItems: 'start' }}>
          {/* Left: Schedule Leave Form */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: '1.15rem' }}>Register Doctor Leave</h3>
            </div>

            <div className="alert alert-warning" style={{ fontSize: '0.85rem', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
              <AlertTriangle size={18} />
              <span>
                <strong>Automatic Conflict Resolution:</strong> Registering a leave automatically cancels any existing booked appointments for this doctor on that date in a single atomic transaction and queues cancellation emails for patients.
              </span>
            </div>

            <form onSubmit={handleAddLeave}>
              <div className="form-group">
                <label className="form-label">Select Doctor *</label>
                <select
                  className="form-select"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  required
                >
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.user?.name} ({doc.specialisation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Leave Date *</label>
                <input
                  type="date"
                  min={todayStr}
                  required
                  className="form-input"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Medical Conference, Annual Leave"
                  className="form-input"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={leaveSubmitting}
              >
                {leaveSubmitting ? 'Registering Leave & Resolving Conflicts...' : 'Register Leave'}
              </button>
            </form>
          </div>

          {/* Right: Scheduled Leaves List */}
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>
              Scheduled Leaves for Selected Doctor ({doctorLeaves.length})
            </h3>

            {doctorLeaves.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                No scheduled leaves found for this doctor.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {doctorLeaves.map((leave) => {
                  const formatted = new Date(leave.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={leave.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg-subtle)',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: '4px solid var(--warning-text)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatted}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Reason: {leave.reason || 'Not specified'}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteLeave(leave.id)}
                        className="btn btn-outline-danger btn-sm"
                        title="Remove Leave"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Onboard Doctor Modal */}
      {showDoctorModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h2>Onboard New Doctor</h2>
              <button
                onClick={() => setShowDoctorModal(false)}
                className="btn btn-secondary btn-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDoctor}>
              <div className="grid-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Doctor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Sarah Jenkins"
                    className="form-input"
                    value={doctorForm.name}
                    onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="dr.sarah@clinic.com"
                    className="form-input"
                    value={doctorForm.email}
                    onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-3" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Initial Password *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="form-input"
                    placeholder="••••••••"
                    value={doctorForm.password}
                    onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Specialisation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Cardiology"
                    className="form-input"
                    value={doctorForm.specialisation}
                    onChange={(e) => setDoctorForm({ ...doctorForm, specialisation: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Slot Duration (Mins)</label>
                  <select
                    className="form-select"
                    value={doctorForm.slotDuration}
                    onChange={(e) => setDoctorForm({ ...doctorForm, slotDuration: e.target.value })}
                  >
                    <option value={15}>15 mins</option>
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins</option>
                  </select>
                </div>
              </div>

              {/* Working Hours Schedule Selector */}
              <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                <label className="form-label">Weekly Consultation Schedule</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const dayConfig = doctorForm.workingDays[key];
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label style={{ width: '110px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={dayConfig.active}
                            onChange={() => handleWorkingDayToggle(key)}
                          />
                          {label}
                        </label>

                        {dayConfig.active ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                            <input
                              type="time"
                              className="form-input"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              value={dayConfig.start}
                              onChange={(e) => handleWorkingHourChange(key, 'start', e.target.value)}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>to</span>
                            <input
                              type="time"
                              className="form-input"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              value={dayConfig.end}
                              onChange={(e) => handleWorkingHourChange(key, 'end', e.target.value)}
                            />
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                            Day Off
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDoctorModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Register Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
