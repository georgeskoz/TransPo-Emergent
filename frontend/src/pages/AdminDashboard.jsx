import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  Users, Car, DollarSign, TrendingUp, LogOut, Zap, Clock,
  CheckCircle, XCircle, AlertCircle, Menu, X, Settings, FileText,
  Gauge, CreditCard, Wallet, Receipt, FileCheck, AlertTriangle,
  ChevronRight, Save, Eye, Download, Building, Percent, Calendar
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout, getAuthHeaders } = useAuthStore();
  
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [cases, setCases] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [contractTemplate, setContractTemplate] = useState(null);
  const [taxReport, setTaxReport] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeSection === "documents") loadPendingDocs();
    if (activeSection === "cases") loadCases();
    if (activeSection === "payouts") { loadPayouts(); loadPendingPayouts(); }
    if (activeSection === "contracts") { loadContracts(); loadContractTemplate(); }
    if (activeSection === "taxes") loadTaxReport();
  }, [activeSection]);

  const loadInitialData = async () => {
    try {
      const [statsRes, settingsRes, usersRes, driversRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/settings`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/users`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/drivers`, { headers: getAuthHeaders() })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (usersRes.ok) setUsers((await usersRes.json()).users || []);
      if (driversRes.ok) setDrivers((await driversRes.json()).drivers || []);
    } catch (e) {
      console.log('Error loading admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingDocs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/documents/pending`, { headers: getAuthHeaders() });
      if (res.ok) setPendingDocs((await res.json()).pending_documents || []);
    } catch (e) { console.log(e); }
  };

  const loadCases = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/cases`, { headers: getAuthHeaders() });
      if (res.ok) setCases((await res.json()).cases || []);
    } catch (e) { console.log(e); }
  };

  const loadPayouts = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/payouts`, { headers: getAuthHeaders() });
      if (res.ok) setPayouts((await res.json()).payouts || []);
    } catch (e) { console.log(e); }
  };

  const loadPendingPayouts = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/payouts/pending`, { headers: getAuthHeaders() });
      if (res.ok) setPendingPayouts((await res.json()).pending_payouts || []);
    } catch (e) { console.log(e); }
  };

  const loadContracts = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/contracts/signed`, { headers: getAuthHeaders() });
      if (res.ok) setContracts((await res.json()).contracts || []);
    } catch (e) { console.log(e); }
  };

  const loadContractTemplate = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/contracts/template`, { headers: getAuthHeaders() });
      if (res.ok) setContractTemplate(await res.json());
    } catch (e) { console.log(e); }
  };

  const loadTaxReport = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/taxes/report`, { headers: getAuthHeaders() });
      if (res.ok) setTaxReport(await res.json());
    } catch (e) { console.log(e); }
  };

  const updateSettings = async (updates) => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        toast.success('Settings updated');
        setSettings({ ...settings, ...updates });
      }
    } catch (e) {
      toast.error('Failed to update settings');
    }
  };

  const approveDocument = async (driverId, docType, approved) => {
    try {
      const res = await fetch(`${API_URL}/admin/documents/approve?driver_id=${driverId}&document_type=${docType}&approved=${approved}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success(`Document ${approved ? 'approved' : 'rejected'}`);
        loadPendingDocs();
      }
    } catch (e) {
      toast.error('Failed to process document');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out');
  };

  const menuItems = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "meter", label: "Taxi Meter", icon: Gauge },
    { id: "documents", label: "Documents", icon: FileCheck, badge: pendingDocs.length },
    { id: "cases", label: "Cases", icon: AlertTriangle, badge: cases.filter(c => c.status === 'open').length },
    { id: "merchants", label: "Merchants", icon: CreditCard },
    { id: "payouts", label: "Payouts", icon: Wallet },
    { id: "taxes", label: "Taxes", icon: Receipt },
    { id: "contracts", label: "Contracts", icon: FileText },
    { id: "commissions", label: "Commissions", icon: Percent },
    { id: "users", label: "Users", icon: Users },
    { id: "drivers", label: "Drivers", icon: Car },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 min-h-screen transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-gray-800">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <span className="font-bold text-white">Transpo</span>
              <div className="text-xs text-gray-400">Admin Panel</div>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                activeSection === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left text-sm">{item.label}</span>
                  {item.badge > 0 && (
                    <Badge className="bg-red-500 text-white text-xs">{item.badge}</Badge>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Toggle & Logout */}
        <div className="p-2 border-t border-gray-800 space-y-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <Menu className="w-5 h-5" />
            {sidebarOpen && <span className="text-sm">Collapse</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeSection}</h1>
          <p className="text-sm text-gray-500">Manage your platform settings and operations</p>
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <Badge className="bg-blue-100 text-blue-700">Users</Badge>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{stats?.users?.total || 0}</div>
                  <div className="text-xs text-gray-500">Registered users</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Car className="w-5 h-5 text-green-500" />
                    <Badge className="bg-green-100 text-green-700">{stats?.drivers?.online || 0} online</Badge>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{stats?.drivers?.total || 0}</div>
                  <div className="text-xs text-gray-500">Total drivers</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Gauge className="w-5 h-5 text-orange-500" />
                    <Badge className="bg-orange-100 text-orange-700">{stats?.bookings?.active || 0} active</Badge>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{stats?.bookings?.total || 0}</div>
                  <div className="text-xs text-gray-500">Total trips</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900">${stats?.revenue?.platform?.toFixed(0) || 0}</div>
                  <div className="text-xs text-gray-500">Platform revenue ({settings?.commission_rate || 25}%)</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" onClick={() => setActiveSection("documents")} className="h-auto py-4 flex flex-col gap-2">
                    <FileCheck className="w-6 h-6" />
                    <span>Review Documents</span>
                    {pendingDocs.length > 0 && <Badge variant="destructive">{pendingDocs.length} pending</Badge>}
                  </Button>
                  <Button variant="outline" onClick={() => setActiveSection("payouts")} className="h-auto py-4 flex flex-col gap-2">
                    <Wallet className="w-6 h-6" />
                    <span>Process Payouts</span>
                  </Button>
                  <Button variant="outline" onClick={() => setActiveSection("cases")} className="h-auto py-4 flex flex-col gap-2">
                    <AlertTriangle className="w-6 h-6" />
                    <span>Open Cases</span>
                    {cases.filter(c => c.status === 'open').length > 0 && (
                      <Badge variant="destructive">{cases.filter(c => c.status === 'open').length} open</Badge>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setActiveSection("taxes")} className="h-auto py-4 flex flex-col gap-2">
                    <Receipt className="w-6 h-6" />
                    <span>Tax Reports</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Taxi Meter Settings */}
        {activeSection === "meter" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quebec Taxi Meter Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h3 className="font-semibold text-amber-800 mb-3">Day Rate (05:00 - 23:00)</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Base fare:</span><span className="font-mono">$4.10</span></div>
                      <div className="flex justify-between"><span>Per km:</span><span className="font-mono">$2.05</span></div>
                      <div className="flex justify-between"><span>Waiting/min:</span><span className="font-mono">$0.77</span></div>
                    </div>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h3 className="font-semibold text-indigo-800 mb-3">Night Rate (23:00 - 05:00)</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Base fare:</span><span className="font-mono">$4.70</span></div>
                      <div className="flex justify-between"><span>Per km:</span><span className="font-mono">$2.35</span></div>
                      <div className="flex justify-between"><span>Waiting/min:</span><span className="font-mono">$0.89</span></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Government Fee (CTQ):</span><span className="font-mono font-semibold">$0.90</span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-500">
                  * Rates are regulated by the Commission des transports du Québec (CTQ). Custom rates require regulatory approval.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Commission Settings */}
        {activeSection === "commissions" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Commission Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Note:</strong> Commissions are calculated on the meter fare <strong>excluding</strong> government fees ($0.90) and taxes.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="commission_rate">Default Commission Rate (%)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="commission_rate"
                        type="number"
                        min="0"
                        max="100"
                        value={settings?.commission_rate || 25}
                        onChange={(e) => setSettings({ ...settings, commission_rate: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                      <Button onClick={() => updateSettings({ commission_rate: settings?.commission_rate })}>
                        <Save className="w-4 h-4 mr-2" />Save
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Applied to all payment types by default</p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Payment-Specific Rates</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Credit Card Payments (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={settings?.card_payment_commission || settings?.commission_rate || 25}
                        onChange={(e) => setSettings({ ...settings, card_payment_commission: parseFloat(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>In-App Payments (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={settings?.app_payment_commission || settings?.commission_rate || 25}
                        onChange={(e) => setSettings({ ...settings, app_payment_commission: parseFloat(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Cash Payments (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={settings?.cash_payment_commission || settings?.commission_rate || 25}
                        onChange={(e) => setSettings({ ...settings, cash_payment_commission: parseFloat(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button 
                    className="mt-4"
                    onClick={() => updateSettings({
                      card_payment_commission: settings?.card_payment_commission,
                      app_payment_commission: settings?.app_payment_commission,
                      cash_payment_commission: settings?.cash_payment_commission
                    })}
                  >
                    <Save className="w-4 h-4 mr-2" />Save Payment Rates
                  </Button>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-2">Commission Example</h3>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm">
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>Meter fare:</span><span>$25.00</span></div>
                      <div className="flex justify-between text-gray-500"><span>- Government fee:</span><span>-$0.90</span></div>
                      <div className="flex justify-between font-semibold border-t pt-1"><span>Commissionable amount:</span><span>$24.10</span></div>
                      <div className="flex justify-between text-blue-600"><span>Platform commission ({settings?.commission_rate || 25}%):</span><span>${((24.10) * (settings?.commission_rate || 25) / 100).toFixed(2)}</span></div>
                      <div className="flex justify-between text-green-600 font-semibold border-t pt-1"><span>Driver receives:</span><span>${(24.10 - (24.10 * (settings?.commission_rate || 25) / 100)).toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Document Approval */}
        {activeSection === "documents" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Document Verifications</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingDocs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>All documents verified!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingDocs.map((driver) => (
                      <div key={driver.user_id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{driver.user?.name || 'Driver'}</h3>
                            <p className="text-sm text-gray-500">{driver.user?.email}</p>
                          </div>
                          <Badge variant="outline">Pending Review</Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 rounded">
                            <div className="text-sm font-medium">Driver's License</div>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" variant="outline" onClick={() => approveDocument(driver.user_id, 'license', true)}>
                                <CheckCircle className="w-4 h-4 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600" onClick={() => approveDocument(driver.user_id, 'license', false)}>
                                <XCircle className="w-4 h-4 mr-1" />Reject
                              </Button>
                            </div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded">
                            <div className="text-sm font-medium">Taxi Permit</div>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" variant="outline" onClick={() => approveDocument(driver.user_id, 'taxi_license', true)}>
                                <CheckCircle className="w-4 h-4 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600" onClick={() => approveDocument(driver.user_id, 'taxi_license', false)}>
                                <XCircle className="w-4 h-4 mr-1" />Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cases */}
        {activeSection === "cases" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div></div>
              <Button>
                <AlertTriangle className="w-4 h-4 mr-2" />New Case
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Support Cases</CardTitle>
              </CardHeader>
              <CardContent>
                {cases.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No cases found</div>
                ) : (
                  <div className="space-y-3">
                    {cases.map((c) => (
                      <div key={c.id} className="p-4 border rounded-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-500">{c.case_number}</span>
                            <Badge className={
                              c.status === 'open' ? 'bg-red-100 text-red-700' :
                              c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }>{c.status}</Badge>
                            <Badge variant="outline">{c.case_type}</Badge>
                          </div>
                          <h3 className="font-medium mt-1">{c.title}</h3>
                          <p className="text-sm text-gray-500 truncate max-w-md">{c.description}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Merchants (Stripe) */}
        {activeSection === "merchants" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Merchants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Stripe</h3>
                        <p className="text-sm text-gray-500">Payment processing</p>
                      </div>
                    </div>
                    <Badge className={settings?.stripe_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                      {settings?.stripe_enabled ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label>Stripe Merchant ID</Label>
                      <Input
                        placeholder="acct_..."
                        value={settings?.stripe_merchant_id || ''}
                        onChange={(e) => setSettings({ ...settings, stripe_merchant_id: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="stripe_enabled"
                        checked={settings?.stripe_enabled || false}
                        onChange={(e) => setSettings({ ...settings, stripe_enabled: e.target.checked })}
                      />
                      <Label htmlFor="stripe_enabled">Enable Stripe payments</Label>
                    </div>
                    <Button onClick={() => updateSettings({ stripe_enabled: settings?.stripe_enabled, stripe_merchant_id: settings?.stripe_merchant_id })}>
                      <Save className="w-4 h-4 mr-2" />Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payouts */}
        {activeSection === "payouts" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payout Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Minimum Payout ($)</Label>
                    <Input
                      type="number"
                      value={settings?.min_payout_amount || 50}
                      onChange={(e) => setSettings({ ...settings, min_payout_amount: parseFloat(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Payout Frequency</Label>
                    <select
                      value={settings?.payout_frequency || 'weekly'}
                      onChange={(e) => setSettings({ ...settings, payout_frequency: e.target.value })}
                      className="w-full mt-1 p-2 border rounded-md"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="bi-weekly">Bi-Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => updateSettings({ min_payout_amount: settings?.min_payout_amount, payout_frequency: settings?.payout_frequency })}>
                      <Save className="w-4 h-4 mr-2" />Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending Payouts</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingPayouts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No pending payouts</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Driver</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Total Fares</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Commission</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Balance Due</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPayouts.map((p) => (
                          <tr key={p.driver_id} className="border-b">
                            <td className="py-3 px-4">
                              <div className="font-medium">{p.user?.name || 'Driver'}</div>
                              <div className="text-xs text-gray-500">{p.trip_count} trips</div>
                            </td>
                            <td className="py-3 px-4 font-mono">${p.total_fares?.toFixed(2)}</td>
                            <td className="py-3 px-4 text-gray-500">{p.commission_rate}%</td>
                            <td className="py-3 px-4 font-mono text-green-600 font-semibold">${p.balance_due?.toFixed(2)}</td>
                            <td className="py-3 px-4">
                              <Button size="sm">Process Payout</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tax Reports */}
        {activeSection === "taxes" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax Report - {taxReport?.period?.year || new Date().getFullYear()}</CardTitle>
              </CardHeader>
              <CardContent>
                {taxReport ? (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-600">Total Fares</div>
                        <div className="text-2xl font-bold">${taxReport.totals?.total_fares?.toFixed(2) || '0.00'}</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-sm text-green-600">Platform Commission</div>
                        <div className="text-2xl font-bold">${taxReport.platform_commission?.toFixed(2) || '0.00'}</div>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-lg">
                        <div className="text-sm text-orange-600">Tax Liability</div>
                        <div className="text-2xl font-bold">${taxReport.taxes?.total_tax_liability?.toFixed(2) || '0.00'}</div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3">Tax Breakdown</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>GST ({taxReport.taxes?.gst_rate}%)</span>
                          <span className="font-mono">${taxReport.taxes?.gst_collected?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>QST ({taxReport.taxes?.qst_rate}%)</span>
                          <span className="font-mono">${taxReport.taxes?.qst_collected?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" />Export Report
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">Loading tax data...</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contracts */}
        {activeSection === "contracts" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Driver Contract Template</CardTitle>
              </CardHeader>
              <CardContent>
                {contractTemplate && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">Version {contractTemplate.version}</Badge>
                      <span className="text-sm text-gray-500">
                        Last updated: {new Date(contractTemplate.updated_at || contractTemplate.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <Label>Contract Content</Label>
                      <Textarea
                        value={contractTemplate.content}
                        onChange={(e) => setContractTemplate({ ...contractTemplate, content: e.target.value })}
                        className="mt-1 font-mono text-sm h-64"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={async () => {
                        try {
                          await fetch(`${API_URL}/admin/contracts/template`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                            body: JSON.stringify({ contract_text: contractTemplate.content })
                          });
                          toast.success('Contract template saved');
                        } catch (e) {
                          toast.error('Failed to save');
                        }
                      }}>
                        <Save className="w-4 h-4 mr-2" />Save Template
                      </Button>
                      <Button variant="outline">
                        <Eye className="w-4 h-4 mr-2" />Preview
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Signed Contracts ({contracts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No signed contracts yet</div>
                ) : (
                  <div className="space-y-2">
                    {contracts.map((c) => (
                      <div key={c.id} className="p-3 border rounded-lg flex items-center justify-between">
                        <div>
                          <div className="font-medium">{c.driver_name}</div>
                          <div className="text-sm text-gray-500">Signed: {new Date(c.signed_at).toLocaleDateString()}</div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users */}
        {activeSection === "users" && (
          <Card>
            <CardHeader>
              <CardTitle>Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{u.name}</td>
                        <td className="py-3 px-4 text-gray-500">{u.email}</td>
                        <td className="py-3 px-4">
                          <Badge className={
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'driver' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }>{u.role}</Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drivers */}
        {activeSection === "drivers" && (
          <Card>
            <CardHeader>
              <CardTitle>Drivers ({drivers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Driver</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vehicle</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Rating</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-gray-500">{d.email}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {d.vehicle_make ? `${d.vehicle_color} ${d.vehicle_make} ${d.vehicle_model}` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="capitalize">{d.status}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-yellow-600">★ {d.rating?.toFixed(1)}</td>
                        <td className="py-3 px-4 font-mono">${d.earnings_total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings */}
        {activeSection === "settings" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Tax Settings</h3>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span>GST Rate:</span>
                      <span className="font-mono">{settings?.tax_settings?.gst_rate || 5}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>QST Rate:</span>
                      <span className="font-mono">{settings?.tax_settings?.qst_rate || 9.975}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Government Fee:</span>
                      <span className="font-mono">${settings?.tax_settings?.government_fee || 0.90}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
