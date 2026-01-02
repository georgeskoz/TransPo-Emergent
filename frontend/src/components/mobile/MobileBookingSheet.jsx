import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { 
  MapPin, Navigation, Car, Clock, ChevronUp, ChevronDown,
  Search, X, Locate, Star, Home, Briefcase, Heart, Plus
} from "lucide-react";
import { useAuthStore, useBookingStore, useMapStore } from "../../store";
import { toast } from "sonner";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VEHICLE_TYPES = [
  { id: 'sedan', icon: '🚗', label: 'Sedan', mult: '1x' },
  { id: 'suv', icon: '🚙', label: 'SUV', mult: '1.3x' },
  { id: 'premium', icon: '✨', label: 'Premium', mult: '1.8x' }
];

export default function MobileBookingSheet({ 
  isExpanded, 
  onExpandChange,
  onBookRide,
  isLoading 
}) {
  const { token, user } = useAuthStore();
  const { pickup, dropoff, setPickup, setDropoff, fareEstimate, setFareEstimate } = useMapStore();
  const dragControls = useDragControls();
  
  const [activeInput, setActiveInput] = useState(null); // 'pickup' | 'dropoff' | null
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [vehicleType, setVehicleType] = useState('sedan');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isLocating, setIsLocating] = useState(false);
  
  const sheetRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    loadSavedAddresses();
  }, []);

  useEffect(() => {
    if (pickup?.address) setPickupText(pickup.address);
  }, [pickup]);

  useEffect(() => {
    if (dropoff?.address) setDropoffText(dropoff.address);
  }, [dropoff]);

  const loadSavedAddresses = async () => {
    try {
      const res = await fetch(`${API_URL}/user/saved-addresses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSavedAddresses(data.addresses || []);
    } catch (e) {
      console.log('Failed to load saved addresses');
    }
  };

  const searchAddress = async (query) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    
    try {
      // Mock suggestions - replace with real geocoding API
      const mockSuggestions = [
        { address: `${query}, Montreal, QC`, lat: 45.5017 + Math.random() * 0.01, lng: -73.5673 + Math.random() * 0.01 },
        { address: `${query} Street, Montreal, QC`, lat: 45.5017 + Math.random() * 0.01, lng: -73.5673 + Math.random() * 0.01 },
        { address: `${query} Avenue, Montreal, QC`, lat: 45.5017 + Math.random() * 0.01, lng: -73.5673 + Math.random() * 0.01 }
      ];
      setSuggestions(mockSuggestions);
    } catch (e) {
      console.error('Search error:', e);
    }
  };

  const handleInputChange = (type, value) => {
    if (type === 'pickup') {
      setPickupText(value);
    } else {
      setDropoffText(value);
    }
    
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchAddress(value), 300);
  };

  const selectSuggestion = (suggestion) => {
    const location = {
      lat: suggestion.lat || suggestion.latitude,
      lng: suggestion.lng || suggestion.longitude,
      address: suggestion.address
    };
    
    if (activeInput === 'pickup') {
      setPickup(location);
      setPickupText(suggestion.address);
    } else {
      setDropoff(location);
      setDropoffText(suggestion.address);
    }
    
    setSuggestions([]);
    setActiveInput(null);
  };

  const selectSavedAddress = (addr) => {
    const location = {
      lat: addr.latitude,
      lng: addr.longitude,
      address: addr.address
    };
    
    if (activeInput === 'pickup') {
      setPickup(location);
      setPickupText(addr.address);
    } else {
      setDropoff(location);
      setDropoffText(addr.address);
    }
    
    setActiveInput(null);
  };

  const getCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });
      
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        address: 'Current Location'
      };
      
      setPickup(location);
      setPickupText('Current Location');
      toast.success('Location detected!');
    } catch (e) {
      toast.error('Could not get your location');
    } finally {
      setIsLocating(false);
    }
  };

  const getIconForLabel = (label) => {
    const lower = label?.toLowerCase() || '';
    if (lower.includes('home')) return <Home className="w-4 h-4" />;
    if (lower.includes('work') || lower.includes('office')) return <Briefcase className="w-4 h-4" />;
    if (lower.includes('favorite') || lower.includes('fav')) return <Heart className="w-4 h-4" />;
    return <Star className="w-4 h-4" />;
  };

  return (
    <>
      {/* Full-screen address picker overlay */}
      <AnimatePresence>
        {activeInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 safe-area-top">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveInput(null);
                    setSuggestions([]);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <input
                    type="text"
                    value={activeInput === 'pickup' ? pickupText : dropoffText}
                    onChange={(e) => handleInputChange(activeInput, e.target.value)}
                    placeholder={activeInput === 'pickup' ? 'Enter pickup location' : 'Enter destination'}
                    className="w-full text-lg font-medium bg-transparent outline-none"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {activeInput === 'pickup' && (
              <button
                onClick={getCurrentLocation}
                disabled={isLocating}
                className="flex items-center gap-3 w-full px-4 py-4 border-b border-gray-100 hover:bg-gray-50"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Locate className={`w-5 h-5 text-blue-600 ${isLocating ? 'animate-pulse' : ''}`} />
                </div>
                <span className="font-medium text-gray-900">Use current location</span>
              </button>
            )}

            {/* Saved Addresses */}
            {savedAddresses.length > 0 && suggestions.length === 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Saved Places</p>
                <div className="space-y-1">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => selectSavedAddress(addr)}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-gray-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                        {getIconForLabel(addr.label)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900">{addr.label}</p>
                        <p className="text-sm text-gray-500 truncate">{addr.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Search Results</p>
                <div className="space-y-1">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSuggestion(suggestion)}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-gray-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-gray-600" />
                      </div>
                      <p className="text-left text-gray-900 truncate">{suggestion.address}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Sheet */}
      <motion.div
        ref={sheetRef}
        initial={{ y: '60%' }}
        animate={{ y: isExpanded ? 0 : '60%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y"
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -50) onExpandChange(true);
          else if (info.offset.y > 50) onExpandChange(false);
        }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl"
        style={{ height: '85vh', maxHeight: '85vh' }}
      >
        {/* Handle */}
        <div 
          className="flex justify-center py-3 cursor-grab"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Collapsed Preview */}
        {!isExpanded && (
          <div className="px-4 pb-4" onClick={() => onExpandChange(true)}>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="w-0.5 h-6 bg-gray-300" />
                <div className="w-3 h-3 rounded-full bg-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">From</p>
                <p className="font-medium text-gray-900 truncate">{pickupText || 'Set pickup location'}</p>
                <p className="text-sm text-gray-500 mt-2">To</p>
                <p className="font-medium text-gray-900 truncate">{dropoffText || 'Where to?'}</p>
              </div>
              <ChevronUp className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-24 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
            {/* Location Inputs */}
            <div className="space-y-3 mb-6">
              {/* Pickup */}
              <button
                onClick={() => setActiveInput('pickup')}
                className="flex items-center gap-3 w-full p-4 bg-gray-50 rounded-2xl text-left"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className={`font-medium ${pickupText ? 'text-gray-900' : 'text-gray-400'}`}>
                    {pickupText || 'Set pickup location'}
                  </p>
                </div>
                <Search className="w-5 h-5 text-gray-400" />
              </button>

              {/* Dropoff */}
              <button
                onClick={() => setActiveInput('dropoff')}
                className="flex items-center gap-3 w-full p-4 bg-gray-50 rounded-2xl text-left"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Dropoff</p>
                  <p className={`font-medium ${dropoffText ? 'text-gray-900' : 'text-gray-400'}`}>
                    {dropoffText || 'Where are you going?'}
                  </p>
                </div>
                <Search className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Vehicle Selection */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Choose your ride</p>
              <div className="flex gap-3">
                {VEHICLE_TYPES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVehicleType(v.id)}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all ${
                      vehicleType === v.id
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-900'
                    }`}
                  >
                    <div className="text-2xl mb-1">{v.icon}</div>
                    <p className="text-sm font-medium">{v.label}</p>
                    <p className={`text-xs ${vehicleType === v.id ? 'text-gray-400' : 'text-gray-500'}`}>{v.mult}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Fare Estimate */}
            {fareEstimate && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-gray-50 rounded-2xl mb-6"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600">Estimated fare</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${fareEstimate.our_fare?.total?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>{fareEstimate.our_fare?.distance_km?.toFixed(1)} km</span>
                  <span>•</span>
                  <span>{fareEstimate.our_fare?.duration_min?.toFixed(0)} min</span>
                </div>
              </motion.div>
            )}

            {/* Book Button */}
            <button
              onClick={onBookRide}
              disabled={isLoading || !pickup || !dropoff}
              className="w-full py-4 bg-gray-900 text-white font-semibold text-lg rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Car className="w-5 h-5" />
                  {fareEstimate ? `Book Ride - $${fareEstimate.our_fare?.total?.toFixed(2)}` : 'Get Fare Estimate'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Safe area spacer */}
        <div className="h-safe-area-bottom" />
      </motion.div>
    </>
  );
}
