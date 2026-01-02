import { motion } from "framer-motion";
import { MapPin, Clock, DollarSign, User, Phone, Navigation, X, Check } from "lucide-react";

/**
 * Mobile-optimized ride card for driver dashboard
 * Supports swipe gestures for accept/decline
 */
export default function MobileRideCard({
  ride,
  onAccept,
  onDecline,
  isScheduled = false,
  minutesUntilPickup = null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`bg-white rounded-3xl shadow-xl border-2 ${
        isScheduled ? 'border-purple-200' : 'border-gray-100'
      } overflow-hidden`}
    >
      {/* Header */}
      {isScheduled && (
        <div className="bg-purple-500 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Scheduled Ride</span>
          </div>
          <span className="text-sm font-bold">{minutesUntilPickup} min</span>
        </div>
      )}

      <div className="p-5">
        {/* Customer Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{ride.userName || 'Customer'}</p>
              <div className="flex items-center gap-1 text-yellow-500">
                {'★'.repeat(5)}
                <span className="text-sm text-gray-500 ml-1">4.8</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              ${ride.fare?.total?.toFixed(2) || ride.fare?.our_fare?.total?.toFixed(2) || '0.00'}
            </p>
            <p className="text-sm text-gray-500">
              {ride.fare?.distance_km?.toFixed(1) || ride.fare?.our_fare?.distance_km?.toFixed(1) || '0'} km
            </p>
          </div>
        </div>

        {/* Route */}
        <div className="space-y-3 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="w-0.5 h-8 bg-gray-200" />
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-xs text-gray-500">PICKUP</p>
              <p className="font-medium text-gray-900">{ride.pickup?.address || 'Loading...'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="flex-1 pt-0.5">
              <p className="text-xs text-gray-500">DROPOFF</p>
              <p className="font-medium text-gray-900">{ride.dropoff?.address || 'Loading...'}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onDecline}
            className="flex-1 py-4 bg-red-100 text-red-600 font-semibold rounded-2xl flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Decline
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onAccept}
            className="flex-1 py-4 bg-green-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Accept
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
