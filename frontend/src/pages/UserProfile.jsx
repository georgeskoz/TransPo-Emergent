import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  ArrowLeft, Camera, User, MapPin, CreditCard, Plus, Trash2, 
  Check, Zap, Phone, Mail, Building, Globe, Star, Bell, Home, 
  Briefcase, Heart, Settings, AlertCircle
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COUNTRIES = [
  "Canada", "United States", "Mexico", "United Kingdom", "France", "Germany", "Australia"
];

const PROVINCES = {
  "Canada": ["Quebec", "Ontario", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", "Nova Scotia", "New Brunswick"],
  "United States": ["New York", "California", "Texas", "Florida", "Illinois", "Pennsylvania", "Ohio", "Georgia"]
};

export default function UserProfile() {
  const navigate = useNavigate();
  const { user, token, getAuthHeaders } = useAuthStore();
  const fileInputRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    country: "",
    state: "",
    city: ""
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({
    type: "credit_card",
    card_last_four: "",
    card_brand: "Visa",
    expiry_month: "",
    expiry_year: "",
    is_default: false
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // User rating
  const [userRating, setUserRating] = useState(5.0);
  const [noShowCount, setNoShowCount] = useState(0);
  const [lateCancelCount, setLateCancelCount] = useState(0);
  
  // Notifications
  const [notifications, setNotifications] = useState({
    push_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    ride_updates: true,
    promotions: true
  });
  
  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "home",
    address: "",
    latitude: 0,
    longitude: 0
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/profile`, {
        headers: getAuthHeaders(),
        
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone || "",
          address: data.address || "",
          country: data.country || "",
          state: data.state || "",
          city: data.city || ""
        });
        setPhotoPreview(data.profile_photo);
        setPaymentMethods(data.payment_methods || []);
        // Load rating info
        setUserRating(data.rating || 5.0);
        setNoShowCount(data.no_show_count || 0);
        setLateCancelCount(data.late_cancellation_count || 0);
        // Load notifications
        if (data.notifications) {
          setNotifications(data.notifications);
        }
        // Load saved addresses
        setSavedAddresses(data.saved_addresses || []);
      }
    } catch (e) {
      console.log('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      
      // Upload immediately
      const formData = new FormData();
      formData.append('photo', file);
      
      try {
        const res = await fetch(`${API_URL}/user/profile/photo`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
          
        });
        if (res.ok) {
          const data = await res.json();
          setPhotoPreview(data.photo_url);
          toast.success('Photo uploaded');
        }
      } catch (e) {
        toast.error('Failed to upload photo');
      }
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(profile),
        
      });
      if (res.ok) {
        toast.success('Profile saved');
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      const res = await fetch(`${API_URL}/user/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newPayment),
        
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods([...paymentMethods, data.payment_method]);
        setShowAddPayment(false);
        setNewPayment({
          type: "credit_card",
          card_last_four: "",
          card_brand: "Visa",
          expiry_month: "",
          expiry_year: "",
          is_default: false
        });
        toast.success('Payment method added');
      }
    } catch (e) {
      toast.error('Failed to add payment method');
    }
  };

  const handleDeletePaymentMethod = async (methodId) => {
    try {
      const res = await fetch(`${API_URL}/user/payment-methods/${methodId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        
      });
      if (res.ok) {
        setPaymentMethods(paymentMethods.filter(m => m.id !== methodId));
        toast.success('Payment method removed');
      }
    } catch (e) {
      toast.error('Failed to remove payment method');
    }
  };

  const handleSaveNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/user/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(notifications),
      });
      if (res.ok) {
        toast.success('Notification preferences saved');
      }
    } catch (e) {
      toast.error('Failed to save notifications');
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.address) {
      toast.error('Please enter an address');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/user/saved-addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newAddress),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedAddresses([...savedAddresses, data.address]);
        setShowAddAddress(false);
        setNewAddress({ label: "home", address: "", latitude: 0, longitude: 0 });
        toast.success('Address saved');
      }
    } catch (e) {
      toast.error('Failed to save address');
    }
  };

  const handleDeleteAddress = async (addressId) => {
    try {
      const res = await fetch(`${API_URL}/user/saved-addresses/${addressId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSavedAddresses(savedAddresses.filter(a => a.id !== addressId));
        toast.success('Address removed');
      }
    } catch (e) {
      toast.error('Failed to remove address');
    }
  };

  const getPaymentIcon = (type) => {
    switch (type) {
      case 'apple_pay': return '🍎';
      case 'google_pay': return '🔷';
      case 'debit_card': return '💳';
      default: return '💳';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-bold text-gray-900">Profile & Settings</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 overflow-y-auto">
        {/* User Rating Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Profile Photo */}
                  <div 
                    className="relative w-16 h-16 rounded-full bg-white border-2 border-yellow-300 flex items-center justify-center cursor-pointer overflow-hidden group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview.startsWith('http') || photoPreview.startsWith('/') ? photoPreview : `${API_URL.replace('/api', '')}${photoPreview}`} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {profile.first_name} {profile.last_name}
                    </h2>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm">
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                    <span className="text-2xl font-bold text-gray-900">{userRating.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Your Rating</p>
                </div>
              </div>
              {/* Accountability Stats */}
              {(noShowCount > 0 || lateCancelCount > 0) && (
                <div className="mt-4 pt-4 border-t border-yellow-200 flex gap-6">
                  {noShowCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{noShowCount} no-show{noShowCount > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {lateCancelCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{lateCancelCount} late cancellation{lateCancelCount > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-gray-200 p-1 rounded-xl w-full grid grid-cols-4">
            <TabsTrigger value="profile" className="data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-lg">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-lg">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="addresses" className="data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-lg">
              <MapPin className="w-4 h-4 mr-2" />
              Addresses
            </TabsTrigger>
            <TabsTrigger value="payment" className="data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-lg">
              <CreditCard className="w-4 h-4 mr-2" />
              Payment
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="bg-white border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-600" />
                  Personal Information
                </CardTitle>
                <Button 
                  onClick={handleSaveProfile}
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                  disabled={saving}
                  data-testid="save-profile-btn"
                >
                  {saving ? <div className="spinner w-4 h-4" /> : 'Save Changes'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">First Name</Label>
                    <Input
                      value={profile.first_name}
                      onChange={(e) => setProfile({...profile, first_name: e.target.value})}
                      className="bg-white border-gray-200 text-gray-900"
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Last Name</Label>
                    <Input
                      value={profile.last_name}
                      onChange={(e) => setProfile({...profile, last_name: e.target.value})}
                      className="bg-white border-gray-200 text-gray-900"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2">
                  <Label className="text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </Label>
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    className="bg-white border-gray-200 text-gray-900"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="bg-gray-100 border-gray-200 text-gray-500"
                  />
                </div>

                {/* Address Section */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Home Address
                  </h4>
                  <div className="space-y-4">
                    <Input
                      value={profile.address}
                      onChange={(e) => setProfile({...profile, address: e.target.value})}
                      className="bg-white border-gray-200 text-gray-900"
                      placeholder="Street address"
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <Select value={profile.country} onValueChange={(val) => setProfile({...profile, country: val, state: ""})}>
                        <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={profile.state} onValueChange={(val) => setProfile({...profile, state: val})}>
                        <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                          <SelectValue placeholder="State/Province" />
                        </SelectTrigger>
                        <SelectContent>
                          {(PROVINCES[profile.country] || []).map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={profile.city}
                        onChange={(e) => setProfile({...profile, city: e.target.value})}
                        className="bg-white border-gray-200 text-gray-900"
                        placeholder="City"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="preferences">
            <Card className="bg-white border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-gray-600" />
                  Notification Preferences
                </CardTitle>
                <Button 
                  onClick={handleSaveNotifications}
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  Save
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Notification Channels */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700">Notification Channels</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Push Notifications</p>
                        <p className="text-sm text-gray-500">Receive alerts on your device</p>
                      </div>
                      <Switch 
                        checked={notifications.push_enabled}
                        onCheckedChange={(val) => setNotifications({...notifications, push_enabled: val})}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Email Notifications</p>
                        <p className="text-sm text-gray-500">Receive updates via email</p>
                      </div>
                      <Switch 
                        checked={notifications.email_enabled}
                        onCheckedChange={(val) => setNotifications({...notifications, email_enabled: val})}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">SMS Notifications</p>
                        <p className="text-sm text-gray-500">Receive text messages</p>
                      </div>
                      <Switch 
                        checked={notifications.sms_enabled}
                        onCheckedChange={(val) => setNotifications({...notifications, sms_enabled: val})}
                      />
                    </div>
                  </div>
                </div>

                {/* Notification Types */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-gray-700">What to Notify</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Ride Updates</p>
                        <p className="text-sm text-gray-500">Driver arrival, trip status changes</p>
                      </div>
                      <Switch 
                        checked={notifications.ride_updates}
                        onCheckedChange={(val) => setNotifications({...notifications, ride_updates: val})}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Promotions & Offers</p>
                        <p className="text-sm text-gray-500">Discounts, special deals</p>
                      </div>
                      <Switch 
                        checked={notifications.promotions}
                        onCheckedChange={(val) => setNotifications({...notifications, promotions: val})}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Saved Addresses Tab */}
          <TabsContent value="addresses">
            <Card className="bg-white border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  Saved Addresses
                </CardTitle>
                <Button 
                  onClick={() => setShowAddAddress(true)}
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Address
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {savedAddresses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No saved addresses yet</p>
                    <p className="text-sm">Add your home, work, or favorite places</p>
                  </div>
                ) : (
                  savedAddresses.map((addr) => (
                    <div key={addr.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          addr.label === 'home' ? 'bg-blue-100' : 
                          addr.label === 'work' ? 'bg-purple-100' : 'bg-gray-100'
                        }`}>
                          {addr.label === 'home' ? <Home className="w-5 h-5 text-blue-600" /> :
                           addr.label === 'work' ? <Briefcase className="w-5 h-5 text-purple-600" /> :
                           <Heart className="w-5 h-5 text-gray-600" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 capitalize">{addr.label}</p>
                          <p className="text-sm text-gray-500">{addr.address}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}

                {/* Add Address Form */}
                {showAddAddress && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 rounded-xl border-2 border-dashed border-gray-300 space-y-4"
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {['home', 'work', 'gym', 'other'].map((label) => (
                        <button
                          key={label}
                          onClick={() => setNewAddress({...newAddress, label})}
                          className={`p-2 rounded-lg border text-sm capitalize ${
                            newAddress.label === label 
                              ? 'border-gray-900 bg-gray-900 text-white' 
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Input
                      value={newAddress.address}
                      onChange={(e) => setNewAddress({...newAddress, address: e.target.value})}
                      className="bg-white border-gray-200 text-gray-900"
                      placeholder="Enter address..."
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowAddAddress(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleAddAddress}
                        className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        Save Address
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="payment">
            <Card className="bg-white border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  Payment Methods
                </CardTitle>
                <Button 
                  onClick={() => setShowAddPayment(true)}
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No payment methods added</p>
                    <p className="text-sm">Add a card or digital wallet</p>
                  </div>
                ) : (
                  paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getPaymentIcon(method.type)}</span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {method.card_brand} •••• {method.card_last_four}
                          </p>
                          <p className="text-sm text-gray-500">
                            Expires {method.expiry_month}/{method.expiry_year}
                          </p>
                        </div>
                        {method.is_default && (
                          <Badge className="bg-green-100 text-green-700 border-green-200">Default</Badge>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeletePaymentMethod(method.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}

                {/* Add Payment Form */}
                {showAddPayment && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 rounded-xl border-2 border-dashed border-gray-300 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-700">Card Number (last 4)</Label>
                        <Input
                          value={newPayment.card_last_four}
                          onChange={(e) => setNewPayment({...newPayment, card_last_four: e.target.value.slice(0, 4)})}
                          className="bg-white border-gray-200 text-gray-900"
                          placeholder="1234"
                          maxLength={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700">Card Brand</Label>
                        <Select value={newPayment.card_brand} onValueChange={(val) => setNewPayment({...newPayment, card_brand: val})}>
                          <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Visa">Visa</SelectItem>
                            <SelectItem value="Mastercard">Mastercard</SelectItem>
                            <SelectItem value="Amex">American Express</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-700">Expiry Month</Label>
                        <Input
                          value={newPayment.expiry_month}
                          onChange={(e) => setNewPayment({...newPayment, expiry_month: e.target.value})}
                          className="bg-white border-gray-200 text-gray-900"
                          placeholder="MM"
                          maxLength={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700">Expiry Year</Label>
                        <Input
                          value={newPayment.expiry_year}
                          onChange={(e) => setNewPayment({...newPayment, expiry_year: e.target.value})}
                          className="bg-white border-gray-200 text-gray-900"
                          placeholder="YY"
                          maxLength={2}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowAddPayment(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleAddPaymentMethod}
                        className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        Add Card
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
