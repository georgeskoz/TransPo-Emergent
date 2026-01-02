import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  ArrowLeft, Wallet, DollarSign, TrendingUp, CreditCard, Download,
  Clock, CheckCircle, AlertCircle, Calendar, FileText, ChevronRight,
  RefreshCw, ExternalLink, Zap, X
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DriverEarnings() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [statements, setStatements] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [pendingBalance, setPendingBalance] = useState(0);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadEarningsSummary();
  }, [selectedPeriod]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadStripeStatus(),
      loadEarningsSummary(),
      loadPayouts(),
      loadStatements()
    ]);
    setLoading(false);
  };

  const loadStripeStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/driver/stripe/status`, { headers: getAuthHeaders() });
      if (res.ok) setStripeStatus(await res.json());
    } catch (e) { console.log(e); }
  };

  const loadEarningsSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/driver/earnings/summary?period=${selectedPeriod}`, { headers: getAuthHeaders() });
      if (res.ok) setEarningsSummary(await res.json());
    } catch (e) { console.log(e); }
  };

  const loadPayouts = async () => {
    try {
      const res = await fetch(`${API_URL}/driver/payouts`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts || []);
        setPendingBalance(data.pending_balance || 0);
      }
    } catch (e) { console.log(e); }
  };

  const loadStatements = async () => {
    try {
      const res = await fetch(`${API_URL}/driver/statements`, { headers: getAuthHeaders() });
      if (res.ok) setStatements((await res.json()).statements || []);
    } catch (e) { console.log(e); }
  };

  const connectStripe = async () => {
    try {
      const res = await fetch(`${API_URL}/driver/stripe/connect`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        // For demo, simulate completion instead of redirecting
        toast.success('Redirecting to Stripe onboarding...');
        // In production, you would redirect: window.location.href = data.url;
        // For demo, simulate completion:
        setTimeout(async () => {
          const completeRes = await fetch(`${API_URL}/driver/stripe/complete-onboarding?session_id=${data.session_id}`, {
            method: 'POST',
            headers: getAuthHeaders()
          });
          if (completeRes.ok) {
            toast.success('Stripe account connected!');
            loadStripeStatus();
          }
        }, 2000);
      }
    } catch (e) {
      toast.error('Failed to connect Stripe');
    }
  };

  const requestEarlyCashout = async () => {
    try {
      const amount = parseFloat(cashoutAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }
      if (amount > pendingBalance) {
        toast.error(`Amount exceeds available balance ($${pendingBalance.toFixed(2)})`);
        return;
      }

      const res = await fetch(`${API_URL}/driver/payouts/early-cashout?amount=${amount}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Early cashout requested! Fee: ${data.fee_applied}`);
        setShowCashoutModal(false);
        setCashoutAmount('');
        loadPayouts();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to request cashout');
      }
    } catch (e) {
      toast.error('Failed to request cashout');
    }
  };

  const downloadStatement = async (statementId) => {
    try {
      const res = await fetch(`${API_URL}/driver/statements/${statementId}/download`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Generate PDF-like content (in production, would be actual PDF)
        const content = `
TRANSPO DRIVER STATEMENT
========================
Driver: ${data.statement.driver?.name}
Period: ${data.statement.period}
Generated: ${new Date(data.generated_at).toLocaleDateString()}

EARNINGS SUMMARY
----------------
Total Trips: ${data.statement.total_trips}
Gross Earnings: $${data.statement.gross_earnings.toFixed(2)}
Tips: $${data.statement.tips.toFixed(2)}
Government Fees: $${data.statement.government_fees.toFixed(2)}
GST Collected: $${data.statement.gst_collected.toFixed(2)}
QST Collected: $${data.statement.qst_collected.toFixed(2)}
Platform Commission (${data.statement.commission_rate}): -$${data.statement.platform_commission.toFixed(2)}

NET EARNINGS: $${data.statement.net_earnings.toFixed(2)}
        `;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `statement_${statementId}.txt`;
        a.click();
        toast.success('Statement downloaded');
      }
    } catch (e) {
      toast.error('Failed to download statement');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-4 sticky top-0 z-40">
        <button onClick={() => navigate('/driver')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Earnings & Payouts</h1>
        <button onClick={loadAllData} className="ml-auto p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto overflow-y-auto">
        {/* Stripe Connection Status */}
        {!stripeStatus?.connected ? (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-800">Connect Your Bank Account</h3>
                  <p className="text-sm text-orange-700 mt-1">
                    Link your bank account via Stripe to receive payouts for your completed trips.
                  </p>
                  <Button 
                    className="mt-3 bg-orange-600 hover:bg-orange-700"
                    onClick={connectStripe}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect with Stripe
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">Stripe Connected</span>
                <Badge className="bg-green-100 text-green-700 ml-auto">Active</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Balance Card */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Available Balance</p>
                <p className="text-3xl font-bold mt-1">${pendingBalance.toFixed(2)}</p>
                <p className="text-gray-400 text-xs mt-2">Next payout: Friday</p>
              </div>
              {stripeStatus?.connected && pendingBalance >= 50 && (
                <Button 
                  variant="secondary" 
                  className="bg-white text-gray-900 hover:bg-gray-100"
                  onClick={() => setShowCashoutModal(true)}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Early Cashout
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Period Selector */}
        <div className="flex gap-2">
          {['daily', 'weekly', 'monthly'].map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
              className="capitalize"
            >
              {period}
            </Button>
          ))}
        </div>

        {/* Earnings Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Trips</div>
                <div className="text-2xl font-bold">{earningsSummary?.total_trips || 0}</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600">Gross</div>
                <div className="text-2xl font-bold text-green-700">
                  ${earningsSummary?.gross_earnings?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600">Tips</div>
                <div className="text-2xl font-bold text-blue-700">
                  ${earningsSummary?.tips?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-sm text-purple-600">Net Earnings</div>
                <div className="text-2xl font-bold text-purple-700">
                  ${earningsSummary?.net_earnings?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>
            
            {/* Deductions breakdown */}
            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Platform Commission ({earningsSummary?.commission_rate || 15}%)</span>
                <span className="text-red-500">-${earningsSummary?.platform_commission?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Stripe Processing Fees</span>
                <span className="text-red-500">-${earningsSummary?.stripe_fees?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-500" />
              Payout History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Wallet className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No payouts yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payouts.slice(0, 5).map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">${payout.net_amount?.toFixed(2) || payout.amount?.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(payout.created_at).toLocaleDateString()}
                        {payout.type === 'early_cashout' && (
                          <span className="ml-2 text-orange-600">• Early Cashout</span>
                        )}
                      </div>
                    </div>
                    <Badge className={
                      payout.status === 'completed' ? 'bg-green-100 text-green-700' :
                      payout.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      payout.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }>
                      {payout.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statements */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              Monthly Statements
            </CardTitle>
            <CardDescription>Download your earning statements for tax purposes</CardDescription>
          </CardHeader>
          <CardContent>
            {statements.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No statements available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {statements.map((stmt) => (
                  <button 
                    key={stmt.id}
                    onClick={() => downloadStatement(stmt.id)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div className="text-left">
                        <div className="font-medium">{stmt.month}</div>
                        <div className="text-xs text-gray-500">{stmt.trip_count} trips</div>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Early Cashout Modal */}
      <AnimatePresence>
        {showCashoutModal && (
          <motion.div 
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Early Cashout
                </h2>
                <button onClick={() => setShowCashoutModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600">Available Balance</div>
                  <div className="text-2xl font-bold text-blue-700">${pendingBalance.toFixed(2)}</div>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Early cashout has a <strong>1.5% fee</strong>. Regular payouts are free every Friday.
                </div>

                <div>
                  <Label>Cashout Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="50"
                    max={pendingBalance}
                    value={cashoutAmount}
                    onChange={(e) => setCashoutAmount(e.target.value)}
                    placeholder="Enter amount (min $50)"
                    className="mt-1"
                  />
                  {cashoutAmount && parseFloat(cashoutAmount) > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Fee: ${(parseFloat(cashoutAmount) * 0.015).toFixed(2)} • 
                      You'll receive: ${(parseFloat(cashoutAmount) * 0.985).toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowCashoutModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                    onClick={requestEarlyCashout}
                    disabled={!cashoutAmount || parseFloat(cashoutAmount) < 50}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Request Cashout
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
