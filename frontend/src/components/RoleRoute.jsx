import { Navigate } from 'react-router-dom';

/**
 * RoleRoute — Route-level RBAC guard.
 *
 * Usage:
 *   <RoleRoute allowedRoles={['owner', 'head_manager']}>
 *     <Financials />
 *   </RoleRoute>
 *
 * Behaviour:
 *  - Reads `user_type` from localStorage (set by the login serializer).
 *  - If the role IS in `allowedRoles` → renders children normally.
 *  - If the role IS NOT in `allowedRoles` → redirects to /dashboard
 *    (safe landing page for all authenticated users) with `replace` so the
 *    forbidden URL is not left in history.
 *
 * This component is always rendered INSIDE a ProtectedRoute, so we can
 * assume a valid token already exists when this check runs.
 */
export default function RoleRoute({ allowedRoles = [], children }) {
  const userType = localStorage.getItem('user_type') || 'student';

  if (!allowedRoles.includes(userType)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
