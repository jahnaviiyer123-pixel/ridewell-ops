from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Header, Query
from fastapi.responses import Response as RawResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import requests as http_requests


# ---------- DB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------- App ----------
app = FastAPI(title="RideWell Ops")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ridewell")

# ---------- Auth helpers ----------
JWT_SECRET = os.environ.get("JWT_SECRET", "devsecret")
JWT_ALG = "HS256"
ACCESS_MIN = 60 * 12  # 12 hours


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("status") and user["status"] != "active":
        raise HTTPException(status_code=403, detail="Account is not active")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------- Models ----------
class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Literal["admin", "trainer"]
    phone: Optional[str] = None
    created_at: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TrainerCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    shift: Optional[Literal["morning", "afternoon", "both"]] = "both"
    salary_type: Optional[Literal["part_time", "full_time"]] = "full_time"
    base_salary: Optional[int] = 0


class TrainerRegister(BaseModel):
    """Self-signup by trainer — creates a pending account that admin must approve."""
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None


class TrainerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    photo_url: Optional[str] = None
    shift: Optional[Literal["morning", "afternoon", "both"]] = None
    salary_type: Optional[Literal["part_time", "full_time"]] = None
    base_salary: Optional[int] = None


class StudentCreate(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    age: Optional[int] = None
    gender: Optional[Literal["male", "female", "other"]] = None
    license_type: Literal["gearless", "geared", "both"] = "gearless"
    joining_date: str  # ISO date
    slot_time: Optional[str] = None
    needs_pickup: bool = False
    pickup_address: Optional[str] = None
    drop_address: Optional[str] = None
    total_classes: int = 10
    assigned_trainer_id: Optional[str] = None
    pickup_trainer_id: Optional[str] = None
    drop_trainer_id: Optional[str] = None
    photo_url: Optional[str] = None
    fees_total: float = 0
    fees_paid: float = 0
    notes: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    age: Optional[int] = None
    gender: Optional[Literal["male", "female", "other"]] = None
    license_type: Optional[Literal["gearless", "geared", "both"]] = None
    joining_date: Optional[str] = None
    slot_time: Optional[str] = None
    needs_pickup: Optional[bool] = None
    pickup_address: Optional[str] = None
    drop_address: Optional[str] = None
    total_classes: Optional[int] = None
    assigned_trainer_id: Optional[str] = None
    pickup_trainer_id: Optional[str] = None
    drop_trainer_id: Optional[str] = None
    photo_url: Optional[str] = None
    fees_total: Optional[float] = None
    fees_paid: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[Literal["active", "completed", "dropped"]] = None


class SlotCreate(BaseModel):
    label: str  # e.g. "06:00-07:00"
    start_time: str  # "06:00"
    end_time: str  # "07:00"


class ClassUpdate(BaseModel):
    scheduled_date: Optional[str] = None
    completed_date: Optional[str] = None
    trainer_id: Optional[str] = None
    status: Optional[Literal["pending", "completed", "missed"]] = None
    notes: Optional[str] = None


class AttendanceCreate(BaseModel):
    trainer_id: str
    date: str
    status: Literal["present", "absent", "leave"]
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    student_id: str
    amount: float
    date: str
    method: Literal["cash", "upi", "card", "bank"] = "cash"
    notes: Optional[str] = None


# ---------- Startup / Seed ----------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@ridewell.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "status": "active",
            "phone": None,
            "photo_url": None,
            "created_at": _now_iso(),
        })
        logger.info("Seeded admin user")
    else:
        updates = {}
        if not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        if existing.get("status") != "active":
            updates["status"] = "active"
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})

    # Seed demo trainer
    trainer_email = "trainer@ridewell.com"
    if not await db.users.find_one({"email": trainer_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": trainer_email,
            "password_hash": hash_password("trainer123"),
            "name": "Ravi Kumar",
            "role": "trainer",
            "status": "active",
            "phone": "+91 98765 43210",
            "photo_url": None,
            "created_at": _now_iso(),
        })
        logger.info("Seeded demo trainer")


async def seed_default_slots():
    if await db.slots.count_documents({}) > 0:
        return
    defaults = [
        ("06:00-07:00", "06:00", "07:00"),
        ("07:00-08:00", "07:00", "08:00"),
        ("08:00-09:00", "08:00", "09:00"),
        ("17:00-18:00", "17:00", "18:00"),
        ("18:00-19:00", "18:00", "19:00"),
    ]
    for label, st, en in defaults:
        await db.slots.insert_one({
            "id": str(uuid.uuid4()),
            "label": label,
            "start_time": st,
            "end_time": en,
            "created_at": _now_iso(),
        })


async def _safe_create_index(collection, keys, **kwargs):
    """Create index, dropping conflicting one if needed."""
    try:
        await collection.create_index(keys, **kwargs)
    except Exception as e:
        if "IndexKeySpecsConflict" in str(e) or "already exists" in str(e):
            if isinstance(keys, str):
                index_name = f"{keys}_1"
            else:
                index_name = "_".join(f"{k}_{v}" for k, v in keys)
            try:
                await collection.drop_index(index_name)
                await collection.create_index(keys, **kwargs)
                logger.info("Recreated index %s", index_name)
            except Exception as e2:
                logger.warning("Could not recreate index: %s", e2)
        else:
            logger.warning("Index creation issue (non-fatal): %s", e)


@app.on_event("startup")
async def _startup():
    await _safe_create_index(db.users, "email", unique=True)
    await _safe_create_index(db.students, "id", unique=True)
    await _safe_create_index(db.classes, [("student_id", 1), ("class_number", 1)], unique=True)
    await _safe_create_index(db.attendance, [("trainer_id", 1), ("date", 1)], unique=True)
    await _safe_create_index(db.slots, "label", unique=True)
    await seed_admin()
    await seed_default_slots()


@app.on_event("shutdown")
async def _shutdown():
    client.close()


# ---------- Auth Endpoints ----------
def _set_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_MIN * 60,
        path="/",
    )


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    status_val = user.get("status", "active")
    if status_val == "pending":
        raise HTTPException(status_code=403, detail="Account pending admin approval")
    if status_val == "rejected":
        raise HTTPException(status_code=403, detail="Account access has been revoked")
    token = create_access_token(user["id"], user["email"], user["role"])
    _set_cookie(response, token)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "phone": user.get("phone"),
            "photo_url": user.get("photo_url"),
            "status": status_val,
            "created_at": user["created_at"],
        },
    }


@api.post("/auth/register")
async def register_trainer(body: TrainerRegister):
    """Trainer self-signup. Creates a pending account that admin must approve."""
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "trainer",
        "status": "pending",
        "phone": body.phone,
        "photo_url": None,
        "created_at": _now_iso(),
    }
    await db.users.insert_one(doc)
    return {"ok": True, "message": "Registration submitted. Waiting for admin approval."}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------- Users / Trainers ----------
@api.get("/trainers")
async def list_trainers(
    status: Optional[str] = Query(None, description="active|pending|rejected"),
    user: dict = Depends(get_current_user),
):
    q = {"role": "trainer"}
    if status:
        q["status"] = status
    # non-admin can only see active trainers
    if user.get("role") != "admin":
        q["status"] = "active"
    trainers = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(500)
    return trainers


@api.post("/trainers")
async def create_trainer(body: TrainerCreate, user: dict = Depends(require_admin)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "trainer",
        "status": "active",  # admin-created trainers are auto-active
        "phone": body.phone,
        "photo_url": None,
        "shift": body.shift or "both",
        "salary_type": body.salary_type or "full_time",
        "base_salary": body.base_salary or 0,
        "created_at": _now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@api.post("/trainers/{trainer_id}/approve")
async def approve_trainer(trainer_id: str, user: dict = Depends(require_admin)):
    res = await db.users.update_one(
        {"id": trainer_id, "role": "trainer"},
        {"$set": {"status": "active"}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer not found")
    trainer = await db.users.find_one({"id": trainer_id}, {"_id": 0, "password_hash": 0})
    return trainer


@api.post("/trainers/{trainer_id}/reject")
async def reject_trainer(trainer_id: str, user: dict = Depends(require_admin)):
    res = await db.users.update_one(
        {"id": trainer_id, "role": "trainer"},
        {"$set": {"status": "rejected"}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer not found")
    trainer = await db.users.find_one({"id": trainer_id}, {"_id": 0, "password_hash": 0})
    return trainer


@api.patch("/trainers/{trainer_id}")
async def update_trainer(trainer_id: str, body: TrainerUpdate, user: dict = Depends(get_current_user)):
    # Admin can edit any trainer; trainers can edit only themselves
    if user.get("role") != "admin" and user.get("id") != trainer_id:
        raise HTTPException(status_code=403, detail="Cannot edit other trainers")
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.phone is not None:
        updates["phone"] = body.phone
    if body.password:
        updates["password_hash"] = hash_password(body.password)
    if body.photo_url is not None:
        updates["photo_url"] = body.photo_url
    if body.shift is not None:
        updates["shift"] = body.shift
    if body.salary_type is not None:
        updates["salary_type"] = body.salary_type
    if body.base_salary is not None:
        updates["base_salary"] = body.base_salary
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.users.update_one({"id": trainer_id, "role": "trainer"}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer not found")
    trainer = await db.users.find_one({"id": trainer_id}, {"_id": 0, "password_hash": 0})
    return trainer


@api.delete("/trainers/{trainer_id}")
async def delete_trainer(trainer_id: str, user: dict = Depends(require_admin)):
    res = await db.users.delete_one({"id": trainer_id, "role": "trainer"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trainer not found")
    return {"status": "ok"}


@api.get("/trainers/{trainer_id}")
async def get_trainer(trainer_id: str, user: dict = Depends(get_current_user)):
    trainer = await db.users.find_one({"id": trainer_id, "role": "trainer"}, {"_id": 0, "password_hash": 0})
    if not trainer:
        raise HTTPException(status_code=404, detail="Trainer not found")
    
    # Get assigned students
    students = await db.students.find({"assigned_trainer_id": trainer_id}, {"_id": 0}).to_list(100)
    
    # Get attendance history
    attendance = await db.attendance.find({"trainer_id": trainer_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    
    return {
        "trainer": trainer,
        "students": students,
        "attendance": attendance,
    }


# ---------- Students ----------
async def _create_class_slots(student_id: str, total: int, trainer_id: Optional[str]):
    docs = []
    for i in range(1, total + 1):
        docs.append({
            "id": str(uuid.uuid4()),
            "student_id": student_id,
            "class_number": i,
            "scheduled_date": None,
            "completed_date": None,
            "trainer_id": trainer_id,
            "status": "pending",
            "notes": None,
            "updated_at": _now_iso(),
        })
    if docs:
        await db.classes.insert_many(docs)


@api.get("/students")
async def list_students(user: dict = Depends(get_current_user)):
    students = await db.students.find({}, {"_id": 0}).to_list(1000)
    # attach progress
    for s in students:
        completed = await db.classes.count_documents({"student_id": s["id"], "status": "completed"})
        s["classes_completed"] = completed
    students.sort(key=lambda x: x.get("joining_date", ""), reverse=True)
    return students


@api.post("/students")
async def create_student(body: StudentCreate, user: dict = Depends(get_current_user)):
    sid = str(uuid.uuid4())
    doc = {
        "id": sid,
        "name": body.name,
        "phone": body.phone,
        "email": body.email,
        "age": body.age,
        "gender": body.gender,
        "license_type": body.license_type,
        "joining_date": body.joining_date,
        "slot_time": body.slot_time,
        "needs_pickup": body.needs_pickup,
        "pickup_address": body.pickup_address,
        "drop_address": body.drop_address,
        "total_classes": body.total_classes,
        "assigned_trainer_id": body.assigned_trainer_id,
        "pickup_trainer_id": body.pickup_trainer_id,
        "drop_trainer_id": body.drop_trainer_id,
        "photo_url": body.photo_url,
        "fees_total": body.fees_total,
        "fees_paid": body.fees_paid,
        "notes": body.notes,
        "status": "active",
        "created_at": _now_iso(),
    }
    await db.students.insert_one(doc)
    
    # Automatically record initial payment in transaction ledger
    if body.fees_paid > 0:
        payment_doc = {
            "id": str(uuid.uuid4()),
            "student_id": sid,
            "amount": body.fees_paid,
            "date": body.joining_date,
            "method": "cash",  # Default to cash for initial enrollment payment
            "notes": "Initial enrollment payment",
            "recorded_by": user["id"],
            "created_at": _now_iso(),
        }
        await db.payments.insert_one(payment_doc)
        logger.info("Automatically recorded initial payment of %d for student %s", body.fees_paid, sid)

    await _create_class_slots(sid, body.total_classes, body.assigned_trainer_id)
    doc.pop("_id", None)
    return doc


@api.get("/students/{student_id}")
async def get_student(student_id: str, user: dict = Depends(get_current_user)):
    s = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    return s


@api.patch("/students/{student_id}")
async def update_student(student_id: str, body: StudentUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.students.update_one({"id": student_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return await db.students.find_one({"id": student_id}, {"_id": 0})


@api.delete("/students/{student_id}")
async def delete_student(student_id: str, user: dict = Depends(require_admin)):
    await db.students.delete_one({"id": student_id})
    await db.classes.delete_many({"student_id": student_id})
    await db.payments.delete_many({"student_id": student_id})
    return {"ok": True}


# ---------- Classes ----------
@api.get("/students/{student_id}/classes")
async def list_classes(student_id: str, user: dict = Depends(get_current_user)):
    classes = await db.classes.find({"student_id": student_id}, {"_id": 0}).sort("class_number", 1).to_list(100)
    return classes


@api.patch("/classes/{class_id}")
async def update_class(class_id: str, body: ClassUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    res = await db.classes.update_one({"id": class_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    updated_class = await db.classes.find_one({"id": class_id}, {"_id": 0})

    # Auto-complete student when ALL their classes are done
    if updated_class and updates.get("status") == "completed":
        student_id = updated_class["student_id"]
        total = await db.classes.count_documents({"student_id": student_id})
        completed = await db.classes.count_documents({"student_id": student_id, "status": "completed"})
        if total > 0 and completed >= total:
            await db.students.update_one(
                {"id": student_id, "status": "active"},
                {"$set": {"status": "completed", "completed_at": _now_iso()}},
            )
            logger.info("Auto-completed student %s (all %d classes done)", student_id, total)

    return updated_class


# ---------- Trainer Attendance ----------
@api.get("/attendance")
async def list_attendance(
    date: Optional[str] = None,
    trainer_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q = {}
    if date:
        q["date"] = date
    if trainer_id:
        q["trainer_id"] = trainer_id
    records = await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(1000)
    return records


@api.post("/attendance")
async def upsert_attendance(body: AttendanceCreate, user: dict = Depends(get_current_user)):
    # Only admin or the trainer themselves can mark
    if user["role"] != "admin" and user["id"] != body.trainer_id:
        raise HTTPException(status_code=403, detail="Cannot mark attendance for others")
    doc = {
        "trainer_id": body.trainer_id,
        "date": body.date,
        "status": body.status,
        "notes": body.notes,
        "updated_at": _now_iso(),
    }
    await db.attendance.update_one(
        {"trainer_id": body.trainer_id, "date": body.date},
        {"$set": doc, "$setOnInsert": {"id": str(uuid.uuid4())}},
        upsert=True,
    )
    return await db.attendance.find_one(
        {"trainer_id": body.trainer_id, "date": body.date}, {"_id": 0}
    )


# ---------- Payments ----------
@api.get("/payments")
async def list_payments(student_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if student_id:
        q["student_id"] = student_id
    payments = await db.payments.find(q, {"_id": 0}).sort("date", -1).to_list(1000)
    return payments


@api.post("/payments")
async def create_payment(body: PaymentCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "student_id": body.student_id,
        "amount": body.amount,
        "date": body.date,
        "method": body.method,
        "notes": body.notes,
        "recorded_by": user["id"],
        "created_at": _now_iso(),
    }
    await db.payments.insert_one(doc)
    # bump fees_paid on student
    await db.students.update_one(
        {"id": body.student_id},
        {"$inc": {"fees_paid": body.amount}},
    )
    doc.pop("_id", None)
    return doc




# ---------- Slots ----------
@api.get("/slots")
async def list_slots(user: dict = Depends(get_current_user)):
    slots = await db.slots.find({}, {"_id": 0}).sort("start_time", 1).to_list(100)
    return slots


@api.post("/slots")
async def create_slot(body: SlotCreate, user: dict = Depends(require_admin)):
    if await db.slots.find_one({"label": body.label}):
        raise HTTPException(status_code=400, detail="Slot label already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "label": body.label,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "created_at": _now_iso(),
    }
    await db.slots.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/slots/{slot_id}")
async def delete_slot(slot_id: str, user: dict = Depends(require_admin)):
    res = await db.slots.delete_one({"id": slot_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slot not found")
    return {"ok": True}


# ---------- Schedule (Today's Ops View) ----------
@api.get("/schedule/today")
async def schedule_today(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    day = date or datetime.now(timezone.utc).date().isoformat()

    slots = await db.slots.find({}, {"_id": 0}).sort("start_time", 1).to_list(100)
    students = await db.students.find({"status": "active"}, {"_id": 0}).to_list(1000)
    trainers = await db.users.find(
        {"role": "trainer"}, {"_id": 0, "password_hash": 0}
    ).to_list(500)

    # group students by slot
    by_slot = {}
    unassigned = []
    for s in students:
        # get next pending class for student
        next_class = await db.classes.find_one(
            {"student_id": s["id"], "status": "pending"},
            {"_id": 0},
            sort=[("class_number", 1)],
        )
        # get today's class if any
        today_class = await db.classes.find_one(
            {"student_id": s["id"], "$or": [
                {"completed_date": day},
                {"scheduled_date": day},
            ]},
            {"_id": 0},
        )
        student_row = {
            "id": s["id"],
            "name": s["name"],
            "phone": s["phone"],
            "needs_pickup": s.get("needs_pickup", False),
            "pickup_address": s.get("pickup_address"),
            "drop_address": s.get("drop_address"),
            "assigned_trainer_id": s.get("assigned_trainer_id"),
            "next_class": next_class,
            "today_class": today_class,
        }
        slot = s.get("slot_time")
        if slot:
            by_slot.setdefault(slot, []).append(student_row)
        else:
            unassigned.append(student_row)

    return {
        "date": day,
        "slots": slots,
        "by_slot": by_slot,
        "unassigned": unassigned,
        "trainers": trainers,
    }


# ---------- Telegram Whitelist (removed) ----------


# ---------- Dashboard / Reports ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    total_students = await db.students.count_documents({})
    active_students = await db.students.count_documents({"status": "active"})
    total_trainers = await db.users.count_documents({"role": "trainer"})

    # today classes
    classes_today_completed = await db.classes.count_documents(
        {"completed_date": today, "status": "completed"}
    )

    # trainers attendance today
    present_today = await db.attendance.count_documents({"date": today, "status": "present"})
    absent_today = await db.attendance.count_documents({"date": today, "status": "absent"})

    # fees
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$fees_total"}, "paid": {"$sum": "$fees_paid"}}}]
    agg = await db.students.aggregate(pipeline).to_list(1)
    fees_total = agg[0]["total"] if agg else 0
    fees_paid = agg[0]["paid"] if agg else 0

    return {
        "total_students": total_students,
        "active_students": active_students,
        "total_trainers": total_trainers,
        "classes_today": classes_today_completed,
        "present_today": present_today,
        "absent_today": absent_today,
        "fees_total": fees_total,
        "fees_paid": fees_paid,
        "fees_pending": max(0, fees_total - fees_paid),
    }


@api.get("/reports/daily")
async def daily_report(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    day = date or datetime.now(timezone.utc).date().isoformat()
    classes = await db.classes.find({"completed_date": day}, {"_id": 0}).to_list(500)
    attendance = await db.attendance.find({"date": day}, {"_id": 0}).to_list(500)
    payments = await db.payments.find({"date": day}, {"_id": 0}).to_list(500)
    return {"date": day, "classes": classes, "attendance": attendance, "payments": payments}


# Include router + middleware
app.include_router(api)

# ---------- CORS ----------
origins_env = os.environ.get("CORS_ORIGINS", "")
if origins_env.strip():
    allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
else:
    # Default: allow common local dev ports + any Vercel preview
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


# ---------- Serve React Frontend ----------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

FRONTEND_BUILD_DIR = Path(__file__).parent.parent / "frontend" / "build"

if FRONTEND_BUILD_DIR.exists():
    # Mount the /static folder containing bundle assets
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "static")), name="static")

    @app.get("/{catchall:path}")
    async def serve_frontend(request: Request, catchall: str):
        # Do not catch requests starting with api/
        if catchall.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        
        # Check if the requested file actually exists in the build root (like favicon.ico, logo192.png)
        file_path = FRONTEND_BUILD_DIR / catchall
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
            
        # Default to the SPA index.html for page routing
        return FileResponse(str(FRONTEND_BUILD_DIR / "index.html"))

