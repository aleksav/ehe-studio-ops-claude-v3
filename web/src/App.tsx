import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TimeLoggingPage from './pages/TimeLoggingPage';
import WeeklyGridPage from './pages/WeeklyGridPage';
import { Box, CircularProgress } from '@mui/material';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Box
        component="h3"
        sx={{
          m: 0,
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 600,
          fontSize: 20,
        }}
      >
        {title}
      </Box>
      <Box component="p" sx={{ color: 'text.secondary', mt: 1 }}>
        Coming soon.
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <RedirectIfAuth>
              <LoginPage />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuth>
              <RegisterPage />
            </RedirectIfAuth>
          }
        />

        {/* Authenticated routes */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<PlaceholderPage title="Projects" />} />
          <Route path="/team" element={<PlaceholderPage title="Team" />} />
          <Route path="/time-logging" element={<TimeLoggingPage />} />
          <Route path="/weekly-grid" element={<WeeklyGridPage />} />
          <Route path="/standup" element={<PlaceholderPage title="Standup" />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
