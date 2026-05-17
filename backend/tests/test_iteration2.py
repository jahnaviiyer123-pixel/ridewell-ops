"""Iteration 2 backend tests for RideWell Ops.

Covers: Slots CRUD (admin-gated), extended Student model (age, gender, slot_time,
needs_pickup, pickup_address, drop_address), Today's Schedule endpoint, and
Telegram whitelist (admin-only, upsert, @/case normalization).
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
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def trainer_token():
    r = requests.post(f"{API}/auth/login", json=TRAINER, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def trainer_user(trainer_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {trainer_token}"}, timeout=20)
    assert r.status_code == 200
    return r.json()


def _ah(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Slots ----------
class TestSlots:
    created_slot_id = None
    DEFAULT_LABELS = {"06:00-07:00", "07:00-08:00", "08:00-09:00", "17:00-18:00", "18:00-19:00"}

    def test_list_slots_has_seeded_defaults(self, trainer_token):
        r = requests.get(f"{API}/slots", headers=_ah(trainer_token), timeout=20)
        assert r.status_code == 200, r.text
        slots = r.json()
        labels = {s["label"] for s in slots}
        missing = self.DEFAULT_LABELS - labels
        assert not missing, f"Missing default seeded slots: {missing}"
        # sorted ascending by start_time
        starts = [s["start_time"] for s in slots]
        assert starts == sorted(starts), "Slots not sorted by start_time"
        # structural fields
        for s in slots:
            assert {"id", "label", "start_time", "end_time", "created_at"}.issubset(s.keys())
            assert "_id" not in s

    def test_list_slots_requires_auth(self):
        r = requests.get(f"{API}/slots", timeout=20)
        assert r.status_code == 401

    def test_create_slot_forbidden_for_trainer(self, trainer_token):
        body = {"label": "TEST-20:00-21:00", "start_time": "20:00", "end_time": "21:00"}
        r = requests.post(f"{API}/slots", json=body, headers=_ah(trainer_token), timeout=20)
        assert r.status_code == 403

    def test_create_slot_admin(self, admin_token):
        # unique label each run
        label = f"TEST-{uuid.uuid4().hex[:4]}-21:00-22:00"
        body = {"label": label, "start_time": "21:00", "end_time": "22:00"}
        r = requests.post(f"{API}/slots", json=body, headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["label"] == label
        assert s["start_time"] == "21:00"
        assert s["end_time"] == "22:00"
        assert "id" in s and "_id" not in s
        TestSlots.created_slot_id = s["id"]

        # Verify persisted via GET
        r2 = requests.get(f"{API}/slots", headers=_ah(admin_token), timeout=20)
        assert any(x["id"] == s["id"] for x in r2.json())

    def test_create_slot_duplicate_label_400(self, admin_token):
        # reuse seeded label
        r = requests.post(
            f"{API}/slots",
            json={"label": "06:00-07:00", "start_time": "06:00", "end_time": "07:00"},
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 400

    def test_delete_slot_forbidden_for_trainer(self, trainer_token):
        assert TestSlots.created_slot_id
        r = requests.delete(
            f"{API}/slots/{TestSlots.created_slot_id}",
            headers=_ah(trainer_token), timeout=20,
        )
        assert r.status_code == 403

    def test_delete_slot_admin(self, admin_token):
        assert TestSlots.created_slot_id
        r = requests.delete(
            f"{API}/slots/{TestSlots.created_slot_id}",
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 200
        # Verify gone
        r2 = requests.get(f"{API}/slots", headers=_ah(admin_token), timeout=20)
        assert not any(x["id"] == TestSlots.created_slot_id for x in r2.json())

    def test_delete_slot_404(self, admin_token):
        r = requests.delete(f"{API}/slots/nonexistent-{uuid.uuid4().hex}",
                            headers=_ah(admin_token), timeout=20)
        assert r.status_code == 404


# ---------- Students extended fields + Schedule ----------
class TestStudentsExtendedAndSchedule:
    assigned_student_id = None
    unassigned_student_id = None
    SLOT = "07:00-08:00"

    def test_create_student_with_new_fields(self, admin_token, trainer_user):
        body = {
            "name": "TEST Pickup Student",
            "phone": "9000011111",
            "age": 24,
            "gender": "female",
            "license_type": "gearless",
            "joining_date": date.today().isoformat(),
            "slot_time": self.SLOT,
            "needs_pickup": True,
            "pickup_address": "TEST 12 MG Road",
            "drop_address": "TEST 34 Park Street",
            "total_classes": 5,
            "assigned_trainer_id": trainer_user["id"],
            "fees_total": 3000,
        }
        r = requests.post(f"{API}/students", json=body, headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        for k in ["age", "gender", "slot_time", "needs_pickup", "pickup_address", "drop_address"]:
            assert k in s, f"Missing field {k} in response"
        assert s["age"] == 24
        assert s["gender"] == "female"
        assert s["slot_time"] == self.SLOT
        assert s["needs_pickup"] is True
        assert s["pickup_address"] == "TEST 12 MG Road"
        assert s["drop_address"] == "TEST 34 Park Street"
        TestStudentsExtendedAndSchedule.assigned_student_id = s["id"]

        # GET to confirm persistence
        g = requests.get(f"{API}/students/{s['id']}", headers=_ah(admin_token), timeout=20)
        assert g.status_code == 200
        gs = g.json()
        assert gs["needs_pickup"] is True
        assert gs["slot_time"] == self.SLOT

    def test_create_unassigned_student(self, admin_token):
        body = {
            "name": "TEST Unassigned",
            "phone": "9000022222",
            "license_type": "geared",
            "joining_date": date.today().isoformat(),
            "needs_pickup": False,
            "total_classes": 3,
        }
        r = requests.post(f"{API}/students", json=body, headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s.get("slot_time") in (None, "")
        assert s["needs_pickup"] is False
        TestStudentsExtendedAndSchedule.unassigned_student_id = s["id"]

    def test_patch_student_new_fields_including_needs_pickup_bool(self, admin_token):
        sid = TestStudentsExtendedAndSchedule.assigned_student_id
        # flip needs_pickup to False and update addresses/age
        r = requests.patch(
            f"{API}/students/{sid}",
            json={
                "needs_pickup": False,
                "age": 25,
                "gender": "other",
                "pickup_address": "TEST updated pickup",
                "drop_address": "TEST updated drop",
                "slot_time": "08:00-09:00",
            },
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["needs_pickup"] is False
        assert s["age"] == 25
        assert s["gender"] == "other"
        assert s["pickup_address"] == "TEST updated pickup"
        assert s["slot_time"] == "08:00-09:00"

        # Flip it back to True so schedule test has a pickup-needed row
        r2 = requests.patch(
            f"{API}/students/{sid}",
            json={"needs_pickup": True, "slot_time": self.SLOT},
            headers=_ah(admin_token), timeout=20,
        )
        assert r2.status_code == 200
        assert r2.json()["needs_pickup"] is True
        assert r2.json()["slot_time"] == self.SLOT

    def test_schedule_today_structure_and_buckets(self, admin_token):
        today = date.today().isoformat()
        r = requests.get(f"{API}/schedule/today?date={today}", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["date", "slots", "by_slot", "unassigned", "trainers"]:
            assert k in data, f"Missing key {k} in schedule response"
        assert data["date"] == today
        assert isinstance(data["slots"], list) and len(data["slots"]) >= 5
        assert isinstance(data["by_slot"], dict)
        assert isinstance(data["unassigned"], list)
        assert isinstance(data["trainers"], list)

        # Our assigned student should appear in the slot bucket
        assigned_id = TestStudentsExtendedAndSchedule.assigned_student_id
        bucket = data["by_slot"].get(self.SLOT, [])
        found = [x for x in bucket if x["id"] == assigned_id]
        assert found, f"Assigned student not found in by_slot[{self.SLOT}]"
        row = found[0]
        for k in ["id", "name", "phone", "needs_pickup", "pickup_address",
                  "drop_address", "assigned_trainer_id", "next_class", "today_class"]:
            assert k in row, f"Missing field {k} in schedule row"
        assert row["needs_pickup"] is True

        # Unassigned student appears in unassigned bucket
        unassigned_id = TestStudentsExtendedAndSchedule.unassigned_student_id
        assert any(x["id"] == unassigned_id for x in data["unassigned"])

    def test_schedule_today_default_date(self, admin_token):
        r = requests.get(f"{API}/schedule/today", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["date"]  # present

    def test_schedule_today_requires_auth(self):
        r = requests.get(f"{API}/schedule/today", timeout=20)
        assert r.status_code == 401

    def test_zz_cleanup_students(self, admin_token):
        for sid in [TestStudentsExtendedAndSchedule.assigned_student_id,
                    TestStudentsExtendedAndSchedule.unassigned_student_id]:
            if sid:
                requests.delete(f"{API}/students/{sid}", headers=_ah(admin_token), timeout=20)


# ---------- Telegram Whitelist ----------
class TestTelegramWhitelist:
    created_id = None
    second_id = None

    def test_list_forbidden_for_trainer(self, trainer_token):
        r = requests.get(f"{API}/telegram/whitelist", headers=_ah(trainer_token), timeout=20)
        assert r.status_code == 403

    def test_list_admin_ok(self, admin_token):
        r = requests.get(f"{API}/telegram/whitelist", headers=_ah(admin_token), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_post_forbidden_for_trainer(self, trainer_token, trainer_user):
        r = requests.post(
            f"{API}/telegram/whitelist",
            json={"telegram_username": "test_tg_x", "user_id": trainer_user["id"]},
            headers=_ah(trainer_token), timeout=20,
        )
        assert r.status_code == 403

    def test_post_creates_with_stripped_lowercased_handle(self, admin_token, trainer_user):
        handle_input = f"@TEST_Handle_{uuid.uuid4().hex[:6].upper()}"
        expected = handle_input.lstrip("@").lower()
        r = requests.post(
            f"{API}/telegram/whitelist",
            json={"telegram_username": handle_input, "user_id": trainer_user["id"]},
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        row = r.json()
        assert row["telegram_username"] == expected
        assert row["user_id"] == trainer_user["id"]
        assert "id" in row and "_id" not in row
        TestTelegramWhitelist.created_id = row["id"]
        TestTelegramWhitelist._handle = expected

    def test_post_is_upsert_same_username(self, admin_token, trainer_user):
        # Re-post same handle (with different casing/@) -> should update (upsert)
        handle = TestTelegramWhitelist._handle
        r = requests.post(
            f"{API}/telegram/whitelist",
            json={"telegram_username": f"@{handle.upper()}", "user_id": trainer_user["id"]},
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        row = r.json()
        assert row["telegram_username"] == handle  # lowercased/stripped

        # Verify only one entry for this handle
        lst = requests.get(f"{API}/telegram/whitelist", headers=_ah(admin_token), timeout=20).json()
        matches = [x for x in lst if x["telegram_username"] == handle]
        assert len(matches) == 1, f"Upsert violated: {len(matches)} entries for {handle}"
        # user_name/user_role attached
        assert "user_name" in matches[0] and "user_role" in matches[0]

    def test_post_user_not_found_404(self, admin_token):
        r = requests.post(
            f"{API}/telegram/whitelist",
            json={"telegram_username": f"test_nouser_{uuid.uuid4().hex[:5]}",
                  "user_id": f"nonexistent-{uuid.uuid4().hex}"},
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 404

    def test_delete_forbidden_for_trainer(self, trainer_token):
        assert TestTelegramWhitelist.created_id
        r = requests.delete(
            f"{API}/telegram/whitelist/{TestTelegramWhitelist.created_id}",
            headers=_ah(trainer_token), timeout=20,
        )
        assert r.status_code == 403

    def test_delete_admin_removes(self, admin_token):
        # Fetch current id for our handle in case upsert kept the original id
        lst = requests.get(f"{API}/telegram/whitelist", headers=_ah(admin_token), timeout=20).json()
        row = next((x for x in lst if x["telegram_username"] == TestTelegramWhitelist._handle), None)
        assert row is not None
        r = requests.delete(
            f"{API}/telegram/whitelist/{row['id']}",
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 200
        lst2 = requests.get(f"{API}/telegram/whitelist", headers=_ah(admin_token), timeout=20).json()
        assert not any(x["telegram_username"] == TestTelegramWhitelist._handle for x in lst2)

    def test_delete_404(self, admin_token):
        r = requests.delete(
            f"{API}/telegram/whitelist/nonexistent-{uuid.uuid4().hex}",
            headers=_ah(admin_token), timeout=20,
        )
        assert r.status_code == 404
