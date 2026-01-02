import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, MapPin } from "lucide-react";

export default function MobileInput({
  value,
  onChange,
  placeholder,
  icon: Icon = null,
  type = "text",
  onFocus = null,
  onClear = null,
  suggestions = [],
  onSuggestionSelect = null,
  showClear = true,
  className = ""
}) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    // Delay to allow suggestion click
    setTimeout(() => setIsFocused(false), 200);
  };

  const handleClear = () => {
    onChange("");
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <div className={`mobile-input-wrapper ${className}`}>
      <div className={`mobile-input-container ${isFocused ? "focused" : ""}`}>
        {Icon && (
          <Icon className="mobile-input-icon" />
        )}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="mobile-input"
        />
        {showClear && value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleClear}
            className="mobile-input-clear"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {isFocused && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mobile-input-suggestions"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionSelect?.(suggestion)}
                className="mobile-input-suggestion"
              >
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">{suggestion.address || suggestion}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
