import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './lib/store';
import { useEffect } from 'react';

// Pages (will be created next)
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import NewProject from './pages/NewProject';
import ProjectDetails from './pages/ProjectDetails';
import Login from './pages/Login';
import Register from './pages/Register';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Protected Route component - redirects to login if not authenticated
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Onboarding Route - shows onboarding if user experience not set
 */
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const userExperience = useStore((state) => state.userExperience);

  if (!userExperience) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

/**
 * Main App component with routing
 */
function App() {
  const theme = useStore((state) => state.theme);

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className={`app ${theme}`}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <OnboardingRoute>
                    <Dashboard />
                  </OnboardingRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/new"
              element={
                <ProtectedRoute>
                  <OnboardingRoute>
                    <NewProject />
                  </OnboardingRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute>
                  <OnboardingRoute>
                    <ProjectDetails />
                  </OnboardingRoute>
                </ProtectedRoute>
              }
            />

            {/* Redirect unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
