import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuthStore, useDriverStore } from "../store";
import { toast } from "sonner";
import { 
  Car, LogOut, Zap, MapPin, DollarSign, Star, Clock, User,
  CheckCircle, XCircle, Navigation, AlertCircle
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user, logout, getAuthHeaders } = useAuthStore();
  const { 
    profile, setProfile, 
    status, setStatus, 
    pendingJobs, activeJobs, setJobs,
    earnings, setEarnings
  } = useDriverStore();
  
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDriverData();
    const interval = setInterval(loadJobs, 5000); // Poll for jobs every 5s
    return () => clearInterval(interval);
  }, []);

  const loadDriverData = async () => {
    try {
      const [profileRes, earningsRes] = await Promise.all([
        fetch(`${API_URL}/driver/profile`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/driver/earnings`, { headers: getAuthHeaders() })
      ]);
      
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
        setStatus(profileData.status);
        setIsOnline(profileData.status === 'online');
      }
      
      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        setEarnings(earningsData);
      }
      
      await loadJobs();
    } catch (e) {
      console.log('Error loading driver data:', e);
    }
  };

  const loadJobs = async () => {
    try {
      const res = await fetch(`${API_URL}/driver/jobs`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.pending_jobs || [], data.active_jobs || []);
      }
    } catch (e) {
      console.log('Error loading jobs:', e);
    }
  };

  const toggleOnlineStatus = async () => {
    const newStatus = isOnline ? 'offline' : 'online';
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/status?status=${newStatus}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setIsOnline(!isOnline);
        setStatus(newStatus);
        toast.success(`You are now ${newStatus}`);
        
        // Update location when going online
        if (newStatus === 'online') {
          updateLocation();
        }
      }
    } catch (e) {
      toast.error('Error updating status');
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async () => {
    // Simulate location - in real app, use geolocation API
    const lat = 45.5017 + (Math.random() - 0.5) * 0.02;
    const lng = -73.5673 + (Math.random() - 0.5) * 0.02;
    
    try {
      await fetch(`${API_URL}/driver/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });
    } catch (e) {
      console.log('Error updating location:', e);
    }
  };

  const acceptJob = async (bookingId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/accept/${bookingId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Job accepted!');
        loadJobs();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to accept job');
      }
    } catch (e) {
      toast.error('Error accepting job');
    } finally {
      setLoading(false);
    }
  };

  const completeJob = async (bookingId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/complete/${bookingId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Ride completed! Earned $${data.earnings.toFixed(2)}`);
        loadDriverData();
      }
    } catch (e) {
      toast.error('Error completing job');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out');
  };

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
              <span className="font-heading text-lg font-bold text-white">Transpo Driver</span>
              <div className="text-xs text-noir-100">{user?.name}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Profile Link */}
            <Button 
              variant="ghost" 
              onClick={() => navigate('/driver/profile')}
              className="text-noir-100 hover:text-white"
              data-testid="driver-profile-btn"
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>

            {/* Online Toggle */}
            <div className="flex items-center gap-3">
              <span className={`text-sm ${isOnline ? 'text-cyan' : 'text-noir-100'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <Switch
                checked={isOnline}
                onCheckedChange={toggleOnlineStatus}
                disabled={loading}
                className="data-[state=checked]:bg-cyan"
                data-testid="online-toggle"
              />
            </div>
            
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
        {/* Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            isOnline ? 'bg-cyan/10 border border-cyan/30' : 'bg-noir-500 border border-noir-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'status-online' : 'status-offline'}`} />
            <span className={`font-medium ${isOnline ? 'text-cyan' : 'text-noir-100'}`}>
              {isOnline ? 'You are online and receiving job requests' : 'Go online to start receiving jobs'}
            </span>
          </div>
          {isOnline && pendingJobs.length > 0 && (
            <Badge className="bg-yellow text-black">
              {pendingJobs.length} new job{pendingJobs.length > 1 ? 's' : ''}
            </Badge>
          )}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left - Jobs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Jobs */}
            {activeJobs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-noir-600 border-cyan/30">
                  <CardHeader>
                    <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-cyan animate-pulse" />
                      Active Ride
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeJobs.map((job) => (
                      <div key={job.id} className="space-y-4">
                        <div className="p-4 rounded-lg bg-noir-500 border border-noir-300">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="text-white font-medium">{job.user_name}</div>
                              <div className="text-sm text-noir-100">{job.vehicle_type} ride</div>
                            </div>
                            <Badge className="bg-cyan/20 text-cyan capitalize">{job.status}</Badge>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex items-start gap-2">
                              <div className="w-3 h-3 rounded-full bg-cyan mt-1.5" />
                              <div>
                                <div className="text-xs text-noir-100">Pickup</div>
                                <div className="text-sm text-white">{job.pickup?.address}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="w-3 h-3 rounded-full bg-pink mt-1.5" />
                              <div>
                                <div className="text-xs text-noir-100">Dropoff</div>
                                <div className="text-sm text-white">{job.dropoff?.address}</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="text-xs text-noir-100">Fare</div>
                              <div className="text-xl font-heading font-bold text-white">
                                ${job.fare?.total?.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-noir-100">Your Earnings</div>
                              <div className="text-xl font-heading font-bold text-cyan">
                                ${(job.fare?.total * 0.8).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          <Button 
                            onClick={() => completeJob(job.id)}
                            className="w-full btn-primary"
                            disabled={loading}
                            data-testid="complete-ride-btn"
                          >
                            {loading ? <div className="spinner" /> : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Complete Ride
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Pending Jobs */}
            <Card className="bg-noir-600 border-noir-300">
              <CardHeader>
                <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow" />
                  Available Jobs
                  {pendingJobs.length > 0 && (
                    <Badge className="ml-2 bg-yellow text-black">{pendingJobs.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isOnline ? (
                  <div className="text-center py-12 text-noir-100">
                    Go online to see available jobs
                  </div>
                ) : pendingJobs.length === 0 ? (
                  <div className="text-center py-12 text-noir-100">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    No jobs available. Waiting for ride requests...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingJobs.map((job) => (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 rounded-lg bg-noir-500 border border-yellow/30"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-white font-medium">{job.user_name}</div>
                            <div className="text-sm text-noir-100">{job.vehicle_type} ride</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-heading font-bold text-white">
                              ${job.fare?.total?.toFixed(2)}
                            </div>
                            <div className="text-xs text-cyan">
                              You earn ${(job.fare?.total * 0.8).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-cyan" />
                            <span className="text-noir-100 truncate">{job.pickup?.address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-pink" />
                            <span className="text-noir-100 truncate">{job.dropoff?.address}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            onClick={() => acceptJob(job.id)}
                            className="flex-1 btn-primary"
                            disabled={loading}
                            data-testid="accept-job-btn"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Accept
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 btn-secondary"
                            disabled={loading}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Decline
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Map Placeholder */}
            <Card className="bg-noir-600 border-noir-300 overflow-hidden">
              <div className="aspect-video map-placeholder relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Navigation className="w-12 h-12 mx-auto text-cyan mb-2 opacity-50" />
                    <div className="text-noir-100">Your Location</div>
                    <div className="text-xs text-noir-100">Downtown Montreal</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right - Stats */}
          <div className="space-y-6">
            {/* Earnings Card */}
            <Card className="bg-noir-600 border-noir-300">
              <CardHeader>
                <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-cyan" />
                  Earnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-6 rounded-lg bg-cyan/10 border border-cyan/30">
                  <div className="text-xs text-noir-100 mb-1">Today</div>
                  <div className="font-heading text-4xl font-bold text-cyan">
                    ${earnings?.today?.toFixed(2) || '0.00'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-4 rounded-lg bg-noir-500">
                    <div className="text-xs text-noir-100 mb-1">This Week</div>
                    <div className="font-heading text-xl font-bold text-white">
                      ${earnings?.weekly?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-noir-500">
                    <div className="text-xs text-noir-100 mb-1">Total</div>
                    <div className="font-heading text-xl font-bold text-white">
                      ${earnings?.total?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-noir-600 border-noir-300">
              <CardHeader>
                <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-noir-500">
                  <span className="text-noir-100">Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow fill-yellow" />
                    <span className="font-heading font-bold text-white">
                      {earnings?.rating?.toFixed(1) || '5.0'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-noir-500">
                  <span className="text-noir-100">Total Rides</span>
                  <span className="font-heading font-bold text-white">
                    {earnings?.total_rides || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-noir-500">
                  <span className="text-noir-100">Acceptance Rate</span>
                  <span className="font-heading font-bold text-cyan">
                    {((profile?.acceptance_rate || 1) * 100).toFixed(0)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Vehicle Info */}
            <Card className="bg-noir-600 border-noir-300">
              <CardHeader>
                <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                  <Car className="w-5 h-5 text-cyan" />
                  Vehicle
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile?.vehicle_make ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-noir-100">Vehicle</span>
                      <span className="text-white">
                        {profile.vehicle_color} {profile.vehicle_make} {profile.vehicle_model}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-noir-100">Plate</span>
                      <span className="text-white font-mono">{profile.license_plate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-noir-100">Type</span>
                      <Badge className="bg-noir-400 text-white capitalize">{profile.vehicle_type}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-noir-100 text-sm">
                    No vehicle information set
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
