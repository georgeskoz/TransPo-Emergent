import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore, useBookingStore, useMapStore } from "../store";
import { toast } from "sonner";
import { 
  Car, Package, UtensilsCrossed, MapPin, Clock, LogOut, User,
  Zap, History, CreditCard, Navigation, Star, ChevronRight,
  Crosshair, Search, X, Loader2
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Montreal area address suggestions (mock data for autocomplete)
const MONTREAL_ADDRESSES = [
  { address: "1000 Rue De La Gauchetière O, Montréal, QC H3B 4W5", lat: 45.4987, lng: -73.5671 },
  { address: "300 Rue Saint-Paul O, Montréal, QC H2Y 2A3", lat: 45.5045, lng: -73.5542 },
  { address: "1001 Place Jean-Paul-Riopelle, Montréal, QC H2Z 1H5", lat: 45.5048, lng: -73.5619 },
  { address: "4700 Rue Pierre-De Coubertin, Montréal, QC H1V 1B2", lat: 45.5579, lng: -73.5515 },
  { address: "1 Carrefour Alexander-Graham-Bell, Verdun, QC H3E 1W6", lat: 45.4642, lng: -73.5500 },
  { address: "677 Rue Sainte-Catherine O, Montréal, QC H3B 5K4", lat: 45.5041, lng: -73.5713 },
  { address: "175 Rue Peel, Montréal, QC H3C 4Y5", lat: 45.4970, lng: -73.5683 },
  { address: "3400 Ave. du Parc, Montréal, QC H2X 2H5", lat: 45.5106, lng: -73.5797 },
  { address: "1455 Rue De Maisonneuve O, Montréal, QC H3G 1M8", lat: 45.4972, lng: -73.5789 },
  { address: "800 Rue De la Gauchetière E, Montréal, QC H2L 2N2", lat: 45.5095, lng: -73.5565 },
  { address: "275 Rue Notre-Dame E, Montréal, QC H2Y 1C6", lat: 45.5076, lng: -73.5528 },
  { address: "150 Rue Sainte-Catherine O, Montréal, QC H2X 3Y2", lat: 45.5087, lng: -73.5680 },
  { address: "1275 Ave des Canadiens-de-Montréal, Montréal, QC H3B 0G4", lat: 45.4961, lng: -73.5693 },
  { address: "185 Rue Sainte-Catherine O, Montréal, QC H2X 3X6", lat: 45.5084, lng: -73.5673 },
  { address: "5555 Ave du Parc, Montréal, QC H2V 4H2", lat: 45.5215, lng: -73.6063 },
  { address: "Aéroport Montréal-Trudeau, Dorval, QC H4Y 1H1", lat: 45.4657, lng: -73.7455 },
  { address: "Gare Centrale, 895 Rue De La Gauchetière O, Montréal, QC H3B 4G1", lat: 45.4998, lng: -73.5672 },
  { address: "1250 Rue Guy, Montréal, QC H3H 2L3", lat: 45.4954, lng: -73.5788 },
  { address: "3450 Rue McTavish, Montréal, QC H3A 0E5", lat: 45.5048, lng: -73.5772 },
  { address: "4101 Rue Sherbrooke E, Montréal, QC H1X 2B2", lat: 45.5545, lng: -73.5665 },
];

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, logout, getAuthHeaders } = useAuthStore();
  const { bookings, setBookings, fareEstimate, setFareEstimate, isLoading, setLoading } = useBookingStore();
  const { drivers, setDrivers, userLocation, pickup, dropoff, setPickup, setDropoff, setUserLocation } = useMapStore();
  
  const [activeTab, setActiveTab] = useState("taxi");
  const [vehicleType, setVehicleType] = useState("sedan");
  
  // Address input states
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);

  useEffect(() => {
    loadBookings();
    loadNearbyDrivers();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickupRef.current && !pickupRef.current.contains(e.target)) {
        setShowPickupSuggestions(false);
      }
      if (dropoffRef.current && !dropoffRef.current.contains(e.target)) {
        setShowDropoffSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadBookings = async () => {
    try {
      const res = await fetch(`${API_URL}/bookings/user`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch (e) {
      console.log('Error loading bookings:', e);
    }
  };

  const loadNearbyDrivers = async () => {
    try {
      const res = await fetch(`${API_URL}/map/drivers?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=5`);
      const data = await res.json();
      setDrivers(data.drivers || []);
    } catch (e) {
      console.log('Error loading drivers:', e);
    }
  };

  // Search addresses (filter mock data)
  const searchAddresses = (query) => {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    return MONTREAL_ADDRESSES.filter(addr => 
      addr.address.toLowerCase().includes(lowerQuery)
    ).slice(0, 5);
  };

  // Handle pickup input change
  const handlePickupChange = (e) => {
    const value = e.target.value;
    setPickupText(value);
    const suggestions = searchAddresses(value);
    setPickupSuggestions(suggestions);
    setShowPickupSuggestions(suggestions.length > 0);
    
    // Clear pickup if text is cleared
    if (!value) {
      setPickup(null);
    }
  };

  // Handle dropoff input change
  const handleDropoffChange = (e) => {
    const value = e.target.value;
    setDropoffText(value);
    const suggestions = searchAddresses(value);
    setDropoffSuggestions(suggestions);
    setShowDropoffSuggestions(suggestions.length > 0);
    
    // Clear dropoff if text is cleared
    if (!value) {
      setDropoff(null);
    }
  };

  // Select pickup suggestion
  const selectPickup = (suggestion) => {
    setPickupText(suggestion.address);
    setPickup({
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.address
    });
    setShowPickupSuggestions(false);
  };

  // Select dropoff suggestion
  const selectDropoff = (suggestion) => {
    setDropoffText(suggestion.address);
    setDropoff({
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.address
    });
    setShowDropoffSuggestions(false);
  };

  // Use current location for pickup
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const address = `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        
        setPickupText(address);
        setPickup({
          lat: latitude,
          lng: longitude,
          address: address
        });
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocating(false);
        toast.success("Location found!");
        
        // Reload nearby drivers with new location
        loadNearbyDrivers();
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Location permission denied. Please enable location access.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location unavailable. Please try again.");
            break;
          case error.TIMEOUT:
            toast.error("Location request timed out. Please try again.");
            break;
          default:
            toast.error("Unable to get location. Please enter address manually.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const estimateFare = async () => {
    if (!pickup || !dropoff) {
      toast.error("Please enter pickup and dropoff locations");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/fare/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          vehicle_type: vehicleType
        }),
        credentials: 'include'
      });
      const data = await res.json();
      setFareEstimate(data);
    } catch (e) {
      toast.error("Error estimating fare");
    } finally {
      setLoading(false);
    }
  };

  const bookRide = async () => {
    if (!pickup || !dropoff) {
      toast.error("Please enter pickup and dropoff locations");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/taxi/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          pickup_address: pickup.address || pickupText,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          dropoff_address: dropoff.address || dropoffText,
          vehicle_type: vehicleType
        }),
        credentials: 'include'
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Ride booked! Looking for drivers...");
        loadBookings();
        setPickupText("");
        setDropoffText("");
        setPickup(null);
        setDropoff(null);
        setFareEstimate(null);
      } else {
        throw new Error(data.detail || "Booking failed");
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success("Logged out successfully");
  };

  const clearPickup = () => {
    setPickupText("");
    setPickup(null);
    setShowPickupSuggestions(false);
  };

  const clearDropoff = () => {
    setDropoffText("");
    setDropoff(null);
    setShowDropoffSuggestions(false);
  };

  const vehicleTypes = [
    { id: 'sedan', label: 'Sedan', icon: '🚗', mult: '1x' },
    { id: 'suv', label: 'SUV', icon: '🚙', mult: '1.3x' },
    { id: 'van', label: 'Van', icon: '🚐', mult: '1.5x' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900">Transpo</span>
              <div className="text-xs text-gray-500">Welcome, {user?.first_name || user?.name}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/profile')}
              className="text-gray-600"
              data-testid="profile-btn"
            >
              <User className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="text-gray-600"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left - Booking Panel */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-gray-700" />
                    Book a Ride
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3 bg-gray-100 mb-6">
                      <TabsTrigger 
                        value="taxi" 
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
                        data-testid="taxi-tab"
                      >
                        <Car className="w-4 h-4 mr-2" />
                        Taxi
                      </TabsTrigger>
                      <TabsTrigger 
                        value="courier"
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
                        data-testid="courier-tab"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Courier
                      </TabsTrigger>
                      <TabsTrigger 
                        value="food"
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
                        data-testid="food-tab"
                      >
                        <UtensilsCrossed className="w-4 h-4 mr-2" />
                        Food
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="taxi" className="space-y-4">
                      {/* Pickup Location */}
                      <div className="space-y-2" ref={pickupRef}>
                        <Label className="text-gray-700 font-medium">Pickup Location</Label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500" />
                          <Input
                            placeholder="Enter pickup address..."
                            value={pickupText}
                            onChange={handlePickupChange}
                            onFocus={() => pickupText.length >= 2 && setShowPickupSuggestions(true)}
                            className="pl-10 pr-20 bg-white border-gray-300 text-gray-900 placeholder-gray-400 h-12"
                            data-testid="pickup-input"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {pickupText && (
                              <button 
                                onClick={clearPickup}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <X className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                            <button 
                              onClick={useCurrentLocation}
                              disabled={isLocating}
                              className="p-2 hover:bg-gray-100 rounded text-gray-600"
                              title="Use current location"
                              data-testid="current-location-btn"
                            >
                              {isLocating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Crosshair className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          
                          {/* Pickup Suggestions Dropdown */}
                          <AnimatePresence>
                            {showPickupSuggestions && pickupSuggestions.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
                              >
                                {pickupSuggestions.map((suggestion, index) => (
                                  <button
                                    key={index}
                                    onClick={() => selectPickup(suggestion)}
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-0"
                                  >
                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-sm text-gray-700">{suggestion.address}</span>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Dropoff Location */}
                      <div className="space-y-2" ref={dropoffRef}>
                        <Label className="text-gray-700 font-medium">Dropoff Location</Label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500" />
                          <Input
                            placeholder="Enter destination address..."
                            value={dropoffText}
                            onChange={handleDropoffChange}
                            onFocus={() => dropoffText.length >= 2 && setShowDropoffSuggestions(true)}
                            className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 placeholder-gray-400 h-12"
                            data-testid="dropoff-input"
                          />
                          {dropoffText && (
                            <button 
                              onClick={clearDropoff}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4 text-gray-400" />
                            </button>
                          )}
                          
                          {/* Dropoff Suggestions Dropdown */}
                          <AnimatePresence>
                            {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
                              >
                                {dropoffSuggestions.map((suggestion, index) => (
                                  <button
                                    key={index}
                                    onClick={() => selectDropoff(suggestion)}
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-0"
                                  >
                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-sm text-gray-700">{suggestion.address}</span>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Vehicle Selection */}
                      <div className="space-y-2">
                        <Label className="text-gray-700 font-medium">Vehicle Type</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {vehicleTypes.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => setVehicleType(v.id)}
                              className={`p-4 rounded-xl border text-center transition-all ${
                                vehicleType === v.id 
                                  ? 'border-gray-900 bg-gray-900 text-white' 
                                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                              }`}
                              data-testid={`vehicle-${v.id}-btn`}
                            >
                              <div className="text-2xl mb-1">{v.icon}</div>
                              <div className="text-sm font-medium">{v.label}</div>
                              <div className={`text-xs ${vehicleType === v.id ? 'text-gray-300' : 'text-gray-400'}`}>{v.mult}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Estimate Button */}
                      <Button 
                        onClick={estimateFare}
                        className="w-full py-6 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium"
                        disabled={isLoading || !pickup || !dropoff}
                        data-testid="estimate-fare-btn"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Get Fare Estimate
                          </>
                        )}
                      </Button>

                      {/* Fare Estimate Display */}
                      {fareEstimate && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4"
                        >
                          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-gray-600">Your Fare</span>
                              <span className="text-3xl font-bold text-gray-900">
                                ${fareEstimate.our_fare.total.toFixed(2)}
                              </span>
                            </div>
                            
                            {/* Breakdown */}
                            <div className="space-y-2 text-sm border-t border-gray-200 pt-4">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Base fare</span>
                                <span className="text-gray-900 font-mono">${fareEstimate.our_fare.base_fare.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Distance ({fareEstimate.our_fare.distance_km}km)</span>
                                <span className="text-gray-900 font-mono">${fareEstimate.our_fare.distance_charge.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Time ({fareEstimate.our_fare.duration_min}min)</span>
                                <span className="text-gray-900 font-mono">${fareEstimate.our_fare.time_charge.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Quebec Transport Fee</span>
                                <span className="text-gray-900 font-mono">${fareEstimate.our_fare.government_fee.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">GST (5%)</span>
                                <span className="text-gray-900 font-mono">${fareEstimate.our_fare.gst.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">QST (9.975%)</span>
                                <span className="text-gray-900 font-mono">${fareEstimate.our_fare.qst.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Competitor Comparison */}
                          <div className="p-4 rounded-xl bg-white border border-gray-200">
                            <div className="text-sm text-gray-500 mb-3">Market Comparison (Estimates)</div>
                            <div className="space-y-2">
                              {fareEstimate.competitor_estimates.map((comp) => (
                                <div key={comp.provider} className="flex justify-between items-center">
                                  <span className="text-gray-600">{comp.provider}</span>
                                  <span className="text-gray-900 font-mono">${comp.estimated_fare.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="text-xs text-gray-400 mt-2 italic">
                              *Market prices are estimates only
                            </div>
                          </div>

                          <Button 
                            onClick={bookRide}
                            className="w-full py-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-lg"
                            disabled={isLoading}
                            data-testid="book-ride-btn"
                          >
                            {isLoading ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              `Book Ride - $${fareEstimate.our_fare.total.toFixed(2)}`
                            )}
                          </Button>
                        </motion.div>
                      )}
                    </TabsContent>

                    <TabsContent value="courier">
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Courier Service</h3>
                        <p className="text-gray-500">Coming soon in v2</p>
                      </div>
                    </TabsContent>

                    <TabsContent value="food">
                      <div className="text-center py-12">
                        <UtensilsCrossed className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Food Delivery</h3>
                        <p className="text-gray-500">Coming soon in v2</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>

            {/* Map Placeholder */}
            <Card className="bg-white border-gray-200 overflow-hidden">
              <div className="aspect-video bg-gray-100 relative">
                <div className="absolute inset-0 map-container" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <div className="text-gray-600 font-medium">Map View</div>
                    <div className="text-sm text-gray-400">{drivers.length} drivers nearby</div>
                  </div>
                </div>
                
                {/* Driver dots */}
                {drivers.slice(0, 6).map((driver, i) => (
                  <motion.div
                    key={driver.id}
                    className="absolute w-3 h-3 rounded-full bg-gray-800"
                    style={{
                      left: `${20 + (i % 3) * 25}%`,
                      top: `${30 + Math.floor(i / 3) * 25}%`
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* Right - Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-xl bg-gray-50">
                    <div className="text-2xl font-bold text-gray-900">{bookings.length}</div>
                    <div className="text-xs text-gray-500">Total Rides</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-gray-50">
                    <div className="text-2xl font-bold text-green-600">{drivers.length}</div>
                    <div className="text-xs text-gray-500">Drivers Nearby</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Bookings */}
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-600" />
                  Recent Rides
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No rides yet. Book your first ride!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.slice(0, 5).map((booking) => (
                      <div 
                        key={booking.id} 
                        className="p-3 rounded-xl bg-gray-50 border border-gray-100"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              booking.status === 'completed' ? 'bg-green-500' :
                              booking.status === 'pending' ? 'bg-yellow-500' :
                              booking.status === 'in_progress' ? 'bg-blue-500' :
                              'bg-gray-400'
                            }`} />
                            <span className="text-sm font-medium text-gray-900 capitalize">{booking.status}</span>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">${booking.fare?.total?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {booking.pickup?.address} → {booking.dropoff?.address}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
