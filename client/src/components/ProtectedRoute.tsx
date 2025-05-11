import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import socketService from '../services/socket.ts';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles = [] }) => {
  const { authState } = useAuth();
  const { isAuthenticated, user, token, loading } = authState;

  useEffect(() => {
    // Debug info
    console.log("ProtectedRoute state:", { 
      isAuthenticated, 
      role: user?.role, 
      loading, 
      allowedRoles,
      hasToken: !!token,
      socketConnected: socketService.isConnected()
    });

    // Connect socket if authenticated but not connected
    if (isAuthenticated && token && !socketService.isConnected()) {
      console.log("Connecting socket from ProtectedRoute");
      socketService.connect(token);
    }
  }, [isAuthenticated, user, token, loading, allowedRoles]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    console.log("Not authenticated, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role
  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    console.log(`User role ${user.role} not allowed, redirecting to home`);
    return <Navigate to="/" replace />;
  }

  // Ensure socket is connected
  if (!socketService.isConnected() && token) {
    socketService.connect(token);
  }

  return <Outlet />;
};

export default ProtectedRoute; 