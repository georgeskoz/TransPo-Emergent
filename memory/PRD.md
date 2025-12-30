# Transpo - Multi-Service Mobility Platform PRD

## Original Problem Statement
Build a multi-service mobility platform with:
- User App (Passengers/Customers) - Book taxis, request courier, order food
- Driver App (Taxi/Courier/Delivery Drivers) - Go online, accept jobs, earn money
- Admin Web Panel (Operations & Control) - Manage users, drivers, analytics
- Public Website (Marketing + Restaurant menus)

Combining Taxi, Courier, and Food Delivery services in one ecosystem.

## User Choices
- Dark mode (Neon Noir theme)
- Google Maps (mocked with placeholder for MVP)
- Stripe payments (test keys)
- JWT-based custom auth
- Mock fare comparison data

## Core Requirements (Static)

### Fare Calculation (Quebec)
```
Base Fare: $3.50
Distance Rate: $1.75/km
Time Rate: $0.65/min
Government Fee (Quebec Transport): $0.90
GST (5%): Applied on subtotal
QST (9.975%): Applied on subtotal
Minimum Fare: $7.50
Vehicle Multipliers: sedan=1x, suv=1.3x, van=1.5x
```

### Driver Matching Algorithm
```
Score = (1/distance_km) * 0.6 + (rating/5) * 0.3 + acceptance_rate * 0.1
- Filter: status='online', is_available=true, within radius
- Sort by score descending
- Return top 5-10 matches
```

## What's Been Implemented (v1 MVP)

### Completed on 2025-12-30

**Backend (FastAPI)**
- ✅ JWT Authentication (register, login, protected routes)
- ✅ User, Driver, Admin roles
- ✅ Fare calculation with Quebec taxes (GST/QST)
- ✅ Driver matching algorithm (distance + rating + acceptance)
- ✅ Taxi booking flow (create, accept, complete)
- ✅ Driver profile management (status, location, earnings)
- ✅ Admin stats (users, drivers, bookings, revenue)
- ✅ Stripe payment integration (checkout session)
- ✅ Demo driver seeding

**Frontend (React)**
- ✅ Landing page with services overview
- ✅ Auth page (login/register with role selection)
- ✅ User Dashboard (book taxi, fare estimate, competitor comparison)
- ✅ Driver Dashboard (go online, accept jobs, complete rides, earnings)
- ✅ Admin Dashboard (stats, users, drivers, bookings tabs)
- ✅ Mock map with driver markers
- ✅ Neon Noir dark theme (Unbounded + Manrope fonts)

**Mocked Components**
- Google Maps (placeholder with animated driver dots)
- Competitor pricing (UberX, Lyft, TaxiCoop estimates)

## Prioritized Backlog

### P0 (Critical for Launch)
- [ ] Real Google Maps integration (when API key provided)
- [ ] Push notifications for new jobs
- [ ] Complete payment flow with webhooks

### P1 (High Priority)
- [ ] Courier service module
- [ ] Food delivery module (restaurants, menus)
- [ ] Rating & review system
- [ ] In-app chat/call between driver and rider

### P2 (Medium Priority)
- [ ] Scheduled rides
- [ ] Driver document verification
- [ ] Surge pricing based on demand
- [ ] Admin pricing controls

### P3 (Nice to Have)
- [ ] Shared delivery discounts
- [ ] Multiple packages in one courier request
- [ ] Restaurant onboarding portal
- [ ] Driver leaderboards

## API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### User
- POST /api/fare/estimate
- POST /api/taxi/book
- GET /api/taxi/booking/{id}
- GET /api/bookings/user

### Driver
- GET /api/driver/profile
- PUT /api/driver/profile
- POST /api/driver/status
- POST /api/driver/location
- GET /api/driver/jobs
- POST /api/driver/accept/{booking_id}
- POST /api/driver/complete/{booking_id}
- GET /api/driver/earnings

### Admin
- GET /api/admin/stats
- GET /api/admin/users
- GET /api/admin/drivers
- GET /api/admin/bookings

### Map
- GET /api/map/drivers?lat=&lng=&radius=

### Payments
- POST /api/payments/create-checkout
- GET /api/payments/status/{session_id}

## Tech Stack
- Backend: FastAPI + Python
- Frontend: React + Tailwind + shadcn/ui
- Database: MongoDB
- Auth: JWT (python-jose)
- Payments: Stripe
- State: Zustand

## Next Tasks
1. Add Google Maps API key and implement real maps
2. Implement Stripe webhook handler
3. Add courier booking flow
4. Add food delivery with restaurants
