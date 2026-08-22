import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Calendar, Clock, ArrowLeft, AlertCircle, CheckCircle2, Sparkles, Pill, RefreshCw, XCircle } from 'lucide-react';

export default function AppointmentDetails() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // symptom update state
  const [newSymptoms, setNewSymptoms] = useState('');
  const [updatingSymptoms, setUpdatingSymptoms] = useState(false);

  // reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [slotsData, setSlotsData] = useState({ onLeave: false, slots: [] });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/appointments/${appointmentId}`);
      setAppointment(data);
      setNewSymptoms(data.symptoms || '');
    } catch (err) {
      setError(err.message || 'Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointment();
  }, [appointmentId]);

  // fetch slots for rescheduling
  useEffect(() => {
    if (!newDate || !appointment?.doctorId) return;

    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);
        const data = await api.get(`/doctors/${appointment.doctorId}/slots?date=${newDate}`);
        setSlotsData(data);
      } catch (err) {
        setError(err.message || 'Failed to load slots');
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [newDate, appointment?.doctorId]);

  const handleUpdateSymptoms = async (e) => {
    e.preventDefault();
    if (!newSymptoms.trim()) return;

    try {
      setUpdatingSymptoms(true);
      setError('');
      await api.patch(`/appointments/${appointmentId}/symptoms`, { symptoms: newSymptoms });
      setActionSuccess('Symptoms updated! AI pre-visit assessment is generating.');
      await fetchAppointment();
    } catch (err) {
      setError(err.message || 'Failed to update symptoms');
    } finally {
      setUpdatingSymptoms(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      setError('');
      await api.patch(`/appointments/${appointmentId}/cancel`);
      setActionSuccess('Appointment successfully cancelled.');
      await fetchAppointment();
    } catch (err) {
      setError(err.message || 'Failed to cancel appointment');
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    try {
      setRescheduling(true);
      setError('');
      await api.patch(`/appointments/${appointmentId}/reschedule`, { scheduledAt: selectedSlot.datetime });
      setActionSuccess('Appointment successfully rescheduled.');
      setShowReschedule(false);
      await fetchAppointment();
    } catch (err) {
      setError(err.message || 'Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading appointment details...</div>;
  }

  if (!appointment) {
    return (
      <div className="empty-state">
        <h3>Appointment not found</h3>
        <Link to="/patient" className="btn btn-secondary" style={{ marginTop: '1rem' }}>Back to Dashboard</Link>
      </div>
    );
  }

  const isConfirmed = appointment.status === 'CONFIRMED';
  const isCompleted = appointment.status === 'COMPLETED';
  const isCancelled = appointment.status === 'CANCELLED';

  const scheduledDate = new Date(appointment.scheduledAt);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <Link to="/patient" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>Consultation with Dr. {appointment.doctor?.user?.name}</h1>
            <span style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{appointment.doctor?.specialisation}</span>
          </div>
          <span className={`badge badge-${appointment.status.toLowerCase()}`}>
            {appointment.status}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.95rem', margin: '1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="var(--primary-600)" />
            <span>{scheduledDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--primary-600)" />
            <span>{scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ({appointment.doctor?.slotDuration || 30} mins)</span>
          </div>
        </div>

        {isConfirmed && (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <button onClick={() => setShowReschedule(!showReschedule)} className="btn btn-secondary btn-sm">
              <RefreshCw size={15} />
              {showReschedule ? 'Close Reschedule' : 'Reschedule Appointment'}
            </button>
            <button onClick={handleCancel} className="btn btn-outline-danger btn-sm">
              <XCircle size={15} />
              Cancel Appointment
            </button>
          </div>
        )}
      </div>

      {/* Reschedule Box */}
      {showReschedule && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '2px solid var(--primary-500)' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Pick a New Date and Slot</h3>
          <form onSubmit={handleRescheduleSubmit}>
            <div className="form-group">
              <label className="form-label">New Date</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="form-input"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>

            {loadingSlots ? (
              <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading slots...</div>
            ) : slotsData.onLeave ? (
              <div className="alert alert-warning">Doctor is on leave on this date.</div>
            ) : slotsData.slots.length > 0 ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Available Slots</label>
                <div className="slot-grid">
                  {slotsData.slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      className={`slot-btn ${selectedSlot?.time === s.time ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(s)}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              </div>
            ) : newDate ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No slots available on this date.</p>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedSlot || rescheduling}
            >
              {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </form>
        </div>
      )}

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        {/* Symptoms & Pre-visit Assessment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Patient Symptoms</h3>
            {isConfirmed ? (
              <form onSubmit={handleUpdateSymptoms}>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Describe your symptoms..."
                  value={newSymptoms}
                  onChange={(e) => setNewSymptoms(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.75rem' }}
                  disabled={updatingSymptoms}
                >
                  {updatingSymptoms ? 'Updating...' : 'Update Symptoms'}
                </button>
              </form>
            ) : (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {appointment.symptoms || 'No symptoms provided.'}
              </p>
            )}
          </div>

          {/* AI Pre-visit Summary */}
          {appointment.preVisitSummary && (
            <div className="card" style={{ borderLeft: '4px solid #0ea5e9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-700)', fontWeight: 700 }}>
                  <Sparkles size={18} />
                  <span>AI Pre-visit Assessment</span>
                </div>
                {appointment.preVisitSummary.urgency && (
                  <span className={`badge badge-urgency-${appointment.preVisitSummary.urgency.toLowerCase()}`}>
                    Urgency: {appointment.preVisitSummary.urgency}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                <strong style={{ color: 'var(--text-main)' }}>Chief Complaint:</strong>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {appointment.preVisitSummary.chiefComplaint}
                </p>
              </div>

              {appointment.preVisitSummary.suggestedQuestions?.length > 0 && (
                <div style={{ fontSize: '0.9rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Suggested Questions for Doctor:</strong>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {appointment.preVisitSummary.suggestedQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Post-visit Notes & Prescriptions (Doctor & LLM) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {isCompleted ? (
            <>
              {appointment.postVisitSummary && (
                <div className="card" style={{ borderLeft: '4px solid var(--accent-500)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-600)', fontWeight: 700 }}>
                    <Sparkles size={18} />
                    <span>Your Post-Visit Health Summary</span>
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                    {appointment.postVisitSummary}
                  </div>
                </div>
              )}

              {appointment.prescriptions && appointment.prescriptions.length > 0 && (
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Pill size={18} color="var(--primary-600)" />
                    <h3 style={{ fontSize: '1.15rem' }}>Prescriptions & Regimen</h3>
                  </div>

                  {appointment.prescriptions.map((rx, i) => (
                    <div key={i} className="rx-card">
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                        {rx.medication} <span style={{ color: 'var(--primary-600)', fontSize: '0.9rem' }}>{rx.dose}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Frequency: <strong>{rx.frequency}</strong> • Duration: <strong>{rx.days} days</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Post-visit clinical notes, prescriptions, and patient-friendly AI summary will appear here once the doctor completes your consultation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
