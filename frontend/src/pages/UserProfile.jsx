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
      <div className="min-h-screen bg-noir-700 flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-700">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="text-noir-100 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-heading text-lg font-bold text-white">My Profile</span>
          </div>
          <Button 
            onClick={handleSaveProfile}
            className="btn-primary"
            disabled={saving}
            data-testid="save-profile-btn"
          >
            {saving ? <div className="spinner w-4 h-4" /> : 'Save Changes'}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Profile Photo & Basic Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Photo */}
              <div className="flex items-center gap-6">
                <div 
                  className="relative w-24 h-24 rounded-full bg-noir-500 border-2 border-dashed border-noir-300 flex items-center justify-center cursor-pointer hover:border-cyan transition-colors overflow-hidden group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <img src={photoPreview.startsWith('http') || photoPreview.startsWith('/') ? photoPreview : `${API_URL.replace('/api', '')}${photoPreview}`} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-noir-100" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
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
                  <h3 className="text-white font-medium">{profile.first_name} {profile.last_name}</h3>
                  <p className="text-sm text-noir-100">{user?.email}</p>
                  <Badge className="mt-2 bg-cyan/20 text-cyan capitalize">{user?.role}</Badge>
                </div>
              </div>

              {/* Name Fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-noir-100">First Name</Label>
                  <Input
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    className="bg-noir-500 border-noir-300 text-white"
                    data-testid="profile-firstname-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">Last Name</Label>
                  <Input
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    className="bg-noir-500 border-noir-300 text-white"
                    data-testid="profile-lastname-input"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="text-noir-100 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+1 514 555 0123"
                  className="bg-noir-500 border-noir-300 text-white"
                  data-testid="profile-phone-input"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Address */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-pink" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-noir-100">Street Address</Label>
                <Input
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="123 Main Street, Apt 4B"
                  className="bg-noir-500 border-noir-300 text-white"
                  data-testid="profile-address-input"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-noir-100 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Country
                  </Label>
                  <Select
                    value={profile.country}
                    onValueChange={(value) => setProfile({ ...profile, country: value, state: "" })}
                  >
                    <SelectTrigger className="bg-noir-500 border-noir-300 text-white" data-testid="profile-country-select">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="bg-noir-600 border-noir-300">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c} className="text-white hover:bg-noir-500">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-noir-100">State / Province</Label>
                  <Select
                    value={profile.state}
                    onValueChange={(value) => setProfile({ ...profile, state: value })}
                    disabled={!profile.country}
                  >
                    <SelectTrigger className="bg-noir-500 border-noir-300 text-white" data-testid="profile-state-select">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-noir-600 border-noir-300">
                      {(PROVINCES[profile.country] || []).map((s) => (
                        <SelectItem key={s} value={s} className="text-white hover:bg-noir-500">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-noir-100 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  City / Region
                </Label>
                <Input
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  placeholder="Montreal"
                  className="bg-noir-500 border-noir-300 text-white"
                  data-testid="profile-city-input"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Methods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-yellow" />
                Payment Methods
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddPayment(true)}
                className="btn-secondary"
                data-testid="add-payment-btn"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentMethods.length === 0 ? (
                <p className="text-noir-100 text-sm text-center py-6">No payment methods added yet</p>
              ) : (
                paymentMethods.map((method) => (
                  <div 
                    key={method.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-noir-500 border border-noir-300"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getPaymentIcon(method.type)}</span>
                      <div>
                        <div className="text-white font-medium">
                          {method.type === 'apple_pay' ? 'Apple Pay' : 
                           method.type === 'google_pay' ? 'Google Pay' :
                           `${method.card_brand} •••• ${method.card_last_four}`}
                        </div>
                        {method.expiry_month && (
                          <div className="text-xs text-noir-100">
                            Expires {method.expiry_month}/{method.expiry_year}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.is_default && (
                        <Badge className="bg-cyan/20 text-cyan">Default</Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeletePaymentMethod(method.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {/* Add Payment Form */}
              {showAddPayment && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 rounded-lg bg-noir-500 border border-cyan/30 space-y-4"
                >
                  <div className="space-y-2">
                    <Label className="text-noir-100">Payment Type</Label>
                    <Select
                      value={newPayment.type}
                      onValueChange={(value) => setNewPayment({ ...newPayment, type: value })}
                    >
                      <SelectTrigger className="bg-noir-600 border-noir-300 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-noir-600 border-noir-300">
                        <SelectItem value="credit_card" className="text-white hover:bg-noir-500">Credit Card</SelectItem>
                        <SelectItem value="debit_card" className="text-white hover:bg-noir-500">Debit Card</SelectItem>
                        <SelectItem value="apple_pay" className="text-white hover:bg-noir-500">Apple Pay</SelectItem>
                        <SelectItem value="google_pay" className="text-white hover:bg-noir-500">Google Pay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(newPayment.type === 'credit_card' || newPayment.type === 'debit_card') && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-noir-100">Card Brand</Label>
                          <Select
                            value={newPayment.card_brand}
                            onValueChange={(value) => setNewPayment({ ...newPayment, card_brand: value })}
                          >
                            <SelectTrigger className="bg-noir-600 border-noir-300 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-noir-600 border-noir-300">
                              <SelectItem value="Visa" className="text-white hover:bg-noir-500">Visa</SelectItem>
                              <SelectItem value="Mastercard" className="text-white hover:bg-noir-500">Mastercard</SelectItem>
                              <SelectItem value="Amex" className="text-white hover:bg-noir-500">American Express</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-noir-100">Last 4 Digits</Label>
                          <Input
                            value={newPayment.card_last_four}
                            onChange={(e) => setNewPayment({ ...newPayment, card_last_four: e.target.value.slice(0, 4) })}
                            placeholder="1234"
                            maxLength={4}
                            className="bg-noir-600 border-noir-300 text-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-noir-100">Expiry Month</Label>
                          <Input
                            type="number"
                            value={newPayment.expiry_month}
                            onChange={(e) => setNewPayment({ ...newPayment, expiry_month: e.target.value })}
                            placeholder="MM"
                            min="1"
                            max="12"
                            className="bg-noir-600 border-noir-300 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-noir-100">Expiry Year</Label>
                          <Input
                            type="number"
                            value={newPayment.expiry_year}
                            onChange={(e) => setNewPayment({ ...newPayment, expiry_year: e.target.value })}
                            placeholder="YYYY"
                            min="2024"
                            className="bg-noir-600 border-noir-300 text-white"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_default"
                      checked={newPayment.is_default}
                      onChange={(e) => setNewPayment({ ...newPayment, is_default: e.target.checked })}
                      className="rounded border-noir-300"
                    />
                    <Label htmlFor="is_default" className="text-noir-100 text-sm">Set as default payment method</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAddPaymentMethod}
                      className="btn-primary flex-1"
                      data-testid="confirm-add-payment-btn"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Add Payment Method
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowAddPayment(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
