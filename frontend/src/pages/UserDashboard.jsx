import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore, useBookingStore, useMapStore } from "../store";
import { toast } from "sonner";
import { 
  Car, Package, UtensilsCrossed, MapPin, Clock, LogOut, User,
  Zap, History, CreditCard, Navigation, Star, ChevronRight
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, token, logout, getAuthHeaders } = useAuthStore();
  const { bookings, setBookings, fareEstimate, setFareEstimate, isLoading, setLoading } = useBookingStore();
  const { drivers, setDrivers, userLocation, pickup, dropoff, setPickup, setDropoff } = useMapStore();
  
  const [activeTab, setActiveTab] = useState("taxi");
  const [vehicleType, setVehicleType] = useState("sedan");

  useEffect(() => {
    loadBookings();
    loadNearbyDrivers();
  }, []);

  const loadBookings = async () => {
    try {
      const res = await fetch(`${API_URL}/bookings/user`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setBookings(data.bookings || []);
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
        })
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
          pickup_address: pickup.address || "Pickup Location",
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          dropoff_address: dropoff.address || "Dropoff Location",
          vehicle_type: vehicleType
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Ride booked! Looking for drivers...");
        loadBookings();
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

  // Mock location setter for demo
  const setDemoLocations = () => {
    setPickup({ lat: 45.5017, lng: -73.5673, address: "Downtown Montreal" });
    setDropoff({ lat: 45.5088, lng: -73.5538, address: "Old Port Montreal" });
  };

  const vehicleTypes = [
    { id: 'sedan', label: 'Sedan', icon: '🚗', mult: '1x' },
    { id: 'suv', label: 'SUV', icon: '🚙', mult: '1.3x' },
    { id: 'van', label: 'Van', icon: '🚐', mult: '1.5x' },
  ];

  return (
    <div className="min-h-screen bg-noir-700">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan flex items-center justify-center">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <div>
              <span className="font-heading text-lg font-bold text-white">Transpo</span>
              <div className="text-xs text-noir-100">Welcome, {user?.name}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/profile')}
              className="text-noir-100 hover:text-white"
              data-testid="profile-btn"
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/book')}
              className="text-noir-100 hover:text-white"
              data-testid="book-ride-header-btn"
            >
              <Car className="w-4 h-4 mr-2" />
              Book Ride
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="text-noir-100 hover:text-white"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left - Booking Panel */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-noir-600 border-noir-300">
                <CardHeader>
                  <CardTitle className="font-heading text-xl text-white flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-cyan" />
                    Book a Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3 bg-noir-500 mb-6">
                      <TabsTrigger 
                        value="taxi" 
                        className="data-[state=active]:bg-cyan data-[state=active]:text-black"
                        data-testid="taxi-tab"
                      >
                        <Car className="w-4 h-4 mr-2" />
                        Taxi
                      </TabsTrigger>
                      <TabsTrigger 
                        value="courier"
                        className="data-[state=active]:bg-yellow data-[state=active]:text-black"
                        data-testid="courier-tab"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Courier
                      </TabsTrigger>
                      <TabsTrigger 
                        value="food"
                        className="data-[state=active]:bg-pink data-[state=active]:text-black"
                        data-testid="food-tab"
                      >
                        <UtensilsCrossed className="w-4 h-4 mr-2" />
                        Food
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="taxi" className="space-y-4">
                      {/* Location Inputs */}
                      <div className="space-y-3">
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan" />
                          <Input
                            placeholder="Pickup location"
                            value={pickup?.address || ''}
                            onChange={(e) => setPickup({ ...pickup, address: e.target.value, lat: 45.5017, lng: -73.5673 })}
                            className="pl-10 bg-noir-500 border-noir-300 text-white"
                            data-testid="pickup-input"
                          />
                        </div>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-pink" />
                          <Input
                            placeholder="Dropoff location"
                            value={dropoff?.address || ''}
                            onChange={(e) => setDropoff({ ...dropoff, address: e.target.value, lat: 45.5088, lng: -73.5538 })}
                            className="pl-10 bg-noir-500 border-noir-300 text-white"
                            data-testid="dropoff-input"
                          />
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={setDemoLocations}
                          className="text-xs text-noir-100"
                          data-testid="demo-location-btn"
                        >
                          Use Demo Locations (Downtown → Old Port)
                        </Button>
                      </div>

                      {/* Vehicle Selection */}
                      <div>
                        <Label className="text-noir-100 mb-2 block">Vehicle Type</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {vehicleTypes.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => setVehicleType(v.id)}
                              className={`p-3 rounded-lg border text-center transition-all ${
                                vehicleType === v.id 
                                  ? 'border-cyan bg-cyan/10' 
                                  : 'border-noir-300 hover:border-noir-200'
                              }`}
                              data-testid={`vehicle-${v.id}-btn`}
                            >
                              <div className="text-2xl mb-1">{v.icon}</div>
                              <div className={`text-sm font-medium ${vehicleType === v.id ? 'text-white' : 'text-noir-100'}`}>
                                {v.label}
                              </div>
                              <div className="text-xs text-noir-100">{v.mult}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Estimate Button */}
                      <Button 
                        onClick={estimateFare}
                        className="w-full btn-secondary"
                        disabled={isLoading || !pickup || !dropoff}
                        data-testid="estimate-fare-btn"
                      >
                        {isLoading ? <div className="spinner" /> : 'Get Fare Estimate'}
                      </Button>

                      {/* Fare Estimate Display */}
                      {fareEstimate && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4"
                        >
                          <div className="p-4 rounded-lg bg-noir-500 border border-cyan/30">
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-noir-100">Your Fare</span>
                              <span className="font-heading text-3xl font-bold text-white">
                                ${fareEstimate.our_fare.total.toFixed(2)}
                              </span>
                            </div>
                            
                            {/* Breakdown */}
                            <div className="space-y-2 text-sm border-t border-noir-300 pt-3">
                              <div className="flex justify-between">
                                <span className="text-noir-100">Base fare</span>
                                <span className="text-white font-mono">${fareEstimate.our_fare.base_fare.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-noir-100">Distance ({fareEstimate.our_fare.distance_km}km)</span>
                                <span className="text-white font-mono">${fareEstimate.our_fare.distance_charge.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-noir-100">Time ({fareEstimate.our_fare.duration_min}min)</span>
                                <span className="text-white font-mono">${fareEstimate.our_fare.time_charge.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-noir-100">Quebec Transport Fee</span>
                                <span className="text-white font-mono">${fareEstimate.our_fare.government_fee.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-noir-100">GST (5%)</span>
                                <span className="text-white font-mono">${fareEstimate.our_fare.gst.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-noir-100">QST (9.975%)</span>
                                <span className="text-white font-mono">${fareEstimate.our_fare.qst.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Competitor Comparison */}
                          <div className="p-4 rounded-lg bg-noir-500 border border-noir-300">
                            <div className="text-sm text-noir-100 mb-3">Market Comparison (Estimates)</div>
                            <div className="space-y-2">
                              {fareEstimate.competitor_estimates.map((comp) => (
                                <div key={comp.provider} className="flex justify-between items-center">
                                  <span className="text-noir-100">{comp.provider}</span>
                                  <span className="text-white font-mono">${comp.estimated_fare.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="text-xs text-noir-100 mt-2 italic">
                              *Market prices are estimates only
                            </div>
                          </div>

                          <Button 
                            onClick={bookRide}
                            className="w-full btn-primary"
                            disabled={isLoading}
                            data-testid="book-ride-btn"
                          >
                            {isLoading ? <div className="spinner" /> : `Book Ride - $${fareEstimate.our_fare.total.toFixed(2)}`}
                          </Button>
                        </motion.div>
                      )}
                    </TabsContent>

                    <TabsContent value="courier">
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 mx-auto text-yellow mb-4 opacity-50" />
                        <h3 className="font-heading text-xl text-white mb-2">Courier Service</h3>
                        <p className="text-noir-100">Coming soon in v2</p>
                      </div>
                    </TabsContent>

                    <TabsContent value="food">
                      <div className="text-center py-12">
                        <UtensilsCrossed className="w-16 h-16 mx-auto text-pink mb-4 opacity-50" />
                        <h3 className="font-heading text-xl text-white mb-2">Food Delivery</h3>
                        <p className="text-noir-100">Coming soon in v2</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>

            {/* Map Placeholder */}
            <Card className="bg-noir-600 border-noir-300 overflow-hidden">
              <div className="aspect-video map-placeholder relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 mx-auto text-cyan mb-2 opacity-50" />
                    <div className="text-noir-100">Map View</div>
                    <div className="text-xs text-noir-100">{drivers.length} drivers nearby</div>
                  </div>
                </div>
                
                {/* Driver dots */}
                {drivers.slice(0, 6).map((driver, i) => (
                  <div
                    key={driver.id}
                    className="absolute w-3 h-3 rounded-full bg-cyan animate-pulse"
                    style={{
                      left: `${20 + (i % 3) * 30}%`,
                      top: `${30 + Math.floor(i / 3) * 30}%`
                    }}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* Right - Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="bg-noir-600 border-noir-300">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-noir-500">
                    <div className="text-2xl font-heading font-bold text-white">{bookings.length}</div>
                    <div className="text-xs text-noir-100">Total Rides</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-noir-500">
                    <div className="text-2xl font-heading font-bold text-cyan">{drivers.length}</div>
                    <div className="text-xs text-noir-100">Drivers Nearby</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Bookings */}
            <Card className="bg-noir-600 border-noir-300">
              <CardHeader>
                <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan" />
                  Recent Rides
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <div className="text-center py-8 text-noir-100">
                    No rides yet. Book your first ride!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.slice(0, 5).map((booking) => (
                      <div 
                        key={booking.id} 
                        className="p-3 rounded-lg bg-noir-500 border border-noir-300"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              booking.status === 'completed' ? 'bg-green-500' :
                              booking.status === 'pending' ? 'bg-yellow' :
                              booking.status === 'in_progress' ? 'bg-cyan' :
                              'bg-noir-100'
                            }`} />
                            <span className="text-sm font-medium text-white capitalize">{booking.status}</span>
                          </div>
                          <span className="text-sm font-mono text-cyan">${booking.fare?.total?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-noir-100 truncate">
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
