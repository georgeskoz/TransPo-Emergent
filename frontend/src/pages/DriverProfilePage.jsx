import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  ArrowLeft, Camera, User, MapPin, Car, FileText, Upload,
  CheckCircle, XCircle, Clock, AlertCircle, Receipt, Check
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COUNTRIES = ["Canada", "United States", "Mexico"];
const PROVINCES = {
  "Canada": ["Quebec", "Ontario", "British Columbia", "Alberta", "Manitoba"],
  "United States": ["New York", "California", "Texas", "Florida", "Illinois"]
};

export default function DriverProfilePage() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuthStore();
  const photoInputRef = useRef(null);
  const licenseInputRef = useRef(null);
  const taxiLicenseInputRef = useRef(null);
  
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    country: "",
    state: "",
    city: "",
    vehicle_type: "sedan",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_color: "",
    license_plate: "",
    drivers_license_number: "",
    drivers_license_expiry: "",
    taxi_license_number: "",
    taxi_license_expiry: "",
    // Tax Info
    gst_number: "",
    qst_number: "",
    srs_code: "",
    billing_number: "",
    srs_available: false,
    tax_disclaimer_accepted: false
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [driversLicensePhoto, setDriversLicensePhoto] = useState(null);
  const [taxiLicensePhoto, setTaxiLicensePhoto] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState({
    profile_photo: "pending",
    drivers_license: "pending",
    taxi_license: "pending",
    overall: "pending"
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/profile`, {
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
          city: data.city || "",
          vehicle_type: data.vehicle_type || "sedan",
          vehicle_make: data.vehicle_make || "",
          vehicle_model: data.vehicle_model || "",
          vehicle_color: data.vehicle_color || "",
          license_plate: data.license_plate || "",
          drivers_license_number: data.drivers_license_number || "",
          drivers_license_expiry: data.drivers_license_expiry || "",
          taxi_license_number: data.taxi_license_number || "",
          taxi_license_expiry: data.taxi_license_expiry || "",
          // Tax Info
          gst_number: data.gst_number || "",
          qst_number: data.qst_number || "",
          srs_code: data.srs_code || "",
          billing_number: data.billing_number || "",
          srs_available: data.srs_available || false,
          tax_disclaimer_accepted: data.tax_disclaimer_accepted || false
        });
        setPhotoPreview(data.profile_photo);
        setDriversLicensePhoto(data.drivers_license_photo);
        setTaxiLicensePhoto(data.taxi_license_photo);
        setVerificationStatus({
          profile_photo: data.profile_photo_status || "pending",
          drivers_license: data.drivers_license_status || "pending",
          taxi_license: data.taxi_license_status || "pending",
          overall: data.verification_status || "pending"
        });
      }
    } catch (e) {
      console.log('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file, type) => {
    const formData = new FormData();
    formData.append('photo', file);
    
    let endpoint = '';
    if (type === 'profile') {
      endpoint = '/user/profile/photo';
    } else if (type === 'drivers_license') {
      endpoint = '/driver/documents/license';
      formData.append('license_number', profile.drivers_license_number);
      formData.append('expiry_date', profile.drivers_license_expiry);
    } else if (type === 'taxi_license') {
      endpoint = '/driver/documents/taxi-license';
      formData.append('license_number', profile.taxi_license_number);
      formData.append('expiry_date', profile.taxi_license_expiry);
    }
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
        
      });
      if (res.ok) {
        const data = await res.json();
        if (type === 'profile') {
          setPhotoPreview(data.photo_url);
        } else if (type === 'drivers_license') {
          setDriversLicensePhoto(data.photo_url);
          setVerificationStatus(prev => ({ ...prev, drivers_license: 'pending' }));
        } else if (type === 'taxi_license') {
          setTaxiLicensePhoto(data.photo_url);
          setVerificationStatus(prev => ({ ...prev, taxi_license: 'pending' }));
        }
        toast.success(`${type === 'profile' ? 'Photo' : 'Document'} uploaded for verification`);
      }
    } catch (e) {
      toast.error('Failed to upload');
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/driver/profile`, {
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-yellow/20 text-yellow"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
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
              onClick={() => navigate('/driver')}
              className="text-noir-100 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-heading text-lg font-bold text-white">Driver Profile</span>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(verificationStatus.overall)}
            <Button 
              onClick={handleSaveProfile}
              className="btn-primary"
              disabled={saving}
              data-testid="save-driver-profile-btn"
            >
              {saving ? <div className="spinner w-4 h-4" /> : 'Save Changes'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Verification Status Banner */}
        {verificationStatus.overall === 'pending' && (
          <div className="p-4 rounded-lg bg-yellow/10 border border-yellow/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-yellow font-medium">Documents Under Review</h4>
              <p className="text-sm text-noir-100">Your profile is being verified. You can start accepting rides once all documents are approved.</p>
            </div>
          </div>
        )}

        {/* Profile Photo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan" />
                Profile Photo
                <span className="ml-auto">{getStatusBadge(verificationStatus.profile_photo)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div 
                  className="relative w-32 h-32 rounded-full bg-noir-500 border-2 border-dashed border-noir-300 flex items-center justify-center cursor-pointer hover:border-cyan transition-colors overflow-hidden group"
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <img src={photoPreview.startsWith('http') || photoPreview.startsWith('/') ? photoPreview : `${API_URL.replace('/api', '')}${photoPreview}`} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-10 h-10 text-noir-100" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setPhotoPreview(URL.createObjectURL(file));
                        handlePhotoUpload(file, 'profile');
                      }
                    }}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Upload a clear photo of yourself</p>
                  <p className="text-sm text-noir-100">This will be shown to passengers when they book a ride</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Personal Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-pink" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-noir-100">First Name</Label>
                  <Input
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">Last Name</Label>
                  <Input
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-noir-100">Phone Number</Label>
                <Input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="bg-noir-500 border-noir-300 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-noir-100">Address</Label>
                <Input
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  className="bg-noir-500 border-noir-300 text-white"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-noir-100">Country</Label>
                  <Select
                    value={profile.country}
                    onValueChange={(value) => setProfile({ ...profile, country: value, state: "" })}
                  >
                    <SelectTrigger className="bg-noir-500 border-noir-300 text-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-noir-600 border-noir-300">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c} className="text-white hover:bg-noir-500">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">State/Province</Label>
                  <Select
                    value={profile.state}
                    onValueChange={(value) => setProfile({ ...profile, state: value })}
                    disabled={!profile.country}
                  >
                    <SelectTrigger className="bg-noir-500 border-noir-300 text-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-noir-600 border-noir-300">
                      {(PROVINCES[profile.country] || []).map((s) => (
                        <SelectItem key={s} value={s} className="text-white hover:bg-noir-500">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">City</Label>
                  <Input
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Vehicle Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-yellow" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-noir-100">Vehicle Type</Label>
                  <Select
                    value={profile.vehicle_type}
                    onValueChange={(value) => setProfile({ ...profile, vehicle_type: value })}
                  >
                    <SelectTrigger className="bg-noir-500 border-noir-300 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-noir-600 border-noir-300">
                      <SelectItem value="sedan" className="text-white hover:bg-noir-500">Sedan</SelectItem>
                      <SelectItem value="suv" className="text-white hover:bg-noir-500">SUV</SelectItem>
                      <SelectItem value="van" className="text-white hover:bg-noir-500">Van</SelectItem>
                      <SelectItem value="bike" className="text-white hover:bg-noir-500">Motorcycle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">License Plate</Label>
                  <Input
                    value={profile.license_plate}
                    onChange={(e) => setProfile({ ...profile, license_plate: e.target.value.toUpperCase() })}
                    placeholder="ABC 123"
                    className="bg-noir-500 border-noir-300 text-white uppercase"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-noir-100">Make</Label>
                  <Input
                    value={profile.vehicle_make}
                    onChange={(e) => setProfile({ ...profile, vehicle_make: e.target.value })}
                    placeholder="Toyota"
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">Model</Label>
                  <Input
                    value={profile.vehicle_model}
                    onChange={(e) => setProfile({ ...profile, vehicle_model: e.target.value })}
                    placeholder="Camry"
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">Color</Label>
                  <Input
                    value={profile.vehicle_color}
                    onChange={(e) => setProfile({ ...profile, vehicle_color: e.target.value })}
                    placeholder="White"
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Driver's License */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan" />
                Driver's License
                <span className="ml-auto">{getStatusBadge(verificationStatus.drivers_license)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-noir-100">License Number</Label>
                  <Input
                    value={profile.drivers_license_number}
                    onChange={(e) => setProfile({ ...profile, drivers_license_number: e.target.value })}
                    placeholder="DL12345678"
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">Expiry Date</Label>
                  <Input
                    type="date"
                    value={profile.drivers_license_expiry}
                    onChange={(e) => setProfile({ ...profile, drivers_license_expiry: e.target.value })}
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
              </div>

              <div 
                className="border-2 border-dashed border-noir-300 rounded-lg p-6 text-center cursor-pointer hover:border-cyan transition-colors"
                onClick={() => licenseInputRef.current?.click()}
              >
                {driversLicensePhoto ? (
                  <div className="space-y-2">
                    <img 
                      src={driversLicensePhoto.startsWith('http') || driversLicensePhoto.startsWith('/') ? driversLicensePhoto : `${API_URL.replace('/api', '')}${driversLicensePhoto}`}
                      alt="Driver's License" 
                      className="max-h-40 mx-auto rounded"
                    />
                    <p className="text-sm text-cyan">Click to replace</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 mx-auto text-noir-100 mb-2" />
                    <p className="text-white font-medium">Upload Driver's License Photo</p>
                    <p className="text-sm text-noir-100">Click or drag to upload</p>
                  </>
                )}
                <input
                  ref={licenseInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (!profile.drivers_license_number || !profile.drivers_license_expiry) {
                        toast.error('Please fill in license number and expiry date first');
                        return;
                      }
                      handlePhotoUpload(file, 'drivers_license');
                    }
                  }}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Taxi License */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-yellow" />
                Taxi/Permit License
                <span className="ml-auto">{getStatusBadge(verificationStatus.taxi_license)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-noir-100">License/Permit Number</Label>
                  <Input
                    value={profile.taxi_license_number}
                    onChange={(e) => setProfile({ ...profile, taxi_license_number: e.target.value })}
                    placeholder="TX12345"
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-noir-100">Expiry Date</Label>
                  <Input
                    type="date"
                    value={profile.taxi_license_expiry}
                    onChange={(e) => setProfile({ ...profile, taxi_license_expiry: e.target.value })}
                    className="bg-noir-500 border-noir-300 text-white"
                  />
                </div>
              </div>

              <div 
                className="border-2 border-dashed border-noir-300 rounded-lg p-6 text-center cursor-pointer hover:border-yellow transition-colors"
                onClick={() => taxiLicenseInputRef.current?.click()}
              >
                {taxiLicensePhoto ? (
                  <div className="space-y-2">
                    <img 
                      src={taxiLicensePhoto.startsWith('http') || taxiLicensePhoto.startsWith('/') ? taxiLicensePhoto : `${API_URL.replace('/api', '')}${taxiLicensePhoto}`}
                      alt="Taxi License" 
                      className="max-h-40 mx-auto rounded"
                    />
                    <p className="text-sm text-yellow">Click to replace</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 mx-auto text-noir-100 mb-2" />
                    <p className="text-white font-medium">Upload Taxi License Photo</p>
                    <p className="text-sm text-noir-100">Click or drag to upload</p>
                  </>
                )}
                <input
                  ref={taxiLicenseInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (!profile.taxi_license_number || !profile.taxi_license_expiry) {
                        toast.error('Please fill in license number and expiry date first');
                        return;
                      }
                      handlePhotoUpload(file, 'taxi_license');
                    }
                  }}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
