import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store";
import { MobileHeader, BottomSheet } from "../components/mobile";
import { 
  Clock, MapPin, Car, CheckCircle, XCircle, 
  ChevronRight, Calendar, Filter, Search
} from "lucide-react";
import { toast } from "sonner";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  pending: { label: "Searching", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  scheduled: { label: "Scheduled", color: "bg-purple-100 text-purple-700", icon: Calendar },
  accepted: { label: "Driver Found", color: "bg-blue-100 text-blue-700", icon: Car },
  in_progress: { label: "In Progress", color: "bg-purple-100 text-purple-700", icon: Car },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
  cancelled_by_driver: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
  no_show: { label: "No Show", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

export default function UserTrips() {
  const { token } = useAuthStore();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [filter, setFilter] = useState("all"); // all, active, completed

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const res = await fetch(`${API_URL}/bookings/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTrips(data.bookings || []);
    } catch (error) {
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = trips.filter(trip => {
    if (filter === "active") return ["pending", "accepted", "in_progress"].includes(trip.status);
    if (filter === "completed") return ["completed", "cancelled", "cancelled_by_driver", "no_show"].includes(trip.status);
    return true;
  });

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  return (
    <div className="mobile-layout bg-gray-50">
      <MobileHeader title="My Trips" showNotifications />
      
      <div className="mobile-content">
        {/* Filter Tabs */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex gap-2">
            {["all", "active", "completed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === f 
                    ? "bg-gray-900 text-white" 
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Trips List */}
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner" />
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="mobile-empty-state">
              <div className="mobile-empty-state-icon">
                <Car className="w-8 h-8 text-gray-400" />
              </div>
              <p className="mobile-empty-state-title">No trips yet</p>
              <p className="mobile-empty-state-desc">Your trip history will appear here</p>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const status = STATUS_CONFIG[trip.status] || STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              
              return (
                <motion.button
                  key={trip.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedTrip(trip)}
                  className="mobile-card w-full text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {formatDate(trip.created_at)}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      <p className="text-sm text-gray-900 line-clamp-1">
                        {trip.pickup?.address || "Pickup location"}
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                      <p className="text-sm text-gray-900 line-clamp-1">
                        {trip.dropoff?.address || "Dropoff location"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500 capitalize">
                        {trip.vehicle_type || "Sedan"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-gray-900">
                        ${trip.fare?.total?.toFixed(2) || "0.00"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      {/* Trip Details Bottom Sheet */}
      <BottomSheet
        isOpen={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title="Trip Details"
      >
        {selectedTrip && (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_CONFIG[selectedTrip.status]?.color}`}>
                {STATUS_CONFIG[selectedTrip.status]?.label}
              </span>
            </div>

            {/* Route */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 mt-1" />
                <div>
                  <p className="text-xs text-gray-400 mb-1">Pickup</p>
                  <p className="text-gray-900">{selectedTrip.pickup?.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 mt-1" />
                <div>
                  <p className="text-xs text-gray-400 mb-1">Dropoff</p>
                  <p className="text-gray-900">{selectedTrip.dropoff?.address}</p>
                </div>
              </div>
            </div>

            {/* Driver Info */}
            {selectedTrip.driver_name && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <Car className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedTrip.driver_name}</p>
                    <p className="text-sm text-gray-500">{selectedTrip.driver_vehicle}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Fare Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Base fare</span>
                <span className="text-gray-900">${selectedTrip.fare?.base_fare?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Distance ({selectedTrip.fare?.distance_km} km)</span>
                <span className="text-gray-900">${selectedTrip.fare?.distance_charge?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time ({selectedTrip.fare?.duration_min} min)</span>
                <span className="text-gray-900">${selectedTrip.fare?.time_charge?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">GST</span>
                <span className="text-gray-900">${selectedTrip.fare?.gst?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">QST</span>
                <span className="text-gray-900">${selectedTrip.fare?.qst?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-semibold text-gray-900">
                  ${selectedTrip.fare?.total?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
