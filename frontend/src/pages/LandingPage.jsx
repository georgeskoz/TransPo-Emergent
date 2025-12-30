import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "../store";
import { 
  Car, Package, UtensilsCrossed, MapPin, Clock, Shield, 
  ChevronRight, Star, Zap, Users, ArrowRight, Check
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    const initDrivers = async () => {
      try {
        await fetch(`${API_URL}/seed/drivers`, { method: 'POST' });
        const res = await fetch(`${API_URL}/map/drivers?lat=45.5017&lng=-73.5673&radius=10`);
        const data = await res.json();
        setDrivers(data.drivers || []);
      } catch (e) {
        console.log('Error loading drivers:', e);
      }
    };
    initDrivers();
  }, []);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (user?.role === 'driver') navigate('/driver');
      else if (user?.role === 'admin') navigate('/admin');
      else navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Transpo</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Services</a>
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button 
                onClick={handleGetStarted}
                className="btn-primary rounded-full px-6"
                data-testid="dashboard-btn"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/auth')}
                  className="text-gray-600 hover:text-gray-900"
                  data-testid="login-btn"
                >
                  Sign In
                </Button>
                <Button 
                  onClick={() => navigate('/auth')}
                  className="btn-primary rounded-full px-6"
                  data-testid="get-started-btn"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-700">{drivers.length} drivers online in Montreal</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-gray-900">
              Get there.
              <br />
              <span className="text-gray-400">Your way.</span>
            </h1>

            <p className="text-lg text-gray-600 max-w-lg">
              One platform for all your mobility needs. Taxi rides, courier deliveries, 
              and food delivery — with transparent pricing.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={handleGetStarted}
                className="btn-primary rounded-xl px-8 py-6 text-lg group"
                data-testid="hero-get-started-btn"
              >
                Book a Ride
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/auth?role=driver')}
                className="btn-secondary rounded-xl px-8 py-6 text-lg"
                data-testid="become-driver-btn"
              >
                Become a Driver
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-12 pt-8 border-t border-gray-200">
              <div>
                <div className="text-3xl font-bold text-gray-900">50K+</div>
                <div className="text-sm text-gray-500">Happy Riders</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">2.5K</div>
                <div className="text-sm text-gray-500">Active Drivers</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900 flex items-center gap-1">
                  4.9
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                </div>
                <div className="text-sm text-gray-500">Rating</div>
              </div>
            </div>
          </motion.div>

          {/* Right - App Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative bg-gray-100 rounded-3xl p-8 overflow-hidden">
              {/* Mock Phone Frame */}
              <div className="bg-white rounded-[40px] shadow-2xl p-4 max-w-[320px] mx-auto">
                <div className="bg-gray-50 rounded-[32px] overflow-hidden">
                  {/* Status bar */}
                  <div className="bg-white px-6 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">9:41</span>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-2 bg-gray-800 rounded-sm" />
                    </div>
                  </div>
                  
                  {/* Map area */}
                  <div className="h-48 bg-gray-200 relative">
                    <div className="absolute inset-0 map-container opacity-50" />
                    {drivers.slice(0, 5).map((driver, i) => (
                      <motion.div
                        key={driver.id}
                        className="absolute w-3 h-3 bg-gray-800 rounded-full"
                        style={{
                          left: `${20 + (i % 3) * 25}%`,
                          top: `${20 + Math.floor(i / 3) * 30}%`
                        }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                      />
                    ))}
                  </div>
                  
                  {/* Bottom panel */}
                  <div className="bg-white p-4 space-y-3">
                    <div className="text-lg font-semibold text-gray-900">Where to?</div>
                    <div className="bg-gray-100 rounded-xl p-4 flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-400">Enter destination</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-gray-100 rounded-xl p-3 text-center">
                        <Car className="w-5 h-5 mx-auto mb-1 text-gray-600" />
                        <span className="text-xs text-gray-600">Ride</span>
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-xl p-3 text-center">
                        <Package className="w-5 h-5 mx-auto mb-1 text-gray-600" />
                        <span className="text-xs text-gray-600">Package</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating card */}
            <motion.div 
              className="absolute -bottom-4 -left-4 bg-white p-4 rounded-2xl shadow-xl"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Avg. Pickup</div>
                  <div className="text-2xl font-bold text-gray-900">3 min</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Three Services, One App
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Everything you need to move people and packages across the city
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Taxi Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white border-gray-200 overflow-hidden card-hover h-full">
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  <img 
                    src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80"
                    alt="Taxi service"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4">
                    <div className="w-12 h-12 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
                      <Car className="w-6 h-6 text-gray-800" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Taxi Rides</h3>
                  <p className="text-gray-600 mb-4">
                    Book instant rides with professional drivers. Real-time tracking and transparent pricing.
                  </p>
                  <ul className="space-y-2 text-sm">
                    {['Instant fare comparison', 'Live GPS tracking', 'Cashless payments'].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-gray-600">
                        <Check className="w-4 h-4 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* Courier Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white border-gray-200 overflow-hidden card-hover h-full">
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  <img 
                    src="https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&q=80"
                    alt="Courier service"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4">
                    <div className="w-12 h-12 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
                      <Package className="w-6 h-6 text-gray-800" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Courier Delivery</h3>
                  <p className="text-gray-600 mb-4">
                    24/7 on-demand package delivery. Send anything across the city with real-time tracking.
                  </p>
                  <ul className="space-y-2 text-sm">
                    {['Same-day delivery', 'Shared delivery discounts', 'Package insurance'].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-gray-600">
                        <Check className="w-4 h-4 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* Food Delivery Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white border-gray-200 overflow-hidden card-hover h-full">
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  <img 
                    src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80"
                    alt="Food delivery"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4">
                    <div className="w-12 h-12 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
                      <UtensilsCrossed className="w-6 h-6 text-gray-800" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Food Delivery</h3>
                  <p className="text-gray-600 mb-4">
                    Order from your favorite restaurants. Fast delivery with multiple payment options.
                  </p>
                  <ul className="space-y-2 text-sm">
                    {['500+ restaurants', 'Live order tracking', 'No hidden fees'].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-gray-600">
                        <Check className="w-4 h-4 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Why Choose Transpo?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: MapPin, title: "Real-Time Tracking", desc: "Track your ride or delivery live on the map" },
              { icon: Shield, title: "Transparent Pricing", desc: "See full fare breakdown with Quebec taxes" },
              { icon: Users, title: "Verified Drivers", desc: "All drivers are background-checked" },
              { icon: Zap, title: "Fast Matching", desc: "Smart algorithm for quick driver assignment" },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-white border-gray-200 p-6 h-full card-hover shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-gray-700" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>{feature.title}</h3>
                  <p className="text-sm" style={{ color: '#4B5563' }}>{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Transparent Pricing
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              See exactly what you pay — no hidden fees. Quebec taxes included.
            </p>
          </motion.div>

          <motion.div
            className="max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Card className="bg-white border-gray-200 p-8">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500 mb-1">Example 10km trip (~15 min)</div>
                <div className="text-5xl font-bold text-gray-900">$24.65</div>
              </div>
              
              <div className="space-y-3 border-t border-gray-200 pt-6">
                {[
                  { label: 'Base Fare', value: '$3.50' },
                  { label: 'Distance (10km × $1.75)', value: '$17.50' },
                  { label: 'Time (15min × $0.65)', value: '$0.98' },
                  { label: 'Quebec Transport Fee', value: '$0.90' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="text-gray-900 font-mono">{item.value}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (5%)</span>
                    <span className="text-gray-900 font-mono">$1.14</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">QST (9.975%)</span>
                    <span className="text-gray-900 font-mono">$0.63</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <Check className="w-4 h-4" />
                  <span>Compare: UberX ~$22.50 | Lyft ~$23.80</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Ready to Ride?
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Join thousands of riders and drivers on Transpo
            </p>
            <Button 
              onClick={handleGetStarted}
              className="btn-primary rounded-xl px-10 py-6 text-lg"
              data-testid="cta-get-started-btn"
            >
              Get Started Free
              <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Transpo</span>
          </div>
          <p className="text-gray-500 text-sm">
            © 2024 Transpo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
