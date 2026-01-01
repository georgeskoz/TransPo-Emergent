"""
Admin Role Definitions and Models
RBAC (Role-Based Access Control) for Transpo Platform
"""

from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime


# ============== ROLE DEFINITIONS ==============

class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    SUPPORT_AGENT = "support_agent"
    DOCUMENT_REVIEWER = "document_reviewer"
    PAYOUT_MANAGER = "payout_manager"
    FINANCE_ADMIN = "finance_admin"


class Permission(str, Enum):
    # Dashboard
    VIEW_DASHBOARD = "view_dashboard"
    
    # User Management
    VIEW_USERS = "view_users"
    MANAGE_USERS = "manage_users"
    RESTRICT_USERS = "restrict_users"
    
    # Driver Management
    VIEW_DRIVERS = "view_drivers"
    MANAGE_DRIVERS = "manage_drivers"
    APPROVE_DRIVERS = "approve_drivers"
    SUSPEND_DRIVERS = "suspend_drivers"
    
    # Document Management
    VIEW_DOCUMENTS = "view_documents"
    MANAGE_DOCUMENTS = "manage_documents"
    
    # Trip Management
    VIEW_TRIPS = "view_trips"
    MANAGE_TRIPS = "manage_trips"
    CANCEL_TRIPS = "cancel_trips"
    REASSIGN_TRIPS = "reassign_trips"
    
    # Financial
    VIEW_REPORTS = "view_reports"
    EXPORT_REPORTS = "export_reports"
    MANAGE_PAYOUTS = "manage_payouts"
    MANAGE_COMMISSIONS = "manage_commissions"
    MANAGE_TAXES = "manage_taxes"
    
    # Taxi Config
    VIEW_TAXI_CONFIG = "view_taxi_config"
    MANAGE_TAXI_CONFIG = "manage_taxi_config"
    
    # Cases/Disputes
    VIEW_CASES = "view_cases"
    MANAGE_CASES = "manage_cases"
    RESOLVE_DISPUTES = "resolve_disputes"
    
    # Admin Management
    VIEW_ADMINS = "view_admins"
    MANAGE_ADMINS = "manage_admins"
    CREATE_ADMINS = "create_admins"
    
    # Audit
    VIEW_AUDIT_LOG = "view_audit_log"
    FREEZE_RECORDS = "freeze_records"
    
    # System
    MANAGE_SETTINGS = "manage_settings"
    MANAGE_MERCHANTS = "manage_merchants"
    ALL = "all"


# Role configurations with permissions
ROLE_PERMISSIONS: Dict[str, Dict] = {
    AdminRole.SUPER_ADMIN: {
        "name": "Super Admin",
        "description": "Platform owner with full access. Can create admins and configure platform.",
        "level": 1,
        "permissions": [Permission.ALL],
        "can_be_assigned_to": ["global"],
        "requires_2fa": True,
        "requires_confirmation": True
    },
    AdminRole.ADMIN: {
        "name": "Admin",
        "description": "Operations/city-level admin. Can manage drivers, users, and trips.",
        "level": 2,
        "permissions": [
            Permission.VIEW_DASHBOARD,
            Permission.VIEW_USERS, Permission.MANAGE_USERS, Permission.RESTRICT_USERS,
            Permission.VIEW_DRIVERS, Permission.MANAGE_DRIVERS, Permission.APPROVE_DRIVERS, Permission.SUSPEND_DRIVERS,
            Permission.VIEW_DOCUMENTS, Permission.MANAGE_DOCUMENTS,
            Permission.VIEW_TRIPS, Permission.MANAGE_TRIPS, Permission.CANCEL_TRIPS, Permission.REASSIGN_TRIPS,
            Permission.VIEW_REPORTS,
            Permission.VIEW_TAXI_CONFIG,
            Permission.VIEW_CASES, Permission.MANAGE_CASES, Permission.RESOLVE_DISPUTES,
            Permission.VIEW_AUDIT_LOG
        ],
        "can_be_assigned_to": ["city", "region", "jurisdiction"],
        "requires_2fa": True,
        "requires_confirmation": False
    },
    AdminRole.SUPPORT_AGENT: {
        "name": "Support Agent",
        "description": "Read-only access with ability to add notes. Cannot modify data.",
        "level": 3,
        "permissions": [
            Permission.VIEW_DASHBOARD,
            Permission.VIEW_USERS,
            Permission.VIEW_DRIVERS,
            Permission.VIEW_DOCUMENTS,
            Permission.VIEW_TRIPS,
            Permission.VIEW_CASES,
            Permission.VIEW_AUDIT_LOG
        ],
        "can_be_assigned_to": ["city", "region"],
        "requires_2fa": False,
        "requires_confirmation": False
    },
    AdminRole.DOCUMENT_REVIEWER: {
        "name": "Document Reviewer",
        "description": "Can approve/reject driver documents.",
        "level": 3,
        "permissions": [
            Permission.VIEW_DASHBOARD,
            Permission.VIEW_DRIVERS,
            Permission.VIEW_DOCUMENTS, Permission.MANAGE_DOCUMENTS,
            Permission.APPROVE_DRIVERS
        ],
        "can_be_assigned_to": ["city", "region"],
        "requires_2fa": False,
        "requires_confirmation": False
    },
    AdminRole.PAYOUT_MANAGER: {
        "name": "Payout Manager",
        "description": "Can process driver payouts and view reports.",
        "level": 3,
        "permissions": [
            Permission.VIEW_DASHBOARD,
            Permission.VIEW_DRIVERS,
            Permission.VIEW_REPORTS, Permission.EXPORT_REPORTS,
            Permission.MANAGE_PAYOUTS
        ],
        "can_be_assigned_to": ["city", "region", "global"],
        "requires_2fa": True,
        "requires_confirmation": True
    },
    AdminRole.FINANCE_ADMIN: {
        "name": "Finance Admin",
        "description": "Can view reports, manage commissions and taxes.",
        "level": 2,
        "permissions": [
            Permission.VIEW_DASHBOARD,
            Permission.VIEW_REPORTS, Permission.EXPORT_REPORTS,
            Permission.MANAGE_COMMISSIONS, Permission.MANAGE_TAXES,
            Permission.VIEW_AUDIT_LOG
        ],
        "can_be_assigned_to": ["global"],
        "requires_2fa": True,
        "requires_confirmation": True
    }
}


def has_permission(user_permissions: List[str], required_permission: str) -> bool:
    """Check if user has a specific permission."""
    if Permission.ALL in user_permissions or "all" in user_permissions:
        return True
    return required_permission in user_permissions


def get_role_permissions(role: str) -> List[str]:
    """Get all permissions for a role."""
    role_config = ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS[AdminRole.SUPPORT_AGENT])
    return [p.value if isinstance(p, Permission) else p for p in role_config["permissions"]]


# ============== PYDANTIC MODELS ==============

class AdminCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    admin_role: str = AdminRole.ADMIN
    phone: Optional[str] = None
    assignment: Optional[Dict] = None  # {"type": "city", "value": "Montreal"}


class AdminUpdate(BaseModel):
    admin_role: Optional[str] = None
    is_active: Optional[bool] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    assignment: Optional[Dict] = None


class AuditLogEntry(BaseModel):
    id: str
    actor_id: str
    actor_role: str
    action_type: str
    entity_type: str
    entity_id: str
    timestamp: str
    before_snapshot: Optional[Dict] = None
    after_snapshot: Optional[Dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    notes: Optional[str] = None


class DisputeCreate(BaseModel):
    trip_id: str
    opened_by: str  # "user" or "driver"
    reason: str
    description: str


class DisputeResolution(BaseModel):
    decision: str  # "no_action", "partial_refund", "full_refund"
    refund_amount: Optional[float] = None
    notes: str
