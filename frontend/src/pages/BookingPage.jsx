import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function BookingPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to dashboard - booking is handled there
    navigate('/dashboard');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-noir-700 flex items-center justify-center">
      <div className="spinner" />
    </div>
  );
}
