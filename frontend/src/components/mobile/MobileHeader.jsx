import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";

export default function MobileHeader({ 
  title, 
  showBack = false, 
  showNotifications = false,
  showMenu = false,
  rightAction = null,
  transparent = false,
  onMenuClick = null
}) {
  const navigate = useNavigate();

  return (
    <header className={`mobile-header ${transparent ? "transparent" : ""}`}>
      <div className="mobile-header-inner">
        {/* Left side */}
        <div className="mobile-header-left">
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(-1)}
              className="mobile-header-btn"
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>
          )}
        </div>

        {/* Title */}
        <h1 className="mobile-header-title">{title}</h1>

        {/* Right side */}
        <div className="mobile-header-right">
          {showNotifications && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="mobile-header-btn"
            >
              <Bell className="w-5 h-5" />
              <span className="mobile-header-badge">2</span>
            </motion.button>
          )}
          {showMenu && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onMenuClick}
              className="mobile-header-btn"
            >
              <MoreVertical className="w-5 h-5" />
            </motion.button>
          )}
          {rightAction}
        </div>
      </div>
    </header>
  );
}
