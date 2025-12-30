import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user, token) => set({ user, token, isAuthenticated: !!user }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Login failed');
          set({ user: data.user, token: data.access_token, isAuthenticated: true, isLoading: false });
          return data;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      register: async (name, email, password, phone, role = 'user') => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, phone, role }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Registration failed');
          set({ user: data.user, token: data.access_token, isAuthenticated: true, isLoading: false });
          return data;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      getAuthHeaders: () => {
        const token = get().token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export const useBookingStore = create((set) => ({
  currentBooking: null,
  bookings: [],
  fareEstimate: null,
  isLoading: false,

  setFareEstimate: (estimate) => set({ fareEstimate: estimate }),
  setCurrentBooking: (booking) => set({ currentBooking: booking }),
  setBookings: (bookings) => set({ bookings }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

export const useDriverStore = create((set) => ({
  profile: null,
  status: 'offline',
  location: null,
  pendingJobs: [],
  activeJobs: [],
  earnings: null,

  setProfile: (profile) => set({ profile }),
  setStatus: (status) => set({ status }),
  setLocation: (location) => set({ location }),
  setJobs: (pending, active) => set({ pendingJobs: pending, activeJobs: active }),
  setEarnings: (earnings) => set({ earnings }),
}));

export const useMapStore = create((set) => ({
  drivers: [],
  userLocation: { lat: 45.5017, lng: -73.5673 }, // Montreal default
  pickup: null,
  dropoff: null,

  setDrivers: (drivers) => set({ drivers }),
  setUserLocation: (location) => set({ userLocation: location }),
  setPickup: (pickup) => set({ pickup }),
  setDropoff: (dropoff) => set({ dropoff }),
}));
