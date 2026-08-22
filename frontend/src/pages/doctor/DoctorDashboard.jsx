import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Calendar, Clock, User, Sparkles, CheckCircle2, AlertCircle, FileText, ArrowRight, Activity } from 'lucide-react';

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('CONFIRMED');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [appts, calStatus] = await Promise.all([
        api.get('/appointments'),
        api.get('/calendar/status').catch(() => ({ connected: false })),
      ]);
      setAppointments(appts);
      setCalendarConnected(calStatus.connected);
    } catch (err) {
      setError(err.message || 'Failed to load doctor dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const filteredAppointments = appointments.filter((a) => {
    if (filterStatus === 'ALL') return true;
    return a.status === filterStatus;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1>Doctor Consultation Hub</h1>
          <p style={{ color: 'var(--text-muted)' }}>Review patient schedules, AI pre-visit assessments, and document consultations</p>
        </div>

        {/* Google Calendar Sync Status Banner */}
        <Link
          to="/doctor/settings"
          className="card"
          style={{
            padding: '0.6rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textDecoration: 'none',
            borderLeft: `4px solid ${calendarConnected ? 'var(--accent-500)' : '#f59e0b'}`,
          }}
        >
          <Calendar size={18} color={calendarConnected ? 'var(--accent-600)' : '#f59e0b'} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Google Calendar: {calendarConnected ? 'Synced' : 'Not Connected'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {calendarConnected ? 'Auto-syncing scheduled visits' : 'Click to connect calendar'}
            </div>
          </div>
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['CONFIRMED', 'COMPLETED', 'CANCELLED', 'ALL'].map((status) => (
          <button
            key={status}
            className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(status)}
          >
            {status === 'ALL' ? 'All Appointments' : status} ({appointments.filter(a => status === 'ALL' ? true : a.status === status).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading consultation schedule...</div>
      ) : filteredAppointments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Activity size={28} />
          </div>
          <h3>No {filterStatus.toLowerCase()} appointments</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            No appointments matched the current filter.
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {filteredAppointments.map((appt) => {
            const { date, time } = formatDateTime(appt.scheduledAt);
            const urgency = appt.preVisitSummary?.urgency;

            return (
              <div key={appt.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-header" style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {appt.patient?.user?.name?.[0] || 'P'}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem' }}>{appt.patient?.user?.name}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {appt.patient?.user?.phone || appt.patient?.user?.email}
                      </span>
                    </div>
                  </div>

                  <span className={`badge badge-${appt.status.toLowerCase()}`}>
                    {appt.status}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', margin: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={16} color="var(--primary-600)" />
                    <span>{date}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={16} color="var(--primary-600)" />
                    <span>{time}</span>
                  </div>
                </div>

                {/* Pre-visit AI Assessment Preview */}
                {appt.preVisitSummary ? (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', margin: '0.5rem 0 1.25rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0369a1', fontWeight: 700, fontSize: '0.8rem' }}>
                        <Sparkles size={14} /> AI PRE-VISIT TRIAGE
                      </span>
                      {urgency && (
                        <span className={`badge badge-urgency-${urgency.toLowerCase()}`}>
                          {urgency} Urgency
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-main)' }}>
                      <strong>Complaint:</strong> {appt.preVisitSummary.chiefComplaint}
                    </div>
                  </div>
                ) : appt.symptoms ? (
                  <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', margin: '0.5rem 0 1.25rem', fontSize: '0.875rem' }}>
                    <strong>Reported Symptoms:</strong> {appt.symptoms}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-subtle)', fontSize: '0.85rem', fontStyle: 'italic', margin: '0.5rem 0 1.25rem' }}>
                    No symptoms submitted by patient yet.
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <Link to={`/doctor/consultation/${appt.id}`} className="btn btn-primary btn-block btn-sm">
                    <FileText size={16} />
                    {appt.status === 'COMPLETED' ? 'View Clinical Notes' : 'Start / Document Consultation'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
