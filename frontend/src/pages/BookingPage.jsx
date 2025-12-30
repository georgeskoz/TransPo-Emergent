import { useNavigate } from "react-router-dom";

export default function BookingPage() {
  const navigate = useNavigate();
  
  // Redirect to dashboard - booking is handled there
  navigate('/dashboard');
  return null;
}
