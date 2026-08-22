import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';

import PatientDashboard from './pages/patient/PatientDashboard';
import DoctorSearch from './pages/patient/DoctorSearch';
import BookAppointment from './pages/patient/BookAppointment';
import AppointmentDetails from './pages/patient/AppointmentDetails';

import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorConsultation from './pages/doctor/DoctorConsultation';
import DoctorSettings from './pages/doctor/DoctorSettings';

import AdminDashboard from './pages/admin/AdminDashboard';

function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user.role === 'PATIENT') return <Navigate to="/patient" replace />;
  if (user.role === 'DOCTOR') return <Navigate to="/doctor" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Patient Portal */}
              <Route
                path="/patient"
                element={
                  <ProtectedRoute allowedRoles={['PATIENT']}>
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patient/doctors"
                element={
                  <ProtectedRoute allowedRoles={['PATIENT']}>
                    <DoctorSearch />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patient/book/:doctorId"
                element={
                  <ProtectedRoute allowedRoles={['PATIENT']}>
                    <BookAppointment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patient/appointments/:appointmentId"
                element={
                  <ProtectedRoute allowedRoles={['PATIENT']}>
                    <AppointmentDetails />
                  </ProtectedRoute>
                }
              />

              {/* Doctor Portal */}
              <Route
                path="/doctor"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR']}>
                    <DoctorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/consultation/:appointmentId"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR']}>
                    <DoctorConsultation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/settings"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR']}>
                    <DoctorSettings />
                  </ProtectedRoute>
                }
              />

              {/* Admin Portal */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}
