/**
 * Socket.io Client Service for Transpo Real-Time Communication
 */
import { io } from 'socket.io-client';

// Socket.io server URL - using the realtime service
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:8002';

let socket = null;

/**
 * Initialize socket connection
 */
export const initSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error.message);
    });

    socket.on('error', (error) => {
      console.error('🔌 Socket error:', error);
    });
  }
  return socket;
};

/**
 * Get the socket instance
 */
export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

/**
 * Connect to the socket server
 */
export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

/**
 * Disconnect from the socket server
 */
export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

/**
 * Driver: Connect and go online
 */
export const driverGoOnline = (driverId, userId, location) => {
  const s = connectSocket();
  s.emit('driver:connect', {
    driverId,
    userId,
    location: {
      latitude: location.latitude || location.lat,
      longitude: location.longitude || location.lng
    }
  });
};

/**
 * Driver: Go offline
 */
export const driverGoOffline = () => {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('driver:offline');
  }
};

/**
 * Driver: Update location
 */
export const updateDriverLocation = (driverId, location) => {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('driver:location', {
      driverId,
      location: {
        latitude: location.latitude || location.lat,
        longitude: location.longitude || location.lng
      }
    });
  }
};

/**
 * Driver: Accept a ride
 */
export const acceptRide = (driverId, bookingId) => {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('ride:accept', { driverId, bookingId });
  }
};

/**
 * Driver: Decline a ride
 */
export const declineRide = (driverId, bookingId) => {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('ride:decline', { driverId, bookingId });
  }
};

/**
 * User: Request a ride
 */
export const requestRide = (data) => {
  const s = connectSocket();
  s.emit('ride:request', {
    userId: data.userId,
    userName: data.userName,
    pickup: {
      latitude: data.pickup.lat || data.pickup.latitude,
      longitude: data.pickup.lng || data.pickup.longitude,
      address: data.pickup.address
    },
    dropoff: {
      latitude: data.dropoff.lat || data.dropoff.latitude,
      longitude: data.dropoff.lng || data.dropoff.longitude,
      address: data.dropoff.address
    },
    vehicleType: data.vehicleType,
    fare: data.fare,
    bookingId: data.bookingId
  });
};

/**
 * Subscribe to ride alerts (for drivers)
 */
export const onRideAlert = (callback) => {
  const s = getSocket();
  s.on('ride:alert', callback);
  return () => s.off('ride:alert', callback);
};

/**
 * Subscribe to ride taken events (for drivers)
 */
export const onRideTaken = (callback) => {
  const s = getSocket();
  s.on('ride:taken', callback);
  return () => s.off('ride:taken', callback);
};

/**
 * Subscribe to ride accepted events (for users)
 */
export const onRideAccepted = (userId, callback) => {
  const s = getSocket();
  const eventName = `ride:accepted:${userId}`;
  s.on(eventName, callback);
  return () => s.off(eventName, callback);
};

/**
 * Subscribe to drivers notified events (for users)
 */
export const onDriversNotified = (callback) => {
  const s = getSocket();
  s.on('ride:drivers_notified', callback);
  return () => s.off('ride:drivers_notified', callback);
};

/**
 * Subscribe to no drivers available events (for users)
 */
export const onNoDrivers = (callback) => {
  const s = getSocket();
  s.on('ride:no_drivers', callback);
  return () => s.off('ride:no_drivers', callback);
};

/**
 * Subscribe to driver connected confirmation
 */
export const onDriverConnected = (callback) => {
  const s = getSocket();
  s.on('driver:connected', callback);
  return () => s.off('driver:connected', callback);
};

/**
 * Subscribe to ride accept success (for drivers)
 */
export const onRideAcceptSuccess = (callback) => {
  const s = getSocket();
  s.on('ride:accept_success', callback);
  return () => s.off('ride:accept_success', callback);
};

/**
 * Subscribe to ride accept failed (for drivers)
 */
export const onRideAcceptFailed = (callback) => {
  const s = getSocket();
  s.on('ride:accept_failed', callback);
  return () => s.off('ride:accept_failed', callback);
};

/**
 * Subscribe to scheduled ride alerts (for drivers)
 * These are rides booked in advance, alerting 30 min before pickup
 */
export const onScheduledRideAlert = (callback) => {
  const s = getSocket();
  s.on('ride:scheduled-alert', callback);
  return () => s.off('ride:scheduled-alert', callback);
};

export default {
  initSocket,
  getSocket,
  connectSocket,
  disconnectSocket,
  driverGoOnline,
  driverGoOffline,
  updateDriverLocation,
  acceptRide,
  declineRide,
  requestRide,
  onRideAlert,
  onRideTaken,
  onRideAccepted,
  onDriversNotified,
  onNoDrivers,
  onDriverConnected,
  onRideAcceptSuccess,
  onRideAcceptFailed,
  onScheduledRideAlert
};
