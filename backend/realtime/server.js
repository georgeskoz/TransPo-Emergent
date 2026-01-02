/**
 * Transpo Real-Time Ride Request Service
 * 
 * This service handles real-time communication between users and drivers:
 * - Listens for ride requests from users
 * - Queries MongoDB for drivers within a certain radius
 * - Uses Socket.io to broadcast alerts to only nearby drivers
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/transpo';

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Driver Schema with 2dsphere index for geospatial queries
const driverSchema = new mongoose.Schema({
  id: String,
  user_id: String,
  name: String,
  status: { type: String, default: 'offline' }, // online, offline, busy
  is_available: { type: Boolean, default: false },
  vehicle_type: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  socket_id: String, // Current socket connection ID
  rating: { type: Number, default: 4.5 },
  points: { type: Number, default: 0 },
  tier: { type: String, default: 'silver' }
}, { collection: 'drivers' });

// Create 2dsphere index for geospatial queries
driverSchema.index({ location: '2dsphere' });

const Driver = mongoose.model('Driver', driverSchema);

// Ride Request Schema
const rideRequestSchema = new mongoose.Schema({
  id: String,
  user_id: String,
  user_name: String,
  pickup: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  dropoff: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  vehicle_type: String,
  fare: Object,
  status: { type: String, default: 'pending' },
  notified_drivers: [String], // Driver IDs who received the alert
  created_at: { type: Date, default: Date.now }
}, { collection: 'ride_requests' });

const RideRequest = mongoose.model('RideRequest', rideRequestSchema);

// Store connected drivers: { odriverId: socketId }
const connectedDrivers = new Map();

// ============== SOCKET.IO EVENT HANDLERS ==============

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  /**
   * Driver connects and registers their ID
   * Event: 'driver:connect'
   * Data: { driverId, userId, location: { latitude, longitude } }
   */
  socket.on('driver:connect', async (data) => {
    try {
      const { driverId, userId, location } = data;
      
      // Store socket connection
      connectedDrivers.set(driverId, socket.id);
      socket.driverId = driverId;
      socket.userId = userId;
      
      // Update driver's socket_id and location in MongoDB
      await Driver.findOneAndUpdate(
        { $or: [{ id: driverId }, { user_id: userId }] },
        { 
          socket_id: socket.id,
          status: 'online',
          is_available: true,
          location: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
          }
        },
        { upsert: false }
      );
      
      console.log(`🚗 Driver ${driverId} connected and online`);
      socket.emit('driver:connected', { success: true, message: 'Connected successfully' });
      
    } catch (error) {
      console.error('Error connecting driver:', error);
      socket.emit('error', { message: 'Failed to connect driver' });
    }
  });

  /**
   * Driver updates their location
   * Event: 'driver:location'
   * Data: { driverId, location: { latitude, longitude } }
   */
  socket.on('driver:location', async (data) => {
    try {
      const { driverId, location } = data;
      
      await Driver.findOneAndUpdate(
        { $or: [{ id: driverId }, { user_id: socket.userId }] },
        { 
          location: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
          }
        }
      );
      
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  });

  /**
   * Driver goes offline
   * Event: 'driver:offline'
   */
  socket.on('driver:offline', async () => {
    try {
      if (socket.driverId) {
        await Driver.findOneAndUpdate(
          { $or: [{ id: socket.driverId }, { user_id: socket.userId }] },
          { status: 'offline', is_available: false, socket_id: null }
        );
        connectedDrivers.delete(socket.driverId);
        console.log(`🚗 Driver ${socket.driverId} went offline`);
      }
    } catch (error) {
      console.error('Error setting driver offline:', error);
    }
  });

  /**
   * User requests a ride
   * Event: 'ride:request'
   * Data: { userId, userName, pickup, dropoff, vehicleType, fare, bookingId }
   */
  socket.on('ride:request', async (data) => {
    try {
      const { userId, userName, pickup, dropoff, vehicleType, fare, bookingId } = data;
      const radiusKm = 5; // Search radius in kilometers
      const radiusInMeters = radiusKm * 1000;
      
      console.log(`🚕 New ride request from ${userName}`);
      console.log(`   Pickup: ${pickup.address}`);
      console.log(`   Searching for ${vehicleType} drivers within ${radiusKm}km...`);
      
      // Find nearby available drivers using geospatial query
      const nearbyDrivers = await Driver.find({
        status: 'online',
        is_available: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [pickup.longitude, pickup.latitude]
            },
            $maxDistance: radiusInMeters
          }
        }
      }).limit(10);
      
      console.log(`   Found ${nearbyDrivers.length} nearby drivers`);
      
      if (nearbyDrivers.length === 0) {
        socket.emit('ride:no_drivers', { 
          message: 'No drivers available nearby',
          bookingId 
        });
        return;
      }
      
      // Create ride request record
      const rideRequest = new RideRequest({
        id: bookingId,
        user_id: userId,
        user_name: userName,
        pickup,
        dropoff,
        vehicle_type: vehicleType,
        fare,
        notified_drivers: nearbyDrivers.map(d => d.id || d.user_id)
      });
      await rideRequest.save();
      
      // Prepare the ride alert payload
      const rideAlert = {
        bookingId,
        userId,
        userName,
        pickup: {
          latitude: pickup.latitude,
          longitude: pickup.longitude,
          address: pickup.address
        },
        dropoff: {
          latitude: dropoff.latitude,
          longitude: dropoff.longitude,
          address: dropoff.address
        },
        vehicleType,
        fare,
        timestamp: new Date().toISOString()
      };
      
      // Blast the alert to nearby drivers only
      let notifiedCount = 0;
      for (const driver of nearbyDrivers) {
        const driverSocketId = driver.socket_id || connectedDrivers.get(driver.id) || connectedDrivers.get(driver.user_id);
        
        if (driverSocketId) {
          // Calculate distance for this driver
          const driverLat = driver.location.coordinates[1];
          const driverLng = driver.location.coordinates[0];
          const distance = calculateDistance(
            pickup.latitude, pickup.longitude,
            driverLat, driverLng
          );
          
          // Send personalized alert with ETA
          io.to(driverSocketId).emit('ride:alert', {
            ...rideAlert,
            distanceKm: distance.toFixed(2),
            estimatedPickupMinutes: Math.ceil(distance * 2) // Rough ETA estimate
          });
          
          notifiedCount++;
          console.log(`   📢 Alerted driver ${driver.name || driver.id} (${distance.toFixed(2)}km away)`);
        }
      }
      
      // Notify user how many drivers were alerted
      socket.emit('ride:drivers_notified', {
        bookingId,
        driversNotified: notifiedCount,
        message: `${notifiedCount} driver(s) notified of your ride request`
      });
      
    } catch (error) {
      console.error('Error processing ride request:', error);
      socket.emit('error', { message: 'Failed to process ride request' });
    }
  });

  /**
   * Driver accepts a ride
   * Event: 'ride:accept'
   * Data: { driverId, bookingId }
   */
  socket.on('ride:accept', async (data) => {
    try {
      const { driverId, bookingId } = data;
      
      // Get ride request
      const rideRequest = await RideRequest.findOne({ id: bookingId });
      if (!rideRequest || rideRequest.status !== 'pending') {
        socket.emit('ride:accept_failed', { 
          message: 'Ride no longer available',
          bookingId 
        });
        return;
      }
      
      // Update ride request status
      rideRequest.status = 'accepted';
      await rideRequest.save();
      
      // Mark driver as busy
      const driver = await Driver.findOneAndUpdate(
        { $or: [{ id: driverId }, { user_id: socket.userId }] },
        { is_available: false },
        { new: true }
      );
      
      // Notify the user that a driver accepted
      io.emit(`ride:accepted:${rideRequest.user_id}`, {
        bookingId,
        driverId,
        driverName: driver?.name,
        driverRating: driver?.rating,
        vehicleType: driver?.vehicle_type
      });
      
      // Notify other drivers that this ride is taken
      for (const notifiedDriverId of rideRequest.notified_drivers) {
        if (notifiedDriverId !== driverId) {
          const otherSocketId = connectedDrivers.get(notifiedDriverId);
          if (otherSocketId) {
            io.to(otherSocketId).emit('ride:taken', { bookingId });
          }
        }
      }
      
      socket.emit('ride:accept_success', {
        bookingId,
        message: 'Ride accepted successfully'
      });
      
      console.log(`✅ Driver ${driverId} accepted ride ${bookingId}`);
      
    } catch (error) {
      console.error('Error accepting ride:', error);
      socket.emit('error', { message: 'Failed to accept ride' });
    }
  });

  /**
   * Driver declines a ride
   * Event: 'ride:decline'
   * Data: { driverId, bookingId }
   */
  socket.on('ride:decline', async (data) => {
    try {
      const { driverId, bookingId } = data;
      
      // Remove driver from notified list
      await RideRequest.findOneAndUpdate(
        { id: bookingId },
        { $pull: { notified_drivers: driverId } }
      );
      
      console.log(`❌ Driver ${driverId} declined ride ${bookingId}`);
      
    } catch (error) {
      console.error('Error declining ride:', error);
    }
  });

  /**
   * Handle disconnection
   */
  socket.on('disconnect', async () => {
    try {
      if (socket.driverId) {
        await Driver.findOneAndUpdate(
          { $or: [{ id: socket.driverId }, { user_id: socket.userId }] },
          { socket_id: null }
        );
        connectedDrivers.delete(socket.driverId);
        console.log(`🔌 Driver ${socket.driverId} disconnected`);
      } else {
        console.log(`🔌 Socket ${socket.id} disconnected`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// ============== HELPER FUNCTIONS ==============

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// ============== REST API ENDPOINTS ==============

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'transpo-realtime',
    connectedDrivers: connectedDrivers.size,
    timestamp: new Date().toISOString()
  });
});

// Get connected drivers count
app.get('/drivers/online', async (req, res) => {
  try {
    const count = await Driver.countDocuments({ status: 'online', is_available: true });
    res.json({ onlineDrivers: count, connectedSockets: connectedDrivers.size });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger a ride request (for testing)
app.post('/test/ride-request', async (req, res) => {
  try {
    const { userId, userName, pickup, dropoff, vehicleType, fare, bookingId } = req.body;
    
    // Emit to all sockets as if it came from a user
    io.emit('ride:request', {
      userId,
      userName,
      pickup,
      dropoff,
      vehicleType,
      fare,
      bookingId
    });
    
    res.json({ success: true, message: 'Ride request broadcasted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== SCHEDULED RIDES NOTIFICATION SYSTEM ==============

// Booking schema for scheduled rides
const bookingSchema = new mongoose.Schema({
  id: String,
  user_id: String,
  user_name: String,
  status: String,
  pickup: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  dropoff: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  vehicle_type: String,
  fare: Object,
  is_scheduled: Boolean,
  scheduled_time: String,
  notification_sent: { type: Boolean, default: false },
  driver_id: String
}, { collection: 'bookings' });

const Booking = mongoose.model('Booking', bookingSchema);

/**
 * Check for scheduled rides approaching pickup time (30 min before)
 * and notify nearby drivers
 */
async function checkScheduledRides() {
  try {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const twentyNineMinutesFromNow = new Date(now.getTime() + 29 * 60 * 1000);
    
    // Find scheduled rides that:
    // 1. Are scheduled (is_scheduled = true)
    // 2. Haven't been notified yet (notification_sent = false or doesn't exist)
    // 3. Are within the 30-minute notification window
    // 4. Haven't been assigned a driver yet
    const scheduledRides = await Booking.find({
      is_scheduled: true,
      status: 'scheduled',
      notification_sent: { $ne: true },
      driver_id: null
    });
    
    for (const ride of scheduledRides) {
      if (!ride.scheduled_time) continue;
      
      const scheduledTime = new Date(ride.scheduled_time);
      const timeDiff = scheduledTime.getTime() - now.getTime();
      const minutesUntilPickup = timeDiff / (1000 * 60);
      
      // Notify if within 30-31 minutes of pickup (to avoid duplicate notifications)
      if (minutesUntilPickup <= 31 && minutesUntilPickup >= 29) {
        console.log(`📅 Notifying drivers for scheduled ride ${ride.id} (${Math.round(minutesUntilPickup)} min until pickup)`);
        
        // Find nearby online drivers
        const nearbyDrivers = await Driver.find({
          status: 'online',
          is_available: true,
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [ride.pickup.longitude, ride.pickup.latitude]
              },
              $maxDistance: 10000 // 10km radius
            }
          }
        }).limit(10);
        
        if (nearbyDrivers.length > 0) {
          // Broadcast to nearby drivers
          const notifiedDriverIds = [];
          
          for (const driver of nearbyDrivers) {
            if (driver.socket_id && connectedDrivers.has(driver.id)) {
              const socketId = connectedDrivers.get(driver.id);
              
              io.to(socketId).emit('ride:scheduled-alert', {
                bookingId: ride.id,
                userId: ride.user_id,
                userName: ride.user_name,
                pickup: ride.pickup,
                dropoff: ride.dropoff,
                vehicleType: ride.vehicle_type,
                fare: ride.fare,
                scheduledTime: ride.scheduled_time,
                minutesUntilPickup: Math.round(minutesUntilPickup),
                isScheduled: true
              });
              
              notifiedDriverIds.push(driver.id);
            }
          }
          
          // Mark as notification sent
          await Booking.findOneAndUpdate(
            { id: ride.id },
            { 
              notification_sent: true,
              matched_drivers: notifiedDriverIds
            }
          );
          
          console.log(`✅ Notified ${notifiedDriverIds.length} drivers for scheduled ride ${ride.id}`);
        } else {
          console.log(`⚠️ No online drivers found for scheduled ride ${ride.id}`);
          // Still mark as notified to prevent spam
          await Booking.findOneAndUpdate(
            { id: ride.id },
            { notification_sent: true }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error checking scheduled rides:', error);
  }
}

// Run scheduled ride checker every minute
setInterval(checkScheduledRides, 60 * 1000);
console.log('📅 Scheduled ride notification checker started (runs every minute)');

// API endpoint to manually check scheduled rides (for testing)
app.post('/scheduled/check', async (req, res) => {
  try {
    await checkScheduledRides();
    res.json({ success: true, message: 'Scheduled rides check completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending scheduled rides
app.get('/scheduled/pending', async (req, res) => {
  try {
    const scheduledRides = await Booking.find({
      is_scheduled: true,
      status: 'scheduled'
    }).sort({ scheduled_time: 1 });
    
    res.json({ 
      count: scheduledRides.length,
      rides: scheduledRides.map(r => ({
        id: r.id,
        scheduledTime: r.scheduled_time,
        pickup: r.pickup?.address,
        dropoff: r.dropoff?.address,
        notificationSent: r.notification_sent
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== START SERVER ==============

const PORT = process.env.PORT || 8002;

server.listen(PORT, () => {
  console.log(`\n🚀 Transpo Real-Time Service running on port ${PORT}`);
  console.log(`   Socket.io endpoint: ws://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});

module.exports = { io, app };
