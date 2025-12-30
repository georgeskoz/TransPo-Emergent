import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  Users, Car, ShoppingBag, DollarSign, TrendingUp, LogOut,
  Zap, MapPin, Clock, CheckCircle, XCircle, AlertCircle
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout, getAuthHeaders } = useAuthStore();
  
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadAdminData = async () => {
    try {
      const [statsRes, usersRes, driversRes, bookingsRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/users`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/drivers`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/bookings`, { headers: getAuthHeaders() })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers((await usersRes.json()).users || []);
      if (driversRes.ok) setDrivers((await driversRes.json()).drivers || []);
      if (bookingsRes.ok) setBookings((await bookingsRes.json()).bookings || []);
    } catch (e) {
      console.log('Error loading admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'in_progress': return 'bg-cyan/20 text-cyan';
      case 'accepted': return 'bg-blue-500/20 text-blue-400';
      case 'pending': return 'bg-yellow/20 text-yellow';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-noir-300 text-noir-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-700 flex items-center justify-center">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-700">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-heading text-lg font-bold text-white">Transpo Admin</span>
              <div className="text-xs text-noir-100">{user?.name}</div>
            </div>
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
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <Card className="bg-noir-600 border-noir-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-cyan" />
                <Badge className="bg-cyan/20 text-cyan text-xs">Users</Badge>
              </div>
              <div className="font-heading text-3xl font-bold text-white">
                {stats?.users?.total || 0}
              </div>
              <div className="text-xs text-noir-100">Registered users</div>
            </CardContent>
          </Card>

          <Card className="bg-noir-600 border-noir-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Car className="w-5 h-5 text-yellow" />
                <Badge className="bg-green-500/20 text-green-400 text-xs">
                  {stats?.drivers?.online || 0} online
                </Badge>
              </div>
              <div className="font-heading text-3xl font-bold text-white">
                {stats?.drivers?.total || 0}
              </div>
              <div className="text-xs text-noir-100">Total drivers</div>
            </CardContent>
          </Card>

          <Card className="bg-noir-600 border-noir-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingBag className="w-5 h-5 text-pink" />
                <Badge className="bg-pink/20 text-pink text-xs">
                  {stats?.bookings?.active || 0} active
                </Badge>
              </div>
              <div className="font-heading text-3xl font-bold text-white">
                {stats?.bookings?.total || 0}
              </div>
              <div className="text-xs text-noir-100">Total bookings</div>
            </CardContent>
          </Card>

          <Card className="bg-noir-600 border-noir-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div className="font-heading text-3xl font-bold text-white">
                ${stats?.revenue?.platform?.toFixed(0) || 0}
              </div>
              <div className="text-xs text-noir-100">Platform revenue (20%)</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-noir-600 mb-6">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-cyan data-[state=active]:text-black"
              data-testid="overview-tab"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="data-[state=active]:bg-cyan data-[state=active]:text-black"
              data-testid="users-tab"
            >
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger 
              value="drivers"
              className="data-[state=active]:bg-cyan data-[state=active]:text-black"
              data-testid="drivers-tab"
            >
              Drivers ({drivers.length})
            </TabsTrigger>
            <TabsTrigger 
              value="bookings"
              className="data-[state=active]:bg-cyan data-[state=active]:text-black"
              data-testid="bookings-tab"
            >
              Bookings ({bookings.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Bookings */}
              <Card className="bg-noir-600 border-noir-300">
                <CardHeader>
                  <CardTitle className="font-heading text-lg text-white">Recent Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {bookings.slice(0, 5).map((booking) => (
                      <div 
                        key={booking.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-noir-500"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            booking.status === 'completed' ? 'bg-green-500' :
                            booking.status === 'pending' ? 'bg-yellow' :
                            'bg-cyan'
                          }`} />
                          <div>
                            <div className="text-sm text-white">{booking.user_name}</div>
                            <div className="text-xs text-noir-100 truncate max-w-[150px]">
                              {booking.pickup?.address}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-cyan">
                            ${booking.fare?.total?.toFixed(2)}
                          </div>
                          <Badge className={`text-xs ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {bookings.length === 0 && (
                      <div className="text-center py-8 text-noir-100">No bookings yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Online Drivers */}
              <Card className="bg-noir-600 border-noir-300">
                <CardHeader>
                  <CardTitle className="font-heading text-lg text-white">Online Drivers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {drivers.filter(d => d.status === 'online').slice(0, 5).map((driver) => (
                      <div 
                        key={driver.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-noir-500"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan/20 flex items-center justify-center">
                            <Car className="w-4 h-4 text-cyan" />
                          </div>
                          <div>
                            <div className="text-sm text-white">{driver.name}</div>
                            <div className="text-xs text-noir-100">
                              {driver.vehicle_make} {driver.vehicle_model}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-yellow flex items-center gap-1">
                            ★ {driver.rating?.toFixed(1)}
                          </div>
                          <div className="text-xs text-noir-100">
                            {driver.total_rides} rides
                          </div>
                        </div>
                      </div>
                    ))}
                    {drivers.filter(d => d.status === 'online').length === 0 && (
                      <div className="text-center py-8 text-noir-100">No drivers online</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="bg-noir-600 border-noir-300">
              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-noir-300">
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-noir-400 hover:bg-noir-500/50">
                          <td className="py-3 px-4 text-sm text-white">{u.name}</td>
                          <td className="py-3 px-4 text-sm text-noir-100">{u.email}</td>
                          <td className="py-3 px-4">
                            <Badge className={`text-xs ${
                              u.role === 'admin' ? 'bg-pink/20 text-pink' :
                              u.role === 'driver' ? 'bg-yellow/20 text-yellow' :
                              'bg-cyan/20 text-cyan'
                            }`}>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-noir-100">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers">
            <Card className="bg-noir-600 border-noir-300">
              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-noir-300">
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Driver</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Vehicle</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Rating</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Rides</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((d) => (
                        <tr key={d.id} className="border-b border-noir-400 hover:bg-noir-500/50">
                          <td className="py-3 px-4">
                            <div className="text-sm text-white">{d.name}</div>
                            <div className="text-xs text-noir-100">{d.email}</div>
                          </td>
                          <td className="py-3 px-4 text-sm text-noir-100">
                            {d.vehicle_make ? `${d.vehicle_color} ${d.vehicle_make} ${d.vehicle_model}` : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'status-online' : 'status-offline'}`} />
                              <span className="text-sm text-noir-100 capitalize">{d.status}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-yellow">★ {d.rating?.toFixed(1)}</td>
                          <td className="py-3 px-4 text-sm text-white">{d.total_rides}</td>
                          <td className="py-3 px-4 text-sm font-mono text-cyan">${d.earnings_total?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <Card className="bg-noir-600 border-noir-300">
              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-noir-300">
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">User</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Route</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Driver</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Fare</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-noir-100">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id} className="border-b border-noir-400 hover:bg-noir-500/50">
                          <td className="py-3 px-4 text-sm text-white">{b.user_name}</td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-noir-100 max-w-[200px] truncate">
                              {b.pickup?.address} → {b.dropoff?.address}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-noir-100">{b.driver_name || '-'}</td>
                          <td className="py-3 px-4">
                            <Badge className={`text-xs ${getStatusColor(b.status)}`}>
                              {b.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm font-mono text-cyan">${b.fare?.total?.toFixed(2)}</td>
                          <td className="py-3 px-4 text-sm text-noir-100">
                            {new Date(b.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
