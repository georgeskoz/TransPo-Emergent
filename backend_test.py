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
    def __init__(self, base_url="https://mobility-suite.preview.emergentagent.com/api"):
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
        print("📋 Focus: Password Management, Admin Panel (Payouts, Taxes, Contracts, Merchants), Authentication, Fare Estimation")
        
        start_time = datetime.now()
        
        # Setup admin user first
        self.setup_admin_user()
        
        try:
            self.test_health_check()
            self.test_authentication()
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