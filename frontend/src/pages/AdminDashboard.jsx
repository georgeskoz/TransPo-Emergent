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
  RefreshCw, Search, Filter, MoreVertical, Edit, Trash2, Plus, Mail, Bell
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
  const [platformDocs, setPlatformDocs] = useState([]);
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
  const [showCreateDocModal, setShowCreateDocModal] = useState(false);
  const [showEditDocModal, setShowEditDocModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [newDoc, setNewDoc] = useState({
    title: '',
    doc_type: 'policy',
    content: '',
    target_audience: 'all',
    is_active: true,
    requires_acceptance: false,
    popup_enabled: false,
    popup_title: ''
  });
  const [showCreateConfigModal, setShowCreateConfigModal] = useState(false);
  const [showEditConfigModal, setShowEditConfigModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreateDriverModal, setShowCreateDriverModal] = useState(false);
  const [showCreatePayoutModal, setShowCreatePayoutModal] = useState(false);
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [showTripDetailModal, setShowTripDetailModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [editConfigData, setEditConfigData] = useState(null);
  const [complaintType, setComplaintType] = useState('service');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [tripNote, setTripNote] = useState('');
  const [selectedPayoutDriver, setSelectedPayoutDriver] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [taxQuarter, setTaxQuarter] = useState(null);
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
    if (activeSection === "documents") { loadPendingDocs(); loadPlatformDocs(); }
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

  const loadPlatformDocs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/platform-documents`, { headers: getAuthHeaders() });
      if (res.ok) setPlatformDocs((await res.json()).documents || []);
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

  const createUser = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        toast.success('User created successfully');
        setShowCreateUserModal(false);
        setNewUser({ email: '', password: '', first_name: '', last_name: '', phone: '', address: '' });
        loadInitialData();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create user');
      }
    } catch (e) {
      toast.error('Failed to create user');
    }
  };

  const createDriver = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newDriver)
      });
      if (res.ok) {
        toast.success('Driver created successfully');
        setShowCreateDriverModal(false);
        setNewDriver({ 
          email: '', password: '', first_name: '', last_name: '', phone: '',
          vehicle_type: 'sedan', vehicle_make: '', vehicle_model: '', vehicle_color: '', license_plate: '',
          drivers_license_number: '', taxi_permit_number: '', services: ['taxi']
        });
        loadInitialData();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create driver');
      }
    } catch (e) {
      toast.error('Failed to create driver');
    }
  };

  const createPayout = async () => {
    if (!selectedPayoutDriver || !payoutAmount) {
      toast.error('Please select driver and enter amount');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          driver_id: selectedPayoutDriver.driver_id,
          amount: parseFloat(payoutAmount),
          method: payoutMethod,
          notes: payoutNotes
        })
      });
      if (res.ok) {
        toast.success('Payout created successfully');
        setShowCreatePayoutModal(false);
        setSelectedPayoutDriver(null);
        setPayoutAmount('');
        setPayoutNotes('');
        loadPayouts();
        loadPendingPayouts();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create payout');
      }
    } catch (e) {
      toast.error('Failed to create payout');
    }
  };

  const processPayout = async (payoutId, status) => {
    const transactionId = status === 'completed' ? prompt('Enter transaction ID (optional):') : null;
    try {
      const url = `${API_URL}/admin/payouts/${payoutId}/process?status=${status}${transactionId ? `&transaction_id=${transactionId}` : ''}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success(`Payout ${status}`);
        loadPayouts();
        loadPendingPayouts();
      }
    } catch (e) {
      toast.error('Failed to process payout');
    }
  };

  const updateContractTemplate = async () => {
    if (!contractTemplate) return;
    try {
      const res = await fetch(`${API_URL}/admin/contracts/template`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          title: contractTemplate.title,
          content: contractTemplate.content
        })
      });
      if (res.ok) {
        toast.success('Contract template updated');
        setShowEditContractModal(false);
      }
    } catch (e) {
      toast.error('Failed to update contract template');
    }
  };

  const loadTaxReportWithFilters = async () => {
    try {
      let url = `${API_URL}/admin/taxes/report?year=${taxYear}`;
      if (taxQuarter) url += `&quarter=${taxQuarter}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) setTaxReport(await res.json());
    } catch (e) {
      console.log(e);
    }
  };

  const createTripComplaint = async () => {
    if (!selectedTrip || !complaintDescription.trim()) {
      toast.error('Please enter complaint details');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/trips/${selectedTrip.id}/complaint?complaint_type=${complaintType}&description=${encodeURIComponent(complaintDescription)}&reporter_type=admin`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Complaint created successfully');
        setShowComplaintModal(false);
        setComplaintDescription('');
        setComplaintType('service');
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create complaint');
      }
    } catch (e) {
      toast.error('Failed to create complaint');
    }
  };

  const addTripNote = async () => {
    if (!selectedTrip || !tripNote.trim()) {
      toast.error('Please enter a note');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/trips/${selectedTrip.id}/note?note=${encodeURIComponent(tripNote)}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Note added successfully');
        setTripNote('');
        loadTrips();
      } else {
        toast.error('Failed to add note');
      }
    } catch (e) {
      toast.error('Failed to add note');
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

  const unlockTaxiConfig = async (configId) => {
    const reason = prompt('Enter reason for unlocking:');
    if (!reason) return;
    try {
      const res = await fetch(`${API_URL}/admin/taxi-configs/${configId}/unlock?reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Configuration unlocked for editing');
        loadTaxiConfigs();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to unlock');
      }
    } catch (e) {
      toast.error('Failed to unlock configuration');
    }
  };

  const openEditConfig = (config) => {
    setSelectedConfig(config);
    setEditConfigData({
      name: config.name,
      description: config.description,
      day_base_fare: config.day_rates?.base_fare,
      day_per_km_rate: config.day_rates?.per_km_rate,
      day_waiting_per_min: config.day_rates?.waiting_per_min,
      night_base_fare: config.night_rates?.base_fare,
      night_per_km_rate: config.night_rates?.per_km_rate,
      night_waiting_per_min: config.night_rates?.waiting_per_min,
      government_fee: config.government_fee,
      speed_threshold_kmh: config.speed_threshold_kmh
    });
    setShowEditConfigModal(true);
  };

  const updateTaxiConfig = async () => {
    if (!selectedConfig || !editConfigData) return;
    try {
      const res = await fetch(`${API_URL}/admin/taxi-configs/${selectedConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(editConfigData)
      });
      if (res.ok) {
        toast.success('Configuration updated successfully');
        setShowEditConfigModal(false);
        setSelectedConfig(null);
        setEditConfigData(null);
        loadTaxiConfigs();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to update');
      }
    } catch (e) {
      toast.error('Failed to update configuration');
    }
  };

  const createPlatformDoc = async () => {
    if (!newDoc.title || !newDoc.content) {
      toast.error('Please fill in title and content');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/platform-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newDoc)
      });
      if (res.ok) {
        toast.success('Document created successfully');
        setShowCreateDocModal(false);
        setNewDoc({
          title: '', doc_type: 'policy', content: '', target_audience: 'all',
          is_active: true, requires_acceptance: false, popup_enabled: false, popup_title: ''
        });
        loadPlatformDocs();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create document');
      }
    } catch (e) {
      toast.error('Failed to create document');
    }
  };

  const updatePlatformDoc = async () => {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`${API_URL}/admin/platform-documents/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          title: selectedDoc.title,
          content: selectedDoc.content,
          is_active: selectedDoc.is_active,
          requires_acceptance: selectedDoc.requires_acceptance,
          popup_enabled: selectedDoc.popup_enabled,
          popup_title: selectedDoc.popup_title
        })
      });
      if (res.ok) {
        toast.success('Document updated successfully');
        setShowEditDocModal(false);
        setSelectedDoc(null);
        loadPlatformDocs();
      } else {
        toast.error('Failed to update document');
      }
    } catch (e) {
      toast.error('Failed to update document');
    }
  };

  const deletePlatformDoc = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`${API_URL}/admin/platform-documents/${docId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success('Document deleted');
        loadPlatformDocs();
      }
    } catch (e) {
      toast.error('Failed to delete document');
    }
  };

  const sendDocNotification = async (docId, notificationType) => {
    try {
      const res = await fetch(`${API_URL}/admin/platform-documents/${docId}/send-notification?notification_type=${notificationType}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        toast.success(`Notification sent via ${notificationType}`);
      } else {
        toast.error('Failed to send notification');
      }
    } catch (e) {
      toast.error('Failed to send notification');
    }
  };

  const approveDocument = async (driverId, documentType, approved) => {
    try {
      const res = await fetch(`${API_URL}/admin/documents/approve?driver_id=${driverId}&document_type=${documentType}&approved=${approved}`, {
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
                <CardDescription>Quebec CTQ-compliant rate configurations. Unlock to edit, then lock when done.</CardDescription>
              </CardHeader>
              <CardContent>
                {taxiConfigs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Loading configurations...</div>
                ) : (
                  <div className="space-y-4">
                    {taxiConfigs.map((config) => (
                      <div key={config.id} className={`p-4 border rounded-lg ${config.status === 'active' ? 'border-green-500 bg-green-50' : config.status === 'locked' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}`}>
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
                            {config.locked_reason && (
                              <p className="text-xs text-red-600 mt-1">Lock reason: {config.locked_reason}</p>
                            )}
                          </div>
                          {isSuperAdmin && (
                            <div className="flex gap-2 flex-wrap justify-end">
                              {/* Locked config - show Unlock button */}
                              {config.status === 'locked' && (
                                <Button size="sm" variant="outline" className="text-blue-600 border-blue-200" onClick={() => unlockTaxiConfig(config.id)}>
                                  <Unlock className="w-4 h-4 mr-1" />Unlock
                                </Button>
                              )}
                              {/* Draft/Active config - show Edit and Lock buttons */}
                              {config.status !== 'locked' && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => openEditConfig(config)}>
                                    <Edit className="w-4 h-4 mr-1" />Edit
                                  </Button>
                                  {config.status !== 'active' && (
                                    <Button size="sm" onClick={() => activateTaxiConfig(config.id)}>
                                      Activate
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => lockTaxiConfig(config.id)}>
                                    <Lock className="w-4 h-4 mr-1" />Lock
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                          <div className="p-3 bg-white rounded border">
                            <div className="text-sm font-medium text-amber-700 mb-2">☀️ Day Rates (05:00-23:00)</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between"><span>Base:</span><span className="font-mono">${config.day_rates?.base_fare}</span></div>
                              <div className="flex justify-between"><span>Per km:</span><span className="font-mono">${config.day_rates?.per_km_rate}</span></div>
                              <div className="flex justify-between"><span>Waiting/min:</span><span className="font-mono">${config.day_rates?.waiting_per_min}</span></div>
                            </div>
                          </div>
                          <div className="p-3 bg-white rounded border">
                            <div className="text-sm font-medium text-indigo-700 mb-2">🌙 Night Rates (23:00-05:00)</div>
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
                          {config.updated_at && ` | Updated: ${new Date(config.updated_at).toLocaleDateString()}`}
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
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">{trips.length} trips found</div>
              <Button variant="outline" onClick={loadTrips}>
                <RefreshCw className="w-4 h-4 mr-2" />Refresh
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  Trip Monitor
                </CardTitle>
                <CardDescription>View all trips with driver info, fare details, and manage complaints</CardDescription>
              </CardHeader>
              <CardContent>
                {trips.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No trips found</p>
                    <p className="text-sm mt-2">Trips will appear here when drivers start using the meter</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trips.map((trip) => (
                      <div key={trip.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          {/* Trip Status & ID */}
                          <div className="flex items-center gap-3 lg:w-48">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              trip.status === 'completed' ? 'bg-green-100' :
                              trip.status === 'running' ? 'bg-blue-100' :
                              trip.status === 'cancelled' ? 'bg-red-100' : 'bg-gray-100'
                            }`}>
                              <Car className={`w-5 h-5 ${
                                trip.status === 'completed' ? 'text-green-600' :
                                trip.status === 'running' ? 'text-blue-600' :
                                trip.status === 'cancelled' ? 'text-red-600' : 'text-gray-600'
                              }`} />
                            </div>
                            <div>
                              <Badge className={
                                trip.status === 'completed' ? 'bg-green-100 text-green-700' :
                                trip.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                trip.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }>{trip.status}</Badge>
                              <div className="text-xs text-gray-500 mt-1 font-mono">{trip.id?.slice(0, 8)}...</div>
                            </div>
                          </div>

                          {/* Driver Info */}
                          <div className="flex-1 border-l pl-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Driver</div>
                            {trip.driver_info ? (
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-medium">{trip.driver_info.name || 'Unknown Driver'}</div>
                                  <div className="text-sm text-gray-500">{trip.driver_info.phone || 'No phone'}</div>
                                  {trip.driver_info.vehicle && (
                                    <div className="text-xs text-gray-400">{trip.driver_info.vehicle}</div>
                                  )}
                                  {trip.driver_info.license_plate && (
                                    <Badge variant="outline" className="mt-1 text-xs">{trip.driver_info.license_plate}</Badge>
                                  )}
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-yellow-500 text-sm">★</span>
                                    <span className="text-sm">{trip.driver_info.rating?.toFixed(1) || '5.0'}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-400 text-sm">No driver assigned</div>
                            )}
                          </div>

                          {/* Customer Info (if available) */}
                          <div className="flex-1 border-l pl-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Customer</div>
                            {trip.customer_info ? (
                              <div>
                                <div className="font-medium">{trip.customer_info.name || 'Guest'}</div>
                                <div className="text-sm text-gray-500">{trip.customer_info.phone || trip.customer_info.email || 'No contact'}</div>
                              </div>
                            ) : (
                              <div className="text-gray-400 text-sm">
                                {trip.mode === 'street_hail' ? 'Street Hail (No booking)' : 'No customer info'}
                              </div>
                            )}
                          </div>

                          {/* Trip Details */}
                          <div className="flex-1 border-l pl-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Trip Details</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">Mode:</span>
                                <Badge variant="outline" className="ml-1">{trip.mode || 'app'}</Badge>
                              </div>
                              <div>
                                <span className="text-gray-500">Distance:</span>
                                <span className="ml-1 font-medium">{trip.final_fare?.distance?.toFixed(2) || '0'} km</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Duration:</span>
                                <span className="ml-1">{trip.final_fare?.trip_duration_minutes?.toFixed(0) || '0'} min</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Waiting:</span>
                                <span className="ml-1">{trip.final_fare?.total_waiting_minutes?.toFixed(0) || '0'} min</span>
                              </div>
                            </div>
                          </div>

                          {/* Fare & Actions */}
                          <div className="lg:w-48 border-l pl-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fare</div>
                            <div className="text-2xl font-bold text-green-600">
                              ${trip.final_fare?.total_final?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(trip.start_time).toLocaleDateString()} {new Date(trip.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedTrip(trip);
                                  setShowTripDetailModal(true);
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />View
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                onClick={() => {
                                  setSelectedTrip(trip);
                                  setShowComplaintModal(true);
                                }}
                              >
                                <AlertTriangle className="w-3 h-3 mr-1" />Report
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Admin Notes (if any) */}
                        {trip.admin_notes && trip.admin_notes.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Admin Notes</div>
                            <div className="space-y-2">
                              {trip.admin_notes.map((note, idx) => (
                                <div key={idx} className="bg-yellow-50 p-2 rounded text-sm">
                                  <div className="text-gray-700">{note.note}</div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    By {note.created_by_name} • {new Date(note.created_at).toLocaleString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
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

        {/* Documents Section */}
        {activeSection === "documents" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {platformDocs.length} platform documents | {pendingDocs.length} pending driver documents
              </div>
              {isSuperAdmin && (
                <Button onClick={() => setShowCreateDocModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />Create Document
                </Button>
              )}
            </div>

            {/* Pending Driver Documents */}
            {pendingDocs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    Pending Driver Documents
                  </CardTitle>
                  <CardDescription>Documents awaiting review and approval</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div>
                          <div className="font-medium">{doc.driver_name || 'Driver'}</div>
                          <div className="text-sm text-gray-500">{doc.document_type} - Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Recently'}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => approveDocument(doc.driver_id, doc.document_type, true)}>
                            <CheckCircle className="w-4 h-4 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => approveDocument(doc.driver_id, doc.document_type, false)}>
                            <XCircle className="w-4 h-4 mr-1" />Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Platform Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Platform Documents
                </CardTitle>
                <CardDescription>Terms, policies, guides, and notifications for users, drivers, and admins</CardDescription>
              </CardHeader>
              <CardContent>
                {platformDocs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No platform documents yet</p>
                    <p className="text-sm mt-2">Create documents like Terms & Conditions, Privacy Policy, Driver Guides, etc.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Document Type Filters */}
                    <div className="flex flex-wrap gap-2 pb-4 border-b">
                      {['all', 'terms', 'privacy', 'refund', 'policy', 'driver_guide', 'customer_letter', 'driver_popup'].map(type => (
                        <Badge 
                          key={type} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-gray-100 capitalize"
                        >
                          {type.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>

                    {/* Documents List */}
                    {platformDocs.map((doc) => (
                      <div key={doc.id} className={`p-4 border rounded-lg ${doc.is_active ? 'bg-white' : 'bg-gray-50 opacity-75'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{doc.title}</span>
                              <Badge variant="outline" className="capitalize">{doc.doc_type?.replace('_', ' ')}</Badge>
                              <Badge className={doc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                                {doc.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {doc.target_audience === 'all' ? '👥 All' : 
                                 doc.target_audience === 'drivers' ? '🚗 Drivers' : 
                                 doc.target_audience === 'users' ? '👤 Users' : '🔒 Admins'}
                              </Badge>
                              {doc.requires_acceptance && (
                                <Badge className="bg-purple-100 text-purple-700">Requires Acceptance</Badge>
                              )}
                              {doc.popup_enabled && (
                                <Badge className="bg-orange-100 text-orange-700">📢 Popup Enabled</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{doc.content?.slice(0, 200)}...</p>
                            <div className="text-xs text-gray-400 mt-2">
                              v{doc.version || 1} | Created: {new Date(doc.created_at).toLocaleDateString()}
                              {doc.updated_at && ` | Updated: ${new Date(doc.updated_at).toLocaleDateString()}`}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedDoc({...doc});
                                setShowEditDocModal(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {doc.target_audience === 'drivers' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-orange-600"
                                onClick={() => sendDocNotification(doc.id, 'popup')}
                              >
                                📢 Send Popup
                              </Button>
                            )}
                            {isSuperAdmin && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600"
                                onClick={() => deletePlatformDoc(doc.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Create</CardTitle>
                <CardDescription>Quickly create common document types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex flex-col gap-2"
                    onClick={() => {
                      setNewDoc({...newDoc, doc_type: 'terms', title: 'Terms & Conditions', target_audience: 'all'});
                      setShowCreateDocModal(true);
                    }}
                  >
                    <FileText className="w-6 h-6" />
                    <span className="text-sm">Terms & Conditions</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex flex-col gap-2"
                    onClick={() => {
                      setNewDoc({...newDoc, doc_type: 'privacy', title: 'Privacy Policy', target_audience: 'all'});
                      setShowCreateDocModal(true);
                    }}
                  >
                    <Shield className="w-6 h-6" />
                    <span className="text-sm">Privacy Policy</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex flex-col gap-2"
                    onClick={() => {
                      setNewDoc({...newDoc, doc_type: 'driver_popup', title: 'Driver Notice', target_audience: 'drivers', popup_enabled: true});
                      setShowCreateDocModal(true);
                    }}
                  >
                    <AlertCircle className="w-6 h-6" />
                    <span className="text-sm">Driver Popup</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex flex-col gap-2"
                    onClick={() => {
                      setNewDoc({...newDoc, doc_type: 'customer_letter', title: 'Customer Letter', target_audience: 'users'});
                      setShowCreateDocModal(true);
                    }}
                  >
                    <Mail className="w-6 h-6" />
                    <span className="text-sm">Customer Letter</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Section */}
        {activeSection === "users" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">{users.length} registered users</div>
              <Button onClick={() => setShowCreateUserModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />Add User
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage registered users</CardDescription>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No users found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Phone</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Users className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="font-medium">{u.name || `${u.first_name || ''} ${u.last_name || ''}`}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">{u.email}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{u.phone || '-'}</td>
                            <td className="py-3 px-4">
                              <Badge className={u.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                {u.is_active !== false ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
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

        {/* Drivers Section */}
        {activeSection === "drivers" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">{drivers.length} registered drivers</div>
              <Button onClick={() => setShowCreateDriverModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />Add Driver
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Drivers</CardTitle>
                <CardDescription>Manage registered drivers</CardDescription>
              </CardHeader>
              <CardContent>
                {drivers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No drivers found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Driver</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vehicle</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Rating</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Rides</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Verification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.map((d) => (
                          <tr key={d.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <Car className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                  <div className="font-medium">{d.name || `${d.first_name || ''} ${d.last_name || ''}`}</div>
                                  <div className="text-xs text-gray-500">{d.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm">{d.vehicle_color} {d.vehicle_make} {d.vehicle_model}</div>
                              <div className="text-xs text-gray-500">{d.license_plate}</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={
                                d.status === 'online' ? 'bg-green-100 text-green-700' :
                                d.status === 'busy' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }>{d.status || 'offline'}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <span className="text-yellow-500">★</span>
                                <span>{d.rating?.toFixed(1) || '5.0'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">{d.total_rides || 0}</td>
                            <td className="py-3 px-4">
                              <Badge className={
                                d.verification_status === 'approved' ? 'bg-green-100 text-green-700' :
                                d.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }>{d.verification_status || 'pending'}</Badge>
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

        {/* Payouts Section */}
        {activeSection === "payouts" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">Driver payout management</div>
              <Button onClick={() => setShowCreatePayoutModal(true)} disabled={pendingPayouts.length === 0}>
                <Plus className="w-4 h-4 mr-2" />Create Payout
              </Button>
            </div>

            {/* Pending Payouts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Pending Driver Earnings
                </CardTitle>
                <CardDescription>Drivers with earnings above minimum payout threshold</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingPayouts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No drivers with pending payouts</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Driver</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Total Fares</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Commission</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Driver Share</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Paid Out</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Balance Due</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPayouts.map((p) => (
                          <tr key={p.driver_id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <Car className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                  <div className="font-medium">{p.user?.name || p.driver?.name || 'Driver'}</div>
                                  <div className="text-xs text-gray-500">{p.trip_count} trips</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium">${p.total_fares?.toFixed(2)}</td>
                            <td className="py-3 px-4 text-red-600">-{p.commission_rate}%</td>
                            <td className="py-3 px-4 font-medium">${p.driver_share?.toFixed(2)}</td>
                            <td className="py-3 px-4 text-gray-600">${p.total_paid?.toFixed(2)}</td>
                            <td className="py-3 px-4 font-bold text-green-600">${p.balance_due?.toFixed(2)}</td>
                            <td className="py-3 px-4">
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  setSelectedPayoutDriver(p);
                                  setPayoutAmount(p.balance_due.toFixed(2));
                                  setShowCreatePayoutModal(true);
                                }}
                              >
                                <DollarSign className="w-3 h-3 mr-1" />Pay
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

            {/* Recent Payouts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-500" />
                  Recent Payouts
                </CardTitle>
                <CardDescription>All processed and pending payouts</CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No payouts recorded yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Reference</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Method</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payouts.map((payout) => (
                          <tr key={payout.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono text-sm">{payout.reference}</td>
                            <td className="py-3 px-4 font-bold">${payout.amount?.toFixed(2)}</td>
                            <td className="py-3 px-4 capitalize">{payout.method?.replace('_', ' ')}</td>
                            <td className="py-3 px-4">
                              <Badge className={
                                payout.status === 'completed' ? 'bg-green-100 text-green-700' :
                                payout.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }>{payout.status}</Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {payout.created_at ? new Date(payout.created_at).toLocaleDateString() : '-'}
                            </td>
                            <td className="py-3 px-4">
                              {payout.status === 'pending' && (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => processPayout(payout.id, 'completed')}>
                                    <CheckCircle className="w-3 h-3 mr-1" />Complete
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => processPayout(payout.id, 'failed')}>
                                    <XCircle className="w-3 h-3 mr-1" />Fail
                                  </Button>
                                </div>
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
          </div>
        )}

        {/* Taxes Section */}
        {activeSection === "taxes" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">Quebec GST/QST Tax Reports</div>
              <div className="flex gap-2">
                <select 
                  value={taxYear} 
                  onChange={(e) => setTaxYear(parseInt(e.target.value))}
                  className="border rounded-md px-3 py-2"
                >
                  {[2026, 2025, 2024, 2023].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select 
                  value={taxQuarter || ''} 
                  onChange={(e) => setTaxQuarter(e.target.value ? parseInt(e.target.value) : null)}
                  className="border rounded-md px-3 py-2"
                >
                  <option value="">Full Year</option>
                  <option value="1">Q1 (Jan-Mar)</option>
                  <option value="2">Q2 (Apr-Jun)</option>
                  <option value="3">Q3 (Jul-Sep)</option>
                  <option value="4">Q4 (Oct-Dec)</option>
                </select>
                <Button onClick={loadTaxReportWithFilters}>
                  <RefreshCw className="w-4 h-4 mr-2" />Generate Report
                </Button>
              </div>
            </div>

            {taxReport ? (
              <>
                {/* Tax Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Total Revenue</p>
                          <p className="text-2xl font-bold">${taxReport.totals?.total_fares?.toFixed(2) || '0.00'}</p>
                        </div>
                        <DollarSign className="w-8 h-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Platform Commission</p>
                          <p className="text-2xl font-bold">${taxReport.platform_commission?.toFixed(2) || '0.00'}</p>
                          <p className="text-xs text-gray-400">{taxReport.commission_rate}% rate</p>
                        </div>
                        <Percent className="w-8 h-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Total Trips</p>
                          <p className="text-2xl font-bold">{taxReport.totals?.trip_count || 0}</p>
                        </div>
                        <Activity className="w-8 h-8 text-purple-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Tax Liability</p>
                          <p className="text-2xl font-bold text-red-600">${taxReport.taxes?.total_tax_liability?.toFixed(2) || '0.00'}</p>
                        </div>
                        <Receipt className="w-8 h-8 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Tax Report */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="w-5 h-5" />
                      Tax Report: {taxReport.period?.year} {taxReport.period?.quarter ? `Q${taxReport.period.quarter}` : '(Full Year)'}
                    </CardTitle>
                    <CardDescription>
                      Period: {taxReport.date_range?.start} to {taxReport.date_range?.end}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Revenue Breakdown */}
                      <div>
                        <h3 className="font-semibold mb-3">Revenue Breakdown</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Base Fares</p>
                            <p className="text-lg font-bold">${taxReport.totals?.total_base_fares?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Distance Charges</p>
                            <p className="text-lg font-bold">${taxReport.totals?.total_distance_cost?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Waiting Time</p>
                            <p className="text-lg font-bold">${taxReport.totals?.total_waiting_cost?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Tips Collected</p>
                            <p className="text-lg font-bold">${taxReport.totals?.total_tips?.toFixed(2) || '0.00'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Quebec Tax Breakdown */}
                      <div>
                        <h3 className="font-semibold mb-3">Quebec Tax Obligations (GST/QST)</h3>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <table className="w-full">
                            <tbody>
                              <tr className="border-b border-blue-100">
                                <td className="py-2 text-gray-600">Taxable Revenue (excl. gov fees & tips)</td>
                                <td className="py-2 text-right font-medium">${taxReport.taxable_revenue?.toFixed(2)}</td>
                              </tr>
                              <tr className="border-b border-blue-100">
                                <td className="py-2 text-gray-600">Platform Commission ({taxReport.commission_rate}%)</td>
                                <td className="py-2 text-right font-medium">${taxReport.platform_commission?.toFixed(2)}</td>
                              </tr>
                              <tr className="border-b border-blue-100">
                                <td className="py-2 text-gray-600">GST ({taxReport.taxes?.gst_rate}%) on Commission</td>
                                <td className="py-2 text-right font-medium">${taxReport.taxes?.gst_collected?.toFixed(2)}</td>
                              </tr>
                              <tr className="border-b border-blue-100">
                                <td className="py-2 text-gray-600">QST ({taxReport.taxes?.qst_rate}%) on Commission</td>
                                <td className="py-2 text-right font-medium">${taxReport.taxes?.qst_collected?.toFixed(2)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 font-bold">Total Tax Liability</td>
                                <td className="py-2 text-right font-bold text-red-600">${taxReport.taxes?.total_tax_liability?.toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Export Button */}
                      <div className="flex justify-end">
                        <Button variant="outline">
                          <Download className="w-4 h-4 mr-2" />Export Tax Report
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Click &quot;Generate Report&quot; to view tax information</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Contracts Section */}
        {activeSection === "contracts" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">Driver partnership agreements</div>
              <Button onClick={() => setShowEditContractModal(true)}>
                <Edit className="w-4 h-4 mr-2" />Edit Template
              </Button>
            </div>

            {/* Contract Template */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Current Contract Template
                </CardTitle>
                <CardDescription>
                  Version: {contractTemplate?.version || '1.0'} | 
                  Effective: {contractTemplate?.effective_date ? new Date(contractTemplate.effective_date).toLocaleDateString() : 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contractTemplate ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-4">{contractTemplate.title}</h3>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                      {contractTemplate.content}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">Loading contract template...</div>
                )}
              </CardContent>
            </Card>

            {/* Signed Contracts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-green-500" />
                  Signed Contracts
                </CardTitle>
                <CardDescription>Drivers who have signed the partnership agreement</CardDescription>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No signed contracts yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Driver</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contract Version</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Signed Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contracts.map((contract) => (
                          <tr key={contract.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <Car className="w-4 h-4 text-green-600" />
                                </div>
                                <div className="font-medium">{contract.driver_name || 'Driver'}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4">{contract.contract_version || '1.0'}</td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : '-'}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className="bg-green-100 text-green-700">Active</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Button size="sm" variant="outline">
                                <Eye className="w-3 h-3 mr-1" />View
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

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateUserModal && (
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
                <h2 className="text-xl font-bold">Add New User</h2>
                <button onClick={() => setShowCreateUserModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name *</Label>
                    <Input 
                      value={newUser.first_name}
                      onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
                      className="mt-1"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label>Last Name *</Label>
                    <Input 
                      value={newUser.last_name}
                      onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
                      className="mt-1"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="mt-1"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label>Password *</Label>
                  <Input 
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="mt-1"
                    placeholder="Min 6 characters"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input 
                    value={newUser.phone}
                    onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                    className="mt-1"
                    placeholder="+1 514 555 0100"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input 
                    value={newUser.address}
                    onChange={(e) => setNewUser({...newUser, address: e.target.value})}
                    className="mt-1"
                    placeholder="123 Main Street, Montreal"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateUserModal(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={createUser}
                  disabled={!newUser.email || !newUser.password || !newUser.first_name || !newUser.last_name}
                >
                  <UserPlus className="w-4 h-4 mr-2" />Create User
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Driver Modal */}
      <AnimatePresence>
        {showCreateDriverModal && (
          <motion.div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-2xl bg-white rounded-xl p-6 my-8"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add New Driver</h2>
                <button onClick={() => setShowCreateDriverModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Personal Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>First Name *</Label>
                      <Input 
                        value={newDriver.first_name}
                        onChange={(e) => setNewDriver({...newDriver, first_name: e.target.value})}
                        className="mt-1"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label>Last Name *</Label>
                      <Input 
                        value={newDriver.last_name}
                        onChange={(e) => setNewDriver({...newDriver, last_name: e.target.value})}
                        className="mt-1"
                        placeholder="Doe"
                      />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input 
                        type="email"
                        value={newDriver.email}
                        onChange={(e) => setNewDriver({...newDriver, email: e.target.value})}
                        className="mt-1"
                        placeholder="driver@example.com"
                      />
                    </div>
                    <div>
                      <Label>Password *</Label>
                      <Input 
                        type="password"
                        value={newDriver.password}
                        onChange={(e) => setNewDriver({...newDriver, password: e.target.value})}
                        className="mt-1"
                        placeholder="Min 6 characters"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Phone *</Label>
                      <Input 
                        value={newDriver.phone}
                        onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})}
                        className="mt-1"
                        placeholder="+1 514 555 0100"
                      />
                    </div>
                  </div>
                </div>

                {/* Vehicle Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Vehicle Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Vehicle Type *</Label>
                      <select 
                        value={newDriver.vehicle_type}
                        onChange={(e) => setNewDriver({...newDriver, vehicle_type: e.target.value})}
                        className="w-full mt-1 p-2 border rounded-md"
                      >
                        <option value="sedan">Sedan</option>
                        <option value="suv">SUV</option>
                        <option value="van">Van</option>
                        <option value="bike">Bike</option>
                      </select>
                    </div>
                    <div>
                      <Label>Make</Label>
                      <Input 
                        value={newDriver.vehicle_make}
                        onChange={(e) => setNewDriver({...newDriver, vehicle_make: e.target.value})}
                        className="mt-1"
                        placeholder="Toyota"
                      />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input 
                        value={newDriver.vehicle_model}
                        onChange={(e) => setNewDriver({...newDriver, vehicle_model: e.target.value})}
                        className="mt-1"
                        placeholder="Camry"
                      />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Input 
                        value={newDriver.vehicle_color}
                        onChange={(e) => setNewDriver({...newDriver, vehicle_color: e.target.value})}
                        className="mt-1"
                        placeholder="Black"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>License Plate</Label>
                      <Input 
                        value={newDriver.license_plate}
                        onChange={(e) => setNewDriver({...newDriver, license_plate: e.target.value})}
                        className="mt-1"
                        placeholder="ABC 123"
                      />
                    </div>
                  </div>
                </div>

                {/* License Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">License Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Driver&apos;s License #</Label>
                      <Input 
                        value={newDriver.drivers_license_number}
                        onChange={(e) => setNewDriver({...newDriver, drivers_license_number: e.target.value})}
                        className="mt-1"
                        placeholder="License number"
                      />
                    </div>
                    <div>
                      <Label>Taxi Permit #</Label>
                      <Input 
                        value={newDriver.taxi_permit_number}
                        onChange={(e) => setNewDriver({...newDriver, taxi_permit_number: e.target.value})}
                        className="mt-1"
                        placeholder="Permit number"
                      />
                    </div>
                  </div>
                </div>

                {/* Services */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Services</h3>
                  <div className="flex gap-4">
                    {['taxi', 'courier', 'food'].map((service) => (
                      <label key={service} className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          checked={newDriver.services.includes(service)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewDriver({...newDriver, services: [...newDriver.services, service]});
                            } else {
                              setNewDriver({...newDriver, services: newDriver.services.filter(s => s !== service)});
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="capitalize">{service}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateDriverModal(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={createDriver}
                  disabled={!newDriver.email || !newDriver.password || !newDriver.first_name || !newDriver.last_name || !newDriver.phone}
                >
                  <UserPlus className="w-4 h-4 mr-2" />Create Driver
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Payout Modal */}
      <AnimatePresence>
        {showCreatePayoutModal && (
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
                <h2 className="text-xl font-bold">Create Payout</h2>
                <button onClick={() => {
                  setShowCreatePayoutModal(false);
                  setSelectedPayoutDriver(null);
                }}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {selectedPayoutDriver && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <p className="text-sm text-gray-600">Paying driver:</p>
                  <p className="font-bold">{selectedPayoutDriver.user?.name || 'Driver'}</p>
                  <p className="text-sm text-gray-500">Balance due: ${selectedPayoutDriver.balance_due?.toFixed(2)}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label>Amount ($) *</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="mt-1"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <select 
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="interac">Interac e-Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea 
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    className="mt-1"
                    placeholder="Add any notes about this payout"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setShowCreatePayoutModal(false);
                  setSelectedPayoutDriver(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={createPayout}
                  disabled={!payoutAmount || parseFloat(payoutAmount) <= 0}
                >
                  <DollarSign className="w-4 h-4 mr-2" />Create Payout
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Contract Template Modal */}
      <AnimatePresence>
        {showEditContractModal && contractTemplate && (
          <motion.div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-2xl bg-white rounded-xl p-6 my-8"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Edit Contract Template</h2>
                <button onClick={() => setShowEditContractModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Contract Title</Label>
                  <Input 
                    value={contractTemplate.title || ''}
                    onChange={(e) => setContractTemplate({...contractTemplate, title: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Contract Content</Label>
                  <Textarea 
                    value={contractTemplate.content || ''}
                    onChange={(e) => setContractTemplate({...contractTemplate, content: e.target.value})}
                    className="mt-1 font-mono text-sm"
                    rows={20}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use placeholders: [COMMISSION_RATE], [PAYOUT_FREQUENCY], [MIN_PAYOUT]
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditContractModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={updateContractTemplate}>
                  <Save className="w-4 h-4 mr-2" />Save Template
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trip Detail Modal */}
      <AnimatePresence>
        {showTripDetailModal && selectedTrip && (
          <motion.div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-2xl bg-white rounded-xl p-6 my-8"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Trip Details</h2>
                <button onClick={() => setShowTripDetailModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Trip Status */}
                <div className="flex items-center gap-4">
                  <Badge className={
                    selectedTrip.status === 'completed' ? 'bg-green-100 text-green-700 text-lg px-4 py-1' :
                    selectedTrip.status === 'running' ? 'bg-blue-100 text-blue-700 text-lg px-4 py-1' :
                    'bg-gray-100 text-gray-700 text-lg px-4 py-1'
                  }>{selectedTrip.status?.toUpperCase()}</Badge>
                  <span className="text-gray-500">Trip ID: {selectedTrip.id}</span>
                </div>

                {/* Driver Section */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <Car className="w-4 h-4" /> Driver Information
                  </h3>
                  {selectedTrip.driver_info ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Name</div>
                        <div className="font-medium">{selectedTrip.driver_info.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Phone</div>
                        <div className="font-medium">{selectedTrip.driver_info.phone || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Email</div>
                        <div className="font-medium">{selectedTrip.driver_info.email || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Rating</div>
                        <div className="font-medium flex items-center gap-1">
                          <span className="text-yellow-500">★</span>
                          {selectedTrip.driver_info.rating?.toFixed(1) || '5.0'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Vehicle</div>
                        <div className="font-medium">{selectedTrip.driver_info.vehicle || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">License Plate</div>
                        <div className="font-medium">{selectedTrip.driver_info.license_plate || 'N/A'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500">No driver information available</div>
                  )}
                </div>

                {/* Customer Section */}
                {selectedTrip.customer_info && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Customer Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Name</div>
                        <div className="font-medium">{selectedTrip.customer_info.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Contact</div>
                        <div className="font-medium">{selectedTrip.customer_info.phone || selectedTrip.customer_info.email || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fare Breakdown */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Fare Breakdown
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Base Fare</span>
                      <span>${selectedTrip.final_fare?.base_fare?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Distance ({selectedTrip.final_fare?.distance?.toFixed(2) || '0'} km)</span>
                      <span>${selectedTrip.final_fare?.distance_cost?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Waiting Time ({selectedTrip.final_fare?.total_waiting_minutes?.toFixed(0) || '0'} min)</span>
                      <span>${selectedTrip.final_fare?.waiting_cost?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Government Fee</span>
                      <span>${selectedTrip.final_fare?.government_fee?.toFixed(2) || '0.00'}</span>
                    </div>
                    {selectedTrip.final_fare?.tip_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tip</span>
                        <span>${selectedTrip.final_fare?.tip_amount?.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 font-bold text-lg">
                      <span>Total</span>
                      <span className="text-green-600">${selectedTrip.final_fare?.total_final?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>

                {/* Add Note Section */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Add Admin Note</h3>
                  <div className="flex gap-2">
                    <Input 
                      value={tripNote}
                      onChange={(e) => setTripNote(e.target.value)}
                      placeholder="Add a note about this trip..."
                      className="flex-1"
                    />
                    <Button onClick={addTripNote} disabled={!tripNote.trim()}>
                      <Plus className="w-4 h-4 mr-1" />Add Note
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowTripDetailModal(false)}>
                  Close
                </Button>
                <Button 
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={() => {
                    setShowTripDetailModal(false);
                    setShowComplaintModal(true);
                  }}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />File Complaint
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complaint Modal */}
      <AnimatePresence>
        {showComplaintModal && selectedTrip && (
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
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  File Complaint
                </h2>
                <button onClick={() => setShowComplaintModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Trip Info Summary */}
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <div className="text-sm text-gray-500">Trip ID: {selectedTrip.id?.slice(0, 12)}...</div>
                {selectedTrip.driver_info && (
                  <div className="font-medium">Driver: {selectedTrip.driver_info.name}</div>
                )}
                <div className="text-sm">{new Date(selectedTrip.start_time).toLocaleString()}</div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Complaint Type *</Label>
                  <select 
                    value={complaintType}
                    onChange={(e) => setComplaintType(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="service">Service Quality</option>
                    <option value="driver_behavior">Driver Behavior</option>
                    <option value="vehicle">Vehicle Condition</option>
                    <option value="billing">Billing/Fare Issue</option>
                    <option value="safety">Safety Concern</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <Label>Description *</Label>
                  <Textarea 
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                    placeholder="Please describe the issue in detail..."
                    className="mt-1"
                    rows={5}
                  />
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg text-sm">
                  <p className="font-medium text-yellow-800">Note:</p>
                  <p className="text-yellow-700">This complaint will be logged and can be reviewed in the Disputes section. The driver may be contacted for follow-up.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setShowComplaintModal(false);
                  setComplaintDescription('');
                }}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={createTripComplaint}
                  disabled={!complaintDescription.trim()}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />Submit Complaint
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Taxi Config Modal */}
      <AnimatePresence>
        {showEditConfigModal && selectedConfig && editConfigData && (
          <motion.div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-2xl bg-white rounded-xl p-6 my-8"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-blue-500" />
                  Edit Taxi Configuration
                </h2>
                <button onClick={() => {
                  setShowEditConfigModal(false);
                  setSelectedConfig(null);
                  setEditConfigData(null);
                }}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Config Info */}
              <div className="bg-blue-50 p-3 rounded-lg mb-4 flex items-center justify-between">
                <div>
                  <span className="font-medium">{selectedConfig.name}</span>
                  <Badge variant="outline" className="ml-2">v{selectedConfig.version}</Badge>
                </div>
                <Badge className={
                  selectedConfig.status === 'active' ? 'bg-green-100 text-green-700' :
                  selectedConfig.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }>{selectedConfig.status}</Badge>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input 
                      value={editConfigData.name || ''}
                      onChange={(e) => setEditConfigData({...editConfigData, name: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input 
                      value={editConfigData.description || ''}
                      onChange={(e) => setEditConfigData({...editConfigData, description: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Day Rates */}
                <div className="bg-amber-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-amber-800 mb-3">☀️ Day Rates (05:00-23:00)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm">Base Fare ($)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={editConfigData.day_base_fare || ''}
                        onChange={(e) => setEditConfigData({...editConfigData, day_base_fare: parseFloat(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Per KM ($)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={editConfigData.day_per_km_rate || ''}
                        onChange={(e) => setEditConfigData({...editConfigData, day_per_km_rate: parseFloat(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Waiting/min ($)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={editConfigData.day_waiting_per_min || ''}
                        onChange={(e) => setEditConfigData({...editConfigData, day_waiting_per_min: parseFloat(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Night Rates */}
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-indigo-800 mb-3">🌙 Night Rates (23:00-05:00)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm">Base Fare ($)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={editConfigData.night_base_fare || ''}
                        onChange={(e) => setEditConfigData({...editConfigData, night_base_fare: parseFloat(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Per KM ($)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={editConfigData.night_per_km_rate || ''}
                        onChange={(e) => setEditConfigData({...editConfigData, night_per_km_rate: parseFloat(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Waiting/min ($)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={editConfigData.night_waiting_per_min || ''}
                        onChange={(e) => setEditConfigData({...editConfigData, night_waiting_per_min: parseFloat(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Other Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Government Fee ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={editConfigData.government_fee || ''}
                      onChange={(e) => setEditConfigData({...editConfigData, government_fee: parseFloat(e.target.value)})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Speed Threshold (km/h)</Label>
                    <Input 
                      type="number"
                      value={editConfigData.speed_threshold_kmh || ''}
                      onChange={(e) => setEditConfigData({...editConfigData, speed_threshold_kmh: parseInt(e.target.value)})}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Below this speed, waiting time charges apply</p>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-yellow-50 p-3 rounded-lg text-sm">
                  <p className="font-medium text-yellow-800">⚠️ Important:</p>
                  <p className="text-yellow-700">After making changes, remember to <strong>Lock</strong> the configuration to prevent further modifications. Only locked configurations are audit-compliant.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setShowEditConfigModal(false);
                  setSelectedConfig(null);
                  setEditConfigData(null);
                }}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={updateTaxiConfig}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
