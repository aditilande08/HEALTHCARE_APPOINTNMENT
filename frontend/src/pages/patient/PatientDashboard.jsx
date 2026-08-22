import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Calendar, Clock, User, PlusCircle, AlertCircle, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await api.get('/appointments');
      setAppointments(data);
    } catch (err) {
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const upcomingAppointments = appointments.filter(
    (a) => a.status === 'CONFIRMED' && new Date(a.scheduledAt) >= new Date()
  );

  const pastAppointments = appointments.filter(
    (a) => a.status === 'COMPLETED' || a.status === 'CANCELLED' || (a.status === 'CONFIRMED' && new Date(a.scheduledAt) < new Date())
  );

  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="badge badge-confirmed">Confirmed</span>;
      case 'COMPLETED':
        return <span className="badge badge-completed">Completed</span>;
      case 'CANCELLED':
        return <span className="badge badge-cancelled">Cancelled</span>;
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Patient Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your visits, symptoms, and medical summaries</p>
        </div>
        <Link to="/patient/doctors" className="btn btn-primary">
          <PlusCircle size={18} />
          Book New Appointment
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading appointments...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Upcoming Section */}
          <section>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} color="var(--primary-600)" />
              Upcoming Appointments ({upcomingAppointments.length})
            </h2>

            {upcomingAppointments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Calendar size={28} />
                </div>
                <h3>No upcoming appointments</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  You don't have any appointments scheduled. Find a specialist to book your next checkup.
                </p>
                <Link to="/patient/doctors" className="btn btn-secondary">
                  Browse Available Doctors
                </Link>
              </div>
            ) : (
              <div className="grid-2">
                {upcomingAppointments.map((appt) => {
                  const { date, time } = formatDateTime(appt.scheduledAt);
                  return (
                    <div key={appt.id} className="card">
                      <div className="card-header">
                        <div>
                          <h3 style={{ fontSize: '1.15rem' }}>Dr. {appt.doctor?.user?.name}</h3>
                          <span style={{ color: 'var(--primary-600)', fontSize: '0.875rem', fontWeight: 600 }}>
                            {appt.doctor?.specialisation}
                          </span>
                        </div>
                        {getStatusBadge(appt.status)}
                      </div>

                      <div style={{ display: 'flex', gap: '1.5rem', margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={16} />
                          <span>{date}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={16} />
                          <span>{time}</span>
                        </div>
                      </div>

                      {appt.symptoms ? (
                        <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                          <strong>Symptoms:</strong> {appt.symptoms}
                        </div>
                      ) : (
                        <div style={{ background: '#fffbeb', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#b45309' }}>
                          ⚠️ No symptoms reported yet. Adding symptoms helps your doctor prepare.
                        </div>
                      )}

                      <Link to={`/patient/appointments/${appt.id}`} className="btn btn-secondary btn-block btn-sm">
                        View Details & Manage
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past Appointments Section */}
          {pastAppointments.length > 0 && (
            <section>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                Past & Cancelled Appointments ({pastAppointments.length})
              </h2>

              <div className="card" style={{ padding: '0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Doctor</th>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Specialisation</th>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Date & Time</th>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastAppointments.map((appt) => {
                      const { date, time } = formatDateTime(appt.scheduledAt);
                      return (
                        <tr key={appt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600 }}>Dr. {appt.doctor?.user?.name}</td>
                          <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-muted)' }}>{appt.doctor?.specialisation}</td>
                          <td style={{ padding: '0.85rem 1.25rem' }}>{date} at {time}</td>
                          <td style={{ padding: '0.85rem 1.25rem' }}>{getStatusBadge(appt.status)}</td>
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                            <Link to={`/patient/appointments/${appt.id}`} style={{ color: 'var(--primary-600)', fontWeight: 600, textDecoration: 'none' }}>
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
