import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  ArrowLeft, CreditCard, FileText, Car, Shield, Receipt,
  ChevronRight, Plus, Upload, Check, AlertCircle, X,
  Building, Calendar, Camera, Save, Trash2, Eye
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DriverSettings() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuthStore();
  
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Bank Account State
  const [bankInfo, setBankInfo] = useState({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    routing_number: '',
    account_type: 'checking'
  });
  const [bankSaved, setBankSaved] = useState(false);
  
  // Car Documents State
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState('');
  
  // Car Info State
  const [carInfo, setCarInfo] = useState({
    make: '',
    model: '',
    year: '',
    color: '',
    license_plate: '',
    vin: ''
  });
  
  // Background Check State
  const [backgroundCheck, setBackgroundCheck] = useState(null);
  
  // Tax Info State
  const [taxInfo, setTaxInfo] = useState({
    sin_number: '',
    business_number: '',
    gst_number: '',
    qst_number: '',
    billing_number: '',
    srs_code: '',
    srs_available: false,
    gst_registered: false,
    qst_registered: false,
    tax_disclaimer_accepted: false
  });

  useEffect(() => {
    loadDriverSettings();
  }, []);

  const loadDriverSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/driver/settings`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.bank_info) {
          setBankInfo(data.bank_info);
          setBankSaved(!!data.bank_info.account_number);
        }
        if (data.documents) setDocuments(data.documents);
        if (data.car_info) setCarInfo(data.car_info);
        if (data.background_check) setBackgroundCheck(data.background_check);
        if (data.tax_info) setTaxInfo(data.tax_info);
      }
    } catch (e) { console.log(e); }
  };

  const saveBankInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/settings/bank`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(bankInfo)
      });
      if (res.ok) {
        toast.success('Bank information saved');
        setBankSaved(true);
        setActiveSection(null);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to save');
      }
    } catch (e) {
      toast.error('Failed to save bank information');
    }
    setLoading(false);
  };

  const saveCarInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/settings/car`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(carInfo)
      });
      if (res.ok) {
        toast.success('Car information saved');
        setActiveSection(null);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to save');
      }
    } catch (e) {
      toast.error('Failed to save car information');
    }
    setLoading(false);
  };

  const saveTaxInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/settings/tax`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(taxInfo)
      });
      if (res.ok) {
        toast.success('Tax information saved');
        setActiveSection(null);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to save');
      }
    } catch (e) {
      toast.error('Failed to save tax information');
    }
    setLoading(false);
  };

  const requestBackgroundCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/settings/background-check`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Background check requested');
        loadDriverSettings();
      }
    } catch (e) {
      toast.error('Failed to request background check');
    }
    setLoading(false);
  };

  const uploadDocument = async (type, file) => {
    // In production, this would upload to storage
    const newDoc = {
      id: Date.now().toString(),
      type,
      name: file.name,
      status: 'pending',
      uploaded_at: new Date().toISOString()
    };
    setDocuments([...documents, newDoc]);
    toast.success(`${type} uploaded successfully`);
    setShowUploadModal(false);
  };

  const menuItems = [
    { id: 'bank', icon: Building, label: 'Bank Account', description: 'Set up direct deposit', status: bankSaved ? 'configured' : 'required' },
    { id: 'documents', icon: FileText, label: 'Car Documents', description: 'Insurance, Registration', status: documents.length > 0 ? 'uploaded' : 'required' },
    { id: 'car', icon: Car, label: 'Car Information', description: 'Vehicle details', status: carInfo.license_plate ? 'configured' : 'required' },
    { id: 'background', icon: Shield, label: 'Background Check', description: 'Verification status', status: backgroundCheck?.status || 'pending' },
    { id: 'tax', icon: Receipt, label: 'Tax Information', description: 'SIN, GST/QST numbers', status: taxInfo.sin_number ? 'configured' : 'optional' },
  ];

  const getStatusBadge = (status) => {
    switch(status) {
      case 'configured':
      case 'uploaded':
      case 'approved':
        return <Badge className="bg-green-100 text-green-700">✓ Complete</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'required':
        return <Badge className="bg-red-100 text-red-700">Required</Badge>;
      default:
        return <Badge variant="outline">Optional</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-4">
        <button onClick={() => activeSection ? setActiveSection(null) : navigate('/driver')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">
          {activeSection ? menuItems.find(m => m.id === activeSection)?.label : 'Settings'}
        </h1>
      </div>

      {/* Main Menu */}
      {!activeSection && (
        <div className="p-4 space-y-3 max-w-lg mx-auto">
          {menuItems.map((item) => (
            <Card 
              key={item.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveSection(item.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{item.label}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bank Account Section */}
      {activeSection === 'bank' && (
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-500" />
                Bank Account for Direct Deposit
              </CardTitle>
              <CardDescription>Your earnings will be deposited here</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Bank Name</Label>
                <Input
                  value={bankInfo.bank_name}
                  onChange={(e) => setBankInfo({...bankInfo, bank_name: e.target.value})}
                  placeholder="e.g., TD Bank, RBC, Desjardins"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Account Holder Name</Label>
                <Input
                  value={bankInfo.account_holder_name}
                  onChange={(e) => setBankInfo({...bankInfo, account_holder_name: e.target.value})}
                  placeholder="Name as it appears on account"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Account Number</Label>
                  <Input
                    type="password"
                    value={bankInfo.account_number}
                    onChange={(e) => setBankInfo({...bankInfo, account_number: e.target.value})}
                    placeholder="••••••••"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Transit/Routing Number</Label>
                  <Input
                    value={bankInfo.routing_number}
                    onChange={(e) => setBankInfo({...bankInfo, routing_number: e.target.value})}
                    placeholder="XXXXX-XXX"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Account Type</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={bankInfo.account_type === 'checking' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBankInfo({...bankInfo, account_type: 'checking'})}
                  >
                    Checking
                  </Button>
                  <Button
                    variant={bankInfo.account_type === 'savings' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBankInfo({...bankInfo, account_type: 'savings'})}
                  >
                    Savings
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Your bank information is encrypted and secure. We use it only for direct deposits.
              </div>
              <Button onClick={saveBankInfo} disabled={loading} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Save Bank Information
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Car Documents Section */}
      {activeSection === 'documents' && (
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" />
                Car Documents
              </CardTitle>
              <CardDescription>Upload required vehicle documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Types */}
              {[
                { type: 'insurance', label: 'Insurance Paper', required: true },
                { type: 'registration', label: 'Registration Paper', required: true },
                { type: 'inspection', label: 'Vehicle Inspection', required: false },
                { type: 'permit', label: 'Taxi Permit', required: true }
              ].map((docType) => {
                const uploaded = documents.find(d => d.type === docType.type);
                return (
                  <div key={docType.type} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${uploaded ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {uploaded ? <Check className="w-5 h-5 text-green-600" /> : <FileText className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div>
                        <div className="font-medium">{docType.label}</div>
                        <div className="text-xs text-gray-500">
                          {uploaded ? `Uploaded ${new Date(uploaded.uploaded_at).toLocaleDateString()}` : (docType.required ? 'Required' : 'Optional')}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setUploadType(docType.type); setShowUploadModal(true); }}
                    >
                      {uploaded ? 'Update' : 'Upload'}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Car Information Section */}
      {activeSection === 'car' && (
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5 text-orange-500" />
                Car Information
              </CardTitle>
              <CardDescription>Vehicle details for your profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Make</Label>
                  <Input
                    value={carInfo.make}
                    onChange={(e) => setCarInfo({...carInfo, make: e.target.value})}
                    placeholder="e.g., Toyota"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input
                    value={carInfo.model}
                    onChange={(e) => setCarInfo({...carInfo, model: e.target.value})}
                    placeholder="e.g., Camry"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Year</Label>
                  <Input
                    value={carInfo.year}
                    onChange={(e) => setCarInfo({...carInfo, year: e.target.value})}
                    placeholder="e.g., 2022"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    value={carInfo.color}
                    onChange={(e) => setCarInfo({...carInfo, color: e.target.value})}
                    placeholder="e.g., Black"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>License Plate</Label>
                <Input
                  value={carInfo.license_plate}
                  onChange={(e) => setCarInfo({...carInfo, license_plate: e.target.value.toUpperCase()})}
                  placeholder="e.g., ABC 123"
                  className="mt-1 uppercase"
                />
              </div>
              <div>
                <Label>VIN (Vehicle Identification Number)</Label>
                <Input
                  value={carInfo.vin}
                  onChange={(e) => setCarInfo({...carInfo, vin: e.target.value.toUpperCase()})}
                  placeholder="17-character VIN"
                  className="mt-1 uppercase font-mono"
                  maxLength={17}
                />
              </div>
              <Button onClick={saveCarInfo} disabled={loading} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Save Car Information
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Background Check Section */}
      {activeSection === 'background' && (
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                Background Check
              </CardTitle>
              <CardDescription>Verification for safety compliance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {backgroundCheck?.status === 'approved' ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <Check className="w-12 h-12 mx-auto mb-2 text-green-600" />
                  <div className="font-semibold text-green-800">Background Check Approved</div>
                  <div className="text-sm text-green-600 mt-1">
                    Verified on {new Date(backgroundCheck.approved_at).toLocaleDateString()}
                  </div>
                </div>
              ) : backgroundCheck?.status === 'pending' ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-yellow-600" />
                  <div className="font-semibold text-yellow-800">Background Check Pending</div>
                  <div className="text-sm text-yellow-600 mt-1">
                    Usually takes 3-5 business days
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Why do we need this?</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Required for passenger safety</li>
                      <li>• Compliance with Quebec taxi regulations</li>
                      <li>• Criminal record verification</li>
                      <li>• Driving record check</li>
                    </ul>
                  </div>
                  <Button onClick={requestBackgroundCheck} disabled={loading} className="w-full">
                    <Shield className="w-4 h-4 mr-2" />
                    Request Background Check
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tax Information Section */}
      {activeSection === 'tax' && (
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-500" />
                Tax Information
              </CardTitle>
              <CardDescription>For tax reporting purposes (Quebec)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Social Insurance Number (SIN)</Label>
                <Input
                  type="password"
                  value={taxInfo.sin_number}
                  onChange={(e) => setTaxInfo({...taxInfo, sin_number: e.target.value})}
                  placeholder="XXX-XXX-XXX"
                  className="mt-1"
                  maxLength={11}
                />
                <p className="text-xs text-gray-500 mt-1">Required for T4A tax slips</p>
              </div>
              <div>
                <Label>Business Number (if applicable)</Label>
                <Input
                  value={taxInfo.business_number}
                  onChange={(e) => setTaxInfo({...taxInfo, business_number: e.target.value})}
                  placeholder="9 digits"
                  className="mt-1"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">GST Registered</div>
                    <div className="text-xs text-gray-500">Federal Goods and Services Tax</div>
                  </div>
                  <Button
                    variant={taxInfo.gst_registered ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTaxInfo({...taxInfo, gst_registered: !taxInfo.gst_registered})}
                  >
                    {taxInfo.gst_registered ? 'Yes' : 'No'}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">QST Registered</div>
                    <div className="text-xs text-gray-500">Quebec Sales Tax</div>
                  </div>
                  <Button
                    variant={taxInfo.qst_registered ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTaxInfo({...taxInfo, qst_registered: !taxInfo.qst_registered})}
                  >
                    {taxInfo.qst_registered ? 'Yes' : 'No'}
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Your tax information is used solely for issuing tax documents and is kept strictly confidential.
              </div>
              <Button onClick={saveTaxInfo} disabled={loading} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Save Tax Information
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Document Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div 
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Upload {uploadType}</h2>
                <button onClick={() => setShowUploadModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => document.getElementById('file-upload').click()}
                >
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG up to 10MB</p>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        uploadDocument(uploadType, e.target.files[0]);
                      }
                    }}
                  />
                </div>
                <Button variant="outline" className="w-full" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
