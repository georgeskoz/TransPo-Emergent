import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  ArrowLeft, Play, Square, MapPin, Clock, Navigation,
  DollarSign, Receipt, Car, Flag, Pause, RefreshCw,
  Sun, Moon, AlertCircle, Check, X
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DriverMeter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');
  
  const { getAuthHeaders } = useAuthStore();
  
  // Meter state
  const [meterId, setMeterId] = useState(null);
  const [meterStatus, setMeterStatus] = useState("idle"); // idle, running, stopped
  const [mode, setMode] = useState(bookingId ? "app_booking" : "street_hail");
  const [fare, setFare] = useState(null);
  const [rates, setRates] = useState(null);
  
  // Location tracking
  const [currentLocation, setCurrentLocation] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const locationWatchId = useRef(null);
  
  // Timer
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);
  
  // Tip selection
  const [showTipModal, setShowTipModal] = useState(false);
  const [selectedTip, setSelectedTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [finalReceipt, setFinalReceipt] = useState(null);

  useEffect(() => {
    loadRates();
    getCurrentLocation();
    
    return () => {
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const loadRates = async () => {
    try {
      const res = await fetch(`${API_URL}/taxi/rates`);
      const data = await res.json();
      setRates(data);
    } catch (e) {
      console.log('Error loading rates:', e);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setIsLocating(false);
      },
      (err) => {
        toast.error("Could not get location");
        setIsLocating(false);
        // Default to downtown Montreal for testing
        setCurrentLocation({ lat: 45.5017, lng: -73.5673 });
      },
      { enableHighAccuracy: true }
    );
  };

  const startMeter = async () => {
    if (!currentLocation) {
      toast.error("Please wait for location");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/taxi/meter/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          booking_id: bookingId || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start meter');
      }

      const data = await res.json();
      setMeterId(data.meter_id);
      setMeterStatus("running");
      setStartLocation(data.start_location);
      setFare(data.fare);
      setMode(data.mode);
      
      toast.success(data.message);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      
      // Start location tracking
      startLocationTracking(data.meter_id);
      
    } catch (e) {
      toast.error(e.message);
    }
  };

  const startLocationTracking = (meterId) => {
    if (!navigator.geolocation) return;
    
    locationWatchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setCurrentLocation(newLoc);
        
        // Update meter
        try {
          const res = await fetch(`${API_URL}/taxi/meter/${meterId}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(newLoc)
          });
          
          if (res.ok) {
            const data = await res.json();
            setFare(data.fare);
          }
        } catch (e) {
          console.log('Meter update error:', e);
        }
      },
      (err) => console.log('Location error:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
  };

  const stopMeter = () => {
    setShowTipModal(true);
  };

  const completeMeter = async () => {
    if (!meterId) return;
    
    // Stop tracking
    if (locationWatchId.current) {
      navigator.geolocation.clearWatch(locationWatchId.current);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      const tipAmount = customTip ? parseFloat(customTip) : 0;
      
      const res = await fetch(`${API_URL}/taxi/meter/${meterId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          tip_percent: tipAmount ? 0 : selectedTip,
          custom_tip: tipAmount,
          payment_method: "cash"
        })
      });

      if (!res.ok) throw new Error('Failed to stop meter');

      const data = await res.json();
      setMeterStatus("stopped");
      setFinalReceipt(data.receipt);
      setShowTipModal(false);
      toast.success("Trip completed!");
      
    } catch (e) {
      toast.error(e.message);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isNightRate = rates?.current_period === 'night';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button 
            onClick={() => navigate('/driver')}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900">Taxi Meter</h1>
            <div className="flex items-center justify-center gap-2 text-sm">
              {mode === "street_hail" ? (
                <span className="flex items-center gap-1 text-orange-600">
                  <Flag className="w-4 h-4" />
                  Street Hail Mode
                </span>
              ) : (
                <span className="flex items-center gap-1 text-blue-600">
                  <Car className="w-4 h-4" />
                  App Booking
                </span>
              )}
            </div>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Rate Period Indicator */}
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isNightRate ? (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-indigo-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Sun className="w-5 h-5 text-amber-600" />
                  </div>
                )}
                <div>
                  <div className="text-sm text-gray-500">Current Rate</div>
                  <div className="font-semibold text-gray-900">
                    {isNightRate ? 'Night Rate (23:00-05:00)' : 'Day Rate (05:00-23:00)'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Per km</div>
                <div className="font-bold text-gray-900">
                  ${isNightRate ? '2.35' : '2.05'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Meter Display */}
        <Card className="bg-white border-gray-200 overflow-hidden">
          <div className={`p-6 text-center ${meterStatus === 'running' ? 'bg-green-50' : 'bg-gray-50'}`}>
            {/* Timer */}
            <div className="text-sm text-gray-500 mb-1">Trip Duration</div>
            <div className="text-4xl font-mono font-bold text-gray-900 mb-4">
              {formatTime(elapsedTime)}
            </div>

            {/* Main Fare */}
            <div className="text-sm text-gray-500 mb-1">Current Fare</div>
            <div className="text-6xl font-bold text-gray-900 mb-2">
              ${fare?.total_before_tip?.toFixed(2) || '0.00'}
            </div>
            
            {meterStatus === 'running' && (
              <motion.div 
                className="flex items-center justify-center gap-2 text-green-600"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Meter Running</span>
              </motion.div>
            )}
          </div>

          <CardContent className="p-4">
            {/* Fare Breakdown */}
            {fare && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Base fare</span>
                  <span className="font-mono text-gray-900">${fare.base_fare?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance ({fare.distance_km} km)</span>
                  <span className="font-mono text-gray-900">${fare.distance_cost?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Waiting ({fare.waiting_minutes?.toFixed(1)} min)</span>
                  <span className="font-mono text-gray-900">${fare.waiting_cost?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="text-gray-500">Gov't fee</span>
                  <span className="font-mono text-gray-900">${fare.government_fee?.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Location Info */}
            {startLocation && (
              <div className="mt-4 p-3 rounded-lg bg-gray-50">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-green-500 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Pickup</div>
                    <div className="text-sm text-gray-700">{startLocation.address}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Control Buttons */}
        <div className="space-y-3">
          {meterStatus === "idle" && (
            <>
              <Button 
                onClick={startMeter}
                disabled={isLocating || !currentLocation}
                className="w-full py-6 text-lg bg-green-600 hover:bg-green-700 text-white rounded-xl"
              >
                {isLocating ? (
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Play className="w-5 h-5 mr-2" />
                )}
                Start Meter
              </Button>
              
              {!bookingId && (
                <p className="text-center text-sm text-gray-500">
                  <Flag className="w-4 h-4 inline mr-1" />
                  Street Hail Mode - No app booking required
                </p>
              )}
            </>
          )}

          {meterStatus === "running" && (
            <Button 
              onClick={stopMeter}
              className="w-full py-6 text-lg bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              <Square className="w-5 h-5 mr-2" />
              Stop Meter
            </Button>
          )}

          {meterStatus === "stopped" && finalReceipt && (
            <div className="space-y-3">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <Check className="w-12 h-12 mx-auto text-green-600 mb-2" />
                  <div className="text-lg font-bold text-green-800">Trip Complete!</div>
                  <div className="text-3xl font-bold text-green-900 mt-2">
                    ${finalReceipt.fare_breakdown?.total_final?.toFixed(2)}
                  </div>
                  {finalReceipt.fare_breakdown?.tip_amount > 0 && (
                    <div className="text-sm text-green-700">
                      (includes ${finalReceipt.fare_breakdown.tip_amount.toFixed(2)} tip)
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Button 
                onClick={() => {
                  setMeterStatus("idle");
                  setFare(null);
                  setElapsedTime(0);
                  setMeterId(null);
                  setStartLocation(null);
                  setFinalReceipt(null);
                }}
                variant="outline"
                className="w-full py-4"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Start New Trip
              </Button>
              
              <Button 
                onClick={() => navigate('/driver')}
                className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white"
              >
                Back to Dashboard
              </Button>
            </div>
          )}
        </div>

        {/* Quebec Compliance Notice */}
        <div className="text-center text-xs text-gray-400 mt-4">
          <AlertCircle className="w-3 h-3 inline mr-1" />
          Quebec CTQ compliant rates • Taxes included
        </div>
      </div>

      {/* Tip Modal */}
      <AnimatePresence>
        {showTipModal && (
          <motion.div 
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-lg bg-white rounded-t-3xl p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Add Tip?</h2>
                <button 
                  onClick={() => setShowTipModal(false)}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="text-center mb-6">
                <div className="text-sm text-gray-500">Fare Total</div>
                <div className="text-3xl font-bold text-gray-900">
                  ${fare?.total_before_tip?.toFixed(2)}
                </div>
              </div>

              {/* Tip Presets */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[0, 15, 20, 25].map((tip) => (
                  <button
                    key={tip}
                    onClick={() => { setSelectedTip(tip); setCustomTip(""); }}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      selectedTip === tip && !customTip
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">{tip === 0 ? 'None' : `${tip}%`}</div>
                    {tip > 0 && (
                      <div className="text-xs opacity-70">
                        ${((fare?.total_before_tip || 0) * tip / 100).toFixed(2)}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Tip */}
              <div className="mb-6">
                <input
                  type="number"
                  placeholder="Custom tip amount ($)"
                  value={customTip}
                  onChange={(e) => { setCustomTip(e.target.value); setSelectedTip(0); }}
                  className="w-full p-3 border border-gray-200 rounded-xl text-center"
                />
              </div>

              {/* Total with Tip */}
              <div className="p-4 rounded-xl bg-gray-50 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total with Tip</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${(
                      (fare?.total_before_tip || 0) + 
                      (customTip ? parseFloat(customTip) : (fare?.total_before_tip || 0) * selectedTip / 100)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <Button 
                onClick={completeMeter}
                className="w-full py-6 text-lg bg-green-600 hover:bg-green-700 text-white rounded-xl"
              >
                <Receipt className="w-5 h-5 mr-2" />
                Complete Trip
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
