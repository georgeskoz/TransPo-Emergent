import { useRef, useEffect } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X } from "lucide-react";

export default function BottomSheet({ 
  isOpen, 
  onClose, 
  children, 
  title = null,
  showHandle = true,
  fullHeight = false,
  snapPoints = [0.5, 0.9]
}) {
  const sheetRef = useRef(null);
  const dragControls = useDragControls();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="bottom-sheet-backdrop"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className={`bottom-sheet-container ${fullHeight ? "full-height" : ""}`}
          >
            {/* Handle */}
            {showHandle && (
              <div 
                className="bottom-sheet-handle-area"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="bottom-sheet-handle" />
              </div>
            )}

            {/* Header */}
            {title && (
              <div className="bottom-sheet-header">
                <h2 className="bottom-sheet-title">{title}</h2>
                <button onClick={onClose} className="bottom-sheet-close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="bottom-sheet-content">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
