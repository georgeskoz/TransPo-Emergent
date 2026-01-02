import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store";
import { MobileHeader, BottomSheet } from "../components/mobile";
import { 
  Wallet, CreditCard, Plus, ChevronRight, Gift, 
  DollarSign, ArrowUpRight, ArrowDownLeft, Clock
} from "lucide-react";
import { toast } from "sonner";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CARD_BRANDS = {
  visa: { bg: "bg-blue-600", icon: "💳" },
  mastercard: { bg: "bg-orange-600", icon: "💳" },
  amex: { bg: "bg-indigo-600", icon: "💳" },
  default: { bg: "bg-gray-700", icon: "💳" }
};

export default function UserWallet() {
  const { token, user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      // Fetch payment methods
      const methodsRes = await fetch(`${API_URL}/user/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const methodsData = await methodsRes.json();
      setPaymentMethods(methodsData.payment_methods || []);

      // Fetch user profile for balance
      const profileRes = await fetch(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const profileData = await profileRes.json();
      setBalance(profileData.wallet_balance || 0);

      // Mock transactions for now
      setTransactions([
        { id: 1, type: "trip", description: "Trip to Downtown", amount: -24.50, date: "2024-12-30" },
        { id: 2, type: "topup", description: "Wallet Top-up", amount: 50.00, date: "2024-12-28" },
        { id: 3, type: "trip", description: "Trip to Airport", amount: -45.00, date: "2024-12-25" },
        { id: 4, type: "promo", description: "Welcome Bonus", amount: 10.00, date: "2024-12-20" },
      ]);
    } catch (error) {
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === "WELCOME10") {
      toast.success("Promo code applied! $10 added to your wallet");
      setBalance(prev => prev + 10);
      setShowPromo(false);
      setPromoCode("");
    } else {
      toast.error("Invalid promo code");
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="mobile-layout bg-gray-50">
      <MobileHeader title="Wallet" showNotifications />
      
      <div className="mobile-content">
        {/* Balance Card */}
        <div className="p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 rounded-2xl p-6 text-white"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Available Balance</span>
              <Wallet className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-4xl font-bold mb-6">${balance.toFixed(2)}</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => toast.info("Top-up coming soon!")}
                className="flex-1 bg-white text-gray-900 rounded-xl py-3 font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Money
              </button>
              <button 
                onClick={() => setShowPromo(true)}
                className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2"
              >
                <Gift className="w-5 h-5" />
                Promo Code
              </button>
            </div>
          </motion.div>
        </div>

        {/* Payment Methods */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Payment Methods</h2>
            <button 
              onClick={() => setShowAddCard(true)}
              className="text-sm text-blue-600 font-medium"
            >
              Add New
            </button>
          </div>

          <div className="space-y-3">
            {paymentMethods.length === 0 ? (
              <button
                onClick={() => setShowAddCard(true)}
                className="mobile-card w-full flex items-center justify-center gap-3 py-8 border-2 border-dashed border-gray-200"
              >
                <CreditCard className="w-6 h-6 text-gray-400" />
                <span className="text-gray-500">Add a payment method</span>
              </button>
            ) : (
              paymentMethods.map((method) => {
                const brand = CARD_BRANDS[method.card_brand?.toLowerCase()] || CARD_BRANDS.default;
                return (
                  <motion.div
                    key={method.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`${brand.bg} rounded-xl p-4 text-white`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{brand.icon}</span>
                        <div>
                          <p className="font-medium">
                            {method.card_brand || "Card"} •••• {method.card_last_four}
                          </p>
                          <p className="text-sm text-white/70">
                            Expires {method.expiry_month}/{method.expiry_year}
                          </p>
                        </div>
                      </div>
                      {method.is_default && (
                        <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                          Default
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="px-4 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
          
          <div className="mobile-card">
            {transactions.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.amount > 0 ? "bg-green-100" : "bg-gray-100"
                      }`}>
                        {tx.amount > 0 ? (
                          <ArrowDownLeft className="w-5 h-5 text-green-600" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tx.description}</p>
                        <p className="text-sm text-gray-500">{formatDate(tx.date)}</p>
                      </div>
                    </div>
                    <span className={`font-semibold ${
                      tx.amount > 0 ? "text-green-600" : "text-gray-900"
                    }`}>
                      {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Card Bottom Sheet */}
      <BottomSheet
        isOpen={showAddCard}
        onClose={() => setShowAddCard(false)}
        title="Add Payment Method"
      >
        <div className="space-y-4">
          <p className="text-gray-500 text-sm">
            Payment method integration is coming soon. For now, you can pay cash or use your wallet balance.
          </p>
          <button
            onClick={() => {
              toast.info("Feature coming soon!");
              setShowAddCard(false);
            }}
            className="mobile-btn mobile-btn-primary mobile-btn-full"
          >
            <CreditCard className="w-5 h-5" />
            Add Credit/Debit Card
          </button>
        </div>
      </BottomSheet>

      {/* Promo Code Bottom Sheet */}
      <BottomSheet
        isOpen={showPromo}
        onClose={() => setShowPromo(false)}
        title="Enter Promo Code"
      >
        <div className="space-y-4">
          <div className="mobile-input-container">
            <Gift className="mobile-input-icon" />
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="mobile-input uppercase"
            />
          </div>
          <p className="text-sm text-gray-500">
            Try: WELCOME10 for $10 bonus
          </p>
          <button
            onClick={handleApplyPromo}
            disabled={!promoCode}
            className="mobile-btn mobile-btn-primary mobile-btn-full disabled:opacity-50"
          >
            Apply Code
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
