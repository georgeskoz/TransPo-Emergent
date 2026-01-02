import { motion } from "framer-motion";
import { Power, Wifi, WifiOff } from "lucide-react";

/**
 * Large prominent online/offline toggle for drivers
 */
export default function MobileOnlineToggle({ 
  isOnline, 
  onToggle, 
  isLoading = false,
  earnings = 0 
}) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
      {/* Status Display */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Today's Earnings</p>
          <p className="text-3xl font-bold text-gray-900">${earnings.toFixed(2)}</p>
        </div>
        <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
          isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          <span className="font-medium">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Toggle Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onToggle}
        disabled={isLoading}
        className={`w-full py-5 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-colors ${
          isOnline
            ? 'bg-red-500 text-white'
            : 'bg-green-500 text-white'
        } disabled:opacity-50`}
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Power className="w-6 h-6" />
            {isOnline ? 'Go Offline' : 'Go Online'}
          </>
        )}
      </motion.button>

      {/* Helper Text */}
      <p className="text-center text-sm text-gray-500 mt-3">
        {isOnline 
          ? 'You are visible to customers and can receive ride requests'
          : 'Go online to start receiving ride requests'
        }
      </p>
    </div>
  );
}
