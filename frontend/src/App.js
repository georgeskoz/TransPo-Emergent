import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "./store";

// Pages
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import UserDashboard from "./pages/UserDashboard";
import UserProfile from "./pages/UserProfile";
import DriverDashboard from "./pages/DriverDashboard";
import DriverProfilePage from "./pages/DriverProfilePage";
import DriverMeter from "./pages/DriverMeter";
import DriverEarnings from "./pages/DriverEarnings";
import DriverTripHistory from "./pages/DriverTripHistory";
import DriverRatings from "./pages/DriverRatings";
import DriverSettings from "./pages/DriverSettings";
import AdminDashboard from "./pages/AdminDashboard";
import BookingPage from "./pages/BookingPage";
import PaymentSuccess from "./pages/PaymentSuccess";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// App Router with session_id detection
function AppRouter() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  // Check URL fragment for session_id (social auth callback)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={isAuthenticated ? <Navigate to={getDashboardPath(user?.role)} replace /> : <AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Change Password - Protected */}
      <Route path="/change-password" element={
        <ProtectedRoute>
          <ChangePassword />
        </ProtectedRoute>
      } />
      
      {/* User Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['user']}>
          <UserDashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <UserProfile />
        </ProtectedRoute>
      } />
      <Route path="/book" element={
        <ProtectedRoute allowedRoles={['user']}>
          <BookingPage />
        </ProtectedRoute>
      } />
      <Route path="/payment/success" element={
        <ProtectedRoute>
          <PaymentSuccess />
        </ProtectedRoute>
      } />
      <Route path="/payment/cancel" element={
        <ProtectedRoute>
          <Navigate to="/dashboard" replace />
        </ProtectedRoute>
      } />

      {/* Driver Routes */}
      <Route path="/driver" element={
        <ProtectedRoute allowedRoles={['driver']}>
          <DriverDashboard />
        </ProtectedRoute>
      } />
      <Route path="/driver/profile" element={
        <ProtectedRoute allowedRoles={['driver']}>
          <DriverProfilePage />
        </ProtectedRoute>
      } />
      <Route path="/driver/meter" element={
        <ProtectedRoute allowedRoles={['driver']}>
          <DriverMeter />
        </ProtectedRoute>
      } />
      <Route path="/driver/earnings" element={
        <ProtectedRoute allowedRoles={['driver']}>
          <DriverEarnings />
        </ProtectedRoute>
      } />
      <Route path="/driver/trips" element={
        <ProtectedRoute allowedRoles={['driver']}>
          <DriverTripHistory />
        </ProtectedRoute>
      } />
      <Route path="/driver/ratings" element={
        <ProtectedRoute allowedRoles={['driver']}>
          <DriverRatings />
        </ProtectedRoute>
      } />
      <Route path="/driver/settings" element={
        <ProtectedRoute allowedRoles={['driver']}>
          <DriverSettings />
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function getDashboardPath(role) {
  switch (role) {
    case 'driver': return '/driver';
    case 'admin': return '/admin';
    default: return '/dashboard';
  }
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
