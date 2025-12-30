import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socialLogin } = useAuthStore();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      // Get session_id from URL fragment
      const hash = location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        toast.error('No session found');
        navigate('/auth');
        return;
      }

      try {
        await socialLogin(sessionId);
        toast.success('Welcome to Transpo!');
        navigate('/dashboard', { replace: true });
      } catch (error) {
        toast.error(error.message || 'Login failed');
        navigate('/auth');
      }
    };

    processSession();
  }, []);

  return (
    <div className="min-h-screen bg-noir-700 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" style={{ width: '40px', height: '40px' }} />
        <p className="text-noir-100">Signing you in...</p>
      </div>
    </div>
  );
}
