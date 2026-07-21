import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RoleRoute from './components/RoleRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── EDGE-LIGHTWEIGHT ROUTING (Code Splitting) ──────────────────────────────
// By wrapping these in React.lazy, we ensure the browser only downloads the 
// specific Javascript chunk needed for the current page, destroying initial load lag.
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Attendance = React.lazy(() => import('./pages/Attendance'));
const StudentList = React.lazy(() => import('./pages/StudentList'));
const StudentProfile = React.lazy(() => import('./pages/StudentProfile'));
const Teachers = React.lazy(() => import('./pages/Teachers'));
const TeacherProfile = React.lazy(() => import('./pages/TeacherProfile'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Classroom = React.lazy(() => import('./pages/Classroom'));
const Assignments = React.lazy(() => import('./pages/Assignments'));
const Library = React.lazy(() => import('./pages/Library'));
const AdminHub = React.lazy(() => import('./pages/AdminHub'));
const FinanceHub = React.lazy(() => import('./pages/FinanceHub'));
const Analytics = React.lazy(() => import('./pages/Analytics'));

// ── ROLE CONSTANTS ─────────────────────────────────────────────────────────
const SUPER_ADMIN_ROLES = ['owner', 'head_manager'];      // /admin, /analytics
const FINANCE_ROLES = ['owner', 'head_manager'];          // /finance
const STAFF_ROLES = ['owner', 'head_manager', 'manager']; // /teachers
const ALL_STAFF = ['owner', 'head_manager', 'manager', 'teacher']; // /students

// ── PROTECTED ROUTE GUARD ──────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('access');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// ── ZERO-CLS FALLBACK UI ───────────────────────────────────────────────────
// This renders instantly while the requested page chunk downloads in the background.
const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      <p className="text-sm font-medium text-slate-500">Loading Module...</p>
    </div>
  </div>
);

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          {/* The global Suspense boundary catches any lazy-loaded component
            and renders the PageLoader until the chunk is ready. 
          */}
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── PUBLIC ROUTES ── */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            {/* ── FULL-SCREEN CLASSROOM (No Sidebar) ── */}
            <Route
              path="/classroom/:roomName"
              element={
                <ProtectedRoute>
                  <Classroom />
                </ProtectedRoute>
              }
            />

            {/* ── PRIVATE PORTAL (With Layout/Sidebar) ── */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Universal Routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/library" element={<Library />} />

              {/* ── COMMAND HUBS ── */}
              <Route
                path="/admin"
                element={
                  <RoleRoute allowedRoles={SUPER_ADMIN_ROLES}>
                    <AdminHub />
                  </RoleRoute>
                }
              />

              <Route
                path="/finance"
                element={
                  <RoleRoute allowedRoles={FINANCE_ROLES}>
                    <FinanceHub />
                  </RoleRoute>
                }
              />

              <Route
                path="/analytics"
                element={
                  <RoleRoute allowedRoles={SUPER_ADMIN_ROLES}>
                    <Analytics />
                  </RoleRoute>
                }
              />

              {/* ── DIRECTORIES (Self-contained Creation Drawers) ── */}
              <Route
                path="/students"
                element={
                  <RoleRoute allowedRoles={ALL_STAFF}>
                    <StudentList />
                  </RoleRoute>
                }
              />
              <Route
                path="/students/:id"
                element={
                  <RoleRoute allowedRoles={ALL_STAFF}>
                    <StudentProfile />
                  </RoleRoute>
                }
              />

              <Route
                path="/teachers"
                element={
                  <RoleRoute allowedRoles={STAFF_ROLES}>
                    <Teachers />
                  </RoleRoute>
                }
              />
              <Route
                path="/teachers/:id"
                element={
                  <RoleRoute allowedRoles={STAFF_ROLES}>
                    <TeacherProfile />
                  </RoleRoute>
                }
              />
            </Route>

            {/* 404 FALLBACK */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
        </QueryClientProvider>
  );
}

export default App;