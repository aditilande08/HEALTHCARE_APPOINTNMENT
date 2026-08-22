import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { ArrowLeft, Sparkles, Pill, Plus, Trash2, CheckCircle2, AlertCircle, User, Calendar, Clock, HelpCircle } from 'lucide-react';

export default function DoctorConsultation() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // form state
  const [postVisitNotes, setPostVisitNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState([
    { medication: '', dose: '', frequency: '', days: 5 },
  ]);

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/appointments/${appointmentId}`);
      setAppointment(data);
      if (data.postVisitNotes) {
        setPostVisitNotes(data.postVisitNotes);
      }
      if (data.prescriptions && data.prescriptions.length > 0) {
        setPrescriptions(data.prescriptions);
      }
    } catch (err) {
      setError(err.message || 'Failed to load consultation details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointment();
  }, [appointmentId]);

  const handleAddPrescription = () => {
    setPrescriptions((prev) => [
      ...prev,
      { medication: '', dose: '', frequency: '', days: 5 },
    ]);
  };

  const handleRemovePrescription = (index) => {
    setPrescriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrescriptionChange = (index, field, value) => {
    setPrescriptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: field === 'days' ? parseInt(value, 10) || 1 : value };
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!postVisitNotes.trim()) {
      setError('Please provide clinical notes for this consultation.');
      return;
    }

    // Filter out completely blank prescription rows
    const validPrescriptions = prescriptions.filter(
      (p) => p.medication.trim() && p.dose.trim() && p.frequency.trim()
    );

    try {
      setSubmitting(true);
      const res = await api.patch(`/appointments/${appointmentId}/notes`, {
        postVisitNotes: postVisitNotes.trim(),
        prescriptions: validPrescriptions,
      });

      setSuccess('Consultation successfully documented and marked completed! AI summary is generating for the patient.');
      await fetchAppointment();
    } catch (err) {
      setError(err.message || 'Failed to save consultation notes');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading consultation details...</div>;
  }

  if (!appointment) {
    return (
      <div className="empty-state">
        <h3>Consultation not found</h3>
        <Link to="/doctor" className="btn btn-secondary" style={{ marginTop: '1rem' }}>Back to Schedule</Link>
      </div>
    );
  }

  const patient = appointment.patient;
  const isCompleted = appointment.status === 'COMPLETED';
  const scheduledDate = new Date(appointment.scheduledAt);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <Link to="/doctor" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Doctor Schedule
      </Link>

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

      {/* Patient & Visit Overview Header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem' }}>
              {patient?.user?.name?.[0] || 'P'}
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem' }}>{patient?.user?.name}</h1>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                <span>Email: {patient?.user?.email}</span>
                {patient?.user?.phone && <span>Phone: {patient?.user?.phone}</span>}
                {patient?.bloodGroup && <span>Blood Group: <strong>{patient?.bloodGroup}</strong></span>}
                {patient?.gender && <span>Gender: <strong>{patient?.gender}</strong></span>}
              </div>
            </div>
          </div>

          <span className={`badge badge-${appointment.status.toLowerCase()}`}>
            {appointment.status}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={16} color="var(--primary-600)" />
            <span>{scheduledDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={16} color="var(--primary-600)" />
            <span>{scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ({appointment.doctor?.slotDuration} mins)</span>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: AI Pre-visit Triage & Patient Reported Symptoms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* AI Pre-visit Summary Box */}
          {appointment.preVisitSummary ? (
            <div className="card" style={{ borderLeft: '4px solid #0ea5e9', background: '#f0f9ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0369a1', fontWeight: 700 }}>
                  <Sparkles size={18} />
                  <span>AI Pre-Visit Assessment</span>
                </div>
                {appointment.preVisitSummary.urgency && (
                  <span className={`badge badge-urgency-${appointment.preVisitSummary.urgency.toLowerCase()}`}>
                    Urgency: {appointment.preVisitSummary.urgency}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                <strong style={{ color: '#0f172a' }}>Chief Complaint:</strong>
                <p style={{ color: '#334155', marginTop: '0.25rem' }}>
                  {appointment.preVisitSummary.chiefComplaint}
                </p>
              </div>

              {appointment.preVisitSummary.suggestedQuestions?.length > 0 && (
                <div>
                  <strong style={{ color: '#0f172a', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <HelpCircle size={15} color="#0369a1" /> Recommended Diagnostic Questions:
                  </strong>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', color: '#334155', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {appointment.preVisitSummary.suggestedQuestions.map((q, idx) => (
                      <li key={idx}><strong>Q{idx + 1}:</strong> {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Reported Symptoms</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {appointment.symptoms || 'No symptoms reported by patient.'}
              </p>
            </div>
          )}

          {/* If already completed, show the generated patient summary */}
          {isCompleted && appointment.postVisitSummary && (
            <div className="card" style={{ borderLeft: '4px solid var(--accent-500)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--accent-600)', fontWeight: 700 }}>
                <Sparkles size={18} />
                <span>Patient-Friendly AI Summary (Delivered to Patient)</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                {appointment.postVisitSummary}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Clinical Notes & Prescription Writer Form */}
        <div>
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>
              {isCompleted ? 'Consultation Record' : 'Document Consultation'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Doctor Clinical Notes *</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  required
                  placeholder="Record examination findings, diagnosis, clinical advice, and patient instructions..."
                  value={postVisitNotes}
                  onChange={(e) => setPostVisitNotes(e.target.value)}
                  disabled={isCompleted}
                />
              </div>

              {/* Prescription Builder */}
              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Pill size={16} color="var(--primary-600)" /> Prescriptions & Medications
                  </label>
                  {!isCompleted && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddPrescription}
                    >
                      <Plus size={14} /> Add Medicine
                    </button>
                  )}
                </div>

                {prescriptions.map((rx, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Medication name (e.g., Amoxicillin)"
                        className="form-input"
                        style={{ flex: 2 }}
                        value={rx.medication}
                        onChange={(e) => handlePrescriptionChange(idx, 'medication', e.target.value)}
                        disabled={isCompleted}
                      />
                      <input
                        type="text"
                        placeholder="Dose (e.g., 500mg)"
                        className="form-input"
                        style={{ flex: 1 }}
                        value={rx.dose}
                        onChange={(e) => handlePrescriptionChange(idx, 'dose', e.target.value)}
                        disabled={isCompleted}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Frequency (e.g., Twice daily after meals)"
                        className="form-input"
                        style={{ flex: 2 }}
                        value={rx.frequency}
                        onChange={(e) => handlePrescriptionChange(idx, 'frequency', e.target.value)}
                        disabled={isCompleted}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          placeholder="Days"
                          className="form-input"
                          value={rx.days}
                          onChange={(e) => handlePrescriptionChange(idx, 'days', e.target.value)}
                          disabled={isCompleted}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>days</span>
                      </div>

                      {!isCompleted && prescriptions.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleRemovePrescription(idx)}
                          title="Remove row"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!isCompleted && (
                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={submitting}
                >
                  <CheckCircle2 size={18} />
                  {submitting ? 'Saving & Generating Summary...' : 'Complete Consultation & Generate Patient Summary'}
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
