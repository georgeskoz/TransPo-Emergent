import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuthStore, useDriverStore } from "../store";
import { toast } from "sonner";
import { 
  Home, Search, Settings, Navigation, DollarSign, Star, Clock,
  CheckCircle, XCircle, MapPin, ChevronUp, Menu, User, Car,
  Hexagon, ArrowRight, LogOut, AlertCircle, X, History, Wallet
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
  const [showBottomSheet, setShowBottomSheet] = useState(true);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadDriverData();
    const interval = setInterval(loadJobs, 5000);
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
        
        // Show job modal if there's a new pending job
        if (data.pending_jobs?.length > 0 && isOnline) {
          setSelectedJob(data.pending_jobs[0]);
          setShowJobModal(true);
        }
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
        headers: getAuthHeaders(),
        
      });
      if (res.ok) {
        setIsOnline(!isOnline);
        setStatus(newStatus);
        toast.success(newStatus === 'online' ? "You're now online! Finding trips..." : "You're offline");
        
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
    const lat = 45.5017 + (Math.random() - 0.5) * 0.02;
    const lng = -73.5673 + (Math.random() - 0.5) * 0.02;
    
    try {
      await fetch(`${API_URL}/driver/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
        
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
        headers: getAuthHeaders(),
        
      });
      if (res.ok) {
        toast.success('Trip accepted!');
        setShowJobModal(false);
        setSelectedJob(null);
        loadJobs();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Trip no longer available');
      }
    } catch (e) {
      toast.error('Error accepting trip');
    } finally {
      setLoading(false);
    }
  };

  const declineJob = () => {
    setShowJobModal(false);
    setSelectedJob(null);
    toast.info('Trip declined');
  };

  const completeJob = async (bookingId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/complete/${bookingId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Trip completed! Earned $${data.earnings.toFixed(2)}`);
        loadDriverData();
      }
    } catch (e) {
      toast.error('Error completing trip');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out');
  };

  // Calculate points progress (mock data)
  const currentPoints = 174;
  const targetPoints = 600;
  const pointsProgress = (currentPoints / targetPoints) * 100;

  return (
    <div className="h-screen flex flex-col bg-gray-100 relative overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0 map-container">
        {/* Simulated map with streets */}
        <svg className="absolute inset-0 w-full h-full opacity-40">
          <defs>
            <pattern id="streets" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 0 50 L 100 50 M 50 0 L 50 100" fill="none" stroke="#9CA3AF" strokeWidth="2"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#streets)" />
        </svg>
        
        {/* Green areas (parks) */}
        <div className="absolute top-1/4 left-1/4 w-32 h-24 bg-green-200/50 rounded-lg" />
        <div className="absolute bottom-1/3 right-1/4 w-40 h-32 bg-green-200/50 rounded-lg" />
        <div className="absolute top-1/2 left-1/3 w-24 h-20 bg-green-200/50 rounded-lg" />
        
        {/* Water area */}
        <div className="absolute bottom-1/4 left-0 w-48 h-32 bg-blue-200/40 rounded-r-full" />
        
        {/* Highway */}
        <div className="absolute top-0 right-1/4 w-4 h-full bg-blue-400/30" />
        
        {/* Location labels */}
        <div className="absolute top-1/4 left-1/2 text-xs text-gray-500 font-medium">MONT-LUC</div>
        <div className="absolute top-1/3 right-1/3 text-xs text-gray-400">CH TACHÉ</div>
        <div className="absolute bottom-1/3 left-1/4 text-xs text-gray-400">RTE 105</div>
      </div>

      {/* Top Header */}
      <div className="relative z-10 p-4 flex items-center justify-between">
        <button 
          onClick={() => setShowMenu(true)}
          className="icon-btn"
          data-testid="menu-btn"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>

        {/* Earnings Badge */}
        <div className="earnings-badge" data-testid="earnings-display">
          ${(earnings?.today || 0).toFixed(2)}
        </div>

        <button 
          onClick={() => navigate('/driver/profile')}
          className="icon-btn"
          data-testid="profile-btn"
        >
          <User className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* Side Menu Overlay */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div 
              className="fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
            />
            <motion.div 
              className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 shadow-xl"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Menu Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
                      <Car className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900">Transpo</span>
                  </div>
                  <button 
                    onClick={() => setShowMenu(false)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                
                {/* Driver Info */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{user?.name || 'Driver'}</div>
                    <div className="text-sm text-gray-500">{user?.email}</div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <nav className="p-4">
                <ul className="space-y-1">
                  <li>
                    <button 
                      onClick={() => { navigate('/'); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <Home className="w-5 h-5" />
                      <span>Home</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => { navigate('/driver/profile'); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <User className="w-5 h-5" />
                      <span>My Profile</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <Wallet className="w-5 h-5" />
                      <span>Earnings</span>
                      <span className="ml-auto text-green-600 font-semibold">${(earnings?.today || 0).toFixed(2)}</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <History className="w-5 h-5" />
                      <span>Trip History</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <Star className="w-5 h-5" />
                      <span>Ratings</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <Settings className="w-5 h-5" />
                      <span>Settings</span>
                    </button>
                  </li>
                </ul>
              </nav>

              {/* Logout */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
                <button 
                  onClick={() => { handleLogout(); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 text-red-600"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Center - Driver Location Indicator */}
      <div className="flex-1 relative flex items-center justify-center">
        <motion.div 
          className="driver-marker"
          animate={{ scale: isOnline ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 2, repeat: isOnline ? Infinity : 0 }}
        >
          <Navigation className="w-5 h-5 text-gray-800" />
        </motion.div>
        
        {/* Route badge */}
        <div className="absolute top-1/4 right-8 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
          50
        </div>
        <div className="absolute bottom-1/3 left-8 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
          307
        </div>
      </div>

      {/* Side Buttons */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        <button className="icon-btn">
          <MapPin className="w-5 h-5 text-gray-600" />
        </button>
        <button 
          onClick={handleLogout}
          className="icon-btn"
          data-testid="logout-btn"
        >
          <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Bottom Sheet */}
      <motion.div 
        className="relative z-10 bottom-sheet"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Online/Offline Toggle */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="text-lg font-semibold text-gray-800">
                {isOnline ? 'Finding trips' : 'Go online to find trips'}
              </span>
            </div>
            <button className="p-2">
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* Progress bar when online */}
          {isOnline && (
            <motion.div 
              className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div 
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </motion.div>
          )}
        </div>

        {/* Go Online Button */}
        {!isOnline && (
          <div className="px-6 pb-4">
            <Button 
              onClick={toggleOnlineStatus}
              className="w-full py-6 text-lg font-semibold bg-gray-800 hover:bg-gray-900 text-white rounded-xl"
              disabled={loading}
              data-testid="go-online-btn"
            >
              {loading ? <div className="spinner" /> : 'Go Online'}
            </Button>
          </div>
        )}

        {/* Active Trip */}
        {isOnline && activeJobs.length > 0 && (
          <div className="px-6 pb-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-blue-700">Active Trip</span>
                  <Badge className="bg-blue-500 text-white">{activeJobs[0].status}</Badge>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-gray-600 truncate">{activeJobs[0].pickup?.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-gray-600 truncate">{activeJobs[0].dropoff?.address}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-gray-800">${activeJobs[0].fare?.total?.toFixed(2)}</span>
                  <Button 
                    onClick={() => completeJob(activeJobs[0].id)}
                    className="btn-success"
                    disabled={loading}
                    data-testid="complete-trip-btn"
                  >
                    Complete Trip
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rewards Progress */}
        <div className="px-6 pb-6 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div>
                <span className="font-semibold text-gray-800">Unlock Platinum</span>
                <span className="text-gray-400 ml-2 text-sm">0%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hexagon className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold text-gray-800">{currentPoints} / {targetPoints} pts</span>
            </div>
          </div>
        </div>

        {/* Go Offline when online */}
        {isOnline && activeJobs.length === 0 && (
          <div className="px-6 pb-6">
            <Button 
              onClick={toggleOnlineStatus}
              variant="outline"
              className="w-full py-4 text-gray-600 border-gray-300"
              disabled={loading}
              data-testid="go-offline-btn"
            >
              Go Offline
            </Button>
          </div>
        )}
      </motion.div>

      {/* Job Request Modal */}
      <AnimatePresence>
        {showJobModal && selectedJob && (
          <motion.div 
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-lg bg-white rounded-t-3xl p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              {/* Close button */}
              <button 
                onClick={declineJob}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-1">New Trip Request</h3>
                <p className="text-gray-500">{selectedJob.vehicle_type} ride</p>
              </div>

              {/* Fare */}
              <div className="text-center mb-6">
                <span className="text-4xl font-bold text-gray-800">${selectedJob.fare?.total?.toFixed(2)}</span>
                <p className="text-sm text-green-600 mt-1">You earn ${(selectedJob.fare?.total * 0.8).toFixed(2)}</p>
              </div>

              {/* Route */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <p className="text-xs text-gray-400">Pickup</p>
                    <p className="text-gray-800 font-medium">{selectedJob.pickup?.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                  <div>
                    <p className="text-xs text-gray-400">Dropoff</p>
                    <p className="text-gray-800 font-medium">{selectedJob.dropoff?.address}</p>
                  </div>
                </div>
              </div>

              {/* Distance & Time */}
              <div className="flex justify-center gap-8 mb-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-800">{selectedJob.fare?.distance_km} km</p>
                  <p className="text-sm text-gray-400">Distance</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{Math.round(selectedJob.fare?.duration_min)} min</p>
                  <p className="text-sm text-gray-400">Est. time</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button 
                  onClick={declineJob}
                  variant="outline"
                  className="flex-1 py-6 text-lg border-gray-300"
                >
                  Decline
                </Button>
                <Button 
                  onClick={() => acceptJob(selectedJob.id)}
                  className="flex-1 py-6 text-lg btn-success"
                  disabled={loading}
                  data-testid="accept-trip-btn"
                >
                  {loading ? <div className="spinner" /> : 'Accept'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
