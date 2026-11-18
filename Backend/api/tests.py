import json
import uuid
from django.test import TestCase, Client
from django.contrib.auth.hashers import make_password, check_password
from .models import CrewUser, Aircraft, Part, WorkOrder, PurchaseOrder, FlightRoute, Technician, ActivityFeed
from .views import load_json_file, save_json_file, USERS_FILE, MRO_DB_FILE

class AuthenticationAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.orig_users = load_json_file(USERS_FILE)
        self.hashed_pwd = make_password("SecurePass123!")
        self.user = CrewUser.objects.create(
            name="Alice Vance",
            email="alice.test@flightfix.aero",
            employee_id="AME-1001",
            password=self.hashed_pwd,
            role="Field Technician",
            station="JFK"
        )

    def tearDown(self):
        if self.orig_users is not None:
            save_json_file(USERS_FILE, self.orig_users)

    def test_login_by_email_success(self):
        payload = {
            "identifier": "alice.test@flightfix.aero",
            "password": "SecurePass123!"
        }
        res = self.client.post("/api/auth/login", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["user"]["email"], "alice.test@flightfix.aero")
        # Ensure password is NEVER leaked in response
        self.assertNotIn("password", data["user"])

    def test_login_by_employee_id_success(self):
        payload = {
            "identifier": "AME-1001",
            "password": "SecurePass123!"
        }
        res = self.client.post("/api/auth/login", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["user"]["employeeId"], "AME-1001")

    def test_login_invalid_password_returns_401(self):
        payload = {
            "identifier": "alice.test@flightfix.aero",
            "password": "WrongPassword999"
        }
        res = self.client.post("/api/auth/login", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 401)
        data = res.json()
        self.assertFalse(data.get("success"))

    def test_login_nonexistent_user_returns_401(self):
        payload = {
            "identifier": "ghost.nonexistent@flightfix.aero",
            "password": "AnyPassword"
        }
        res = self.client.post("/api/auth/login", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 401)

    def test_signup_new_user_success(self):
        uid = uuid.uuid4().hex[:6]
        payload = {
            "name": f"Test Pilot {uid}",
            "email": f"pilot.{uid}@flightfix.aero",
            "employeeId": f"AME-{uid}",
            "password": "StrongPassword789!",
            "role": "Field Technician",
            "station": "LHR"
        }
        res = self.client.post("/api/auth/signup", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data.get("success"))
        # Verify user persisted in database with hashed password
        created = CrewUser.objects.get(email=payload["email"])
        self.assertTrue(check_password("StrongPassword789!", created.password))
        self.assertNotEqual(created.password, "StrongPassword789!")

    def test_signup_duplicate_email_rejected_409(self):
        payload = {
            "name": "Alice Clone",
            "email": "ALICE.TEST@flightfix.aero", # case-insensitive test
            "employeeId": "AME-9999",
            "password": "ValidPassword123!",
            "role": "Field Technician"
        }
        res = self.client.post("/api/auth/signup", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 409)
        data = res.json()
        self.assertIn("already registered", data.get("error", "").lower())

    def test_signup_duplicate_employee_id_rejected_409(self):
        payload = {
            "name": "Different Name",
            "email": "different@flightfix.aero",
            "employeeId": "ame-1001", # case-insensitive test
            "password": "ValidPassword123!",
            "role": "Field Technician"
        }
        res = self.client.post("/api/auth/signup", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 409)

    def test_signup_short_password_rejected_400(self):
        payload = {
            "name": "Short Pass User",
            "email": "short@flightfix.aero",
            "employeeId": "AME-3003",
            "password": "123",
            "role": "Field Technician"
        }
        res = self.client.post("/api/auth/signup", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 400)


class AircraftFleetAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.orig_mro = load_json_file(MRO_DB_FILE)
        self.ac = Aircraft.objects.create(
            reg="VT-TST",
            model="Airbus A320neo",
            serial="MSN-9901",
            flight_hours=1250.5,
            cycles=600,
            status="in_service",
            aog=False,
            location="BOM"
        )

    def tearDown(self):
        if self.orig_mro is not None:
            save_json_file(MRO_DB_FILE, self.orig_mro)

    def test_list_aircraft(self):
        res = self.client.get("/api/aircraft")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        regs = [a.get("reg") or a.get("r") for a in data.get("data", [])]
        self.assertIn("VT-TST", regs)

    def test_aircraft_detail(self):
        res = self.client.get(f"/api/aircraft/{self.ac.reg}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["data"]["reg"], "VT-TST")
        self.assertEqual(data["data"]["model"], "Airbus A320neo")

    def test_aircraft_telemetry(self):
        res = self.client.get(f"/api/aircraft/{self.ac.reg}/telemetry")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("turbofan", data["data"])
        self.assertIn("hydraulics", data["data"])
        self.assertIn("flightControls", data["data"])

    def test_aircraft_patch_update(self):
        payload = {"flightHours": 1260.0, "status": "maintenance"}
        res = self.client.patch(f"/api/aircraft/{self.ac.reg}", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["data"]["flightHours"], 1260.0)


class WorkOrderAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.orig_mro = load_json_file(MRO_DB_FILE)
        self.ac = Aircraft.objects.create(
            reg="VT-MRO",
            model="Boeing 777-300ER",
            status="in_service",
            flight_hours=3200.0,
            cycles=1200
        )
        self.wo = WorkOrder.objects.create(
            wo_id="WO-101",
            aircraft=self.ac.reg,
            title="A-Check Turnaround Inspection",
            kind="A-Check",
            status="progress",
            bay="Bay 2",
            day="Tue",
            assigned_to="Marcus Vance",
            checklist=[["Inspect landing gear", 0], ["Hydraulic fluid check", 1]]
        )

    def tearDown(self):
        if self.orig_mro is not None:
            save_json_file(MRO_DB_FILE, self.orig_mro)

    def test_list_workorders(self):
        res = self.client.get("/api/workorders")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("data", data)
        self.assertTrue(any(w.get("id") == "WO-101" or w.get("wo_id") == "WO-101" for w in data["data"]))

    def test_toggle_checklist_step(self):
        # Toggle step 0 from 0 to 1
        res = self.client.post(f"/api/workorders/{self.wo.wo_id}/checklist/0", content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.wo.refresh_from_db()
        self.assertEqual(self.wo.checklist[0][1], 1)

    def test_signoff_workorder(self):
        res = self.client.post(f"/api/workorders/{self.wo.wo_id}/signoff")
        self.assertEqual(res.status_code, 200)
        self.wo.refresh_from_db()
        self.assertEqual(self.wo.status, "done")


class PartsAndInventoryAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.orig_mro = load_json_file(MRO_DB_FILE)
        self.part = Part.objects.create(
            part_id="CFM-BLD-01",
            name="Fan Blade Stage 1",
            ata_chapter="ATA 72",
            qty=8,
            min_qty=2,
            unit_cost=14200.0,
            supplier="Safran Aero"
        )

    def tearDown(self):
        if self.orig_mro is not None:
            save_json_file(MRO_DB_FILE, self.orig_mro)

    def test_list_parts(self):
        res = self.client.get("/api/parts")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        part_ids = [p.get("id") or p.get("partId") or p.get("partNo") for p in data.get("data", [])]
        self.assertIn("CFM-BLD-01", part_ids)


class StateSyncAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.orig_mro = load_json_file(MRO_DB_FILE)

    def tearDown(self):
        if self.orig_mro is not None:
            save_json_file(MRO_DB_FILE, self.orig_mro)

    def test_get_full_sync_state(self):
        res = self.client.get("/api/sync")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        state = data.get("state", {})
        self.assertIn("ac", state)
        self.assertIn("wo", state)
        self.assertIn("parts", state)
        self.assertIn("routes", state)

    def test_post_sync_state(self):
        payload = {
            "ac": [{"r": "VT-SYNC", "t": "A321", "h": 500, "aog": 0}],
            "routes": [{"id": "RT-99", "flightNo": "FF-99", "origin": "DEL", "dest": "DXB", "active": True}]
        }
        res = self.client.post("/api/sync", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
