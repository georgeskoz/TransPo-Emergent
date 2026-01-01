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
  Users, Car, DollarSign, TrendingUp, LogOut, Zap, Clock,
  CheckCircle, XCircle, AlertCircle, Menu, X, Settings, FileText,
  Gauge, CreditCard, Wallet, Receipt, FileCheck, AlertTriangle,
  ChevronRight, Save, Eye, Download, Building, Percent, Calendar,
  Shield, UserPlus, Lock, Unlock, History, MapPin, Activity,
  RefreshCw, Search, Filter, MoreVertical, Edit, Trash2, Plus
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout, getAuthHeaders } = useAuthStore();
  
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Admin profile state
  const [adminProfile, setAdminProfile] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Data states
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [cases, setCases] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [contractTemplate, setContractTemplate] = useState(null);
  const [taxReport, setTaxReport] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [adminRoles, setAdminRoles] = useState({});
  const [taxiConfigs, setTaxiConfigs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [trips, setTrips] = useState([]);
  
  // Modal states
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [showCreateConfigModal, setShowCreateConfigModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreateDriverModal, setShowCreateDriverModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', first_name: '', last_name: '', admin_role: 'admin' });
  const [newUser, setNewUser] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '', address: '' });
  const [newDriver, setNewDriver] = useState({ 
    email: '', password: '', first_name: '', last_name: '', phone: '',
    vehicle_type: 'sedan', vehicle_make: '', vehicle_model: '', vehicle_color: '', license_plate: '',
    drivers_license_number: '', taxi_permit_number: '', services: ['taxi']
  });
  
  useEffect(() => {
    loadAdminProfile();
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeSection === "documents") loadPendingDocs();
    if (activeSection === "cases") { loadCases(); loadDisputes(); }
    if (activeSection === "payouts") { loadPayouts(); loadPendingPayouts(); }
    if (activeSection === "contracts") { loadContracts(); loadContractTemplate(); }
    if (activeSection === "taxes") loadTaxReport();
    if (activeSection === "admin-management") { loadAdmins(); loadAdminRoles(); }
    if (activeSection === "taxi-config") loadTaxiConfigs();
    if (activeSection === "audit-logs") loadAuditLogs();
    if (activeSection === "trips") loadTrips();
  }, [activeSection]);

  const loadAdminProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/profile`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAdminProfile(data);
        setIsSuperAdmin(data.is_super_admin || data.admin_role === 'super_admin');
      }
    } catch (e) { console.log(e); }
  };

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

  const loadAdmins = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/admins`, { headers: getAuthHeaders() });
      if (res.ok) setAdmins((await res.json()).admins || []);
    } catch (e) { console.log(e); }
  };

  const loadAdminRoles = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/roles`, { headers: getAuthHeaders() });
      if (res.ok) setAdminRoles((await res.json()).roles || {});
    } catch (e) { console.log(e); }
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

  const loadDisputes = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/disputes`, { headers: getAuthHeaders() });
      if (res.ok) setDisputes((await res.json()).disputes || []);
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

  const loadTaxiConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/taxi-configs`, { headers: getAuthHeaders() });
      if (res.ok) setTaxiConfigs((await res.json()).configs || []);
    } catch (e) { console.log(e); }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/audit-logs?limit=50`, { headers: getAuthHeaders() });
      if (res.ok) setAuditLogs((await res.json()).logs || []);
    } catch (e) { console.log(e); }
  };

  const loadTrips = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/trips?limit=50`, { headers: getAuthHeaders() });
      if (res.ok) setTrips((await res.json()).trips || []);
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

  const createAdmin = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newAdmin)
      });
      if (res.ok) {
        toast.success('Admin created successfully');
        setShowCreateAdminModal(false);
        setNewAdmin({ email: '', password: '', first_name: '', last_name: '', admin_role: 'admin' });
        loadAdmins();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create admin');
      }
    } catch (e) {
      toast.error('Failed to create admin');
    }
  };

  const updateAdminRole = async (adminId, newRole) => {
    try {
      const res = await fetch(`${API_URL}/admin/admins/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ admin_role: newRole })
      });
      if (res.ok) {
        toast.success('Admin role updated');
        loadAdmins();
      }
    } catch (e) {
      toast.error('Failed to update admin');
    }
  };

  const deactivateAdmin = async (adminId) => {
    if (!confirm('Are you sure you want to deactivate this admin?')) return;
    try {
      const res = await fetch(`${API_URL}/admin/admins/${adminId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Admin deactivated');
        loadAdmins();
      }
    } catch (e) {
      toast.error('Failed to deactivate admin');
    }
  };

  const activateTaxiConfig = async (configId) => {
    try {
      const res = await fetch(`${API_URL}/admin/taxi-configs/${configId}/activate`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Configuration activated');
        loadTaxiConfigs();
      }
    } catch (e) {
      toast.error('Failed to activate configuration');
    }
  };

  const lockTaxiConfig = async (configId) => {
    const reason = prompt('Enter reason for locking (legal hold):');
    if (!reason) return;
    try {
      const res = await fetch(`${API_URL}/admin/taxi-configs/${configId}/lock?reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Configuration locked');
        loadTaxiConfigs();
      }
    } catch (e) {
      toast.error('Failed to lock configuration');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out');
  };

  // Define menu items based on permissions
  const getMenuItems = () => {
    const items = [
      { id: "overview", label: "Overview", icon: TrendingUp, permission: "view_dashboard" },
      { id: "trips", label: "Trips", icon: MapPin, permission: "view_trips" },
      { id: "taxi-config", label: "Taxi Config", icon: Gauge, permission: "view_taxi_config", superOnly: !isSuperAdmin },
      { id: "documents", label: "Documents", icon: FileCheck, permission: "view_documents", badge: pendingDocs.length },
      { id: "cases", label: "Cases & Disputes", icon: AlertTriangle, permission: "view_cases", badge: disputes.filter(d => d.status === 'open').length },
      { id: "merchants", label: "Merchants", icon: CreditCard, permission: "manage_merchants" },
      { id: "payouts", label: "Payouts", icon: Wallet, permission: "view_reports" },
      { id: "taxes", label: "Taxes", icon: Receipt, permission: "view_reports" },
      { id: "contracts", label: "Contracts", icon: FileText, permission: "view_dashboard" },
      { id: "commissions", label: "Commissions", icon: Percent, permission: "manage_commissions" },
      { id: "users", label: "Users", icon: Users, permission: "view_users" },
      { id: "drivers", label: "Drivers", icon: Car, permission: "view_drivers" },
    ];
    
    // Super admin only sections
    if (isSuperAdmin) {
      items.push({ id: "admin-management", label: "Admin Management", icon: Shield, permission: "manage_admins" });
      items.push({ id: "audit-logs", label: "Audit Logs", icon: History, permission: "view_audit_log" });
    }
    
    items.push({ id: "profile", label: "My Profile", icon: Settings, permission: "view_dashboard" });
    
    return items;
  };

  const menuItems = getMenuItems();

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
              <div className="text-xs text-gray-400">
                {isSuperAdmin ? 'Super Admin' : 'Admin Panel'}
              </div>
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeSection.replace('-', ' ')}</h1>
            <p className="text-sm text-gray-500">
              {isSuperAdmin && <Badge className="bg-purple-100 text-purple-700 mr-2">Super Admin</Badge>}
              Manage your platform settings and operations
            </p>
          </div>
          {adminProfile && (
            <div className="text-right">
              <div className="text-sm font-medium text-gray-700">{adminProfile.name}</div>
              <div className="text-xs text-gray-500">{adminProfile.email}</div>
            </div>
          )}
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
                    {disputes.filter(d => d.status === 'open').length > 0 && (
                      <Badge variant="destructive">{disputes.filter(d => d.status === 'open').length} open</Badge>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setActiveSection("taxes")} className="h-auto py-4 flex flex-col gap-2">
                    <Receipt className="w-6 h-6" />
                    <span>Tax Reports</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Role Info */}
            {adminProfile && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{adminProfile.role_info?.name || 'Admin'}</div>
                      <div className="text-sm text-gray-500">{adminProfile.role_info?.description}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Admin Management Section (Super Admin Only) */}
        {activeSection === "admin-management" && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div></div>
              <Button onClick={() => setShowCreateAdminModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />Create Admin
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Admin Users</CardTitle>
                <CardDescription>Manage administrators and their roles</CardDescription>
              </CardHeader>
              <CardContent>
                {admins.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No admin users found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Admin</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Role</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admins.map((admin) => (
                          <tr key={admin.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium">{admin.name}</div>
                              <div className="text-xs text-gray-500">{admin.email}</div>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={admin.admin_role || 'admin'}
                                onChange={(e) => updateAdminRole(admin.id, e.target.value)}
                                disabled={admin.id === adminProfile?.id}
                                className="text-sm border rounded px-2 py-1"
                              >
                                {Object.entries(adminRoles).map(([key, role]) => (
                                  <option key={key} value={key}>{role.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={admin.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                {admin.is_active !== false ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {new Date(admin.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              {admin.id !== adminProfile?.id && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => deactivateAdmin(admin.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Roles */}
            <Card>
              <CardHeader>
                <CardTitle>Available Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(adminRoles).map(([key, role]) => (
                    <div key={key} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className={`w-5 h-5 ${key === 'super_admin' ? 'text-purple-500' : 'text-blue-500'}`} />
                        <span className="font-semibold">{role.name}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">{role.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions?.slice(0, 3).map((p, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                        {role.permissions?.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{role.permissions.length - 3}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Taxi Config Section */}
        {activeSection === "taxi-config" && (
          <div className="space-y-6">
            {isSuperAdmin && (
              <div className="flex justify-between items-center">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-yellow-800">Only Super Admin can modify taxi configurations</span>
                </div>
                <Button onClick={() => setShowCreateConfigModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />New Version
                </Button>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Taxi Configuration Versions</CardTitle>
                <CardDescription>Quebec CTQ-compliant rate configurations</CardDescription>
              </CardHeader>
              <CardContent>
                {taxiConfigs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Loading configurations...</div>
                ) : (
                  <div className="space-y-4">
                    {taxiConfigs.map((config) => (
                      <div key={config.id} className={`p-4 border rounded-lg ${config.status === 'active' ? 'border-green-500 bg-green-50' : config.status === 'locked' ? 'border-red-300 bg-red-50' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{config.name}</span>
                              <Badge variant="outline">v{config.version}</Badge>
                              <Badge className={
                                config.status === 'active' ? 'bg-green-100 text-green-700' :
                                config.status === 'locked' ? 'bg-red-100 text-red-700' :
                                config.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }>{config.status}</Badge>
                              {config.status === 'locked' && <Lock className="w-4 h-4 text-red-500" />}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                          </div>
                          {isSuperAdmin && config.status !== 'locked' && (
                            <div className="flex gap-2">
                              {config.status !== 'active' && (
                                <Button size="sm" onClick={() => activateTaxiConfig(config.id)}>
                                  Activate
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => lockTaxiConfig(config.id)}>
                                <Lock className="w-4 h-4 mr-1" />Lock
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                          <div className="p-3 bg-white rounded border">
                            <div className="text-sm font-medium text-amber-700 mb-2">Day Rates (05:00-23:00)</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between"><span>Base:</span><span className="font-mono">${config.day_rates?.base_fare}</span></div>
                              <div className="flex justify-between"><span>Per km:</span><span className="font-mono">${config.day_rates?.per_km_rate}</span></div>
                              <div className="flex justify-between"><span>Waiting/min:</span><span className="font-mono">${config.day_rates?.waiting_per_min}</span></div>
                            </div>
                          </div>
                          <div className="p-3 bg-white rounded border">
                            <div className="text-sm font-medium text-indigo-700 mb-2">Night Rates (23:00-05:00)</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between"><span>Base:</span><span className="font-mono">${config.night_rates?.base_fare}</span></div>
                              <div className="flex justify-between"><span>Per km:</span><span className="font-mono">${config.night_rates?.per_km_rate}</span></div>
                              <div className="flex justify-between"><span>Waiting/min:</span><span className="font-mono">${config.night_rates?.waiting_per_min}</span></div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 text-xs text-gray-500">
                          Gov Fee: ${config.government_fee} | Speed Threshold: {config.speed_threshold_kmh} km/h | 
                          Created: {new Date(config.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trips Section */}
        {activeSection === "trips" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Trip Monitor</CardTitle>
                <CardDescription>View all trips with config versions and GPS data</CardDescription>
              </CardHeader>
              <CardContent>
                {trips.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No trips found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Trip ID</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Mode</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fare</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trips.map((trip) => (
                          <tr key={trip.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-mono text-sm">{trip.id?.slice(0, 8)}...</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">{trip.mode || 'app'}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={
                                trip.status === 'completed' ? 'bg-green-100 text-green-700' :
                                trip.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                trip.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }>{trip.status}</Badge>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              ${trip.final_fare?.total_final?.toFixed(2) || '0.00'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {new Date(trip.start_time).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
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

        {/* Audit Logs Section (Super Admin Only) */}
        {activeSection === "audit-logs" && isSuperAdmin && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>Complete history of admin actions</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No audit logs found</div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 border rounded-lg flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <History className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.action_type}</Badge>
                            <span className="text-sm text-gray-500">{log.entity_type}</span>
                          </div>
                          <div className="text-sm text-gray-700 mt-1">
                            Actor: {log.actor_id?.slice(0, 8)}... ({log.actor_role})
                          </div>
                          {log.notes && (
                            <div className="text-sm text-gray-500 mt-1">{log.notes}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(log.timestamp).toLocaleString()}
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

        {/* Admin Profile Section */}
        {activeSection === "profile" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {adminProfile && (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
                        <Shield className="w-10 h-10 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{adminProfile.name}</h2>
                        <p className="text-gray-500">{adminProfile.email}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge className={adminProfile.is_super_admin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                            {adminProfile.role_info?.name || 'Admin'}
                          </Badge>
                          {adminProfile.requires_2fa && <Badge variant="outline">2FA Required</Badge>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3">Permissions</h3>
                      <div className="flex flex-wrap gap-2">
                        {adminProfile.permissions?.map((p, i) => (
                          <Badge key={i} variant="outline">{p}</Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3">Account Info</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Created:</span>
                          <span>{new Date(adminProfile.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">ID:</span>
                          <span className="font-mono">{adminProfile.id?.slice(0, 12)}...</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cases & Disputes */}
        {activeSection === "cases" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Disputes</CardTitle>
              </CardHeader>
              <CardContent>
                {disputes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No disputes found</div>
                ) : (
                  <div className="space-y-3">
                    {disputes.map((d) => (
                      <div key={d.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{d.dispute_number}</span>
                              <Badge className={
                                d.status === 'open' ? 'bg-red-100 text-red-700' :
                                d.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                'bg-yellow-100 text-yellow-700'
                              }>{d.status}</Badge>
                            </div>
                            <div className="text-sm text-gray-700 mt-1">{d.reason}</div>
                            <div className="text-sm text-gray-500 mt-1">{d.description}</div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-1" />View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Commissions, Payouts, Taxes, etc. - Keep existing implementations */}
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Other sections - Documents, Payouts, Taxes, Contracts, Merchants, Users, Drivers, Settings */}
        {/* ... keeping existing implementations for brevity ... */}

      </main>

      {/* Create Admin Modal */}
      <AnimatePresence>
        {showCreateAdminModal && (
          <motion.div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-md bg-white rounded-xl p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create Admin Account</h2>
                <button onClick={() => setShowCreateAdminModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input 
                      value={newAdmin.first_name}
                      onChange={(e) => setNewAdmin({...newAdmin, first_name: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input 
                      value={newAdmin.last_name}
                      onChange={(e) => setNewAdmin({...newAdmin, last_name: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input 
                    type="password"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <select 
                    value={newAdmin.admin_role}
                    onChange={(e) => setNewAdmin({...newAdmin, admin_role: e.target.value})}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    {Object.entries(adminRoles).map(([key, role]) => (
                      <option key={key} value={key}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateAdminModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={createAdmin}>
                  <UserPlus className="w-4 h-4 mr-2" />Create Admin
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
