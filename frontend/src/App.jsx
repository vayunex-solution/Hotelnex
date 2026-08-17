import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }          from './context/AuthContext.jsx';
import { ThemeProvider }         from './context/ThemeContext.jsx';
import { PlatformAuthProvider }  from './context/PlatformAuthContext.jsx';
import { PlatformThemeProvider } from './context/PlatformThemeContext.jsx';
import ProtectedRoute            from './components/ProtectedRoute.jsx';
import MainLayout               from './components/layout/MainLayout.jsx';
import PlatformLayout           from './layouts/PlatformLayout.jsx';
import Login                    from './pages/Login.jsx';
import PlatformLogin            from './pages/Platform/PlatformLogin.jsx';

// ─── Hotel PMS Pages (lazy) ───────────────────────────────────────────────────
const Dashboard      = React.lazy(() => import('./pages/Dashboard/Dashboard.jsx'));
const Rooms          = React.lazy(() => import('./pages/Rooms/Rooms.jsx'));
const BookingHistory = React.lazy(() => import('./pages/Bookings/BookingHistory.jsx'));
const Guests         = React.lazy(() => import('./pages/Guests/Guests.jsx'));
const Bookings       = React.lazy(() => import('./pages/Bookings/Bookings.jsx'));
const Settings       = React.lazy(() => import('./pages/Settings/Settings.jsx'));

// ─── Platform Admin Pages (lazy) ─────────────────────────────────────────────
const PlatformDashboard = React.lazy(() => import('./pages/Platform/PlatformDashboard.jsx'));
const Tenants           = React.lazy(() => import('./pages/Platform/Tenants.jsx'));
const TenantDetails     = React.lazy(() => import('./pages/Platform/TenantDetails.jsx'));

const PropertyDashboard = React.lazy(() => import('./pages/Platform/Properties/PropertyDashboard.jsx'));
const PropertyWizard    = React.lazy(() => import('./pages/Platform/Properties/PropertyWizard.jsx'));
const PropertySettings  = React.lazy(() => import('./pages/Platform/Properties/PropertySettings.jsx'));

const Verification      = React.lazy(() => import('./pages/Verification.jsx'));

// ─── Shared Spinner ───────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ─── Platform Guard ───────────────────────────────────────────────────────────
// Blocks access to platform pages if not authenticated as super admin
const PlatformGuard = ({ children }) => {
  const token = localStorage.getItem('platform_token');
  if (!token) return <Navigate to="/platform/login" replace />;
  return children;
};

// ─── Route Trees ──────────────────────────────────────────────────────────────
const HotelPmsRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route 
      path="/verification" 
      element={
        <React.Suspense fallback={<Spinner />}>
          <Verification />
        </React.Suspense>
      } 
    />
    {[
      { path: '/dashboard', Page: Dashboard      },
      { path: '/rooms',     Page: Rooms          },
      { path: '/history',   Page: BookingHistory },
      { path: '/bookings',  Page: Bookings       },
      { path: '/guests',    Page: Guests         },
      { path: '/settings',  Page: Settings       },
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
    <Route path="/"  element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

const PlatformAdminRoutes = () => (
  <Routes>
    <Route path="/login" element={<PlatformLogin />} />
    {[
      { path: '/dashboard',       Page: PlatformDashboard },
      { path: '/tenants',         Page: Tenants           },
      { path: '/tenants/:id',     Page: TenantDetails     },
      { path: '/properties',      Page: PropertyDashboard },
      { path: '/properties/new',  Page: PropertyWizard    },
      { path: '/properties/:id',  Page: PropertySettings  },
    ].map(({ path, Page }) => (
      <Route
        key={path}
        path={path}
        element={
          <PlatformGuard>
            <PlatformLayout>
              <React.Suspense fallback={<Spinner />}>
                <Page />
              </React.Suspense>
            </PlatformLayout>
          </PlatformGuard>
        }
      />
    ))}
    <Route path="*" element={<Navigate to="/platform/login" replace />} />
  </Routes>
);

// ─── App Root ─────────────────────────────────────────────────────────────────
const App = () => (
  <Router>
    <ThemeProvider>
      <AuthProvider>
        <PlatformThemeProvider>
          <PlatformAuthProvider>
            <Routes>
              {/* Platform Admin — isolated under /platform/* */}
              <Route path="/platform/*" element={<PlatformAdminRoutes />} />

              {/* Hotel PMS — all other routes */}
              <Route path="/*" element={<HotelPmsRoutes />} />
            </Routes>
          </PlatformAuthProvider>
        </PlatformThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  </Router>
);

export default App;
