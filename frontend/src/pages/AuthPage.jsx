import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { Zap, ArrowLeft, User, Car, Shield } from "lucide-react";

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') || 'user';
  
  const { login, register, isLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState("login");
  const [role, setRole] = useState(defaultRole);
  
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ 
    name: "", email: "", password: "", phone: "" 
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(loginForm.email, loginForm.password);
      toast.success("Welcome back!");
      navigate(role === 'driver' ? '/driver' : role === 'admin' ? '/admin' : '/dashboard');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await register(
        registerForm.name, 
        registerForm.email, 
        registerForm.password, 
        registerForm.phone,
        role
      );
      toast.success("Account created successfully!");
      navigate(role === 'driver' ? '/driver' : '/dashboard');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const roles = [
    { id: 'user', label: 'Rider', icon: User, desc: 'Book rides & deliveries' },
    { id: 'driver', label: 'Driver', icon: Car, desc: 'Earn money driving' },
    { id: 'admin', label: 'Admin', icon: Shield, desc: 'Manage platform' },
  ];

  return (
    <div className="min-h-screen bg-noir-700 flex items-center justify-center p-6">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-glow opacity-50" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6 text-noir-100 hover:text-white"
          data-testid="back-to-home-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-cyan flex items-center justify-center">
            <Zap className="w-6 h-6 text-black" />
          </div>
          <span className="font-heading text-xl font-bold text-white">Transpo</span>
        </div>

        <Card className="bg-noir-600 border-noir-300">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-white">
              {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 bg-noir-500 mb-6">
                <TabsTrigger 
                  value="login" 
                  className="data-[state=active]:bg-cyan data-[state=active]:text-black"
                  data-testid="login-tab"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register"
                  className="data-[state=active]:bg-cyan data-[state=active]:text-black"
                  data-testid="register-tab"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Role Selection for Registration */}
              {activeTab === 'register' && (
                <div className="mb-6">
                  <Label className="text-noir-100 mb-3 block">I want to...</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {roles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          role === r.id 
                            ? 'border-cyan bg-cyan/10' 
                            : 'border-noir-300 hover:border-noir-200'
                        }`}
                        data-testid={`role-${r.id}-btn`}
                      >
                        <r.icon className={`w-5 h-5 mx-auto mb-1 ${role === r.id ? 'text-cyan' : 'text-noir-100'}`} />
                        <div className={`text-sm font-medium ${role === r.id ? 'text-white' : 'text-noir-100'}`}>
                          {r.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-noir-100">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="bg-noir-500 border-noir-300 text-white"
                      data-testid="login-email-input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-noir-100">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="bg-noir-500 border-noir-300 text-white"
                      data-testid="login-password-input"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full btn-primary rounded-lg"
                    disabled={isLoading}
                    data-testid="login-submit-btn"
                  >
                    {isLoading ? <div className="spinner" /> : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-noir-100">Full Name</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="John Doe"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="bg-noir-500 border-noir-300 text-white"
                      data-testid="register-name-input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-noir-100">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="bg-noir-500 border-noir-300 text-white"
                      data-testid="register-email-input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-phone" className="text-noir-100">Phone (optional)</Label>
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="+1 514 555 0123"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      className="bg-noir-500 border-noir-300 text-white"
                      data-testid="register-phone-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-noir-100">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="bg-noir-500 border-noir-300 text-white"
                      data-testid="register-password-input"
                      required
                      minLength={6}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full btn-primary rounded-lg"
                    disabled={isLoading}
                    data-testid="register-submit-btn"
                  >
                    {isLoading ? <div className="spinner" /> : `Create ${role === 'driver' ? 'Driver' : role === 'admin' ? 'Admin' : 'Rider'} Account`}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Demo Credentials */}
            <div className="mt-6 p-4 rounded-lg bg-noir-500 border border-noir-300">
              <div className="text-xs text-noir-100 mb-2">Demo Accounts:</div>
              <div className="space-y-1 text-xs font-mono text-noir-100">
                <div>User: user@demo.com / demo123</div>
                <div>Driver: driver@demo.com / demo123</div>
                <div>Admin: admin@demo.com / demo123</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
