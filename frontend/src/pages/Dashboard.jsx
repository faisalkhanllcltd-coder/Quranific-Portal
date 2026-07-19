import React from 'react';
import { Navigate } from 'react-router-dom';

import OwnerDashboard from './dashboards/OwnerDashboard';
import TeacherDashboard from './dashboards/TeacherDashboard';
import StudentDashboard from './dashboards/StudentDashboard';
import ParentDashboard from './dashboards/ParentDashboard';

/**
 * Dashboard — Secure Master Role Router (0-Latency Edition)
 *
 * This acts as the architectural gatekeeper. Because App.jsx already verified 
 * the JWT token via <ProtectedRoute>, we can perform synchronous role evaluation 
 * to render the correct workspace with exactly zero milliseconds of delay.
 */
export default function Dashboard() {
  // ── 1. SYNCHRONOUS ROLE EVALUATION ──
  const token = localStorage.getItem('access');
  const role = (localStorage.getItem('user_type') || 'student').toLowerCase();

  // Failsafe intercept just in case the router guard was bypassed
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // ── 2. INSTANT PRIVILEGE ROUTING ──
  const renderWorkspace = () => {
    switch (role) {
      case 'owner':
      case 'head_manager':
      case 'manager':
        return <OwnerDashboard />;

      case 'teacher':
        return <TeacherDashboard />;

      case 'parent':
        return <ParentDashboard />;

      case 'student':
      default:
        // Absolute Fallback: If a user injects an unknown role into localStorage,
        // they are trapped in the lowest permission tier.
        return <StudentDashboard />;
    }
  };

  return (
    <div className="animate-in fade-in duration-300 h-full w-full transform-gpu">
      {renderWorkspace()}
    </div>
  );
}