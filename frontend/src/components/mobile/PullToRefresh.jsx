import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { RefreshCw } from "lucide-react";

export default function PullToRefresh({ onRefresh, children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const y = useMotionValue(0);
  const pullProgress = useTransform(y, [0, 80], [0, 1]);
  const rotate = useTransform(y, [0, 80], [0, 360]);
  const opacity = useTransform(y, [0, 40, 80], [0, 0.5, 1]);

  const handleDragEnd = async () => {
    if (y.get() >= 80 && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div ref={containerRef} className="pull-to-refresh-container">
      {/* Pull indicator */}
      <motion.div 
        className="pull-to-refresh-indicator"
        style={{ opacity, y: useTransform(y, [0, 80], [-40, 20]) }}
      >
        <motion.div style={{ rotate }}>
          <RefreshCw className={`w-6 h-6 text-gray-400 ${isRefreshing ? "animate-spin" : ""}`} />
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div
        drag={isRefreshing ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.5, bottom: 0 }}
        style={{ y }}
        onDragEnd={handleDragEnd}
        className="pull-to-refresh-content"
      >
        {children}
      </motion.div>
    </div>
  );
}
