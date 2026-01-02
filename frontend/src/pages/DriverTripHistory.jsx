import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  ArrowLeft, MapPin, Clock, DollarSign, Calendar, Car,
  RefreshCw, ChevronRight, Navigation, User, Star
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DriverTripHistory() {
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuthStore();
  
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedTrip, setSelectedTrip] = useState(null);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/trips`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
      }
    } catch (e) { 
      console.log(e); 
    }
    setLoading(false);
  };

  const filteredTrips = trips.filter(trip => {
    if (filter === 'all') return true;
    return trip.status === filter;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return 'N/A';
    const diff = new Date(end) - new Date(start);
    const mins = Math.floor(diff / 60000);
    return `${mins} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/driver')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Trip History</h1>
        <button onClick={loadTrips} className="ml-auto p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 flex gap-2 overflow-x-auto">
        {['all', 'completed', 'cancelled'].map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{trips.length}</div>
              <div className="text-xs text-gray-500">Total Trips</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                ${trips.reduce((sum, t) => sum + (t.final_fare?.total_final || 0), 0).toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">Total Earned</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {trips.filter(t => t.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-500">Completed</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trip List */}
      <div className="px-4 pb-24 space-y-3">
        {filteredTrips.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No trips found</p>
              <p className="text-sm mt-1">Your trip history will appear here</p>
            </CardContent>
          </Card>
        ) : (
          filteredTrips.map((trip) => (
            <motion.div
              key={trip.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
            >
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={
                          trip.status === 'completed' ? 'bg-green-100 text-green-700' :
                          trip.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {trip.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatDate(trip.start_time || trip.created_at)}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-gray-600 truncate">
                            {trip.pickup_address || trip.route?.pickup || 'Pickup location'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-gray-600 truncate">
                            {trip.dropoff_address || trip.route?.dropoff || 'Dropoff location'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        ${trip.final_fare?.total_final?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {trip.final_fare?.distance_km?.toFixed(1) || '0'} km
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {selectedTrip?.id === trip.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-4 pt-4 border-t space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>Duration: {formatDuration(trip.start_time, trip.end_time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-gray-400" />
                          <span>{trip.final_fare?.distance_km?.toFixed(2) || '0'} km</span>
                        </div>
                      </div>
                      
                      {/* Fare Breakdown */}
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Base Fare</span>
                          <span>${trip.final_fare?.base_fare?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Distance</span>
                          <span>${trip.final_fare?.distance_cost?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Waiting Time</span>
                          <span>${trip.final_fare?.waiting_cost?.toFixed(2) || '0.00'}</span>
                        </div>
                        {trip.final_fare?.tip > 0 && (
                          <div className="flex justify-between text-blue-600">
                            <span>Tip</span>
                            <span>${trip.final_fare?.tip?.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quebec Fee</span>
                          <span>${trip.final_fare?.government_fee?.toFixed(2) || '0.90'}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2 font-semibold">
                          <span>Total</span>
                          <span className="text-green-600">${trip.final_fare?.total_final?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                      
                      {trip.rating && (
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{trip.rating}</span>
                          <span className="text-gray-500 text-sm">from rider</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
