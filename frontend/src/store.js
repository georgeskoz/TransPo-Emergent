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
            credentials: 'include'
          });
          
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error('JSON parse error:', text);
            throw new Error('Server error. Please try again.');
          }
          
          if (!res.ok) throw new Error(data.detail || 'Login failed');
          set({ user: data.user, token: data.access_token, isAuthenticated: true, isLoading: false });
          return data;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      register: async (formData) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error('JSON parse error:', text);
            throw new Error('Server error. Please try again.');
          }
          
          if (!res.ok) throw new Error(data.detail || 'Registration failed');
          set({ user: data.user, token: data.access_token, isAuthenticated: true, isLoading: false });
          return data;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      socialLogin: async (sessionId) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/auth/social/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
            credentials: 'include'
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Social login failed');
          
          set({ user: data.user, token: null, isAuthenticated: true, isLoading: false });
          return data;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      checkAuth: async () => {
        try {
          const { token } = get();
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          
          const res = await fetch(`${API_URL}/auth/me`, {
            headers,
            credentials: 'include'
          });
          
          if (res.ok) {
            const user = await res.json();
            set({ user, isAuthenticated: true });
            return user;
          } else {
            set({ user: null, token: null, isAuthenticated: false });
            return null;
          }
        } catch (error) {
          set({ user: null, token: null, isAuthenticated: false });
          return null;
        }
      },

      logout: async () => {
        try {
          const { token } = get();
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            credentials: 'include'
          });
        } catch (e) {
          console.log('Logout error:', e);
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      getAuthHeaders: () => {
        const token = get().token;
        return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      },

      fetchWithAuth: async (url, options = {}) => {
        const { token } = get();
        const headers = { ...options.headers };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return fetch(url, {
          ...options,
          headers,
          credentials: 'include'
        });
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
  userLocation: { lat: 45.5017, lng: -73.5673 },
  pickup: null,
  dropoff: null,

  setDrivers: (drivers) => set({ drivers }),
  setUserLocation: (location) => set({ userLocation: location }),
  setPickup: (pickup) => set({ pickup }),
  setDropoff: (dropoff) => set({ dropoff }),
}));
