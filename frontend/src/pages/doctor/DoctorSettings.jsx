import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Calendar, CheckCircle2, AlertCircle, RefreshCw, Unlink, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function DoctorSettings() {
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/calendar/status');
      setConnected(res.connected);
    } catch (err) {
      setError(err.message || 'Failed to check Google Calendar status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    const calendarParam = searchParams.get('calendar');
    if (calendarParam === 'connected') {
      setMessage('Google Calendar successfully connected! Upcoming appointments will automatically sync.');
    } else if (calendarParam === 'denied') {
      setError('Google Calendar authorization was cancelled or denied.');
    } else if (calendarParam === 'error') {
      setError('An error occurred during Google Calendar authentication. Please try again.');
    }
  }, [searchParams]);

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      setError('');
      const res = await api.get('/calendar/connect');
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setError(err.message || 'Failed to start Google Calendar authorization');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar? Future appointments will not sync.')) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await api.delete('/calendar/disconnect');
      setConnected(false);
      setMessage('Google Calendar has been disconnected.');
    } catch (err) {
      setError(err.message || 'Failed to disconnect calendar');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <Link to="/doctor" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Doctor Schedule
      </Link>

      <div style={{ marginBottom: '2rem' }}>
        <h1>Doctor Integration Settings</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage external calendar sync and consultation preferences</p>
      </div>

      {message && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Google Calendar 2-Way Sync</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Automatically sync consultation bookings, reschedules, and cancellations to your Google Calendar
              </p>
            </div>
          </div>

          <span className={`badge ${connected ? 'badge-confirmed' : 'badge-pending'}`}>
            {connected ? 'Active' : 'Disconnected'}
          </span>
        </div>

        <div style={{ background: 'var(--bg-subtle)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', margin: '1rem 0 1.5rem', fontSize: '0.9rem' }}>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--text-main)' }}>
            <li><strong>Automated Event Creation:</strong> Instantly adds confirmed patient bookings with meeting duration and attendee emails.</li>
            <li><strong>Live Reschedule Sync:</strong> Updates existing calendar invitations whenever a patient changes their time slot.</li>
            <li><strong>Cancellation Flags:</strong> Marks calendar events as cancelled rather than silently disappearing.</li>
            <li><strong>Offline Token Auto-Refresh:</strong> Secure background renewal ensures sync never expires unexpectedly.</li>
          </ul>
        </div>

        {loading ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Checking sync status...</div>
        ) : connected ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--success-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={18} /> Synced with your Google account
            </span>
            <button
              onClick={handleDisconnect}
              className="btn btn-outline-danger btn-sm"
              disabled={actionLoading}
            >
              <Unlink size={15} />
              {actionLoading ? 'Disconnecting...' : 'Disconnect Calendar'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="btn btn-primary btn-block"
            disabled={actionLoading}
          >
            <Calendar size={18} />
            {actionLoading ? 'Redirecting to Google...' : 'Connect Google Calendar'}
          </button>
        )}
      </div>
    </div>
  );
}
