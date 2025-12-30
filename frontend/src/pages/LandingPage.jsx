import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "../store";
import { 
  Car, Package, UtensilsCrossed, MapPin, Clock, Shield, 
  ChevronRight, Star, Zap, Users, ArrowRight
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    // Seed demo drivers and fetch them
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
    <div className="min-h-screen bg-noir-700 overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-cyan flex items-center justify-center">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <span className="font-heading text-xl font-bold text-white">SwiftMove</span>
          </div>
          
          <div className="glass-strong rounded-full px-6 py-2 hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm text-noir-100 hover:text-white transition-colors">Services</a>
            <a href="#features" className="text-sm text-noir-100 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-noir-100 hover:text-white transition-colors">Pricing</a>
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
                  className="text-white hover:text-cyan"
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
      <section className="relative min-h-screen flex items-center pt-20">
        {/* Background */}
        <div className="absolute inset-0 bg-hero-glow" />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1679294176201-f9b302961f42?w=1920&q=80)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-noir-700/80 via-noir-700/90 to-noir-700" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm">
              <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
              <span className="text-noir-100">{drivers.length} drivers online in Montreal</span>
            </div>

            <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
              <span className="text-white">Move </span>
              <span className="neon-cyan">Faster.</span>
              <br />
              <span className="text-white">Pay </span>
              <span className="neon-pink">Smarter.</span>
            </h1>

            <p className="text-lg text-noir-100 max-w-lg">
              One platform for all your mobility needs. Taxi rides, courier deliveries, 
              and food delivery - with transparent pricing and real-time tracking.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={handleGetStarted}
                className="btn-primary rounded-none px-8 py-6 text-lg group"
                data-testid="hero-get-started-btn"
              >
                Book a Ride
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/auth?role=driver')}
                className="btn-secondary rounded-none px-8 py-6 text-lg"
                data-testid="become-driver-btn"
              >
                Become a Driver
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-12 pt-8 border-t border-noir-300">
              <div>
                <div className="font-heading text-3xl font-bold text-white">50K+</div>
                <div className="text-sm text-noir-100">Happy Riders</div>
              </div>
              <div>
                <div className="font-heading text-3xl font-bold text-white">2.5K</div>
                <div className="text-sm text-noir-100">Active Drivers</div>
              </div>
              <div>
                <div className="font-heading text-3xl font-bold text-white">4.9</div>
                <div className="text-sm text-noir-100 flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow fill-yellow" />
                  Rating
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right - Map Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative rounded-2xl overflow-hidden border border-noir-300 shadow-2xl">
              <div className="aspect-square map-placeholder relative">
                {/* Mock map with drivers */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-full h-full">
                    {/* Grid lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-20">
                      <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00F0FF" strokeWidth="0.5"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                    
                    {/* Driver markers */}
                    {drivers.slice(0, 8).map((driver, i) => {
                      const x = 20 + (i % 4) * 20 + Math.random() * 10;
                      const y = 20 + Math.floor(i / 4) * 30 + Math.random() * 10;
                      return (
                        <motion.div
                          key={driver.id}
                          className="absolute driver-marker"
                          style={{ left: `${x}%`, top: `${y}%` }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                        >
                          <Car className="w-4 h-4 text-noir-700" />
                        </motion.div>
                      );
                    })}

                    {/* User location */}
                    <motion.div 
                      className="absolute user-marker"
                      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 }}
                    />
                    
                    {/* Center label */}
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-8 text-center">
                      <div className="glass-strong px-4 py-2 rounded-lg">
                        <div className="text-sm font-medium text-white">Downtown Montreal</div>
                        <div className="text-xs text-noir-100">{drivers.length} drivers nearby</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating card */}
            <motion.div 
              className="absolute -bottom-6 -left-6 glass-strong p-4 rounded-xl shadow-xl max-w-xs"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-cyan/20 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-cyan" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Avg. Pickup Time</div>
                  <div className="text-2xl font-heading font-bold neon-cyan">3 min</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
              Three Services, One Platform
            </h2>
            <p className="text-noir-100 text-lg max-w-2xl mx-auto">
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
              <Card className="bg-noir-600 border-noir-300 overflow-hidden card-hover group h-full">
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1642331395578-62fc20996c2a?w=600&q=80"
                    alt="Taxi service"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-noir-600 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan/20 backdrop-blur flex items-center justify-center">
                      <Car className="w-6 h-6 text-cyan" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="font-heading text-2xl font-bold text-white mb-2">Taxi Rides</h3>
                  <p className="text-noir-100 mb-4">
                    Book instant or scheduled rides with professional drivers. Real-time tracking and transparent pricing.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan" />
                      Instant fare comparison
                    </li>
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan" />
                      Live GPS tracking
                    </li>
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan" />
                      Cashless payments
                    </li>
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
              <Card className="bg-noir-600 border-noir-300 overflow-hidden card-hover group h-full">
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1762185225299-fc4f3db82372?w=600&q=80"
                    alt="Courier service"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-noir-600 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow/20 backdrop-blur flex items-center justify-center">
                      <Package className="w-6 h-6 text-yellow" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="font-heading text-2xl font-bold text-white mb-2">Courier Delivery</h3>
                  <p className="text-noir-100 mb-4">
                    24/7 on-demand package delivery. Send anything across the city with real-time tracking.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow" />
                      Same-day delivery
                    </li>
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow" />
                      Shared delivery discounts
                    </li>
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow" />
                      Package insurance
                    </li>
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
              <Card className="bg-noir-600 border-noir-300 overflow-hidden card-hover group h-full">
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1603508102983-99b101395d1a?w=600&q=80"
                    alt="Food delivery"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-noir-600 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <div className="w-12 h-12 rounded-xl bg-pink/20 backdrop-blur flex items-center justify-center">
                      <UtensilsCrossed className="w-6 h-6 text-pink" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="font-heading text-2xl font-bold text-white mb-2">Food Delivery</h3>
                  <p className="text-noir-100 mb-4">
                    Order from your favorite restaurants. Fast delivery with multiple payment options.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink" />
                      500+ restaurants
                    </li>
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink" />
                      Live order tracking
                    </li>
                    <li className="flex items-center gap-2 text-noir-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink" />
                      No hidden fees
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-noir-600/50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose SwiftMove?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: MapPin, title: "Real-Time Tracking", desc: "Track your ride or delivery live on the map", color: "cyan" },
              { icon: Shield, title: "Transparent Pricing", desc: "See full fare breakdown with Quebec taxes", color: "pink" },
              { icon: Users, title: "Verified Drivers", desc: "All drivers are background-checked", color: "yellow" },
              { icon: Zap, title: "Fast Matching", desc: "Smart algorithm for quick driver assignment", color: "cyan" },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-noir-600 border-noir-300 p-6 h-full card-hover">
                  <div className={`w-12 h-12 rounded-xl bg-${feature.color}/20 flex items-center justify-center mb-4`}>
                    <feature.icon className={`w-6 h-6 text-${feature.color}`} />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-noir-100 text-sm">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing/Fare Comparison Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
              Transparent Fare Breakdown
            </h2>
            <p className="text-noir-100 text-lg max-w-2xl mx-auto">
              See exactly what you pay - no hidden fees. Quebec taxes included.
            </p>
          </motion.div>

          <motion.div
            className="max-w-lg mx-auto"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Card className="bg-noir-600 border-noir-300 p-8">
              <div className="text-center mb-6">
                <div className="text-sm text-noir-100 mb-1">Example 10km trip (~15 min)</div>
                <div className="font-heading text-5xl font-bold text-white">$24.65</div>
              </div>
              
              <div className="space-y-3 border-t border-noir-300 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-noir-100">Base Fare</span>
                  <span className="text-white font-mono">$3.50</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-noir-100">Distance (10km × $1.75)</span>
                  <span className="text-white font-mono">$17.50</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-noir-100">Time (15min × $0.65)</span>
                  <span className="text-white font-mono">$0.98</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-noir-100">Quebec Transport Fee</span>
                  <span className="text-white font-mono">$0.90</span>
                </div>
                <div className="flex justify-between text-sm border-t border-noir-300 pt-3">
                  <span className="text-noir-100">GST (5%)</span>
                  <span className="text-white font-mono">$1.14</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-noir-100">QST (9.975%)</span>
                  <span className="text-white font-mono">$0.63</span>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-cyan/10 border border-cyan/30">
                <div className="flex items-center gap-2 text-cyan text-sm">
                  <Star className="w-4 h-4" />
                  <span>Compare with market: UberX ~$22.50 | Lyft ~$23.80</span>
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
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Move?
            </h2>
            <p className="text-noir-100 text-lg mb-8">
              Join thousands of riders and drivers on SwiftMove
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button 
                onClick={handleGetStarted}
                className="btn-primary rounded-none px-10 py-6 text-lg"
                data-testid="cta-get-started-btn"
              >
                Get Started Free
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-noir-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <span className="font-heading text-lg font-bold text-white">SwiftMove</span>
          </div>
          <p className="text-noir-100 text-sm">
            © 2024 SwiftMove. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
