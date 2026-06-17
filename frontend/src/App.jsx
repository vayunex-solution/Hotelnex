import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import MainLayout from './components/layout/MainLayout.jsx';
import Login from './pages/Login.jsx';

// ─── Lazy Loaded Pages ────────────────────────────────────────────────────────
const Dashboard    = React.lazy(() => import('./pages/Dashboard/Dashboard.jsx'));
const Rooms        = React.lazy(() => import('./pages/Rooms/Rooms.jsx'));
const BookingHistory = React.lazy(() => import('./pages/Bookings/BookingHistory.jsx'));
const Guests       = React.lazy(() => import('./pages/Guests/Guests.jsx'));
const Bookings     = React.lazy(() => import('./pages/Bookings/Bookings.jsx'));
const Settings     = React.lazy(() => import('./pages/Settings/Settings.jsx'));

const Spinner = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/login" element={<Login />} />

    {/* Protected */}
    {[
      { path: '/dashboard', Page: Dashboard },
      { path: '/rooms',     Page: Rooms     },
      { path: '/history',   Page: BookingHistory },
      { path: '/bookings',  Page: Bookings  },
      { path: '/guests',    Page: Guests    },
      { path: '/settings',  Page: Settings  },
    ].map(({ path, Page }) => (
      <Route
        key={path}
        path={path}
        element={
          <ProtectedRoute>
            <MainLayout>
              <React.Suspense fallback={<Spinner />}>
                <Page />
              </React.Suspense>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    ))}

    {/* Default redirect */}
    <Route path="/"  element={<Navigate to="/dashboard" replace />} />
    <Route path="*"  element={<Navigate to="/login"     replace />} />
  </Routes>
);

const App = () => (
  <Router>
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  </Router>
);

export default App;

