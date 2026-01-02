import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuthStore, useDriverStore } from "../store";
import { toast } from "sonner";
import { 
  Home, Search, Settings, Navigation, DollarSign, Star, Clock,
  CheckCircle, XCircle, MapPin, ChevronUp, ChevronDown, Menu, User, Car,
  Hexagon, ArrowRight, LogOut, AlertCircle, X, History, Wallet,
  Gauge, Flag, Phone, UserX, AlertTriangle, Users, Wrench, MapPinOff,
  Baby, Shield, Timer, Zap, Volume2, VolumeX, Power
} from "lucide-react";
import {
  driverGoOnline,
  driverGoOffline,
  updateDriverLocation,
  acceptRide,
  declineRide,
  onRideAlert,
  onRideTaken,
  onDriverConnected,
  onRideAcceptSuccess,
  onRideAcceptFailed,
  onScheduledRideAlert,
  disconnectSocket
} from "../services/socket";
import {
  playRideAlert,
  stopRideAlert,
  playSuccessSound,
  playDeclineSound,
  playRideTakenSound
} from "../services/audioNotification";

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
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const dragControls = useDragControls();
  
  // Cancellation and No-Show states
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [arrivedTime, setArrivedTime] = useState(null);
  const [noShowTimerSeconds, setNoShowTimerSeconds] = useState(0);
  const noShowTimerRef = useRef(null);
  
  // Real-time ride alerts from Socket.io
  const [incomingRideAlert, setIncomingRideAlert] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isScheduledAlert, setIsScheduledAlert] = useState(false);
  const [minutesUntilPickup, setMinutesUntilPickup] = useState(null);
  
  // Driver tier/points state
  const [driverTier, setDriverTier] = useState({
    tier: 'silver',
    points: 0,
    next_tier: 'gold',
    next_tier_threshold: 300,
    progress_percent: 0
  });
  
  // Cancellation reasons with point penalties
  const CANCELLATION_REASONS = [
    { id: 'car_issue', label: 'Car Issue', icon: Wrench, points: 20 },
    { id: 'wrong_address', label: 'Wrong Address', icon: MapPinOff, points: 15 },
    { id: 'no_car_seat', label: 'No Car Seat', icon: Baby, points: 10 },
    { id: 'pickup_too_far', label: 'Pickup Too Far', icon: MapPin, points: 15 },
    { id: 'safety_concern', label: 'Safety Concern', icon: Shield, points: 0 },
    { id: 'too_many_passengers', label: 'More Than 4 People', icon: Users, points: 0 },
  ];
  
  // Tier colors and labels
  const TIER_CONFIG = {
    silver: { color: 'bg-gray-400', textColor: 'text-gray-600', label: 'Silver' },
    gold: { color: 'bg-yellow-500', textColor: 'text-yellow-600', label: 'Gold' },
    platinum: { color: 'bg-purple-500', textColor: 'text-purple-600', label: 'Platinum' },
    diamond: { color: 'bg-cyan-400', textColor: 'text-cyan-600', label: 'Diamond' }
  };

  useEffect(() => {
    loadDriverData();
    loadDriverTier();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  // No-show timer: starts when driver arrives
  useEffect(() => {
    if (arrivedTime) {
      noShowTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - arrivedTime) / 1000);
        setNoShowTimerSeconds(elapsed);
      }, 1000);
    }
    return () => {
      if (noShowTimerRef.current) clearInterval(noShowTimerRef.current);
    };
  }, [arrivedTime]);

  // Track when trip status changes to "arrived"
  useEffect(() => {
    if (activeJobs.length > 0) {
      const currentJob = activeJobs[0];
      if (currentJob.status === 'arrived' && !arrivedTime) {
        setArrivedTime(Date.now());
      } else if (currentJob.status !== 'arrived') {
        setArrivedTime(null);
        setNoShowTimerSeconds(0);
      }
    } else {
      setArrivedTime(null);
      setNoShowTimerSeconds(0);
    }
  }, [activeJobs]);

  // Socket.io event listeners
  useEffect(() => {
    // Listen for incoming ride alerts
    const unsubRideAlert = onRideAlert((data) => {
      console.log('🚕 New ride alert:', data);
      setIncomingRideAlert(data);
      setShowJobModal(true);
      setSelectedJob({
        id: data.bookingId,
        pickup: data.pickup,
        dropoff: data.dropoff,
        fare: data.fare,
        user_name: data.userName,
        distance_km: data.distanceKm,
        eta_minutes: data.estimatedPickupMinutes
      });
      // Play looping notification sound
      playRideAlert();
    });

    // Listen for ride taken by another driver
    const unsubRideTaken = onRideTaken((data) => {
      if (incomingRideAlert?.bookingId === data.bookingId) {
        // Stop the alert sound and play "taken" sound
        stopRideAlert();
        playRideTakenSound();
        setShowJobModal(false);
        setSelectedJob(null);
        setIncomingRideAlert(null);
        toast.info('This ride was accepted by another driver');
      }
    });

    // Listen for socket connection confirmation
    const unsubConnected = onDriverConnected((data) => {
      setSocketConnected(true);
      toast.success('Connected to ride network');
    });

    // Listen for ride accept success
    const unsubAcceptSuccess = onRideAcceptSuccess((data) => {
      // Stop alert sound and play success sound
      stopRideAlert();
      playSuccessSound();
      toast.success('Ride accepted successfully!');
      setShowJobModal(false);
      setIncomingRideAlert(null);
      loadJobs();
    });

    // Listen for ride accept failed
    const unsubAcceptFailed = onRideAcceptFailed((data) => {
      stopRideAlert();
      toast.error(data.message || 'Failed to accept ride');
      setShowJobModal(false);
      setIncomingRideAlert(null);
      setIsScheduledAlert(false);
      setMinutesUntilPickup(null);
    });

    // Listen for scheduled ride alerts (30 min before pickup)
    const unsubScheduledAlert = onScheduledRideAlert((data) => {
      console.log('📅 Scheduled ride alert:', data);
      setIncomingRideAlert(data);
      setIsScheduledAlert(true);
      setMinutesUntilPickup(data.minutesUntilPickup);
      setShowJobModal(true);
      setSelectedJob({
        id: data.bookingId,
        pickup: data.pickup,
        dropoff: data.dropoff,
        fare: data.fare,
        user_name: data.userName,
        scheduled_time: data.scheduledTime
      });
      // Play looping notification sound
      playRideAlert();
      toast.info(`Scheduled ride in ${data.minutesUntilPickup} minutes!`, {
        duration: 10000
      });
    });

    return () => {
      // Stop any playing sounds on cleanup
      stopRideAlert();
      unsubRideAlert();
      unsubRideTaken();
      unsubConnected();
      unsubAcceptSuccess();
      unsubAcceptFailed();
      unsubScheduledAlert();
    };
  }, [incomingRideAlert]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (isOnline) {
        driverGoOffline();
      }
    };
  }, [isOnline]);

  const loadDriverTier = async () => {
    try {
      const res = await fetch(`${API_URL}/driver/status/tier`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDriverTier(data);
      }
    } catch (e) {
      console.log('Error loading tier:', e);
    }
  };

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
          // Get current location and connect to Socket.io
          const lat = 45.5017 + (Math.random() - 0.5) * 0.02;
          const lng = -73.5673 + (Math.random() - 0.5) * 0.02;
          
          // Connect to Socket.io and register as online driver
          driverGoOnline(profile?.id, user?.id, { latitude: lat, longitude: lng });
          updateLocation();
        } else {
          // Disconnect from Socket.io
          driverGoOffline();
          setSocketConnected(false);
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
      // First try via Socket.io for real-time acceptance
      if (incomingRideAlert && incomingRideAlert.bookingId === bookingId) {
        acceptRide(profile?.id || user?.id, bookingId);
        // The success/failure will be handled by socket events
      }
      
      // Also call the REST API for database update
      const res = await fetch(`${API_URL}/driver/accept/${bookingId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        
      });
      if (res.ok) {
        toast.success('Trip accepted!');
        setShowJobModal(false);
        setSelectedJob(null);
        setIncomingRideAlert(null);
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
    // Stop any playing sounds
    stopRideAlert();
    playDeclineSound();
    
    // Notify via Socket.io if it's a real-time alert
    if (incomingRideAlert && selectedJob) {
      declineRide(profile?.id || user?.id, selectedJob.id);
    }
    setShowJobModal(false);
    setSelectedJob(null);
    setIncomingRideAlert(null);
    setIsScheduledAlert(false);
    setMinutesUntilPickup(null);
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

  // Update trip status (arrived, in_progress)
  const updateTripStatus = async (bookingId, newStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/trips/${bookingId}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast.success(`Status updated to ${newStatus}`);
        if (newStatus === 'arrived') {
          setArrivedTime(Date.now());
        }
        loadJobs();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to update status');
      }
    } catch (e) {
      toast.error('Error updating trip status');
    } finally {
      setLoading(false);
    }
  };

  // Get customer contact info for calling
  const getCustomerContact = async () => {
    if (!activeJobs.length) return;
    const bookingId = activeJobs[0].id;
    
    try {
      const res = await fetch(`${API_URL}/driver/booking/${bookingId}/customer`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerInfo(data);
        setShowCallModal(true);
      } else {
        toast.error('Unable to get customer contact');
      }
    } catch (e) {
      toast.error('Error getting customer info');
    }
  };

  // Initiate call to customer
  const callCustomer = () => {
    if (customerInfo?.customer_phone && customerInfo.customer_phone !== 'No phone available') {
      window.location.href = `tel:${customerInfo.customer_phone}`;
    } else {
      toast.error('Customer phone number not available');
    }
  };

  // Handle trip cancellation
  const handleCancelTrip = async (reason) => {
    if (!activeJobs.length) return;
    const bookingId = activeJobs[0].id;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/trips/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        const data = await res.json();
        setShowCancellationModal(false);
        setArrivedTime(null);
        setNoShowTimerSeconds(0);
        
        if (data.points_deducted > 0) {
          toast.warning(`Trip cancelled. -${data.points_deducted} points (${data.new_points} total)`);
        } else {
          toast.success('Trip cancelled successfully');
        }
        // Reload tier info
        loadDriverTier();
        loadJobs();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to cancel trip');
      }
    } catch (e) {
      toast.error('Error cancelling trip');
    } finally {
      setLoading(false);
    }
  };

  // Handle no-show
  const handleNoShow = async () => {
    if (!activeJobs.length) return;
    const bookingId = activeJobs[0].id;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/trips/${bookingId}/no-show`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setArrivedTime(null);
        setNoShowTimerSeconds(0);
        toast.success(data.note || 'Customer marked as no-show. You have priority for next ride!');
        loadJobs();
      } else {
        const resData = await res.json();
        toast.error(resData.detail || 'Failed to mark no-show');
      }
    } catch (e) {
      toast.error('Error marking no-show');
    } finally {
      setLoading(false);
    }
  };

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if no-show button should be enabled (5 minutes after arrival)
  const canMarkNoShow = noShowTimerSeconds >= 300; // 5 minutes = 300 seconds

  // Get current tier config
  const currentTierConfig = TIER_CONFIG[driverTier.tier] || TIER_CONFIG.silver;
  const nextTierConfig = driverTier.next_tier ? TIER_CONFIG[driverTier.next_tier] : null;

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
                      onClick={() => { navigate('/driver/earnings'); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <Wallet className="w-5 h-5" />
                      <span>Earnings & Payouts</span>
                      <span className="ml-auto text-green-600 font-semibold">${(earnings?.today || 0).toFixed(2)}</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => { navigate('/driver/meter'); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-orange-50 text-orange-700 bg-orange-50"
                    >
                      <Gauge className="w-5 h-5" />
                      <span className="font-semibold">Taxi Meter</span>
                      <Flag className="w-4 h-4 ml-auto" />
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => { navigate('/driver/trips'); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <History className="w-5 h-5" />
                      <span>Trip History</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => { navigate('/driver/ratings'); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    >
                      <Star className="w-5 h-5" />
                      <span>Ratings</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => { navigate('/driver/settings'); setShowMenu(false); }}
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

      {/* Bottom Sheet - Draggable */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl"
        initial={{ y: 0 }}
        animate={{ 
          y: bottomSheetExpanded ? 0 : 'calc(100% - 80px)'
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y"
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -50) {
            setBottomSheetExpanded(true);
          } else if (info.offset.y > 50) {
            setBottomSheetExpanded(false);
          }
        }}
        style={{ maxHeight: 'calc(100vh - 100px)' }}
      >
        {/* Drag Handle - Always Visible */}
        <div 
          className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          onClick={() => setBottomSheetExpanded(!bottomSheetExpanded)}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1" />
          
          {/* Mini status when collapsed */}
          {!bottomSheetExpanded && (
            <div className="flex items-center gap-3 py-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700">
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <ChevronUp className="w-4 h-4 text-gray-400" />
            </div>
          )}
          
          {/* Expanded hint */}
          {bottomSheetExpanded && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
              <ChevronDown className="w-3 h-3" />
              <span>Drag down to minimize</span>
            </div>
          )}
        </div>

        {/* Content - Only visible when expanded */}
        <motion.div 
          className={`overflow-y-auto transition-all duration-300`}
          style={{ 
            maxHeight: bottomSheetExpanded ? 'calc(100vh - 180px)' : '0px',
            opacity: bottomSheetExpanded ? 1 : 0
          }}
        >
          {/* Online/Offline Toggle */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-lg font-semibold text-gray-800">
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </span>
              </div>
              <button 
                className="p-2"
                onClick={() => setBottomSheetExpanded(false)}
              >
                <ChevronDown className="w-5 h-5 text-gray-400" />
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
                  className="h-full bg-green-500"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </motion.div>
            )}
          </div>

          {/* Go Online/Offline Button - Always visible */}
          <div className="px-6 pb-4 space-y-3">
            <Button 
              onClick={toggleOnlineStatus}
              className={`w-full py-6 text-lg font-semibold rounded-xl ${
                isOnline 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
              disabled={loading}
              data-testid="go-online-btn"
            >
              {loading ? (
                <div className="spinner" />
              ) : isOnline ? (
                <>
                  <Power className="w-5 h-5 mr-2" />
                  Go Offline
                </>
              ) : (
                <>
                  <Power className="w-5 h-5 mr-2" />
                  Go Online
                </>
              )}
            </Button>
            
            {/* Street Hail Button - Only when offline */}
            {!isOnline && (
              <Button 
                onClick={() => navigate('/driver/meter')}
                variant="outline"
                className="w-full py-4 border-orange-300 text-orange-700 hover:bg-orange-50 rounded-xl"
              >
              <Flag className="w-5 h-5 mr-2" />
              Street Hail / Flag Mode
            </Button>
          )}
        </div>

        {/* Active Trip */}
        {isOnline && activeJobs.length > 0 && (
          <div className="px-6 pb-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                {/* Header with Status and Action Buttons */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-700">Active Trip</span>
                    <Badge className="bg-blue-500 text-white capitalize">{activeJobs[0].status}</Badge>
                  </div>
                  {/* Action Buttons: Phone, Cancel, Logout */}
                  <div className="flex items-center gap-1">
                    {/* Call Customer Button */}
                    <button 
                      onClick={getCustomerContact}
                      className="p-2 rounded-full bg-green-500 shadow-sm hover:bg-green-600 transition-colors"
                      data-testid="call-customer-btn"
                      title="Call Customer"
                    >
                      <Phone className="w-4 h-4 text-white" />
                    </button>
                    {/* Cancel Trip Button */}
                    <button 
                      onClick={() => setShowCancellationModal(true)}
                      className="p-2 rounded-full bg-red-500 shadow-sm hover:bg-red-600 transition-colors"
                      data-testid="cancel-menu-btn"
                      title="Cancel Trip"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    {/* Logout Button */}
                    <button 
                      onClick={handleLogout}
                      className="p-2 rounded-full bg-gray-200 shadow-sm hover:bg-gray-300 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Arrived Timer - Shows waiting time */}
                {activeJobs[0].status === 'arrived' && (
                  <div className="bg-yellow-100 rounded-lg p-3 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-700">Waiting for passenger</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-yellow-700">{formatTime(noShowTimerSeconds)}</span>
                      {!canMarkNoShow && (
                        <p className="text-xs text-yellow-600">No-show in {formatTime(300 - noShowTimerSeconds)}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Route Info */}
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

                {/* Fare */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xl font-bold text-gray-800">${activeJobs[0].fare?.total?.toFixed(2)}</span>
                </div>

                {/* Status-based Action Buttons */}
                <div className="space-y-2">
                  {/* Accepted -> Arrived */}
                  {activeJobs[0].status === 'accepted' && (
                    <Button 
                      onClick={() => updateTripStatus(activeJobs[0].id, 'arrived')}
                      className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white"
                      disabled={loading}
                      data-testid="arrived-btn"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      I&apos;ve Arrived
                    </Button>
                  )}

                  {/* Arrived -> In Progress or No-Show */}
                  {activeJobs[0].status === 'arrived' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={() => updateTripStatus(activeJobs[0].id, 'in_progress')}
                        className="py-3 bg-green-500 hover:bg-green-600 text-white"
                        disabled={loading}
                        data-testid="start-trip-btn"
                      >
                        <Car className="w-4 h-4 mr-2" />
                        Start Trip
                      </Button>
                      <Button 
                        onClick={handleNoShow}
                        variant="outline"
                        className={`py-3 border-2 ${canMarkNoShow ? 'border-red-500 text-red-600 hover:bg-red-50' : 'border-gray-300 text-gray-400'}`}
                        disabled={loading || !canMarkNoShow}
                        data-testid="no-show-btn"
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        No-Show
                      </Button>
                    </div>
                  )}

                  {/* In Progress -> Complete */}
                  {activeJobs[0].status === 'in_progress' && (
                    <Button 
                      onClick={() => completeJob(activeJobs[0].id)}
                      className="w-full py-3 btn-success"
                      disabled={loading}
                      data-testid="complete-trip-btn"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Trip
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tier Progress Section */}
        <div className="px-6 pb-6 border-t border-gray-100 pt-4">
          {/* Current Tier Badge */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${currentTierConfig.color} flex items-center justify-center`}>
                <Hexagon className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <span className={`font-bold ${currentTierConfig.textColor}`}>{currentTierConfig.label}</span>
                <span className="text-gray-500 text-sm ml-2">Driver</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-800">{driverTier.points}</span>
              <span className="text-gray-400 text-sm"> pts</span>
            </div>
          </div>
          
          {/* Progress to Next Tier */}
          {driverTier.next_tier && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-500">
                  Unlock <span className={`font-semibold ${nextTierConfig?.textColor}`}>{nextTierConfig?.label}</span>
                </span>
                <span className="text-gray-600 font-medium">{Math.round(driverTier.progress_percent)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${nextTierConfig?.color || 'bg-blue-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${driverTier.progress_percent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{driverTier.points} pts</span>
                <span>{driverTier.next_tier_threshold} pts</span>
              </div>
            </div>
          )}
          
          {/* Diamond tier - no next tier */}
          {!driverTier.next_tier && (
            <div className="text-center py-2">
              <span className="text-cyan-600 font-semibold">🏆 Max Tier Reached!</span>
            </div>
          )}
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
        
        {/* Bottom padding for mobile nav */}
        <div className="h-20" />
        </motion.div>
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
                {isScheduledAlert ? (
                  <>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full mb-3">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">Scheduled Ride - {minutesUntilPickup} min until pickup</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-1">Upcoming Trip</h3>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-bold text-gray-800 mb-1">New Trip Request</h3>
                  </>
                )}
                <p className="text-gray-500">{selectedJob.vehicle_type || 'Standard'} ride</p>
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

      {/* Cancellation Modal */}
      <AnimatePresence>
        {showCancellationModal && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancellationModal(false)}
          >
            <motion.div 
              className="w-full max-w-lg bg-white rounded-t-3xl p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Cancel Trip</h3>
                <button 
                  onClick={() => setShowCancellationModal(false)}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Cancellation Reasons */}
              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium text-gray-600 mb-3">Select a reason:</p>
                {CANCELLATION_REASONS.map((reason) => {
                  const IconComponent = reason.icon;
                  return (
                    <button
                      key={reason.id}
                      onClick={() => handleCancelTrip(reason.id)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all"
                      data-testid={`cancel-reason-${reason.id}`}
                    >
                      <div className="p-2 rounded-lg bg-gray-100">
                        <IconComponent className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-800">{reason.label}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </button>
                  );
                })}
              </div>

              {/* Close Button */}
              <Button 
                onClick={() => setShowCancellationModal(false)}
                variant="outline"
                className="w-full py-4 border-gray-300"
              >
                Keep Trip
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Customer Modal */}
      <AnimatePresence>
        {showCallModal && customerInfo && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCallModal(false)}
          >
            <motion.div 
              className="w-full max-w-sm bg-white rounded-2xl p-6 mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Contact Customer</h3>
                <p className="text-sm text-gray-500 mt-1">{customerInfo.customer_name}</p>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-800">
                    {customerInfo.customer_phone || 'No phone available'}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <span className="text-sm text-gray-600">{customerInfo.pickup_address}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowCallModal(false)}
                  variant="outline"
                  className="flex-1 py-3 border-gray-300"
                >
                  Close
                </Button>
                <Button 
                  onClick={callCustomer}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white"
                  disabled={!customerInfo.customer_phone || customerInfo.customer_phone === 'No phone available'}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
