import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Clock, Wallet, User, DollarSign, TrendingUp } from "lucide-react";
import { useAuthStore } from "../../store";

// User Navigation Items
const USER_NAV_ITEMS = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/trips", label: "Trips", icon: Clock },
  { path: "/wallet", label: "Wallet", icon: Wallet },
  { path: "/profile", label: "Profile", icon: User },
];

// Driver Navigation Items
const DRIVER_NAV_ITEMS = [
  { path: "/driver", label: "Home", icon: Home },
  { path: "/driver/earnings", label: "Earnings", icon: DollarSign },
  { path: "/driver/trips", label: "Trips", icon: Clock },
  { path: "/driver/profile", label: "Profile", icon: User },
];

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const isDriver = user?.role === "driver";
  const navItems = isDriver ? DRIVER_NAV_ITEMS : USER_NAV_ITEMS;
  
  // Don't show on auth pages, landing, or admin
  const hiddenPaths = ["/", "/auth", "/admin", "/forgot-password", "/reset-password"];
  if (hiddenPaths.some(p => location.pathname === p || location.pathname.startsWith("/admin"))) {
    return null;
  }

  return (
    <nav className="mobile-nav-container">
      <div className="mobile-nav-inner">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== "/dashboard" && item.path !== "/driver" && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`mobile-nav-item ${isActive ? "active" : ""}`}
            >
              <div className="mobile-nav-icon-wrapper">
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="mobile-nav-active-bg"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon className={`mobile-nav-icon ${isActive ? "active" : ""}`} />
              </div>
              <span className={`mobile-nav-label ${isActive ? "active" : ""}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Safe area spacer for iOS */}
      <div className="mobile-nav-safe-area" />
    </nav>
  );
}
