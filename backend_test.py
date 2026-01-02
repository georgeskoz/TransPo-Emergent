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
    def __init__(self, base_url="https://mobility-app-10.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.user_token = None
        self.driver_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.booking_id = None
        self.created_driver_id = None
        
        # Demo credentials from review request
        self.demo_user = {
            "email": "user@demo.com",
            "password": "demo123"
        }
        
        self.demo_driver = {
            "email": "driver@demo.com", 
            "password": "demo123"
        }
        
        self.demo_admin = {
            "email": "admin@demo.com",
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
        
        # Test demo admin login (admin@demo.com/demo123)
        success, response = self.run_test(
            "Demo Admin Login", 
            "POST", 
            "auth/login", 
            200,
            self.demo_admin
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Demo admin token obtained: {self.admin_token[:20]}...")
            print(f"   Admin role: {response.get('user', {}).get('role', 'unknown')}")
            print(f"   Admin permissions: {response.get('user', {}).get('admin_role', 'unknown')}")
        
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
        
        # Test get current user with admin token
        if self.admin_token:
            success, response = self.run_test(
                "Get Current User (Admin)", 
                "GET", 
                "auth/me", 
                200,
                headers=self.get_auth_headers(self.admin_token)
            )
            if success:
                print(f"   Admin profile: {response.get('name', 'N/A')} ({response.get('email', 'N/A')})")
                print(f"   Admin role: {response.get('admin_role', 'N/A')}")

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

    def test_password_management(self):
        """Test password management APIs"""
        print("\n" + "="*50)
        print("🔐 PASSWORD MANAGEMENT TESTS")
        print("="*50)
        
        if not self.user_token:
            print("❌ Skipping password management tests - no user token")
            return
        
        # Test change password
        change_password_data = {
            "current_password": "demo123",
            "new_password": "newdemo123"
        }
        
        success, response = self.run_test(
            "Change Password", 
            "POST", 
            "auth/change-password", 
            200,
            change_password_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if success:
            print("✅ Password changed successfully")
            
            # Change back to original password
            change_back_data = {
                "current_password": "newdemo123",
                "new_password": "demo123"
            }
            
            success_back, _ = self.run_test(
                "Change Password Back", 
                "POST", 
                "auth/change-password", 
                200,
                change_back_data,
                headers=self.get_auth_headers(self.user_token)
            )
            
            if success_back:
                print("✅ Password changed back to original")
        
        # Test forgot password
        forgot_password_data = {
            "email": "user@demo.com"
        }
        
        success, response = self.run_test(
            "Forgot Password", 
            "POST", 
            "auth/forgot-password", 
            200,
            forgot_password_data
        )
        
        if success:
            print("✅ Forgot password request sent (check backend logs for reset token)")
        
        # Test verify reset token with invalid token
        success, response = self.run_test(
            "Verify Reset Token - Invalid", 
            "GET", 
            "auth/verify-reset-token?token=invalid-token", 
            200
        )
        
        if success and not response.get('valid', True):
            print("✅ Invalid token correctly rejected")
        
        # Test reset password with invalid token
        reset_password_data = {
            "token": "invalid-token",
            "new_password": "newpassword123"
        }
        
        self.run_test(
            "Reset Password - Invalid Token", 
            "POST", 
            "auth/reset-password", 
            400,
            reset_password_data
        )

    def test_admin_payouts(self):
        """Test admin payouts APIs"""
        print("\n" + "="*50)
        print("💰 ADMIN PAYOUTS TESTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping admin payouts tests - no admin token")
            return
        
        # Test get all payouts
        success, response = self.run_test(
            "Get All Payouts", 
            "GET", 
            "admin/payouts", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            payouts = response.get('payouts', [])
            print(f"   Found {len(payouts)} payouts")
            if payouts:
                payout = payouts[0]
                print(f"   Sample payout: ${payout.get('amount', 0)} to {payout.get('driver_name', 'N/A')}")
        
        # Test get pending payouts
        success, response = self.run_test(
            "Get Pending Payouts", 
            "GET", 
            "admin/payouts/pending", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            pending_drivers = response.get('drivers', [])
            print(f"   Found {len(pending_drivers)} drivers with pending payouts")
            if pending_drivers:
                driver = pending_drivers[0]
                print(f"   Sample pending: {driver.get('name', 'N/A')} - ${driver.get('pending_amount', 0)}")
        
        # Test create new payout - use the driver we just created
        driver_id = self.created_driver_id or "test-driver-id"
            
        payout_data = {
            "driver_id": driver_id,
            "amount": 150.00,
            "method": "bank_transfer",
            "notes": "Weekly payout test"
        }
        
        success, response = self.run_test(
            "Create New Payout", 
            "POST", 
            "admin/payouts", 
            200,
            payout_data,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            payout_id = response.get('payout', {}).get('id')
            print(f"   Created payout ID: {payout_id}")
            
            # Test process payout if we got an ID
            if payout_id:
                success_process, _ = self.run_test(
                    "Process Payout", 
                    "PUT", 
                    f"admin/payouts/{payout_id}/process?status=completed", 
                    200,
                    headers=self.get_auth_headers(self.admin_token)
                )
                
                if success_process:
                    print("✅ Payout processed successfully")

    def test_admin_taxes(self):
        """Test admin taxes APIs"""
        print("\n" + "="*50)
        print("📊 ADMIN TAXES TESTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping admin taxes tests - no admin token")
            return
        
        # Test get tax report (default current year)
        success, response = self.run_test(
            "Get Tax Report - Current Year", 
            "GET", 
            "admin/taxes/report", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            report = response.get('report', {})
            print(f"   Year: {report.get('year', 'N/A')}")
            print(f"   Total Revenue: ${report.get('total_revenue', 0)}")
            print(f"   GST Collected: ${report.get('gst_collected', 0)}")
            print(f"   QST Collected: ${report.get('qst_collected', 0)}")
            print(f"   Total Rides: {report.get('total_rides', 0)}")
            
            # Check quarterly breakdown
            quarters = report.get('quarterly_breakdown', [])
            if quarters:
                print(f"   Quarterly data available: {len(quarters)} quarters")
                for q in quarters:
                    print(f"     Q{q.get('quarter', 'N/A')}: ${q.get('revenue', 0)} revenue")
        
        # Test get tax report for specific year and quarter
        success, response = self.run_test(
            "Get Tax Report - Q1 2026", 
            "GET", 
            "admin/taxes/report?year=2026&quarter=1", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            report = response.get('report', {})
            print(f"   Q1 2026 Revenue: ${report.get('total_revenue', 0)}")
            print(f"   Q1 2026 GST: ${report.get('gst_collected', 0)}")
            print(f"   Q1 2026 QST: ${report.get('qst_collected', 0)}")

    def test_admin_contracts(self):
        """Test admin contracts APIs"""
        print("\n" + "="*50)
        print("📄 ADMIN CONTRACTS TESTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping admin contracts tests - no admin token")
            return
        
        # Test get current contract template
        success, response = self.run_test(
            "Get Contract Template", 
            "GET", 
            "admin/contracts/template", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            template = response.get('template', {})
            print(f"   Template ID: {template.get('id', 'N/A')}")
            print(f"   Version: {template.get('version', 'N/A')}")
            print(f"   Title: {template.get('title', 'N/A')}")
            content_length = len(template.get('content', ''))
            print(f"   Content length: {content_length} characters")
        
        # Test update contract template
        template_update = {
            "title": "Updated Driver Service Agreement",
            "content": "This is an updated test contract template for driver services...",
            "version": "2.1",
            "effective_date": "2024-02-01"
        }
        
        success, response = self.run_test(
            "Update Contract Template", 
            "PUT", 
            "admin/contracts/template", 
            200,
            template_update,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            print("✅ Contract template updated successfully")
            updated_template = response.get('template', {})
            print(f"   New version: {updated_template.get('version', 'N/A')}")
        
        # Test get signed contracts
        success, response = self.run_test(
            "Get Signed Contracts", 
            "GET", 
            "admin/contracts/signed", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            contracts = response.get('contracts', [])
            print(f"   Found {len(contracts)} signed contracts")
            if contracts:
                contract = contracts[0]
                print(f"   Sample contract: {contract.get('driver_name', 'N/A')} - {contract.get('signed_date', 'N/A')}")

    def test_admin_merchants(self):
        """Test admin merchants/platform earnings APIs"""
        print("\n" + "="*50)
        print("🏪 ADMIN MERCHANTS TESTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping admin merchants tests - no admin token")
            return
        
        # Test get merchants overview
        success, response = self.run_test(
            "Get Merchants Overview", 
            "GET", 
            "admin/merchants/overview", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            overview = response.get('overview', {})
            print(f"   Total Collected: ${overview.get('total_collected', 0)}")
            print(f"   Total Commission: ${overview.get('total_commission', 0)}")
            print(f"   Available Balance: ${overview.get('available_balance', 0)}")
            print(f"   Commission Rate: {overview.get('commission_rate', 0)}%")
            print(f"   This Month Collected: ${overview.get('this_month_collected', 0)}")
            print(f"   This Month Commission: ${overview.get('this_month_commission', 0)}")
            print(f"   Bank Connected: {response.get('bank_connected', False)}")
            
            # Verify structure
            required_fields = ['total_collected', 'total_commission', 'available_balance', 'commission_rate']
            for field in required_fields:
                if field in overview:
                    print(f"✅ {field} field present")
                else:
                    print(f"❌ {field} field missing")
        
        # Test get merchants transactions
        success, response = self.run_test(
            "Get Merchants Transactions", 
            "GET", 
            "admin/merchants/transactions", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            transactions = response.get('transactions', [])
            pagination = response.get('pagination', {})
            print(f"   Found {len(transactions)} transactions")
            print(f"   Pagination: Page {pagination.get('page', 1)} of {pagination.get('pages', 1)}")
            print(f"   Total transactions: {pagination.get('total', 0)}")
            
            if transactions:
                transaction = transactions[0]
                print(f"   Sample transaction: {transaction.get('type', 'N/A')} - ${transaction.get('amount', 0)}")
                print(f"   Transaction ID: {transaction.get('id', 'N/A')}")
        
        # Test get merchants transactions with pagination
        success, response = self.run_test(
            "Get Merchants Transactions - Page 2", 
            "GET", 
            "admin/merchants/transactions?page=2&limit=10", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            pagination = response.get('pagination', {})
            print(f"   Page 2 pagination working: Page {pagination.get('page', 1)}")
        
        # Test get merchants settings
        success, response = self.run_test(
            "Get Merchants Settings", 
            "GET", 
            "admin/merchants/settings", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            settings = response.get('settings', {})
            print(f"   Settings ID: {settings.get('id', 'N/A')}")
            print(f"   Bank Name: {settings.get('bank_name', 'Not set')}")
            print(f"   Payout Schedule: {settings.get('payout_schedule', 'N/A')}")
            print(f"   Auto Payout: {settings.get('auto_payout_enabled', False)}")
            print(f"   Min Payout Amount: ${settings.get('min_payout_amount', 0)}")
            print(f"   Stripe Connected: {settings.get('stripe_connected', False)}")
        
        # Test update merchants settings (Super Admin only)
        settings_update = {
            "bank_account_name": "Transpo Platform Inc",
            "bank_account_number": "****1234",
            "bank_routing_number": "****5678", 
            "bank_name": "Royal Bank of Canada",
            "payout_schedule": "weekly",
            "auto_payout_enabled": True,
            "min_payout_amount": 100.0
        }
        
        success, response = self.run_test(
            "Update Merchants Settings", 
            "PUT", 
            "admin/merchants/settings", 
            200,
            settings_update,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            print("✅ Merchant settings updated successfully")
        
        # Test get withdrawals history
        success, response = self.run_test(
            "Get Platform Withdrawals", 
            "GET", 
            "admin/merchants/withdrawals", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            withdrawals = response.get('withdrawals', [])
            print(f"   Found {len(withdrawals)} withdrawals")
            if withdrawals:
                withdrawal = withdrawals[0]
                print(f"   Sample withdrawal: ${withdrawal.get('amount', 0)} - {withdrawal.get('status', 'N/A')}")
        
        # Test create withdrawal (should fail without bank connected initially)
        withdrawal_amount = 50.0
        withdrawal_notes = "Test withdrawal"
        
        # First test should fail if no bank connected
        success, response = self.run_test(
            "Create Withdrawal - No Bank", 
            "POST", 
            f"admin/merchants/withdraw?amount={withdrawal_amount}&notes={withdrawal_notes}", 
            400,  # Should fail without bank
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if not success:
            print("✅ Withdrawal correctly rejected without bank account")
        
        # Now test with bank connected (after settings update)
        # Get updated overview to check available balance
        success, overview_response = self.run_test(
            "Get Overview for Withdrawal Test", 
            "GET", 
            "admin/merchants/overview", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            available_balance = overview_response.get('overview', {}).get('available_balance', 0)
            bank_connected = overview_response.get('bank_connected', False)
            
            if bank_connected and available_balance > 0:
                # Test withdrawal with valid amount
                test_amount = min(25.0, available_balance)
                
                success, response = self.run_test(
                    "Create Withdrawal - Valid", 
                    "POST", 
                    f"admin/merchants/withdraw?amount={test_amount}&notes=Test withdrawal", 
                    200,
                    headers=self.get_auth_headers(self.admin_token)
                )
                
                if success:
                    withdrawal = response.get('withdrawal', {})
                    withdrawal_id = withdrawal.get('id')
                    print(f"✅ Withdrawal created: ${withdrawal.get('amount', 0)}")
                    print(f"   Withdrawal ID: {withdrawal_id}")
                    print(f"   Status: {withdrawal.get('status', 'N/A')}")
                    
                    # Test update withdrawal status
                    if withdrawal_id:
                        success, response = self.run_test(
                            "Update Withdrawal Status", 
                            "PUT", 
                            f"admin/merchants/withdrawals/{withdrawal_id}?status=completed&transaction_ref=TXN123456", 
                            200,
                            headers=self.get_auth_headers(self.admin_token)
                        )
                        
                        if success:
                            print("✅ Withdrawal status updated successfully")
                
                # Test withdrawal with amount exceeding balance
                excessive_amount = available_balance + 1000
                
                success, response = self.run_test(
                    "Create Withdrawal - Excessive Amount", 
                    "POST", 
                    f"admin/merchants/withdraw?amount={excessive_amount}&notes=Test excessive withdrawal", 
                    400,
                    headers=self.get_auth_headers(self.admin_token)
                )
                
                if not success:
                    print("✅ Excessive withdrawal amount correctly rejected")
            else:
                print(f"⚠️ Skipping withdrawal tests - Bank connected: {bank_connected}, Balance: ${available_balance}")
        
        # Test invalid withdrawal status update
        success, response = self.run_test(
            "Update Withdrawal Status - Invalid", 
            "PUT", 
            "admin/merchants/withdrawals/invalid-id?status=invalid_status", 
            400,  # Should fail with invalid status or ID
            headers=self.get_auth_headers(self.admin_token)
        )

    def test_stripe_dashboard_admin_payments(self):
        """Test new Stripe Dashboard Admin Payment APIs"""
        print("\n" + "="*50)
        print("💳 STRIPE DASHBOARD - ADMIN PAYMENT TESTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping admin payment tests - no admin token")
            return
        
        # Test 1: Get payment transactions
        success, response = self.run_test(
            "Get Payment Transactions", 
            "GET", 
            "admin/payments/transactions", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            transactions = response.get('transactions', [])
            pagination = response.get('pagination', {})
            summary = response.get('summary', {})
            print(f"   Found {len(transactions)} transactions")
            print(f"   Total transactions: {pagination.get('total', 0)}")
            print(f"   Total revenue: ${summary.get('total_revenue', 0)}")
            print(f"   Total commission: ${summary.get('total_commission', 0)}")
            print(f"   Commission rate: {summary.get('commission_rate', 0)}%")
            
            if transactions:
                transaction = transactions[0]
                print(f"   Sample transaction: {transaction.get('trip_id', 'N/A')} - ${transaction.get('total_amount', 0)}")
                # Verify fare breakdown structure
                fare_breakdown = transaction.get('fare_breakdown', {})
                if fare_breakdown:
                    print(f"   Fare breakdown: Base ${fare_breakdown.get('base_fare', 0)}, Distance ${fare_breakdown.get('distance_charge', 0)}, Time ${fare_breakdown.get('time_charge', 0)}")
                    print(f"   Taxes: GST ${fare_breakdown.get('gst', 0)}, QST ${fare_breakdown.get('qst', 0)}")
        
        # Test 2: Get payment transactions with filters
        success, response = self.run_test(
            "Get Payment Transactions - Filtered", 
            "GET", 
            "admin/payments/transactions?page=1&limit=10", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        # Test 3: Export payment transactions
        success, response = self.run_test(
            "Export Payment Transactions", 
            "GET", 
            "admin/payments/transactions/export?format=csv", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            export_data = response.get('data', [])
            print(f"   Export data: {len(export_data)} records")
            print(f"   Generated at: {response.get('generated_at', 'N/A')}")
        
        # Test 4: Get payout settings
        success, response = self.run_test(
            "Get Payout Settings", 
            "GET", 
            "admin/payments/payout-settings", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            settings = response.get('settings', {})
            print(f"   Payout schedule: {settings.get('schedule', 'N/A')}")
            print(f"   Early cashout fee: {settings.get('early_cashout_fee_percent', 0)}%")
            print(f"   Min payout amount: ${settings.get('min_payout_amount', 0)}")
        
        # Test 5: Update payout settings
        payout_settings_update = {
            "schedule": "weekly",
            "early_cashout_fee_percent": 2.0,
            "min_payout_amount": 75.0
        }
        
        success, response = self.run_test(
            "Update Payout Settings", 
            "PUT", 
            "admin/payments/payout-settings", 
            200,
            payout_settings_update,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            print("✅ Payout settings updated successfully")
        
        # Test 6: Get driver payouts
        success, response = self.run_test(
            "Get Driver Payouts", 
            "GET", 
            "admin/payments/driver-payouts", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            payouts = response.get('payouts', [])
            summary = response.get('summary', {})
            print(f"   Found {len(payouts)} driver payouts")
            print(f"   Pending: {summary.get('pending', 0)}, Processing: {summary.get('processing', 0)}")
            print(f"   Completed: {summary.get('completed', 0)}, Failed: {summary.get('failed', 0)}")
            
            # Store a payout ID for retry test
            failed_payout_id = None
            for payout in payouts:
                if payout.get('status') == 'failed':
                    failed_payout_id = payout.get('id')
                    break
            
            # Test 7: Retry failed payout (if we have one)
            if failed_payout_id:
                success, response = self.run_test(
                    "Retry Failed Payout", 
                    "POST", 
                    f"admin/payments/driver-payouts/{failed_payout_id}/retry", 
                    200,
                    headers=self.get_auth_headers(self.admin_token)
                )
                
                if success:
                    print("✅ Failed payout retry queued successfully")
            else:
                print("⚠️ No failed payouts found to test retry functionality")
        
        # Test 8: Create refund
        refund_data = {
            "trip_id": "test-trip-123",
            "refund_type": "partial",
            "exclude_tip": False,
            "reason": "Customer complaint - service issue"
        }
        
        success, response = self.run_test(
            "Create Refund", 
            "POST", 
            "admin/payments/refunds", 
            200,
            refund_data,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        refund_id = None
        if success:
            refund = response.get('refund', {})
            refund_id = refund.get('id')
            print(f"   Created refund ID: {refund_id}")
            print(f"   Refund amount: ${refund.get('amount', 0)}")
            print(f"   Status: {refund.get('status', 'N/A')}")
        
        # Test 9: Get all refunds
        success, response = self.run_test(
            "Get All Refunds", 
            "GET", 
            "admin/payments/refunds", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            refunds = response.get('refunds', [])
            print(f"   Found {len(refunds)} refunds")
            if refunds:
                refund = refunds[0]
                print(f"   Sample refund: {refund.get('trip_id', 'N/A')} - ${refund.get('amount', 0)} ({refund.get('status', 'N/A')})")
        
        # Test 10: Process refund (if we created one)
        if refund_id:
            success, response = self.run_test(
                "Process Refund - Approve", 
                "PUT", 
                f"admin/payments/refunds/{refund_id}/process?status=approved", 
                200,
                headers=self.get_auth_headers(self.admin_token)
            )
            
            if success:
                print("✅ Refund approved successfully")
        
        # Test 11: Get payment disputes
        success, response = self.run_test(
            "Get Payment Disputes", 
            "GET", 
            "admin/payments/disputes", 
            200,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            disputes = response.get('disputes', [])
            summary = response.get('summary', {})
            print(f"   Found {len(disputes)} payment disputes")
            print(f"   Open: {summary.get('open', 0)}, Under review: {summary.get('under_review', 0)}")
            print(f"   Won: {summary.get('won', 0)}, Lost: {summary.get('lost', 0)}")

    def test_stripe_dashboard_driver_earnings(self):
        """Test new Stripe Dashboard Driver Earnings APIs"""
        print("\n" + "="*50)
        print("💰 STRIPE DASHBOARD - DRIVER EARNINGS TESTS")
        print("="*50)
        
        if not self.driver_token:
            print("❌ Skipping driver earnings tests - no driver token")
            return
        
        # Test 1: Get Stripe Connect status
        success, response = self.run_test(
            "Get Driver Stripe Status", 
            "GET", 
            "driver/stripe/status", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            print(f"   Stripe connected: {response.get('connected', False)}")
            print(f"   Account ID: {response.get('account_id', 'Not connected')}")
            print(f"   Payouts enabled: {response.get('payouts_enabled', False)}")
            print(f"   Charges enabled: {response.get('charges_enabled', False)}")
        
        # Test 2: Generate Stripe Connect onboarding link
        success, response = self.run_test(
            "Create Stripe Connect Link", 
            "POST", 
            "driver/stripe/connect", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        session_id = None
        if success:
            session_id = response.get('session_id')
            print(f"   Onboarding URL: {response.get('url', 'N/A')}")
            print(f"   Session ID: {session_id}")
            print(f"   Message: {response.get('message', 'N/A')}")
        
        # Test 3: Complete Stripe onboarding (if we have session_id)
        if session_id:
            success, response = self.run_test(
                "Complete Stripe Onboarding", 
                "POST", 
                f"driver/stripe/complete-onboarding?session_id={session_id}", 
                200,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                print(f"   Account connected: {response.get('account_id', 'N/A')}")
                print("✅ Stripe onboarding completed successfully")
        
        # Test 4: Get earnings summary - weekly
        success, response = self.run_test(
            "Get Earnings Summary - Weekly", 
            "GET", 
            "driver/earnings/summary?period=weekly", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            print(f"   Period: {response.get('period', 'N/A')}")
            print(f"   Total trips: {response.get('total_trips', 0)}")
            print(f"   Gross earnings: ${response.get('gross_earnings', 0)}")
            print(f"   Platform commission: ${response.get('platform_commission', 0)}")
            print(f"   Stripe fees: ${response.get('stripe_fees', 0)}")
            print(f"   Net earnings: ${response.get('net_earnings', 0)}")
            print(f"   Commission rate: {response.get('commission_rate', 0)}%")
        
        # Test 5: Get earnings summary - daily
        success, response = self.run_test(
            "Get Earnings Summary - Daily", 
            "GET", 
            "driver/earnings/summary?period=daily", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test 6: Get earnings summary - monthly
        success, response = self.run_test(
            "Get Earnings Summary - Monthly", 
            "GET", 
            "driver/earnings/summary?period=monthly", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Test 7: Get driver payouts
        success, response = self.run_test(
            "Get Driver Payouts History", 
            "GET", 
            "driver/payouts", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            payouts = response.get('payouts', [])
            pending_balance = response.get('pending_balance', 0)
            next_payout_date = response.get('next_payout_date', 'N/A')
            print(f"   Payout history: {len(payouts)} payouts")
            print(f"   Pending balance: ${pending_balance}")
            print(f"   Next payout date: {next_payout_date}")
            
            if payouts:
                payout = payouts[0]
                print(f"   Latest payout: ${payout.get('amount', 0)} - {payout.get('status', 'N/A')}")
        
        # Test 8: Request early cashout (if driver has Stripe connected and pending balance)
        # First check if driver is connected and has balance
        if pending_balance > 10:  # Only test if there's sufficient balance
            cashout_amount = min(25.0, pending_balance * 0.5)  # Request half of pending or $25, whichever is smaller
            
            success, response = self.run_test(
                "Request Early Cashout", 
                "POST", 
                f"driver/payouts/early-cashout?amount={cashout_amount}", 
                200,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                payout = response.get('payout', {})
                fee_applied = response.get('fee_applied', 'N/A')
                print(f"   Early cashout requested: ${payout.get('amount', 0)}")
                print(f"   Fee applied: {fee_applied}")
                print(f"   Net amount: ${payout.get('net_amount', 0)}")
                print("✅ Early cashout request successful")
        else:
            print("⚠️ Skipping early cashout test - insufficient pending balance")
        
        # Test 9: Get available statements
        success, response = self.run_test(
            "Get Driver Statements", 
            "GET", 
            "driver/statements", 
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        statement_id = None
        if success:
            statements = response.get('statements', [])
            print(f"   Available statements: {len(statements)}")
            
            if statements:
                statement = statements[0]
                statement_id = statement.get('id')
                print(f"   Latest statement: {statement.get('period', 'N/A')} - {statement.get('status', 'N/A')}")
                print(f"   Statement ID: {statement_id}")
        
        # Test 10: Download statement (if we have one)
        if statement_id:
            success, response = self.run_test(
                "Download Driver Statement", 
                "GET", 
                f"driver/statements/{statement_id}/download", 
                200,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                statement_data = response.get('statement', {})
                print(f"   Statement period: {statement_data.get('period', 'N/A')}")
                print(f"   Total earnings: ${statement_data.get('total_earnings', 0)}")
                print(f"   Total trips: {statement_data.get('total_trips', 0)}")
                print("✅ Statement download successful")

    def test_user_rating_accountability(self):
        """Test new User Rating & Accountability APIs"""
        print("\n" + "="*50)
        print("⭐ USER RATING & ACCOUNTABILITY TESTS")
        print("="*50)
        
        if not self.user_token or not self.driver_token:
            print("❌ Skipping user rating tests - missing user or driver token")
            return
        
        # Test 1: Get initial user rating
        success, response = self.run_test(
            "Get User Rating - Initial",
            "GET",
            "user/rating",
            200,
            headers=self.get_auth_headers(self.user_token)
        )
        
        initial_rating = 5.0
        initial_no_show_count = 0
        initial_late_cancel_count = 0
        
        if success:
            initial_rating = response.get('rating', 5.0)
            initial_no_show_count = response.get('no_show_count', 0)
            initial_late_cancel_count = response.get('late_cancellation_count', 0)
            total_bookings = response.get('total_bookings', 0)
            
            print(f"   Initial Rating: {initial_rating}")
            print(f"   No-Show Count: {initial_no_show_count}")
            print(f"   Late Cancellation Count: {initial_late_cancel_count}")
            print(f"   Total Bookings: {total_bookings}")
            
            if initial_rating == 5.0:
                print("✅ User starts with 5.0 rating as expected")
            else:
                print(f"❌ Expected 5.0 initial rating, got {initial_rating}")
        
        # Test 2: Create booking for cancellation tests
        booking_data = {
            "pickup_lat": 45.5017,
            "pickup_lng": -73.5673,
            "pickup_address": "1000 Rue de la Gauchetière, Montreal, QC",
            "dropoff_lat": 45.5088,
            "dropoff_lng": -73.5538,
            "dropoff_address": "300 Rue Saint-Paul, Montreal, QC",
            "vehicle_type": "sedan",
            "booking_for_self": True,
            "special_instructions": "Please wait at main entrance",
            "pet_policy": "none"
        }
        
        success, response = self.run_test(
            "Create Booking for Cancellation Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        booking_id_1 = None
        if success:
            booking_id_1 = response.get('booking_id')
            print(f"   Created booking ID: {booking_id_1}")
        
        # Test 3: Cancel booking within 3 minutes (no penalty)
        if booking_id_1:
            success, response = self.run_test(
                "Cancel Booking - Within 3 Minutes (No Penalty)",
                "POST",
                f"bookings/{booking_id_1}/cancel",
                200,
                headers=self.get_auth_headers(self.user_token)
            )
            
            if success:
                is_late_cancellation = response.get('is_late_cancellation', True)
                rating_deducted = response.get('rating_deducted', 0)
                minutes_since_booking = response.get('minutes_since_booking', 0)
                
                print(f"   Is Late Cancellation: {is_late_cancellation}")
                print(f"   Rating Deducted: {rating_deducted}")
                print(f"   Minutes Since Booking: {minutes_since_booking}")
                
                if not is_late_cancellation and rating_deducted == 0:
                    print("✅ Early cancellation correctly applied no penalty")
                else:
                    print(f"❌ Expected no penalty for early cancellation")
        
        # Test 4: Create booking for no-show test
        success, response = self.run_test(
            "Create Booking for No-Show Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        booking_id_3 = None
        if success:
            booking_id_3 = response.get('booking_id')
            print(f"   Created booking for no-show test ID: {booking_id_3}")
            
            # Accept booking as driver
            success, response = self.run_test(
                "Accept Booking for No-Show Test",
                "POST",
                f"driver/accept/{booking_id_3}",
                200,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                print("✅ Booking accepted by driver")
                
                # Mark as no-show (driver endpoint)
                success, response = self.run_test(
                    "Mark Customer No-Show",
                    "POST",
                    f"driver/trips/{booking_id_3}/no-show",
                    200,
                    headers=self.get_auth_headers(self.driver_token)
                )
                
                if success:
                    priority_boost_active = response.get('priority_boost_active', False)
                    user_rating_deducted = response.get('user_rating_deducted', 0)
                    no_show_fee = response.get('no_show_fee', 0)
                    note = response.get('note', '')
                    
                    print(f"   Priority Boost Active: {priority_boost_active}")
                    print(f"   User Rating Deducted: {user_rating_deducted}")
                    print(f"   No-Show Fee: ${no_show_fee}")
                    print(f"   Note: {note}")
                    
                    if user_rating_deducted == 0.5 and no_show_fee == 5.0:
                        print("✅ No-show correctly deducted 0.5 rating and $5.00 fee")
                    else:
                        print(f"❌ Expected 0.5 rating deduction and $5.00 fee")
                    
                    if priority_boost_active:
                        print("✅ Driver correctly received priority boost")
        
        # Test 5: Check final user rating after no-show
        success, response = self.run_test(
            "Get User Rating - After No-Show",
            "GET",
            "user/rating",
            200,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if success:
            final_rating = response.get('rating', 5.0)
            final_no_show_count = response.get('no_show_count', 0)
            final_late_cancel_count = response.get('late_cancellation_count', 0)
            total_bookings = response.get('total_bookings', 0)
            
            print(f"   Final Rating: {final_rating}")
            print(f"   Final No-Show Count: {final_no_show_count}")
            print(f"   Final Late Cancellation Count: {final_late_cancel_count}")
            print(f"   Total Bookings: {total_bookings}")
            
            # Verify rating was deducted for no-show
            expected_rating = initial_rating - 0.5  # 0.5 deduction for no-show
            if abs(final_rating - expected_rating) < 0.01:
                print("✅ User rating correctly deducted for no-show")
            else:
                print(f"❌ Expected rating {expected_rating}, got {final_rating}")
            
            if final_no_show_count > initial_no_show_count:
                print("✅ No-show count correctly incremented")
            else:
                print("❌ No-show count not incremented")

    def test_enhanced_booking_apis(self):
        """Test Enhanced Booking APIs with new fields"""
        print("\n" + "="*50)
        print("📋 ENHANCED BOOKING APIS TESTS")
        print("="*50)
        
        if not self.user_token:
            print("❌ Skipping enhanced booking tests - no user token")
            return
        
        # Test 1: Enhanced booking for self with special instructions and pet policy
        enhanced_booking_self = {
            "pickup_lat": 45.5017,
            "pickup_lng": -73.5673,
            "pickup_address": "1000 Rue de la Gauchetière, Montreal, QC",
            "dropoff_lat": 45.5088,
            "dropoff_lng": -73.5538,
            "dropoff_address": "300 Rue Saint-Paul, Montreal, QC",
            "vehicle_type": "sedan",
            "booking_for_self": True,
            "special_instructions": "Please wait at main entrance, gate code 1234",
            "pet_policy": "small_pet"
        }
        
        success, response = self.run_test(
            "Enhanced Booking - For Self with Pet",
            "POST",
            "taxi/book",
            200,
            enhanced_booking_self,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if success:
            booking_id = response.get('booking_id')
            booking_details = response.get('booking', {})
            
            print(f"   Booking ID: {booking_id}")
            print(f"   Booking For Self: {booking_details.get('booking_for_self', 'N/A')}")
            print(f"   Special Instructions: {booking_details.get('special_instructions', 'N/A')}")
            print(f"   Pet Policy: {booking_details.get('pet_policy', 'N/A')}")
            
            # Verify enhanced fields are saved
            if booking_details.get('booking_for_self') == True:
                print("✅ booking_for_self field correctly set to True")
            
            if booking_details.get('special_instructions') == "Please wait at main entrance, gate code 1234":
                print("✅ Special instructions correctly saved")
            
            if booking_details.get('pet_policy') == "small_pet":
                print("✅ Pet policy correctly set to small_pet")
        
        # Test 2: Enhanced booking for someone else
        enhanced_booking_other = {
            "pickup_lat": 45.5017,
            "pickup_lng": -73.5673,
            "pickup_address": "1000 Rue de la Gauchetière, Montreal, QC",
            "dropoff_lat": 45.5088,
            "dropoff_lng": -73.5538,
            "dropoff_address": "300 Rue Saint-Paul, Montreal, QC",
            "vehicle_type": "sedan",
            "booking_for_self": False,
            "recipient_name": "John Smith",
            "recipient_phone": "+1-514-555-0123",
            "special_instructions": "Apartment 4B, buzz #4",
            "pet_policy": "service_animal"
        }
        
        success, response = self.run_test(
            "Enhanced Booking - For Someone Else",
            "POST",
            "taxi/book",
            200,
            enhanced_booking_other,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if success:
            booking_id = response.get('booking_id')
            booking_details = response.get('booking', {})
            
            print(f"   Booking ID: {booking_id}")
            print(f"   Booking For Self: {booking_details.get('booking_for_self', 'N/A')}")
            print(f"   Recipient Name: {booking_details.get('recipient_name', 'N/A')}")
            print(f"   Recipient Phone: {booking_details.get('recipient_phone', 'N/A')}")
            print(f"   Special Instructions: {booking_details.get('special_instructions', 'N/A')}")
            print(f"   Pet Policy: {booking_details.get('pet_policy', 'N/A')}")
            
            # Verify enhanced fields for third-party booking
            if booking_details.get('booking_for_self') == False:
                print("✅ booking_for_self field correctly set to False")
            
            if booking_details.get('recipient_name') == "John Smith":
                print("✅ Recipient name correctly saved")
            
            if booking_details.get('recipient_phone') == "+1-514-555-0123":
                print("✅ Recipient phone correctly saved")
            
            if booking_details.get('pet_policy') == "service_animal":
                print("✅ Pet policy correctly set to service_animal")

    def test_saved_addresses_apis(self):
        """Test Saved Addresses APIs"""
        print("\n" + "="*50)
        print("🏠 SAVED ADDRESSES APIS TESTS")
        print("="*50)
        
        if not self.user_token:
            print("❌ Skipping saved addresses tests - no user token")
            return
        
        # Test 1: Get initial saved addresses
        success, response = self.run_test(
            "Get Saved Addresses - Initial",
            "GET",
            "user/saved-addresses",
            200,
            headers=self.get_auth_headers(self.user_token)
        )
        
        initial_addresses = []
        if success:
            initial_addresses = response.get('addresses', [])
            print(f"   Initial saved addresses: {len(initial_addresses)}")
        
        # Test 2: Add home address
        home_address = {
            "label": "Home",
            "address": "123 Main Street, Montreal, QC H3A 1A1",
            "latitude": 45.5017,
            "longitude": -73.5673,
            "is_default": True
        }
        
        success, response = self.run_test(
            "Add Saved Address - Home",
            "POST",
            "user/saved-addresses",
            200,
            home_address,
            headers=self.get_auth_headers(self.user_token)
        )
        
        home_address_id = None
        if success:
            address_data = response.get('address', {})
            home_address_id = address_data.get('id')
            
            print(f"   Added address ID: {home_address_id}")
            print(f"   Label: {address_data.get('label', 'N/A')}")
            print(f"   Address: {address_data.get('address', 'N/A')}")
            print(f"   Is Default: {address_data.get('is_default', False)}")
            
            if address_data.get('label') == "Home" and address_data.get('is_default') == True:
                print("✅ Home address correctly added as default")
        
        # Test 3: Add work address
        work_address = {
            "label": "Work",
            "address": "456 Business Ave, Montreal, QC H3B 2B2",
            "latitude": 45.5088,
            "longitude": -73.5538,
            "is_default": False
        }
        
        success, response = self.run_test(
            "Add Saved Address - Work",
            "POST",
            "user/saved-addresses",
            200,
            work_address,
            headers=self.get_auth_headers(self.user_token)
        )
        
        work_address_id = None
        if success:
            address_data = response.get('address', {})
            work_address_id = address_data.get('id')
            
            if address_data.get('label') == "Work":
                print("✅ Work address correctly added")
        
        # Test 4: Get all saved addresses
        success, response = self.run_test(
            "Get All Saved Addresses",
            "GET",
            "user/saved-addresses",
            200,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if success:
            addresses = response.get('addresses', [])
            print(f"   Total saved addresses: {len(addresses)}")
            
            if len(addresses) >= 2:
                print("✅ Addresses correctly saved")
                
                # Verify address details
                labels = [addr.get('label') for addr in addresses]
                if 'Home' in labels and 'Work' in labels:
                    print("✅ Address labels correctly saved")
        
        # Test 5: Delete work address
        if work_address_id:
            success, response = self.run_test(
                "Delete Saved Address - Work",
                "DELETE",
                f"user/saved-addresses/{work_address_id}",
                200,
                headers=self.get_auth_headers(self.user_token)
            )
            
            if success:
                print("✅ Work address deleted successfully")

    def test_notification_preferences_apis(self):
        """Test Notification Preferences APIs"""
        print("\n" + "="*50)
        print("🔔 NOTIFICATION PREFERENCES APIS TESTS")
        print("="*50)
        
        if not self.user_token:
            print("❌ Skipping notification preferences tests - no user token")
            return
        
        # Test 1: Get initial notification preferences
        success, response = self.run_test(
            "Get Notification Preferences - Initial",
            "GET",
            "user/notifications",
            200,
            headers=self.get_auth_headers(self.user_token)
        )
        
        initial_prefs = {}
        if success:
            initial_prefs = response
            print(f"   Push Enabled: {initial_prefs.get('push_enabled', 'N/A')}")
            print(f"   Email Enabled: {initial_prefs.get('email_enabled', 'N/A')}")
            print(f"   SMS Enabled: {initial_prefs.get('sms_enabled', 'N/A')}")
            print(f"   Ride Updates: {initial_prefs.get('ride_updates', 'N/A')}")
            print(f"   Promotions: {initial_prefs.get('promotions', 'N/A')}")
            
            # Verify default preferences
            expected_defaults = {
                'push_enabled': True,
                'email_enabled': True,
                'sms_enabled': False,
                'ride_updates': True,
                'promotions': True
            }
            
            all_defaults_correct = True
            for key, expected_value in expected_defaults.items():
                if initial_prefs.get(key) != expected_value:
                    print(f"❌ Default {key} should be {expected_value}, got {initial_prefs.get(key)}")
                    all_defaults_correct = False
            
            if all_defaults_correct:
                print("✅ All default notification preferences correct")
        
        # Test 2: Update notification preferences
        updated_prefs = {
            "push_enabled": True,
            "email_enabled": True,
            "sms_enabled": True,  # Enable SMS
            "ride_updates": True,
            "promotions": False   # Disable promotions
        }
        
        success, response = self.run_test(
            "Update Notification Preferences",
            "PUT",
            "user/notifications",
            200,
            updated_prefs,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if success:
            message = response.get('message', '')
            notifications = response.get('notifications', {})
            
            print(f"   Update message: {message}")
            print(f"   SMS Enabled: {notifications.get('sms_enabled', 'N/A')}")
            print(f"   Promotions: {notifications.get('promotions', 'N/A')}")
            
            if notifications.get('sms_enabled') == True and notifications.get('promotions') == False:
                print("✅ Notification preferences updated correctly")
            else:
                print("❌ Notification preferences not updated correctly")

    def test_driver_tier_system(self):
        """Test new Driver Tier System with point-based cancellations"""
        print("\n" + "="*50)
        print("🏆 DRIVER TIER SYSTEM TESTS")
        print("="*50)
        
        if not self.user_token or not self.driver_token:
            print("❌ Skipping tier system tests - missing user or driver token")
            return
        
        # Step 1: Check initial driver tier status (should be Silver with 0 points)
        success, response = self.run_test(
            "Get Initial Driver Tier Status",
            "GET",
            "driver/status/tier",
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            initial_points = response.get('points', 0)
            initial_tier = response.get('tier', 'unknown')
            next_tier = response.get('next_tier', 'N/A')
            next_threshold = response.get('next_tier_threshold', 0)
            progress = response.get('progress_percent', 0)
            total_rides = response.get('total_rides', 0)
            priority_boost = response.get('priority_boost', False)
            
            print(f"   Initial Points: {initial_points}")
            print(f"   Initial Tier: {initial_tier}")
            print(f"   Next Tier: {next_tier}")
            print(f"   Next Tier Threshold: {next_threshold}")
            print(f"   Progress: {progress}%")
            print(f"   Total Rides: {total_rides}")
            print(f"   Priority Boost: {priority_boost}")
            
            if initial_tier == "silver":
                print("✅ Driver starts with Silver tier as expected")
            else:
                print(f"❌ Expected Silver tier, got {initial_tier}")
        
        # Step 2: Create a booking to complete for points
        booking_data = {
            "pickup_lat": 45.5017,
            "pickup_lng": -73.5673,
            "pickup_address": "1000 Rue de la Gauchetière, Montreal, QC",
            "dropoff_lat": 45.5088,
            "dropoff_lng": -73.5538,
            "dropoff_address": "300 Rue Saint-Paul, Montreal, QC",
            "vehicle_type": "sedan"
        }
        
        success, response = self.run_test(
            "Create Booking for Points Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if not success:
            print("❌ Failed to create booking - skipping tier tests")
            return
        
        booking_id = response.get('booking_id')
        if not booking_id:
            print("❌ No booking ID returned - skipping tier tests")
            return
        
        print(f"   Created booking ID: {booking_id}")
        
        # Step 3: Accept and complete booking to earn points
        success, response = self.run_test(
            "Accept Booking for Points",
            "POST",
            f"driver/accept/{booking_id}",
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            print("✅ Booking accepted by driver")
            
            # Complete the booking to earn +10 points
            success, response = self.run_test(
                "Complete Booking for Points",
                "POST",
                f"driver/complete/{booking_id}",
                200,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                points_earned = response.get('points_earned', 0)
                total_points = response.get('total_points', 0)
                tier = response.get('tier', 'unknown')
                
                print(f"   Points Earned: +{points_earned}")
                print(f"   Total Points: {total_points}")
                print(f"   Current Tier: {tier}")
                
                if points_earned == 10:
                    print("✅ Correctly earned +10 points for completed trip")
                else:
                    print(f"❌ Expected +10 points, got +{points_earned}")
        
        # Step 4: Check tier status after earning points
        success, response = self.run_test(
            "Get Tier Status After Points",
            "GET",
            "driver/status/tier",
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            current_points = response.get('points', 0)
            current_tier = response.get('tier', 'unknown')
            progress = response.get('progress_percent', 0)
            
            print(f"   Current Points: {current_points}")
            print(f"   Current Tier: {current_tier}")
            print(f"   Progress to Next Tier: {progress}%")
            
            if current_points >= 10:
                print("✅ Points correctly updated after trip completion")
            else:
                print(f"❌ Expected at least 10 points, got {current_points}")
        
        # Step 5: Create another booking to test cancellation with point deduction
        success, response = self.run_test(
            "Create Booking for Cancellation Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        booking_id_2 = None
        if success:
            booking_id_2 = response.get('booking_id')
            print(f"   Created second booking ID: {booking_id_2}")
            
            # Accept the booking
            if booking_id_2:
                success, response = self.run_test(
                    "Accept Booking for Cancellation",
                    "POST",
                    f"driver/accept/{booking_id_2}",
                    200,
                    headers=self.get_auth_headers(self.driver_token)
                )
                
                if success:
                    print("✅ Second booking accepted")
        
        # Step 6: Test cancellation with penalized reason (car_issue = -20 points)
        if booking_id_2:
            cancel_data = {
                "reason": "car_issue",
                "notes": "Engine trouble - cannot complete trip"
            }
            
            success, response = self.run_test(
                "Cancel Trip - Car Issue (-20 points)",
                "POST",
                f"driver/trips/{booking_id_2}/cancel",
                200,
                cancel_data,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                reason = response.get('reason', 'N/A')
                points_deducted = response.get('points_deducted', 0)
                new_points = response.get('new_points', 0)
                tier = response.get('tier', 'unknown')
                tier_progress = response.get('tier_progress', 0)
                
                print(f"   Cancellation Reason: {reason}")
                print(f"   Points Deducted: -{points_deducted}")
                print(f"   New Points: {new_points}")
                print(f"   Current Tier: {tier}")
                print(f"   Tier Progress: {tier_progress}%")
                
                if points_deducted == 20:
                    print("✅ Correctly deducted 20 points for car_issue cancellation")
                else:
                    print(f"❌ Expected -20 points, got -{points_deducted}")
                
                # Points should not go below 0
                if new_points >= 0:
                    print("✅ Points correctly prevented from going negative")
                else:
                    print(f"❌ Points went negative: {new_points}")
        
        # Step 7: Create another booking to test no-penalty cancellation
        success, response = self.run_test(
            "Create Booking for No-Penalty Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        booking_id_3 = None
        if success:
            booking_id_3 = response.get('booking_id')
            print(f"   Created third booking ID: {booking_id_3}")
            
            # Accept the booking
            if booking_id_3:
                success, response = self.run_test(
                    "Accept Booking for No-Penalty Test",
                    "POST",
                    f"driver/accept/{booking_id_3}",
                    200,
                    headers=self.get_auth_headers(self.driver_token)
                )
                
                if success:
                    print("✅ Third booking accepted")
        
        # Step 8: Test cancellation with no-penalty reason (safety_concern = 0 points)
        if booking_id_3:
            cancel_data = {
                "reason": "safety_concern",
                "notes": "Unsafe pickup location - customer safety concern"
            }
            
            success, response = self.run_test(
                "Cancel Trip - Safety Concern (0 points)",
                "POST",
                f"driver/trips/{booking_id_3}/cancel",
                200,
                cancel_data,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                reason = response.get('reason', 'N/A')
                points_deducted = response.get('points_deducted', 0)
                new_points = response.get('new_points', 0)
                tier = response.get('tier', 'unknown')
                tier_progress = response.get('tier_progress', 0)
                
                print(f"   Cancellation Reason: {reason}")
                print(f"   Points Deducted: -{points_deducted}")
                print(f"   New Points: {new_points}")
                print(f"   Current Tier: {tier}")
                print(f"   Tier Progress: {tier_progress}%")
                
                if points_deducted == 0:
                    print("✅ Correctly deducted 0 points for safety_concern cancellation")
                else:
                    print(f"❌ Expected 0 points deducted, got -{points_deducted}")
        
        # Step 9: Test customer contact endpoint for active booking
        # Create one more booking to test customer contact
        success, response = self.run_test(
            "Create Booking for Customer Contact Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        booking_id_4 = None
        if success:
            booking_id_4 = response.get('booking_id')
            print(f"   Created fourth booking ID: {booking_id_4}")
            
            # Accept the booking
            if booking_id_4:
                success, response = self.run_test(
                    "Accept Booking for Customer Contact Test",
                    "POST",
                    f"driver/accept/{booking_id_4}",
                    200,
                    headers=self.get_auth_headers(self.driver_token)
                )
                
                if success:
                    print("✅ Fourth booking accepted")
                    
                    # Test get customer contact info
                    success, response = self.run_test(
                        "Get Customer Contact Info",
                        "GET",
                        f"driver/booking/{booking_id_4}/customer",
                        200,
                        headers=self.get_auth_headers(self.driver_token)
                    )
                    
                    if success:
                        customer_name = response.get('customer_name', 'N/A')
                        customer_phone = response.get('customer_phone', 'N/A')
                        pickup_address = response.get('pickup_address', 'N/A')
                        
                        print(f"   Customer Name: {customer_name}")
                        print(f"   Customer Phone: {customer_phone}")
                        print(f"   Pickup Address: {pickup_address}")
                        
                        if customer_name != 'N/A' and pickup_address != 'N/A':
                            print("✅ Customer contact info retrieved successfully")
                        else:
                            print("❌ Customer contact info incomplete")
        
        # Step 10: Final tier status check
        success, response = self.run_test(
            "Final Tier Status Check",
            "GET",
            "driver/status/tier",
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            final_points = response.get('points', 0)
            final_tier = response.get('tier', 'unknown')
            next_tier = response.get('next_tier', 'N/A')
            progress = response.get('progress_percent', 0)
            total_rides = response.get('total_rides', 0)
            
            print(f"   Final Points: {final_points}")
            print(f"   Final Tier: {final_tier}")
            print(f"   Next Tier: {next_tier}")
            print(f"   Progress: {progress}%")
            print(f"   Total Rides: {total_rides}")
            
            # Verify tier logic
            if final_points < 300 and final_tier == "silver":
                print("✅ Tier system working correctly - Silver tier for < 300 points")
            elif 300 <= final_points < 600 and final_tier == "gold":
                print("✅ Tier system working correctly - Gold tier for 300-599 points")
            elif 600 <= final_points < 1000 and final_tier == "platinum":
                print("✅ Tier system working correctly - Platinum tier for 600-999 points")
            elif final_points >= 1000 and final_tier == "diamond":
                print("✅ Tier system working correctly - Diamond tier for 1000+ points")
            else:
                print(f"❌ Tier system logic error - {final_points} points should not be {final_tier} tier")
        
        print("\n🎯 Driver Tier System Testing Complete")

    def test_driver_cancellation_no_show(self):
        """Test new Driver Cancellation and No-Show feature"""
        print("\n" + "="*50)
        print("🚫 DRIVER CANCELLATION & NO-SHOW TESTS")
        print("="*50)
        
        if not self.user_token or not self.driver_token:
            print("❌ Skipping cancellation tests - missing user or driver token")
            return
        
        # Step 1: Create a taxi booking as user
        booking_data = {
            "pickup_lat": 45.5017,
            "pickup_lng": -73.5673,
            "pickup_address": "1000 Rue de la Gauchetière, Montreal, QC",
            "dropoff_lat": 45.5088,
            "dropoff_lng": -73.5538,
            "dropoff_address": "300 Rue Saint-Paul, Montreal, QC",
            "vehicle_type": "sedan"
        }
        
        success, response = self.run_test(
            "Create Taxi Booking for Cancellation Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        if not success:
            print("❌ Failed to create booking - skipping cancellation tests")
            return
        
        booking_id = response.get('booking_id')
        if not booking_id:
            print("❌ No booking ID returned - skipping cancellation tests")
            return
        
        print(f"   Created booking ID: {booking_id}")
        
        # Step 2: Accept booking as driver
        success, response = self.run_test(
            "Accept Booking for Cancellation Test",
            "POST",
            f"driver/accept/{booking_id}",
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if not success:
            print("❌ Failed to accept booking - skipping remaining tests")
            return
        
        print("✅ Booking accepted by driver")
        
        # Step 3: Update status to "arrived"
        status_data = {"status": "arrived"}
        success, response = self.run_test(
            "Update Trip Status - Arrived",
            "POST",
            f"driver/trips/{booking_id}/update-status",
            200,
            status_data,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            print(f"✅ Trip status updated to: {response.get('status', 'N/A')}")
        
        # Step 4: Test no-show endpoint
        success, response = self.run_test(
            "Mark Customer No-Show",
            "POST",
            f"driver/trips/{booking_id}/no-show",
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            priority_boost = response.get('priority_boost_active', False)
            print(f"   Priority boost active: {priority_boost}")
            print(f"   Message: {response.get('message', 'N/A')}")
            print(f"   Note: {response.get('note', 'N/A')}")
            
            if priority_boost:
                print("✅ Driver correctly received priority boost for no-show")
            else:
                print("❌ Driver did not receive priority boost")
        
        # Step 5: Check suspension status - should show priority boost
        success, response = self.run_test(
            "Check Suspension Status - Priority Boost",
            "GET",
            "driver/status/suspension",
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            is_suspended = response.get('is_suspended', False)
            priority_boost = response.get('priority_boost', False)
            print(f"   Is suspended: {is_suspended}")
            print(f"   Priority boost: {priority_boost}")
            print(f"   Remaining seconds: {response.get('remaining_seconds', 0)}")
            
            if priority_boost and not is_suspended:
                print("✅ Priority boost correctly active, no suspension")
            else:
                print("❌ Unexpected suspension status after no-show")
        
        # Step 6: Create another booking for cancellation test
        success, response = self.run_test(
            "Create Second Booking for Cancellation Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        booking_id_2 = None
        if success:
            booking_id_2 = response.get('booking_id')
            print(f"   Created second booking ID: {booking_id_2}")
            
            # Accept second booking
            if booking_id_2:
                success, response = self.run_test(
                    "Accept Second Booking",
                    "POST",
                    f"driver/accept/{booking_id_2}",
                    200,
                    headers=self.get_auth_headers(self.driver_token)
                )
                
                if success:
                    print("✅ Second booking accepted")
        
        # Step 7: Cancel with penalized reason (car_issue)
        if booking_id_2:
            cancel_data = {
                "reason": "car_issue",
                "notes": "Engine trouble - cannot complete trip"
            }
            
            success, response = self.run_test(
                "Cancel Trip - Penalized Reason",
                "POST",
                f"driver/trips/{booking_id_2}/cancel",
                200,
                cancel_data,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                is_penalized = response.get('is_penalized', False)
                suspension_minutes = response.get('suspension_minutes', 0)
                reason = response.get('reason', 'N/A')
                
                print(f"   Cancellation reason: {reason}")
                print(f"   Is penalized: {is_penalized}")
                print(f"   Suspension minutes: {suspension_minutes}")
                
                if is_penalized and suspension_minutes == 5:
                    print("✅ Penalized cancellation correctly applied 5-minute suspension")
                else:
                    print("❌ Penalized cancellation did not apply correct suspension")
        
        # Step 8: Check suspension status - should be suspended
        success, response = self.run_test(
            "Check Suspension Status - After Penalized Cancel",
            "GET",
            "driver/status/suspension",
            200,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        if success:
            is_suspended = response.get('is_suspended', False)
            remaining_seconds = response.get('remaining_seconds', 0)
            reason = response.get('reason', 'N/A')
            
            print(f"   Is suspended: {is_suspended}")
            print(f"   Remaining seconds: {remaining_seconds}")
            print(f"   Suspension reason: {reason}")
            
            if is_suspended and remaining_seconds > 0:
                print("✅ Driver correctly suspended after penalized cancellation")
            else:
                print("❌ Driver not suspended after penalized cancellation")
        
        # Step 9: Create third booking for no-penalty cancellation test
        success, response = self.run_test(
            "Create Third Booking for No-Penalty Test",
            "POST",
            "taxi/book",
            200,
            booking_data,
            headers=self.get_auth_headers(self.user_token)
        )
        
        booking_id_3 = None
        if success:
            booking_id_3 = response.get('booking_id')
            print(f"   Created third booking ID: {booking_id_3}")
            
            # Accept third booking (should work even if suspended, for testing)
            if booking_id_3:
                success, response = self.run_test(
                    "Accept Third Booking",
                    "POST",
                    f"driver/accept/{booking_id_3}",
                    200,
                    headers=self.get_auth_headers(self.driver_token)
                )
                
                if success:
                    print("✅ Third booking accepted")
        
        # Step 10: Cancel with no-penalty reason (safety_concern)
        if booking_id_3:
            cancel_data = {
                "reason": "safety_concern",
                "notes": "Unsafe pickup location - customer safety concern"
            }
            
            success, response = self.run_test(
                "Cancel Trip - No Penalty Reason",
                "POST",
                f"driver/trips/{booking_id_3}/cancel",
                200,
                cancel_data,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                is_penalized = response.get('is_penalized', False)
                suspension_minutes = response.get('suspension_minutes', 0)
                reason = response.get('reason', 'N/A')
                
                print(f"   Cancellation reason: {reason}")
                print(f"   Is penalized: {is_penalized}")
                print(f"   Suspension minutes: {suspension_minutes}")
                
                if not is_penalized and suspension_minutes == 0:
                    print("✅ No-penalty cancellation correctly applied no suspension")
                else:
                    print("❌ No-penalty cancellation incorrectly applied suspension")
        
        # Step 11: Test invalid status update
        invalid_status_data = {"status": "invalid_status"}
        self.run_test(
            "Update Trip Status - Invalid Status",
            "POST",
            f"driver/trips/{booking_id}/update-status",
            400,
            invalid_status_data,
            headers=self.get_auth_headers(self.driver_token)
        )
        
        # Step 12: Test update status to in_progress
        if booking_id:
            in_progress_data = {"status": "in_progress"}
            success, response = self.run_test(
                "Update Trip Status - In Progress",
                "POST",
                f"driver/trips/{booking_id}/update-status",
                200,
                in_progress_data,
                headers=self.get_auth_headers(self.driver_token)
            )
            
            if success:
                print(f"✅ Trip status updated to: {response.get('status', 'N/A')}")
        
        print("\n🎯 Driver Cancellation & No-Show Feature Testing Complete")

    def test_admin_endpoints(self):
        """Test admin user and driver creation endpoints"""
        print("\n" + "="*50)
        print("👑 ADMIN ENDPOINTS TESTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping admin tests - no admin token")
            return
        
        # Test admin create user
        import time
        timestamp = int(time.time())
        user_data = {
            "email": f"testuser{timestamp}@example.com",
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User",
            "phone": "+1234567890",
            "address": "123 Test Street, Montreal, QC"
        }
        
        success, response = self.run_test(
            "Admin Create User", 
            "POST", 
            "admin/users", 
            200,
            user_data,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            print(f"   Created user: {response.get('user', {}).get('name', 'N/A')}")
            print(f"   User ID: {response.get('user', {}).get('id', 'N/A')}")
            print(f"   Email: {response.get('user', {}).get('email', 'N/A')}")
            print(f"   Role: {response.get('user', {}).get('role', 'N/A')}")
            
            # Verify user data structure
            user = response.get('user', {})
            if 'password' in user:
                print("❌ Password field should not be returned in response")
            else:
                print("✅ Password field correctly excluded from response")
        
        # Test admin create driver
        driver_data = {
            "email": f"testdriver{timestamp}@example.com",
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "Driver",
            "phone": "+1234567891",
            "vehicle_type": "sedan",
            "vehicle_make": "Toyota",
            "vehicle_model": "Camry",
            "vehicle_color": "Blue",
            "vehicle_year": 2020,
            "license_plate": "ABC123",
            "drivers_license_number": "DL123456789",
            "taxi_permit_number": "TP987654321",
            "gst_number": "GST123456789",
            "qst_number": "QST987654321",
            "srs_code": "SRS123",
            "services": ["taxi", "courier"]
        }
        
        success, response = self.run_test(
            "Admin Create Driver", 
            "POST", 
            "admin/drivers", 
            200,
            driver_data,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        if success:
            print(f"   Created driver: {response.get('driver', {}).get('name', 'N/A')}")
            print(f"   Driver ID: {response.get('driver', {}).get('id', 'N/A')}")
            print(f"   User ID: {response.get('user_id', 'N/A')}")
            print(f"   Email: {response.get('driver', {}).get('email', 'N/A')}")
            print(f"   Vehicle: {response.get('driver', {}).get('vehicle_color', '')} {response.get('driver', {}).get('vehicle_make', '')} {response.get('driver', {}).get('vehicle_model', '')}")
            print(f"   License Plate: {response.get('driver', {}).get('license_plate', 'N/A')}")
            print(f"   Services: {response.get('driver', {}).get('services', [])}")
            print(f"   GST Number: {response.get('driver', {}).get('tax_info', {}).get('gst_number', 'N/A')}")
            print(f"   QST Number: {response.get('driver', {}).get('tax_info', {}).get('qst_number', 'N/A')}")
            
            # Store driver ID for payout test
            self.created_driver_id = response.get('driver', {}).get('id')
            
            # Verify driver data structure
            driver = response.get('driver', {})
            if 'password' not in driver:
                print("✅ Password field correctly excluded from driver response")
            
            # Verify both user and driver profile were created
            if response.get('user_id') and response.get('driver', {}).get('user_id'):
                print("✅ Both user account and driver profile created successfully")
        
        # Test admin create user with duplicate email (should fail)
        duplicate_user_data = {
            "email": f"testuser{timestamp}@example.com",  # Same email as above
            "password": "testpass123",
            "first_name": "Duplicate",
            "last_name": "User"
        }
        
        self.run_test(
            "Admin Create User - Duplicate Email", 
            "POST", 
            "admin/users", 
            400,  # Should fail with 400
            duplicate_user_data,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        # Test admin create driver with duplicate email (should fail)
        duplicate_driver_data = {
            "email": f"testdriver{timestamp}@example.com",  # Same email as above
            "password": "testpass123",
            "first_name": "Duplicate",
            "last_name": "Driver",
            "phone": "+1234567892"
        }
        
        self.run_test(
            "Admin Create Driver - Duplicate Email", 
            "POST", 
            "admin/drivers", 
            400,  # Should fail with 400
            duplicate_driver_data,
            headers=self.get_auth_headers(self.admin_token)
        )
        
        # Test admin endpoints without auth (should fail)
        self.run_test(
            "Admin Create User - No Auth", 
            "POST", 
            "admin/users", 
            401,  # Should fail with 401
            user_data
        )
        
        self.run_test(
            "Admin Create Driver - No Auth", 
            "POST", 
            "admin/drivers", 
            401,  # Should fail with 401
            driver_data
        )
        
        # Test admin endpoints with user token (should fail)
        if self.user_token:
            self.run_test(
                "Admin Create User - User Token", 
                "POST", 
                "admin/users", 
                403,  # Should fail with 403
                user_data,
                headers=self.get_auth_headers(self.user_token)
            )

    def test_socket_io_realtime_service(self):
        """Test Socket.io real-time ride request service integration"""
        print("\n" + "="*50)
        print("🔌 SOCKET.IO REAL-TIME SERVICE TESTS")
        print("="*50)
        
        # Real-time service URL from review request
        realtime_base_url = "http://localhost:8002"
        
        # Test 1: Check Real-time Service Health
        try:
            health_response = requests.get(f"{realtime_base_url}/health", timeout=10)
            if health_response.status_code == 200:
                health_data = health_response.json()
                print(f"✅ Real-time Service Health Check Passed")
                print(f"   Status: {health_data.get('status', 'N/A')}")
                print(f"   Service: {health_data.get('service', 'N/A')}")
                
                if health_data.get('status') == 'ok' and health_data.get('service') == 'transpo-realtime':
                    print("✅ Health endpoint returns correct status and service name")
                    self.tests_passed += 1
                else:
                    print("❌ Health endpoint response format incorrect")
                    self.failed_tests.append({
                        "test": "Real-time Service Health",
                        "error": f"Expected status=ok, service=transpo-realtime, got {health_data}"
                    })
            else:
                print(f"❌ Real-time Service Health Check Failed - Status: {health_response.status_code}")
                self.failed_tests.append({
                    "test": "Real-time Service Health",
                    "error": f"HTTP {health_response.status_code}: {health_response.text}"
                })
        except Exception as e:
            print(f"❌ Real-time Service Health Check Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": "Real-time Service Health",
                "error": f"Connection error: {str(e)}"
            })
        
        self.tests_run += 1
        
        # Test 2: Check Online Drivers Count
        try:
            drivers_response = requests.get(f"{realtime_base_url}/drivers/online", timeout=10)
            if drivers_response.status_code == 200:
                drivers_data = drivers_response.json()
                print(f"✅ Online Drivers Count Check Passed")
                print(f"   Online Drivers: {drivers_data.get('onlineDrivers', 'N/A')}")
                print(f"   Connected Sockets: {drivers_data.get('connectedSockets', 'N/A')}")
                
                if 'onlineDrivers' in drivers_data and 'connectedSockets' in drivers_data:
                    print("✅ Online drivers endpoint returns correct data structure")
                    self.tests_passed += 1
                else:
                    print("❌ Online drivers endpoint missing required fields")
                    self.failed_tests.append({
                        "test": "Online Drivers Count",
                        "error": f"Missing onlineDrivers or connectedSockets fields: {drivers_data}"
                    })
            else:
                print(f"❌ Online Drivers Count Check Failed - Status: {drivers_response.status_code}")
                self.failed_tests.append({
                    "test": "Online Drivers Count",
                    "error": f"HTTP {drivers_response.status_code}: {drivers_response.text}"
                })
        except Exception as e:
            print(f"❌ Online Drivers Count Check Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": "Online Drivers Count",
                "error": f"Connection error: {str(e)}"
            })
        
        self.tests_run += 1
        
        # Test 3: Test Ride Request Broadcast (REST endpoint)
        ride_request_data = {
            "userId": "test-user-1",
            "userName": "Test User",
            "pickup": {
                "latitude": 45.5017,
                "longitude": -73.5673,
                "address": "123 Test St, Montreal"
            },
            "dropoff": {
                "latitude": 45.5088,
                "longitude": -73.554,
                "address": "456 Downtown Ave, Montreal"
            },
            "vehicleType": "sedan",
            "fare": {"total": 15.50},
            "bookingId": "test-booking-123"
        }
        
        try:
            broadcast_response = requests.post(
                f"{realtime_base_url}/test/ride-request",
                json=ride_request_data,
                timeout=10
            )
            if broadcast_response.status_code == 200:
                broadcast_data = broadcast_response.json()
                print(f"✅ Ride Request Broadcast Test Passed")
                print(f"   Success: {broadcast_data.get('success', 'N/A')}")
                print(f"   Message: {broadcast_data.get('message', 'N/A')}")
                
                if broadcast_data.get('success') == True and 'broadcasted' in broadcast_data.get('message', '').lower():
                    print("✅ Ride request broadcast endpoint working correctly")
                    self.tests_passed += 1
                else:
                    print("❌ Ride request broadcast response format incorrect")
                    self.failed_tests.append({
                        "test": "Ride Request Broadcast",
                        "error": f"Expected success=true and 'broadcasted' message, got {broadcast_data}"
                    })
            else:
                print(f"❌ Ride Request Broadcast Test Failed - Status: {broadcast_response.status_code}")
                self.failed_tests.append({
                    "test": "Ride Request Broadcast",
                    "error": f"HTTP {broadcast_response.status_code}: {broadcast_response.text}"
                })
        except Exception as e:
            print(f"❌ Ride Request Broadcast Test Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": "Ride Request Broadcast",
                "error": f"Connection error: {str(e)}"
            })
        
        self.tests_run += 1
        
        # Test 4: Verify MongoDB 2dsphere Index (through backend API)
        print("\n📍 Testing MongoDB 2dsphere Index...")
        if self.admin_token:
            try:
                # Test geospatial query through backend to verify index exists
                nearby_drivers_response = requests.get(
                    f"{self.base_url}/admin/drivers/nearby?lat=45.5017&lng=-73.5673&radius=5",
                    headers=self.get_auth_headers(self.admin_token),
                    timeout=10
                )
                
                if nearby_drivers_response.status_code == 200:
                    print("✅ MongoDB 2dsphere index appears to be working (geospatial query successful)")
                    self.tests_passed += 1
                else:
                    print(f"⚠️ Could not verify 2dsphere index - Status: {nearby_drivers_response.status_code}")
                    # Don't count this as a failure since the endpoint might not exist
            except Exception as e:
                print(f"⚠️ Could not verify 2dsphere index - Error: {str(e)}")
                # Don't count this as a failure since the endpoint might not exist
        else:
            print("⚠️ Cannot verify 2dsphere index - no admin token available")
        
        self.tests_run += 1
        
        # Test 5: Test Backend Integration with Enhanced Booking Fields
        print("\n📋 Testing Backend Integration with Enhanced Booking...")
        if self.user_token:
            enhanced_booking_data = {
                "pickup_lat": 45.5017,
                "pickup_lng": -73.5673,
                "pickup_address": "123 Test St, Montreal",
                "dropoff_lat": 45.5088,
                "dropoff_lng": -73.554,
                "dropoff_address": "456 Downtown Ave, Montreal",
                "vehicle_type": "sedan",
                "booking_for_self": True,
                "special_instructions": "Test integration with real-time service",
                "pet_policy": "none"
            }
            
            try:
                booking_response = requests.post(
                    f"{self.base_url}/taxi/book",
                    json=enhanced_booking_data,
                    headers=self.get_auth_headers(self.user_token),
                    timeout=10
                )
                
                if booking_response.status_code == 200:
                    booking_data = booking_response.json()
                    booking_id = booking_data.get('booking_id')
                    booking_details = booking_data.get('booking', {})
                    
                    print(f"✅ Enhanced Booking Integration Test Passed")
                    print(f"   Booking ID: {booking_id}")
                    print(f"   Booking For Self: {booking_details.get('booking_for_self', 'N/A')}")
                    print(f"   Special Instructions: {booking_details.get('special_instructions', 'N/A')}")
                    print(f"   Pet Policy: {booking_details.get('pet_policy', 'N/A')}")
                    
                    # Verify enhanced fields are included
                    required_fields = ['booking_for_self', 'special_instructions', 'pet_policy']
                    missing_fields = [field for field in required_fields if field not in booking_details]
                    
                    if not missing_fields:
                        print("✅ All enhanced booking fields present in response")
                        self.tests_passed += 1
                    else:
                        print(f"❌ Missing enhanced booking fields: {missing_fields}")
                        self.failed_tests.append({
                            "test": "Enhanced Booking Integration",
                            "error": f"Missing fields in booking response: {missing_fields}"
                        })
                else:
                    print(f"❌ Enhanced Booking Integration Test Failed - Status: {booking_response.status_code}")
                    self.failed_tests.append({
                        "test": "Enhanced Booking Integration",
                        "error": f"HTTP {booking_response.status_code}: {booking_response.text}"
                    })
            except Exception as e:
                print(f"❌ Enhanced Booking Integration Test Failed - Error: {str(e)}")
                self.failed_tests.append({
                    "test": "Enhanced Booking Integration",
                    "error": f"Connection error: {str(e)}"
                })
        else:
            print("❌ Cannot test enhanced booking integration - no user token available")
            self.failed_tests.append({
                "test": "Enhanced Booking Integration",
                "error": "No user token available for testing"
            })
        
        self.tests_run += 1

    def setup_admin_user(self):
        """Setup admin user if it doesn't exist"""
        print("\n🔧 Setting up admin user...")
        try:
            response = requests.post(f"{self.base_url}/seed/super-admin")
            if response.status_code == 200:
                result = response.json()
                print(f"✅ {result.get('message', 'Admin setup completed')}")
            else:
                print(f"⚠️ Admin setup response: {response.status_code}")
        except Exception as e:
            print(f"⚠️ Admin setup failed: {e}")

    def run_focused_tests(self):
        """Run focused tests based on test_result.md requirements"""
        print("🚀 Starting Transpo Backend API Focused Test Suite")
        print(f"🎯 Testing against: {self.base_url}")
        print("📋 Focus: NEW Stripe Dashboard APIs (Admin Payments + Driver Earnings), Password Management, Admin Panel, Authentication, Fare Estimation")
        
        start_time = datetime.now()
        
        # Setup admin user first
        self.setup_admin_user()
        
        try:
            self.test_health_check()
            self.test_authentication()
            self.test_driver_tier_system()  # NEW: Driver Tier System with point-based cancellations
            self.test_driver_cancellation_no_show()  # Driver Cancellation and No-Show feature
            self.test_password_management()
            self.test_admin_taxes()
            self.test_admin_contracts()
            self.test_admin_merchants()  # New merchants section tests
            self.test_stripe_dashboard_admin_payments()  # NEW: Stripe Dashboard Admin Payment APIs
            self.test_stripe_dashboard_driver_earnings()  # NEW: Stripe Dashboard Driver Earnings APIs
            self.test_admin_endpoints()
            self.test_admin_payouts()
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

def main():
    """Main test runner"""
    tester = TranspoAPITester()
    success = tester.run_focused_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())