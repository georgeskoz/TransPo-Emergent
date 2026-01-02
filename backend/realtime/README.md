# Transpo Real-Time Ride Request Service

This service handles real-time communication between users and drivers using Socket.io.

## Features

- **Geospatial Driver Matching**: Uses MongoDB 2dsphere index to find drivers within a specified radius
- **Real-time Alerts**: Broadcasts ride requests only to nearby available drivers
- **Driver Tracking**: Tracks driver locations and availability in real-time
- **Ride Lifecycle**: Handles accept/decline events and notifies all parties

## Prerequisites

- Node.js >= 16
- MongoDB with 2dsphere index on drivers collection
- npm or yarn

## Installation

```bash
cd /app/backend/realtime
npm install
```

## Configuration

Create a `.env` file:

```env
PORT=8002
MONGO_URL=mongodb://localhost:27017/transpo
CORS_ORIGIN=*
```

## Running the Service

```bash
# Development
npm run dev

# Production
npm start
```

## Socket.io Events

### Driver Events

| Event | Direction | Data | Description |
|-------|-----------|------|-------------|
| `driver:connect` | Client → Server | `{ driverId, userId, location }` | Driver connects and goes online |
| `driver:location` | Client → Server | `{ driverId, location }` | Driver updates their location |
| `driver:offline` | Client → Server | - | Driver goes offline |
| `driver:connected` | Server → Client | `{ success, message }` | Confirmation of connection |

### Ride Events

| Event | Direction | Data | Description |
|-------|-----------|------|-------------|
| `ride:request` | Client → Server | `{ userId, userName, pickup, dropoff, vehicleType, fare, bookingId }` | User requests a ride |
| `ride:alert` | Server → Drivers | `{ bookingId, pickup, dropoff, fare, distanceKm, estimatedPickupMinutes }` | Alert sent to nearby drivers |
| `ride:accept` | Client → Server | `{ driverId, bookingId }` | Driver accepts a ride |
| `ride:decline` | Client → Server | `{ driverId, bookingId }` | Driver declines a ride |
| `ride:accepted:{userId}` | Server → User | `{ bookingId, driverId, driverName }` | Notifies user their ride was accepted |
| `ride:taken` | Server → Drivers | `{ bookingId }` | Notifies other drivers the ride is taken |
| `ride:no_drivers` | Server → User | `{ message, bookingId }` | No drivers available nearby |
| `ride:drivers_notified` | Server → User | `{ bookingId, driversNotified }` | Confirmation of how many drivers were notified |

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/drivers/online` | Get count of online drivers |
| POST | `/test/ride-request` | Test endpoint to broadcast a ride request |

## MongoDB Schema

### Drivers Collection

```javascript
{
  id: String,
  user_id: String,
  name: String,
  status: String, // 'online', 'offline', 'busy'
  is_available: Boolean,
  vehicle_type: String,
  location: {
    type: 'Point',
    coordinates: [longitude, latitude]
  },
  socket_id: String,
  rating: Number,
  points: Number,
  tier: String
}
```

### Creating the 2dsphere Index

```javascript
db.drivers.createIndex({ location: '2dsphere' })
```

## Example Client Usage

### Driver Client (React)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8002');

// Connect as driver
socket.emit('driver:connect', {
  driverId: 'driver123',
  userId: 'user456',
  location: { latitude: 45.5017, longitude: -73.5673 }
});

// Listen for ride alerts
socket.on('ride:alert', (data) => {
  console.log('New ride request!', data);
  // Show alert to driver
});

// Accept a ride
socket.emit('ride:accept', {
  driverId: 'driver123',
  bookingId: data.bookingId
});
```

### User Client (React)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8002');

// Request a ride
socket.emit('ride:request', {
  userId: 'user789',
  userName: 'John Doe',
  pickup: { latitude: 45.5017, longitude: -73.5673, address: '123 Main St' },
  dropoff: { latitude: 45.5088, longitude: -73.554, address: '456 Downtown Ave' },
  vehicleType: 'sedan',
  fare: { total: 15.50 },
  bookingId: 'booking123'
});

// Listen for driver acceptance
socket.on('ride:accepted:user789', (data) => {
  console.log('Driver accepted!', data);
});

// Listen for notification count
socket.on('ride:drivers_notified', (data) => {
  console.log(`${data.driversNotified} drivers notified`);
});
```
