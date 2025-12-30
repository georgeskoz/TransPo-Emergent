/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))"
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))"
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))"
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))"
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))"
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))"
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))"
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                // Neon Noir custom colors
                cyan: {
                    DEFAULT: "#00F0FF",
                    dark: "#00B8C4"
                },
                pink: {
                    DEFAULT: "#FF0099",
                    dark: "#CC007A"
                },
                yellow: {
                    DEFAULT: "#FAFF00",
                    dark: "#C8CC00"
                },
                noir: {
                    50: "#EDEDED",
                    100: "#A1A1AA",
                    200: "#52525B",
                    300: "#27272A",
                    400: "#18181B",
                    500: "#121212",
                    600: "#0A0A0A",
                    700: "#050505",
                    800: "#030303",
                    900: "#000000"
                }
            },
            fontFamily: {
                sans: ["Manrope", "sans-serif"],
                heading: ["Unbounded", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"]
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)"
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" }
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" }
                },
                "pulse-glow": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.5" }
                },
                "float": {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" }
                }
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "pulse-glow": "pulse-glow 2s ease-in-out infinite",
                "float": "float 3s ease-in-out infinite"
            },
            backgroundImage: {
                "hero-glow": "radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.15) 0%, rgba(5, 5, 5, 0) 70%)",
                "grid-pattern": "linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)"
            }
        }
    },
    plugins: [require("tailwindcss-animate")]
};
