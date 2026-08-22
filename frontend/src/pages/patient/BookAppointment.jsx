import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Calendar, Clock, AlertCircle, CheckCircle, ArrowLeft, Stethoscope, Sparkles } from 'lucide-react';

export default function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [slotsData, setSlotsData] = useState({ onLeave: false, slots: [] });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  // load doctor profile
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        setLoadingDoctor(true);
        const data = await api.get(`/doctors/${doctorId}`);
        setDoctor(data);
      } catch (err) {
        setError(err.message || 'Failed to load doctor profile');
      } finally {
        setLoadingDoctor(false);
      }
    };
    fetchDoc();
  }, [doctorId]);

  // load slots whenever date changes
  useEffect(() => {
    if (!selectedDate || !doctorId) return;

    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        setError('');
        setSelectedSlot(null);
        const data = await api.get(`/doctors/${doctorId}/slots?date=${selectedDate}`);
        setSlotsData(data);
      } catch (err) {
        setError(err.message || 'Failed to load available slots');
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [selectedDate, doctorId]);

  const handleBook = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select an available time slot');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const appt = await api.post('/appointments', {
        doctorId,
        scheduledAt: selectedSlot.datetime,
        symptoms: symptoms.trim() || undefined,
      });

      setSuccess(appt);
    } catch (err) {
      if (err.status === 409) {
        setError('This slot was just booked by another patient or is conflicting with doctor leave. Please pick another slot.');
        // refresh slots
        const fresh = await api.get(`/doctors/${doctorId}/slots?date=${selectedDate}`);
        setSlotsData(fresh);
      } else {
        setError(err.message || 'Failed to book appointment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  if (loadingDoctor) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading doctor profile...</div>;
  }

  if (success) {
    return (
      <div style={{ maxWidth: '560px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success-text)', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={36} />
          </div>

          <h2>Appointment Confirmed!</h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>
            Your consultation with <strong>Dr. {doctor?.user?.name}</strong> has been successfully booked.
          </p>

          <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'left', marginBottom: '2rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div><strong>Specialty:</strong> {doctor?.specialisation}</div>
            <div><strong>Date & Time:</strong> {new Date(success.scheduledAt).toLocaleString()}</div>
            {success.symptoms && <div><strong>Symptoms Logged:</strong> {success.symptoms}</div>}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/patient" className="btn btn-primary btn-block">
              Go to Dashboard
            </Link>
            <Link to="/patient/doctors" className="btn btn-secondary btn-block">
              Book Another
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/patient/doctors" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Doctor Directory
      </Link>

      <div className="grid-2" style={{ gap: '2rem', alignItems: 'start' }}>
        {/* Left Column: Doctor Profile & Date Picker */}
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.3rem' }}>
                {doctor?.user?.name?.replace('Dr. ', '')[0] || 'D'}
              </div>
              <div>
                <h2>Dr. {doctor?.user?.name}</h2>
                <span style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{doctor?.specialisation}</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Consultation duration: <strong>{doctor?.slotDuration} mins</strong>
            </p>
          </div>

          <div className="card">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={16} /> Choose Date
              </label>
              <input
                type="date"
                min={todayStr}
                className="form-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} /> Available Slots
              </label>

              {loadingSlots ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Checking availability...</div>
              ) : slotsData.onLeave ? (
                <div className="alert alert-warning" style={{ marginTop: '0.5rem' }}>
                  <AlertCircle size={18} />
                  <span>Dr. {doctor?.user?.name} is on leave on this date. Please pick another date.</span>
                </div>
              ) : slotsData.slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginTop: '0.5rem' }}>
                  No available slots for this date. The doctor may not have scheduled hours or all slots are booked.
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Symptoms & Booking Confirmation */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: '1.15rem' }}>Describe Your Symptoms</h3>
            </div>

            {error && (
              <div className="alert alert-danger">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleBook}>
              <div className="form-group">
                <label className="form-label">
                  What issues or symptoms are you experiencing?
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="e.g., Persistent dry cough for 4 days, mild fever in the evening, slight shortness of breath..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', color: 'var(--primary-700)', fontSize: '0.8rem' }}>
                  <Sparkles size={14} />
                  <span>Our AI assistant will analyze these symptoms to generate a pre-visit clinical summary for the doctor.</span>
                </div>
              </div>

              <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', margin: '1.5rem 0', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                  <strong>{selectedDate}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Selected Time:</span>
                  <strong>{selectedSlot ? selectedSlot.time : 'None selected'}</strong>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={!selectedSlot || submitting}
              >
                {submitting ? 'Confirming Booking...' : 'Confirm Appointment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
