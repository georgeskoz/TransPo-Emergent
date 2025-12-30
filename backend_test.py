#!/usr/bin/env python3
"""
Transpo Backend API Testing Suite
Tests core functionality focusing on authentication, fare estimation, and driver profile APIs
Based on test_result.md requirements and review request
"""

import requests
import sys
import json
import io
from datetime import datetime
from typing import Dict, List, Optional

class TranspoAPITester:
    def __init__(self, base_url="https://transpo-connect-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.user_token = None
        self.driver_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.booking_id = None
        
        # Demo credentials from review request
        self.demo_user = {
            "email": "user@demo.com",
            "password": "demo123"
        }
        
        self.demo_driver = {
            "email": "driver@demo.com", 
            "password": "demo123"
        }

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None, files: Optional[Dict] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {}
        if headers:
            test_headers.update(headers)
        
        # Only add Content-Type for JSON requests
        if not files and data:
            test_headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=test_headers)
                elif 'auth/register' in endpoint and data:
                    # Registration endpoint expects form data
                    response = requests.post(url, data=data, headers=test_headers)
                else:
                    response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                
                self.failed_tests.append({
                    "test": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "endpoint": endpoint,
                "error": str(e)
            })
            return False, {}

    def get_auth_headers(self, token: str) -> Dict[str, str]:
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"}

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n" + "="*50)
        print("🏥 HEALTH CHECK TESTS")
        print("="*50)
        
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_authentication(self):
        """Test authentication flow with demo credentials"""
        print("\n" + "="*50)
        print("🔐 AUTHENTICATION TESTS")
        print("="*50)
        
        # Test demo user login (user@demo.com/demo123)
        success, response = self.run_test(
            "Demo User Login", 
            "POST", 
            "auth/login", 
            200,
            self.demo_user
        )
        if success and 'access_token' in response:
            self.user_token = response['access_token']
            print(f"   Demo user token obtained: {self.user_token[:20]}...")
            print(f"   User role: {response.get('user', {}).get('role', 'unknown')}")
        
        # Test demo driver login (driver@demo.com/demo123)
        success, response = self.run_test(
            "Demo Driver Login", 
            "POST", 
            "auth/login", 
            200,
            self.demo_driver
        )
        if success and 'access_token' in response:
            self.driver_token = response['access_token']
            print(f"   Demo driver token obtained: {self.driver_token[:20]}...")
            print(f"   Driver role: {response.get('user', {}).get('role', 'unknown')}")
        
        # Test invalid login
        self.run_test(
            "Invalid Login", 
            "POST", 
            "auth/login", 
            401,
            {"email": "invalid@test.com", "password": "wrongpass"}
        )
        
        # Test get current user with user token
        if self.user_token:
            success, response = self.run_test(
                "Get Current User (User)", 
                "GET", 
                "auth/me", 
                200,
                headers=self.get_auth_headers(self.user_token)
            )
            if success:
                print(f"   User profile: {response.get('name', 'N/A')} ({response.get('email', 'N/A')})")
        
        # Test get current user with driver token
        if self.driver_token:
            success, response = self.run_test(
                "Get Current User (Driver)", 
                "GET", 
                "auth/me", 
                200,
                headers=self.get_auth_headers(self.driver_token)
            )
            if success:
                print(f"   Driver profile: {response.get('name', 'N/A')} ({response.get('email', 'N/A')})")

    def test_fare_estimation(self):
        """Test fare estimation with Quebec taxes - Montreal locations"""
        print("\n" + "="*50)
        print("💰 FARE ESTIMATION TESTS")
        print("="*50)
        
        # Test coordinates from review request - Montreal locations
        # "1000 Rue" to "300 Rue Saint-Paul" (approximate coordinates)
        fare_request = {
            "pickup_lat": 45.5017,   # Downtown Montreal area
            "pickup_lng": -73.5673,
            "dropoff_lat": 45.5088,  # Old Port area (Rue Saint-Paul)
            "dropoff_lng": -73.5538,
            "vehicle_type": "sedan"
        }
        
        success, response = self.run_test(
            "Fare Estimation (Montreal Route)", 
            "POST", 
            "fare/estimate", 
            200,
            fare_request
        )
        
        if success and 'our_fare' in response:
            fare = response['our_fare']
            print(f"   📍 Route: Downtown Montreal to Old Port")
            print(f"   💵 Base fare: ${fare.get('base_fare', 0)}")
            print(f"   📏 Distance charge: ${fare.get('distance_charge', 0)} ({fare.get('distance_km', 0)} km)")
            print(f"   ⏱️  Time charge: ${fare.get('time_charge', 0)} ({fare.get('duration_min', 0)} min)")
            print(f"   🏛️  Government fee: ${fare.get('government_fee', 0)}")
            print(f"   📊 GST (5%): ${fare.get('gst', 0)}")
            print(f"   📊 QST (9.975%): ${fare.get('qst', 0)}")
            print(f"   💰 TOTAL: ${fare.get('total', 0)}")
            
            # Verify Quebec tax calculation
            if fare.get('gst', 0) > 0 and fare.get('qst', 0) > 0:
                print("✅ Quebec taxes (GST + QST) calculated correctly")
            else:
                print("❌ Quebec taxes missing or incorrect")
                
            # Verify fare breakdown makes sense
            expected_subtotal = fare.get('base_fare', 0) + fare.get('distance_charge', 0) + fare.get('time_charge', 0)
            actual_subtotal = fare.get('subtotal', 0)
            if abs(expected_subtotal - actual_subtotal) < 0.01:
                print("✅ Fare breakdown calculation is correct")
            else:
                print(f"❌ Fare breakdown mismatch: expected {expected_subtotal}, got {actual_subtotal}")
        
        # Test different vehicle types
        for vehicle_type in ["suv", "van", "bike"]:
            fare_request["vehicle_type"] = vehicle_type
            success, response = self.run_test(
                f"Fare Estimation - {vehicle_type.upper()}", 
                "POST", 
                "fare/estimate", 
                200,
                fare_request
            )
            if success and 'our_fare' in response:
                total = response['our_fare'].get('total', 0)
                print(f"   {vehicle_type.upper()} total: ${total}")
        
        # Test with longer distance
        long_distance_request = {
            "pickup_lat": 45.5017,   # Downtown Montreal
            "pickup_lng": -73.5673,
            "dropoff_lat": 45.4215,  # South Shore (longer trip)
            "dropoff_lng": -73.4951,
            "vehicle_type": "sedan"
        }
        
        success, response = self.run_test(
            "Fare Estimation (Long Distance)", 
            "POST", 
            "fare/estimate", 
            200,
            long_distance_request
        )
        
        if success and 'our_fare' in response:
            fare = response['our_fare']
            print(f"   📍 Long distance: ${fare.get('total', 0)} ({fare.get('distance_km', 0)} km)")

    def test_driver_profile_api(self):
        """Test driver profile API endpoints"""
        print("\n" + "="*50)
        print("🚗 DRIVER PROFILE API TESTS")
        print("="*50)
        
        if not self.driver_token:
            print("❌ Skipping driver profile tests - no driver token")
            return
        
        # Test get driver profile
        success, response = self.run_test(
            "Get Driver Profile", 
            "GET", 
            "driver/profile", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            print(f"   Driver ID: {response.get('id', 'N/A')}")
            print(f"   Name: {response.get('name', 'N/A')}")
            print(f"   Vehicle: {response.get('vehicle_color', '')} {response.get('vehicle_make', '')} {response.get('vehicle_model', '')}")
            print(f"   License Plate: {response.get('license_plate', 'N/A')}")
            print(f"   Status: {response.get('status', 'N/A')}")
            print(f"   Rating: {response.get('rating', 'N/A')}")
            print(f"   Total Rides: {response.get('total_rides', 'N/A')}")
            print(f"   Verification Status: {response.get('verification_status', 'N/A')}")
        
        # Test update driver profile
        profile_update = {
            "vehicle_type": "sedan",
            "vehicle_make": "Toyota",
            "vehicle_model": "Camry",
            "vehicle_color": "White",
            "license_plate": "TEST123"
        }
        
        self.run_test(
            "Update Driver Profile", 
            "PUT", 
            "driver/profile", 
            200,
            profile_update,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test update driver status
        self.run_test(
            "Update Driver Status - Online", 
            "POST", 
            "driver/status?status=online", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test update driver location
        location_data = {
            "latitude": 45.5017,
            "longitude": -73.5673
        }
        self.run_test(
            "Update Driver Location", 
            "POST", 
            "driver/location", 
            200,
            location_data,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test get driver jobs
        self.run_test(
            "Get Driver Jobs", 
            "GET", 
            "driver/jobs", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test get driver earnings
        success, response = self.run_test(
            "Get Driver Earnings", 
            "GET", 
            "driver/earnings", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            print(f"   Today's Earnings: ${response.get('today', 0)}")
            print(f"   Weekly Earnings: ${response.get('weekly', 0)}")
            print(f"   Total Earnings: ${response.get('total', 0)}")
            print(f"   Total Rides: {response.get('total_rides', 0)}")
            print(f"   Rating: {response.get('rating', 0)}")

    def run_focused_tests(self):
        """Run focused tests based on test_result.md requirements"""
        print("🚀 Starting Transpo Backend API Focused Test Suite")
        print(f"🎯 Testing against: {self.base_url}")
        print("📋 Focus: Authentication, Fare Estimation, Driver Profile APIs")
        
        start_time = datetime.now()
        
        try:
            self.test_health_check()
            self.test_authentication()
            self.test_fare_estimation()
            self.test_driver_profile_api()
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error: {e}")
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Print summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        print(f"Duration: {duration:.2f}s")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['test']} - {test.get('error', 'Status code mismatch')}")
                if 'endpoint' in test:
                    print(f"   Endpoint: {test['endpoint']}")
                if 'expected' in test and 'actual' in test:
                    print(f"   Expected: {test['expected']}, Got: {test['actual']}")
        
        return self.tests_passed == self.tests_run

    def test_taxi_booking(self):
        """Test taxi booking functionality"""
        print("\n" + "="*50)
        print("🚗 TAXI BOOKING TESTS")
        print("="*50)
        
        if not self.user_token:
            print("❌ Skipping booking tests - no user token")
            return
        
        # Seed demo drivers first
        self.run_test("Seed Demo Drivers", "POST", "seed/drivers", 200)
        
        booking_request = {
            "pickup_lat": 45.5017,
            "pickup_lng": -73.5673,
            "pickup_address": "Downtown Montreal",
            "dropoff_lat": 45.5088,
            "dropoff_lng": -73.5538,
            "dropoff_address": "Old Port Montreal",
            "vehicle_type": "sedan"
        }
        
        success, response = self.run_test(
            "Create Taxi Booking", 
            "POST", 
            "taxi/book", 
            200,
            booking_request,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if success and 'booking_id' in response:
            self.booking_id = response['booking_id']
            print(f"   Booking ID: {self.booking_id}")
            
            # Test get booking details
            self.run_test(
                "Get Booking Details", 
                "GET", 
                f"taxi/booking/{self.booking_id}", 
                200,
                headers=self.get_auth_headers(self.user_token)
            )
        
        # Test get user bookings
        self.run_test(
            "Get User Bookings", 
            "GET", 
            "bookings/user", 
            200,
            headers=self.get_auth_headers(self.user_token)
        )

    def test_driver_functionality(self):
        """Test driver-specific functionality"""
        print("\n" + "="*50)
        print("🚙 DRIVER FUNCTIONALITY TESTS")
        print("="*50)
        
        if not self.driver_token:
            print("❌ Skipping driver tests - no driver token")
            return
        
        # Test get driver profile
        self.run_test(
            "Get Driver Profile", 
            "GET", 
            "driver/profile", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test update driver status
        self.run_test(
            "Update Driver Status - Online", 
            "POST", 
            "driver/status?status=online", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test update driver location
        location_data = {
            "latitude": 45.5017,
            "longitude": -73.5673
        }
        self.run_test(
            "Update Driver Location", 
            "POST", 
            "driver/location", 
            200,
            location_data,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test get driver jobs
        self.run_test(
            "Get Driver Jobs", 
            "GET", 
            "driver/jobs", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test accept booking (if we have one)
        if self.booking_id:
            success, response = self.run_test(
                "Accept Booking", 
                "POST", 
                f"driver/accept/{self.booking_id}", 
                200,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                # Test complete booking
                self.run_test(
                    "Complete Booking", 
                    "POST", 
                    f"driver/complete/{self.booking_id}", 
                    200,
                    headers=self.get_auth_headers(self.driver_token)
                )
        
    def test_admin_functionality(self):
        """Test admin dashboard functionality"""
        print("\n" + "="*50)
        print("👑 ADMIN FUNCTIONALITY TESTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping admin tests - no admin token")
            return
        
        # Test get admin stats
        success, response = self.run_test(
            "Get Admin Stats", 
            "GET", 
            "admin/stats", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            print(f"   Users: {response.get('users', {}).get('total', 0)}")
            print(f"   Drivers: {response.get('drivers', {}).get('total', 0)} (Online: {response.get('drivers', {}).get('online', 0)})")
            print(f"   Bookings: {response.get('bookings', {}).get('total', 0)}")
            print(f"   Revenue: ${response.get('revenue', {}).get('platform', 0)}")
        
        # Test get all users
        self.run_test(
            "Get All Users", 
            "GET", 
            "admin/users", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        # Test get all drivers
        self.run_test(
            "Get All Drivers", 
            "GET", 
            "admin/drivers", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        # Test get all bookings
        self.run_test(
            "Get All Bookings", 
            "GET", 
            "admin/bookings", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )

    def test_user_profile_features(self):
        """Test user profile functionality including photo upload and payment methods"""
        print("\n" + "="*50)
        print("👤 USER PROFILE FEATURES TESTS")
        print("="*50)
        
        if not self.user_token:
            print("❌ Skipping user profile tests - no user token")
            return
        
        # Test get user profile
        success, response = self.run_test(
            "Get User Profile", 
            "GET", 
            "user/profile", 
            200,
            headers=self.get_auth_headers(self.user_token)
        )
        
        # Test update user profile
        profile_data = {
            "first_name": "Updated",
            "last_name": "User",
            "phone": "+15145551111",
            "address": "123 Test Street",
            "country": "Canada",
            "state": "Quebec",
            "city": "Montreal"
        }
        
        self.run_test(
            "Update User Profile", 
            "PUT", 
            "user/profile", 
            200,
            profile_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        # Test profile photo upload
        fake_image = io.BytesIO(b"fake image data")
        fake_image.name = "test.jpg"
        
        success, response = self.run_test(
            "Upload Profile Photo", 
            "POST", 
            "user/profile/photo", 
            200,
            data={},
            files={'photo': fake_image},
            headers=self.get_auth_headers(self.user_token)
        )
        
        # Test add payment method - Credit Card
        payment_data = {
            "type": "credit_card",
            "card_last_four": "1234",
            "card_brand": "Visa",
            "expiry_month": 12,
            "expiry_year": 2025,
            "is_default": True
        }
        
        self.run_test(
            "Add Credit Card Payment Method", 
            "POST", 
            "user/payment-methods", 
            200,
            payment_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        # Test add payment method - Apple Pay
        apple_pay_data = {
            "type": "apple_pay",
            "is_default": False
        }
        
        self.run_test(
            "Add Apple Pay Payment Method", 
            "POST", 
            "user/payment-methods", 
            200,
            apple_pay_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        # Test add payment method - Google Pay
        google_pay_data = {
            "type": "google_pay",
            "is_default": False
        }
        
        self.run_test(
            "Add Google Pay Payment Method", 
            "POST", 
            "user/payment-methods", 
            200,
            google_pay_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        # Test get payment methods
        success, response = self.run_test(
            "Get Payment Methods", 
            "GET", 
            "user/payment-methods", 
            200,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if success and 'payment_methods' in response:
            methods = response['payment_methods']
            print(f"   Found {len(methods)} payment methods")
            
            # Test delete payment method if we have any
            if methods:
                method_id = methods[0]['id']
                self.run_test(
                    "Delete Payment Method", 
                    "DELETE", 
                    f"user/payment-methods/{method_id}", 
                    200,
                    headers=self.get_auth_headers(self.user_token)
                )

    def test_driver_profile_features(self):
        """Test driver profile functionality including document uploads"""
        print("\n" + "="*50)
        print("🚗 DRIVER PROFILE FEATURES TESTS")
        print("="*50)
        
        if not self.driver_token:
            print("❌ Skipping driver profile tests - no driver token")
            return
        
        # Test get driver profile
        success, response = self.run_test(
            "Get Driver Profile", 
            "GET", 
            "driver/profile", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test update driver profile
        driver_profile_data = {
            "first_name": "Updated",
            "last_name": "Driver",
            "phone": "+15145552222",
            "address": "456 Driver Street",
            "country": "Canada",
            "state": "Quebec",
            "city": "Montreal",
            "vehicle_type": "sedan",
            "vehicle_make": "Toyota",
            "vehicle_model": "Camry",
            "vehicle_color": "White",
            "license_plate": "ABC123",
            "drivers_license_number": "DL123456789",
            "drivers_license_expiry": "2025-12-31",
            "taxi_license_number": "TX987654321",
            "taxi_license_expiry": "2025-12-31"
        }
        
        self.run_test(
            "Update Driver Profile", 
            "PUT", 
            "driver/profile", 
            200,
            driver_profile_data,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test upload driver's license photo
        fake_license = io.BytesIO(b"fake license image data")
        fake_license.name = "license.jpg"
        
        license_data = {
            'license_number': 'DL123456789',
            'expiry_date': '2025-12-31'
        }
        
        success, response = self.run_test(
            "Upload Driver's License Photo", 
            "POST", 
            "driver/documents/license", 
            200,
            data=license_data,
            files={'photo': fake_license},
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test upload taxi license photo
        fake_taxi_license = io.BytesIO(b"fake taxi license image data")
        fake_taxi_license.name = "taxi_license.jpg"
        
        taxi_license_data = {
            'license_number': 'TX987654321',
            'expiry_date': '2025-12-31'
        }
        
        success, response = self.run_test(
            "Upload Taxi License Photo", 
            "POST", 
            "driver/documents/taxi-license", 
            200,
            data=taxi_license_data,
            files={'photo': fake_taxi_license},
            headers=self.get_auth_headers(self.driver_token)
        )

    def test_admin_verification_features(self):
        """Test admin verification workflow for driver documents"""
        print("\n" + "="*50)
        print("👑 ADMIN VERIFICATION FEATURES TESTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping admin verification tests - no admin token")
            return
        
        # Test get pending verifications
        success, response = self.run_test(
            "Get Pending Verifications", 
            "GET", 
            "admin/drivers/pending-verification", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success and 'drivers' in response:
            drivers = response['drivers']
            print(f"   Found {len(drivers)} drivers with pending verifications")
            
            # Test document verification if we have drivers
            if drivers:
                driver_id = drivers[0]['id']
                
                # Test approve driver's license
                verification_data = {
                    "driver_id": driver_id,
                    "document_type": "drivers_license",
                    "status": "approved"
                }
                
                self.run_test(
                    "Approve Driver's License", 
                    "POST", 
                    "admin/verify-document", 
                    200,
                    verification_data,
                    headers=self.get_auth_headers(self.admin_token)
                )
                
                # Test reject taxi license with reason
                rejection_data = {
                    "driver_id": driver_id,
                    "document_type": "taxi_license",
                    "status": "rejected",
                    "rejection_reason": "Document not clear enough"
                }
                
                self.run_test(
                    "Reject Taxi License", 
                    "POST", 
                    "admin/verify-document", 
                    200,
                    rejection_data,
                    headers=self.get_auth_headers(self.admin_token)
                )
                
                # Test approve profile photo
                photo_approval_data = {
                    "driver_id": driver_id,
                    "document_type": "profile_photo",
                    "status": "approved"
                }
                
                self.run_test(
                    "Approve Profile Photo", 
                    "POST", 
                    "admin/verify-document", 
                    200,
                    photo_approval_data,
                    headers=self.get_auth_headers(self.admin_token)
                )

    def test_map_functionality(self):
        """Test map and driver location functionality"""
        print("\n" + "="*50)
        print("🗺️ MAP FUNCTIONALITY TESTS")
        print("="*50)
        
        # Test get nearby drivers (public endpoint)
        success, response = self.run_test(
            "Get Map Drivers", 
            "GET", 
            "map/drivers?lat=45.5017&lng=-73.5673&radius=10", 
            200
        )
        
        if success and 'drivers' in response:
            driver_count = len(response['drivers'])
            print(f"   Found {driver_count} drivers on map")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting SwiftMove API Test Suite")
        print(f"🎯 Testing against: {self.base_url}")
        
        start_time = datetime.now()
        
        try:
            self.test_health_check()
            self.test_authentication()
            self.test_user_profile_features()
            self.test_driver_profile_features()
            self.test_admin_verification_features()
            self.test_fare_estimation()
            self.test_taxi_booking()
            self.test_driver_functionality()
            self.test_admin_functionality()
            self.test_map_functionality()
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error: {e}")
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Print summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        print(f"Duration: {duration:.2f}s")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['test']} - {test.get('error', 'Status code mismatch')}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = TranspoAPITester()
    success = tester.run_focused_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())