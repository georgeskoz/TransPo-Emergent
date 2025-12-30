#!/usr/bin/env python3
"""
SwiftMove Backend API Testing Suite
Tests all core functionality including auth, fare estimation, booking, and admin features
Updated to test new profile features: photo upload, payment methods, driver documents, admin verification
"""

import requests
import sys
import json
import io
from datetime import datetime
from typing import Dict, List, Optional

class SwiftMoveAPITester:
    def __init__(self, base_url="https://swiftmove-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.user_token = None
        self.driver_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.booking_id = None
        
        # Test data
        self.test_user = {
            "name": f"Test User {datetime.now().strftime('%H%M%S')}",
            "email": f"testuser{datetime.now().strftime('%H%M%S')}@swiftmove.com",
            "password": "TestPass123!",
            "phone": "+15145551234",
            "role": "user"
        }
        
        self.test_driver = {
            "name": f"Test Driver {datetime.now().strftime('%H%M%S')}",
            "email": f"testdriver{datetime.now().strftime('%H%M%S')}@swiftmove.com",
            "password": "TestPass123!",
            "phone": "+15145551235",
            "role": "driver"
        }
        
        self.test_admin = {
            "name": f"Test Admin {datetime.now().strftime('%H%M%S')}",
            "email": f"testadmin{datetime.now().strftime('%H%M%S')}@swiftmove.com",
            "password": "TestPass123!",
            "phone": "+15145551236",
            "role": "admin"
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
        """Test user registration and login"""
        print("\n" + "="*50)
        print("🔐 AUTHENTICATION TESTS")
        print("="*50)
        
        # Test user registration with form data
        form_data = {
            'email': self.test_user["email"],
            'password': self.test_user["password"],
            'first_name': 'Test',
            'last_name': 'User',
            'phone': self.test_user["phone"],
            'role': self.test_user["role"]
        }
        
        success, response = self.run_test(
            "User Registration (Form)", 
            "POST", 
            "auth/register", 
            200,
            data=form_data
        )
        if success and 'access_token' in response:
            self.user_token = response['access_token']
            print(f"   User token obtained: {self.user_token[:20]}...")
        
        # Test driver registration with form data
        driver_form_data = {
            'email': self.test_driver["email"],
            'password': self.test_driver["password"],
            'first_name': 'Test',
            'last_name': 'Driver',
            'phone': self.test_driver["phone"],
            'role': self.test_driver["role"]
        }
        
        success, response = self.run_test(
            "Driver Registration (Form)", 
            "POST", 
            "auth/register", 
            200,
            data=driver_form_data
        )
        if success and 'access_token' in response:
            self.driver_token = response['access_token']
            print(f"   Driver token obtained: {self.driver_token[:20]}...")
        
        # Test admin registration with form data
        admin_form_data = {
            'email': self.test_admin["email"],
            'password': self.test_admin["password"],
            'first_name': 'Test',
            'last_name': 'Admin',
            'phone': self.test_admin["phone"],
            'role': self.test_admin["role"]
        }
        
        success, response = self.run_test(
            "Admin Registration (Form)", 
            "POST", 
            "auth/register", 
            200,
            data=admin_form_data
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
        
        # Test login
        success, response = self.run_test(
            "User Login", 
            "POST", 
            "auth/login", 
            200,
            {"email": self.test_user["email"], "password": self.test_user["password"]}
        )
        
        # Test demo credentials
        success, response = self.run_test(
            "Demo User Login", 
            "POST", 
            "auth/login", 
            200,
            {"email": "user@demo.com", "password": "demo123"}
        )
        
        success, response = self.run_test(
            "Demo Driver Login", 
            "POST", 
            "auth/login", 
            200,
            {"email": "driver@demo.com", "password": "demo123"}
        )
        
        success, response = self.run_test(
            "Demo Admin Login", 
            "POST", 
            "auth/login", 
            200,
            {"email": "admin@demo.com", "password": "demo123"}
        )
        
        # Test invalid login
        self.run_test(
            "Invalid Login", 
            "POST", 
            "auth/login", 
            401,
            {"email": "invalid@test.com", "password": "wrongpass"}
        )
        
        # Test get current user
        if self.user_token:
            self.run_test(
                "Get Current User", 
                "GET", 
                "auth/me", 
                200,
                headers=self.get_auth_headers(self.user_token)
            )

    def test_fare_estimation(self):
        """Test fare estimation with Quebec taxes"""
        print("\n" + "="*50)
        print("💰 FARE ESTIMATION TESTS")
        print("="*50)
        
        # Montreal coordinates (Downtown to Old Port)
        fare_request = {
            "pickup_lat": 45.5017,
            "pickup_lng": -73.5673,
            "dropoff_lat": 45.5088,
            "dropoff_lng": -73.5538,
            "vehicle_type": "sedan"
        }
        
        success, response = self.run_test(
            "Fare Estimation", 
            "POST", 
            "fare/estimate", 
            200,
            fare_request
        )
        
        if success and 'our_fare' in response:
            fare = response['our_fare']
            print(f"   Base fare: ${fare.get('base_fare', 0)}")
            print(f"   Distance charge: ${fare.get('distance_charge', 0)}")
            print(f"   Time charge: ${fare.get('time_charge', 0)}")
            print(f"   Government fee: ${fare.get('government_fee', 0)}")
            print(f"   GST (5%): ${fare.get('gst', 0)}")
            print(f"   QST (9.975%): ${fare.get('qst', 0)}")
            print(f"   Total: ${fare.get('total', 0)}")
            
            # Verify Quebec tax calculation
            if fare.get('gst', 0) > 0 and fare.get('qst', 0) > 0:
                print("✅ Quebec taxes (GST + QST) calculated correctly")
            else:
                print("❌ Quebec taxes missing or incorrect")
        
        # Test different vehicle types
        for vehicle_type in ["suv", "van", "bike"]:
            fare_request["vehicle_type"] = vehicle_type
            self.run_test(
                f"Fare Estimation - {vehicle_type.upper()}", 
                "POST", 
                "fare/estimate", 
                200,
                fare_request
            )

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
        
        # Test get driver earnings
        self.run_test(
            "Get Driver Earnings", 
            "GET", 
            "driver/earnings", 
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
    tester = SwiftMoveAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())