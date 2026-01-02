import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function SwipeAction({ 
  children, 
  onSwipeLeft = null,
  onSwipeRight = null,
  leftAction = null,  // { icon, color, label }
  rightAction = null, // { icon, color, label }
  threshold = 100
}) {
  const x = useMotionValue(0);
  const [isSwipedLeft, setIsSwipedLeft] = useState(false);
  const [isSwipedRight, setIsSwipedRight] = useState(false);
  
  const leftOpacity = useTransform(x, [-threshold, -threshold/2, 0], [1, 0.5, 0]);
  const rightOpacity = useTransform(x, [0, threshold/2, threshold], [0, 0.5, 1]);
  const leftScale = useTransform(x, [-threshold, -threshold/2, 0], [1, 0.8, 0.5]);
  const rightScale = useTransform(x, [0, threshold/2, threshold], [0.5, 0.8, 1]);

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -threshold && onSwipeLeft) {
      setIsSwipedLeft(true);
      onSwipeLeft();
      setTimeout(() => setIsSwipedLeft(false), 300);
    } else if (info.offset.x > threshold && onSwipeRight) {
      setIsSwipedRight(true);
      onSwipeRight();
      setTimeout(() => setIsSwipedRight(false), 300);
    }
  };

  return (
    <div className="swipe-action-container">
      {/* Left action (revealed on swipe right) */}
      {rightAction && (
        <motion.div 
          className="swipe-action-bg right"
          style={{ 
            opacity: rightOpacity, 
            scale: rightScale,
            backgroundColor: rightAction.color || "#10B981" 
          }}
        >
          {rightAction.icon}
          {rightAction.label && <span>{rightAction.label}</span>}
        </motion.div>
      )}

      {/* Right action (revealed on swipe left) */}
      {leftAction && (
        <motion.div 
          className="swipe-action-bg left"
          style={{ 
            opacity: leftOpacity, 
            scale: leftScale,
            backgroundColor: leftAction.color || "#EF4444" 
          }}
        >
          {leftAction.icon}
          {leftAction.label && <span>{leftAction.label}</span>}
        </motion.div>
      )}

      {/* Main content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: leftAction ? -threshold : 0, right: rightAction ? threshold : 0 }}
        dragElastic={0.1}
        style={{ x }}
        onDragEnd={handleDragEnd}
        animate={{ x: isSwipedLeft ? -threshold : isSwipedRight ? threshold : 0 }}
        className="swipe-action-content"
      >
        {children}
      </motion.div>
    </div>
  );
}
