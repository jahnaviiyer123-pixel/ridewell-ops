"""End-to-end backend tests for RideWell Ops.

Covers: auth (admin/trainer), trainers CRUD with RBAC, students with auto class slots,
class updates, attendance upsert, payments + fees increment, dashboard stats and daily reports.
"""
import os
import uuid
from datetime import date

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://fleet-ops-89.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "admin@ridewell.com", "password": "admin123"}
TRAINER = {"email": "trainer@ridewell.com", "password": "trainer123"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and "user" in data
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def trainer_token():
    r = requests.post(f"{API}/auth/login", json=TRAINER, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def trainer_user(trainer_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {trainer_token}"}, timeout=20)
    assert r.status_code == 200
    return r.json()


def _ah(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_trainer_login(self, trainer_token):
        assert isinstance(trainer_token, str) and len(trainer_token) > 20

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "x@x.com", "password": "wrong"}, timeout=20)
        assert r.status_code == 401

    def test_me_admin(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "admin@ridewell.com"
        assert u["role"] == "admin"
        assert "password_hash" not in u

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401


# ---------- Trainers ----------
class TestTrainers:
    created_id = None

    def test_list_trainers_seeded(self, admin_token):
        r = requests.get(f"{API}/trainers", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200
        trainers = r.json()
        assert any(t["email"] == "trainer@ridewell.com" for t in trainers)
        for t in trainers:
            assert "password_hash" not in t

    def test_create_trainer_admin(self, admin_token):
        email = f"test_trainer_{uuid.uuid4().hex[:6]}@ridewell.com"
        body = {"email": email, "password": "pwd12345", "name": "TEST Trainer", "phone": "+91 99999"}
        r = requests.post(f"{API}/trainers", json=body, headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["email"] == email
        assert t["role"] == "trainer"
        assert "password_hash" not in t
        assert "_id" not in t
        TestTrainers.created_id = t["id"]

    def test_create_trainer_forbidden_for_trainer(self, trainer_token):
        body = {"email": f"TEST_x_{uuid.uuid4().hex[:5]}@x.com", "password": "p", "name": "x"}
        r = requests.post(f"{API}/trainers", json=body, headers=_ah(trainer_token), timeout=20)
        assert r.status_code == 403

    def test_patch_trainer(self, admin_token):
        assert TestTrainers.created_id
        r = requests.patch(
            f"{API}/trainers/{TestTrainers.created_id}",
            json={"name": "TEST Renamed", "phone": "+91 11111"},
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "TEST Renamed"

    def test_delete_trainer(self, admin_token):
        assert TestTrainers.created_id
        r = requests.delete(f"{API}/trainers/{TestTrainers.created_id}", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200
        # Verify removal
        r2 = requests.get(f"{API}/trainers", headers=_ah(admin_token), timeout=20)
        assert not any(t["id"] == TestTrainers.created_id for t in r2.json())


# ---------- Students + Classes ----------
class TestStudentsAndClasses:
    student_id = None
    class_id = None

    def test_create_student_with_10_class_slots(self, admin_token, trainer_user):
        body = {
            "name": "TEST Student",
            "phone": "9999900000",
            "license_type": "gearless",
            "joining_date": date.today().isoformat(),
            "total_classes": 10,
            "assigned_trainer_id": trainer_user["id"],
            "fees_total": 5000,
            "fees_paid": 0,
        }
        r = requests.post(f"{API}/students", json=body, headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["name"] == "TEST Student"
        TestStudentsAndClasses.student_id = s["id"]

        # 10 class slots
        rc = requests.get(f"{API}/students/{s['id']}/classes", headers=_ah(admin_token), timeout=20)
        assert rc.status_code == 200
        classes = rc.json()
        assert len(classes) == 10
        nums = sorted(c["class_number"] for c in classes)
        assert nums == list(range(1, 11))
        TestStudentsAndClasses.class_id = classes[0]["id"]

    def test_list_students_has_classes_completed(self, admin_token):
        r = requests.get(f"{API}/students", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200
        students = r.json()
        ours = [s for s in students if s["id"] == TestStudentsAndClasses.student_id]
        assert ours and "classes_completed" in ours[0]
        assert ours[0]["classes_completed"] == 0

    def test_patch_student(self, admin_token):
        r = requests.patch(
            f"{API}/students/{TestStudentsAndClasses.student_id}",
            json={"notes": "TEST note", "phone": "9876543210"},
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["notes"] == "TEST note"
        assert r.json()["phone"] == "9876543210"

    def test_patch_class(self, trainer_token, trainer_user):
        today = date.today().isoformat()
        r = requests.patch(
            f"{API}/classes/{TestStudentsAndClasses.class_id}",
            json={"status": "completed", "completed_date": today,
                  "trainer_id": trainer_user["id"], "notes": "good"},
            headers=_ah(trainer_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "completed"
        assert r.json()["completed_date"] == today

        # classes_completed bump verified via list
        r2 = requests.get(f"{API}/students", headers=_ah(trainer_token), timeout=20)
        ours = [s for s in r2.json() if s["id"] == TestStudentsAndClasses.student_id][0]
        assert ours["classes_completed"] == 1

    def test_trainer_cannot_delete_student(self, trainer_token):
        r = requests.delete(
            f"{API}/students/{TestStudentsAndClasses.student_id}",
            headers=_ah(trainer_token), timeout=20,
        )
        assert r.status_code == 403


# ---------- Attendance ----------
class TestAttendance:
    def test_upsert_and_filter(self, admin_token, trainer_user):
        today = date.today().isoformat()
        body = {"trainer_id": trainer_user["id"], "date": today, "status": "present", "notes": "ok"}
        r = requests.post(f"{API}/attendance", json=body, headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["status"] == "present"

        # Upsert again with different status
        r2 = requests.post(f"{API}/attendance",
                           json={**body, "status": "leave"},
                           headers=_ah(admin_token), timeout=20)
        assert r2.status_code == 200
        assert r2.json()["status"] == "leave"

        # Filter by date
        r3 = requests.get(f"{API}/attendance?date={today}", headers=_ah(admin_token), timeout=20)
        assert r3.status_code == 200
        recs = r3.json()
        assert any(a["trainer_id"] == trainer_user["id"] and a["date"] == today for a in recs)


# ---------- Payments ----------
class TestPayments:
    def test_create_payment_increments_fees(self, admin_token):
        sid = TestStudentsAndClasses.student_id
        # before
        before = requests.get(f"{API}/students/{sid}", headers=_ah(admin_token), timeout=20).json()
        paid_before = float(before.get("fees_paid", 0))

        body = {"student_id": sid, "amount": 1500, "date": date.today().isoformat(),
                "method": "cash", "notes": "TEST pay"}
        r = requests.post(f"{API}/payments", json=body, headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["amount"] == 1500

        after = requests.get(f"{API}/students/{sid}", headers=_ah(admin_token), timeout=20).json()
        assert float(after["fees_paid"]) == pytest.approx(paid_before + 1500)


# ---------- Dashboard / Reports ----------
class TestDashboardAndReports:
    def test_dashboard_stats(self, admin_token):
        r = requests.get(f"{API}/dashboard/stats", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for key in ["total_students", "active_students", "total_trainers",
                    "classes_today", "present_today", "absent_today",
                    "fees_total", "fees_paid", "fees_pending"]:
            assert key in d
        assert d["total_students"] >= 1
        assert d["total_trainers"] >= 1
        assert d["classes_today"] >= 1  # we completed one above

    def test_daily_report(self, admin_token):
        today = date.today().isoformat()
        r = requests.get(f"{API}/reports/daily?date={today}", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200
        rep = r.json()
        assert rep["date"] == today
        assert isinstance(rep["classes"], list)
        assert isinstance(rep["attendance"], list)
        assert isinstance(rep["payments"], list)
        assert any(p.get("amount") == 1500 for p in rep["payments"])


# ---------- Cleanup ----------
def test_zz_cleanup_admin_deletes_student(admin_token=None):
    # Use a fresh login to ensure availability post-tests
    tok = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20).json()["access_token"]
    sid = TestStudentsAndClasses.student_id
    if sid:
        r = requests.delete(f"{API}/students/{sid}", headers={"Authorization": f"Bearer {tok}"}, timeout=20)
        assert r.status_code == 200
