import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { CheckCircle, Loader2, XCircle, ArrowRight } from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAuthHeaders } = useAuthStore();
  
  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id');
  
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [paymentData, setPaymentData] = useState(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    }
  }, [sessionId]);

  const pollPaymentStatus = async () => {
    const maxAttempts = 5;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setStatus('error');
      toast.error('Payment verification timeout');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/payments/status/${sessionId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setPaymentData(data);

      if (data.payment_status === 'paid') {
        setStatus('success');
        toast.success('Payment successful!');
        return;
      } else if (data.status === 'expired') {
        setStatus('error');
        toast.error('Payment session expired');
        return;
      }

      // Continue polling
      setAttempts(prev => prev + 1);
      setTimeout(pollPaymentStatus, pollInterval);
    } catch (error) {
      console.error('Error checking payment:', error);
      setAttempts(prev => prev + 1);
      setTimeout(pollPaymentStatus, pollInterval);
    }
  };

  return (
    <div className="min-h-screen bg-noir-700 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="bg-noir-600 border-noir-300">
          <CardContent className="p-8 text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="w-16 h-16 mx-auto text-cyan animate-spin mb-6" />
                <h2 className="font-heading text-2xl font-bold text-white mb-2">
                  Verifying Payment
                </h2>
                <p className="text-noir-100 mb-6">
                  Please wait while we confirm your payment...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-white mb-2">
                  Payment Successful!
                </h2>
                <p className="text-noir-100 mb-2">
                  Your ride has been paid for.
                </p>
                {paymentData && (
                  <div className="text-2xl font-heading font-bold text-cyan mb-6">
                    ${(paymentData.amount_total || 0).toFixed(2)} CAD
                  </div>
                )}
                <Button 
                  onClick={() => navigate('/dashboard')}
                  className="btn-primary w-full"
                  data-testid="go-to-dashboard-btn"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-white mb-2">
                  Payment Issue
                </h2>
                <p className="text-noir-100 mb-6">
                  There was an issue verifying your payment. Please contact support if you were charged.
                </p>
                <Button 
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary w-full"
                >
                  Return to Dashboard
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
