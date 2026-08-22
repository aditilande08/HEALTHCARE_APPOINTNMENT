import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Search, Stethoscope, Clock, Calendar, AlertCircle } from 'lucide-react';

const POPULAR_SPECIALISATIONS = [
  'All',
  'General',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Neurology',
  'Orthopedics',
  'Psychiatry',
];

export default function DoctorSearch() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('All');

  const fetchDoctors = async (specialisation = '') => {
    try {
      setLoading(true);
      setError('');
      const endpoint = specialisation && specialisation !== 'All'
        ? `/doctors?specialisation=${encodeURIComponent(specialisation)}`
        : '/doctors';
      const data = await api.get(endpoint);
      setDoctors(data);
    } catch (err) {
      setError(err.message || 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors(selectedSpec === 'All' ? '' : selectedSpec);
  }, [selectedSpec]);

  const filteredDoctors = doctors.filter((doc) => {
    const nameMatch = doc.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const specMatch = doc.specialisation?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || specMatch;
  });

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Find a Doctor</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Browse trusted specialists, review their consultation hours, and book instant appointments
        </p>
      </div>

      {/* Search and Specialisation filter bar */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search by doctor name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {POPULAR_SPECIALISATIONS.map((spec) => (
              <button
                key={spec}
                className={`btn btn-sm ${selectedSpec === spec ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedSpec(spec)}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Searching doctors...</div>
      ) : filteredDoctors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Stethoscope size={28} />
          </div>
          <h3>No doctors found</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Try adjusting your search query or selecting another specialisation.
          </p>
        </div>
      ) : (
        <div className="grid-3">
          {filteredDoctors.map((doc) => (
            <div key={doc.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                  {doc.user?.name?.replace('Dr. ', '')[0] || 'D'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem' }}>Dr. {doc.user?.name}</h3>
                  <span style={{ color: 'var(--primary-600)', fontSize: '0.875rem', fontWeight: 600 }}>
                    {doc.specialisation}
                  </span>
                </div>
              </div>

              <div style={{ margin: '0.5rem 0 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={16} />
                  <span>{doc.slotDuration} min consultation slots</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={16} />
                  <span>
                    Available:{' '}
                    {Object.entries(doc.workingHours || {})
                      .filter(([_, v]) => v !== null)
                      .map(([k]) => k.toUpperCase())
                      .join(', ') || 'Custom'}
                  </span>
                </div>
              </div>

              <Link to={`/patient/book/${doc.id}`} className="btn btn-primary btn-block btn-sm">
                Check Slots & Book
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
