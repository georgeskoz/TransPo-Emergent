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
- JWT-based custom auth + Social login (Google via Emergent Auth)
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

## What's Been Implemented

### Completed on 2025-12-30 (v1 MVP)

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

### Completed on 2025-12-30 (v1.1 Profile Update)

**User Profile Features**
- ✅ Profile photo upload (server storage)
- ✅ First name / Last name fields
- ✅ Phone number
- ✅ Address with Country, State/Province, City
- ✅ Payment methods UI (Credit Card, Debit Card, Apple Pay, Google Pay)
- ✅ Google social login via Emergent Auth

**Driver Profile Features**
- ✅ All user profile fields
- ✅ Vehicle information (type, make, model, color, plate)
- ✅ Driver's license upload with verification workflow
- ✅ Taxi license upload with verification workflow
- ✅ Document verification status tracking

**Admin Features**
- ✅ View pending driver verifications
- ✅ Approve/Reject driver documents
- ✅ Document status management

**Frontend (React)**
- ✅ Landing page with services overview
- ✅ Auth page with social login buttons (Google functional)
- ✅ User Profile page with all fields and payment methods
- ✅ Driver Profile page with document uploads
- ✅ User Dashboard (book taxi, fare estimate)
- ✅ Driver Dashboard (go online, accept jobs, earnings)
- ✅ Admin Dashboard (stats, users, drivers, bookings)
- ✅ Neon Noir dark theme (Unbounded + Manrope fonts)

**MOCKED Components**
- Google Maps → Mock map placeholder with animated driver dots
- Competitor pricing → Simulated market estimates
- Payment methods → UI only (no real Stripe card saving)
- Facebook/Apple login → Show "coming soon" toast

## Prioritized Backlog

### P0 (Critical for Launch)
- [ ] Real Google Maps integration (when API key provided)
- [ ] Complete Stripe payment flow with webhooks
- [ ] Facebook and Apple OAuth integration

### P1 (High Priority)
- [ ] Courier service module
- [ ] Food delivery module (restaurants, menus)
- [ ] Rating & review system
- [ ] In-app chat/call between driver and rider
- [ ] Push notifications for new jobs

### P2 (Medium Priority)
- [ ] Scheduled rides
- [ ] Surge pricing based on demand
- [ ] Admin pricing controls

### P3 (Nice to Have)
- [ ] Shared delivery discounts
- [ ] Restaurant onboarding portal
- [ ] Driver leaderboards

## Tech Stack
- Backend: FastAPI + Python
- Frontend: React + Tailwind + shadcn/ui + Framer Motion
- Database: MongoDB
- Auth: JWT + Emergent OAuth (Google)
- Payments: Stripe
- State: Zustand
- File Storage: Local server (/app/backend/uploads/)

## API Endpoints

### Auth
- POST /api/auth/register (form-data with first_name, last_name)
- POST /api/auth/login
- POST /api/auth/social/session
- POST /api/auth/logout
- GET /api/auth/me

### User Profile
- GET /api/user/profile
- PUT /api/user/profile
- POST /api/user/profile/photo
- GET /api/user/payment-methods
- POST /api/user/payment-methods
- DELETE /api/user/payment-methods/{id}

### Driver Profile & Documents
- GET /api/driver/profile
- PUT /api/driver/profile
- POST /api/driver/documents/license
- POST /api/driver/documents/taxi-license
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
- GET /api/admin/drivers/pending-verification
- POST /api/admin/verify-document
- GET /api/admin/bookings

### Taxi
- POST /api/fare/estimate
- POST /api/taxi/book
- GET /api/taxi/booking/{id}
- GET /api/bookings/user

### Map
- GET /api/map/drivers?lat=&lng=&radius=
