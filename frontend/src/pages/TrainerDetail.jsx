import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiError, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeftIcon,
  UserIcon,
  PhoneIcon,
  CalendarBlankIcon,
  BriefcaseIcon,
  ClockIcon,
  CurrencyInrIcon,
  UsersIcon,
  FloppyDiskIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

function buildPhotoSrc(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const token = localStorage.getItem("rw_token");
  const base = API.replace(/\/api$/, "");
  const sep = url.includes("?") ? "&" : "?";
  return `${base}${url}${token ? `${sep}auth=${token}` : ""}`;
}

export default function TrainerDetail() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { id } = useParams();
  
  const [trainer, setTrainer] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Salary and details edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    shift: "both",
    salary_type: "full_time",
    base_salary: 0,
  });

  // Calendar month selection
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-indexed

  const load = async () => {
    try {
      const { data } = await api.get(`/trainers/${id}`);
      setTrainer(data.trainer);
      setStudents(data.students);
      setAttendance(data.attendance);
      setEditForm({
        shift: data.trainer.shift || "both",
        salary_type: data.trainer.salary_type || "full_time",
        base_salary: data.trainer.base_salary || 0,
      });
    } catch (e) {
      toast.error("Failed to load trainer details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const saveDetails = async () => {
    try {
      const payload = {
        shift: editForm.shift,
        salary_type: editForm.salary_type,
        base_salary: Number(editForm.base_salary),
      };
      await api.patch(`/trainers/${id}`, payload);
      toast.success("Trainer profile updated");
      setEditing(false);
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  // Toggle/Mark attendance directly from calendar between Present and Absent
  const toggleAttendance = async (dateStr, currentStatus) => {
    if (!isAdmin) return; // Only admin can mark trainer attendance
    const newStatus = currentStatus === "present" ? "absent" : "present";
    
    try {
      await api.post("/attendance", {
        trainer_id: id,
        date: dateStr,
        status: newStatus,
        notes: `Marked ${newStatus} by admin`,
      });
      toast.success(`Attendance updated for ${dateStr}`);
      await load();
    } catch (e) {
      toast.error("Failed to update attendance");
    }
  };

  if (loading || !trainer) {
    return <div className="label-tag animate-pulse">Loading…</div>;
  }

  // --- CALENDAR GENERATION ---
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarDays = [];
  
  // Calculate Sundays & Working days for salary math
  let totalSundays = 0;
  let presentDays = 0;
  let absentDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const isSunday = date.getDay() === 0;
    
    // YYYY-MM-DD format
    const yyyy = currentYear;
    const mm = String(currentMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const record = attendance.find((a) => a.date === dateStr);
    const status = record ? record.status : "";

    if (isSunday) {
      totalSundays++;
    } else {
      if (status === "present") presentDays++;
      if (status === "absent") absentDays++;
    }

    calendarDays.push({
      dayNum: d,
      dayName,
      isSunday,
      dateStr,
      status,
      notes: record?.notes || "",
    });
  }

  // Salary calculations based on actual present days worked
  const workingDaysInMonth = daysInMonth - totalSundays;
  const baseSalary = trainer.base_salary || 0;
  const perDaySalary = workingDaysInMonth > 0 ? baseSalary / workingDaysInMonth : 0;
  const finalSalary = perDaySalary * presentDays;

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthLabel = new Date(currentYear, currentMonth).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="animate-fadeIn" data-testid="trainer-detail-page">
      <Link to="/trainers" className="inline-flex items-center gap-1 label-tag hover:text-blue-700 mb-6">
        <ArrowLeftIcon size={12} weight="bold" /> Back to Team
      </Link>

      {/* Roster & Grid Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Profile Details Block */}
        <div className="bento p-8 lg:col-span-2 space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap pb-6 border-b border-zinc-200">
            <div className="flex items-start gap-5 flex-1 min-w-0">
              <div className="w-20 h-20 bg-zinc-100 border border-zinc-300 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {trainer.photo_url ? (
                  <img src={buildPhotoSrc(trainer.photo_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={32} weight="bold" className="text-zinc-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="label-tag">Team Trainer</span>
                <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter leading-none mt-1">
                  {trainer.name}
                </h1>
                <div className="flex items-center gap-2 mt-2 font-mono-data text-xs text-zinc-500">
                  <PhoneIcon size={12} /> {trainer.phone || "No phone added"}
                </div>
              </div>
            </div>
            
            {isAdmin && (
              <div>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveDetails}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-blue-700 transition-colors"
                    >
                      <FloppyDiskIcon size={12} weight="bold" /> Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-100 transition-colors"
                  >
                    <PencilSimpleIcon size={12} weight="bold" /> Edit Contract
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* Shift Assignment */}
            <div className="space-y-1">
              <span className="label-tag flex items-center gap-1.5 text-zinc-500">
                <ClockIcon size={13} /> Shift
              </span>
              {editing ? (
                <select
                  value={editForm.shift}
                  onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
                  className="w-full bg-white border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="morning">Morning Only</option>
                  <option value="afternoon">Afternoon Only</option>
                  <option value="both">Both Shifts (Full Day)</option>
                </select>
              ) : (
                <div className="text-sm font-bold capitalize text-zinc-950">
                  {trainer.shift === "both" ? "Morning & Afternoon" : trainer.shift || "both"}
                </div>
              )}
            </div>

            {/* Employment Type */}
            <div className="space-y-1">
              <span className="label-tag flex items-center gap-1.5 text-zinc-500">
                <BriefcaseIcon size={13} /> Contract Type
              </span>
              {editing ? (
                <select
                  value={editForm.salary_type}
                  onChange={(e) => setEditForm({ ...editForm, salary_type: e.target.value })}
                  className="w-full bg-white border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="part_time">Part-Time</option>
                  <option value="full_time">Full-Time</option>
                </select>
              ) : (
                <div className="text-sm font-bold capitalize text-zinc-950">
                  {trainer.salary_type === "full_time" ? "Full-Time" : "Part-Time"}
                </div>
              )}
            </div>

            {/* Base Salary */}
            <div className="space-y-1">
              <span className="label-tag flex items-center gap-1.5 text-zinc-500">
                <CurrencyInrIcon size={13} /> Base Salary
              </span>
              {editing ? (
                <input
                  type="number"
                  value={editForm.base_salary}
                  onChange={(e) => setEditForm({ ...editForm, base_salary: e.target.value })}
                  className="w-full bg-white border border-zinc-300 px-2 py-1.5 text-sm"
                />
              ) : (
                <div className="text-sm font-bold text-zinc-950">
                  ₹{baseSalary.toLocaleString("en-IN")} / month
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Salary Ledger & Leave cuts (Visible only to Admin) */}
        {isAdmin && (
          <div className="bento p-8 bg-zinc-50 border-t-4 border-t-zinc-950 flex flex-col justify-between">
            <div>
              <div className="label-tag flex items-center gap-1.5 text-zinc-500">
                <CurrencyInrIcon size={14} weight="bold" /> Payroll Slip
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 uppercase font-bold tracking-wider">
                Current month projections
              </p>
              
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-500">Base Salary</span>
                  <span className="font-mono-data">₹{baseSalary.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-500">Working Days (Excl. Sundays)</span>
                  <span className="font-mono-data">{workingDaysInMonth} days</span>
                </div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-500">Days Present / Worked</span>
                  <span className="font-mono-data text-emerald-600 font-bold">{presentDays} days</span>
                </div>
                <div className="flex justify-between text-xs font-medium pb-3 border-b border-zinc-200">
                  <span className="text-zinc-500">Days Absent / Off</span>
                  <span className="font-mono-data text-red-600 font-bold">{absentDays} days</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1">
                  <span className="text-zinc-800">Daily Payout Rate</span>
                  <span className="font-mono-data text-zinc-900">₹{Math.round(perDaySalary).toLocaleString("en-IN")} / day</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-200/80">
              <span className="label-tag text-[9px] text-zinc-400">Net salary to transfer</span>
              <div className="font-heading text-3xl font-black text-emerald-800 tracking-tighter mt-1">
                ₹{Math.round(finalSalary).toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Calendar Attendance & Assigned Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left (2/3 width): Calendar Attendance Grid */}
        <div className="lg:col-span-2 bento p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="label-tag flex items-center gap-1 text-zinc-500">
                <CalendarBlankIcon size={13} weight="bold" /> Attendance
              </div>
              <h2 className="font-heading text-2xl font-bold tracking-tight mt-1">Attendance Tracker</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="px-2.5 py-1.5 border border-zinc-300 hover:bg-zinc-100 text-xs font-bold font-mono"
              >
                &lt;
              </button>
              <span className="font-heading font-black text-sm text-zinc-800 px-2 select-none">
                {monthLabel}
              </span>
              <button
                onClick={nextMonth}
                className="px-2.5 py-1.5 border border-zinc-300 hover:bg-zinc-100 text-xs font-bold font-mono"
              >
                &gt;
              </button>
            </div>
          </div>

          {isAdmin && (
            <p className="text-xs text-zinc-400 mb-4 bg-zinc-50 p-2.5 border border-zinc-200">
              💡 **Admin Action:** Click on any calendar working day below to toggle or mark trainer attendance between **Present** / **Absent**. Sundays are auto-holidays.
            </p>
          )}

          {/* Grid Layout of Calendar */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold border-b border-zinc-100 pb-3 mb-3">
            <span className="text-red-500">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Blank placeholder spaces before start day of the month */}
            {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-16" />
            ))}

            {/* Calendar Days */}
            {calendarDays.map(({ dayNum, isSunday, dateStr, status }) => {
              let bgClass = "bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100";
              if (isSunday) {
                bgClass = "bg-zinc-100/50 border-zinc-200 text-zinc-400 cursor-not-allowed";
              } else if (status === "present") {
                bgClass = "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100";
              } else if (status === "absent") {
                bgClass = "bg-red-50 border-red-300 text-red-800 hover:bg-red-100";
              }

              return (
                <button
                  key={`day-${dayNum}`}
                  disabled={isSunday || !isAdmin}
                  onClick={() => toggleAttendance(dateStr, status)}
                  className={`h-16 border p-2 flex flex-col justify-between items-start transition-all relative select-none ${bgClass}`}
                >
                  <span className="font-mono-data text-xs font-bold">{dayNum}</span>
                  {isSunday ? (
                    <span className="text-[8px] uppercase tracking-wider font-extrabold text-zinc-400">Off</span>
                  ) : status ? (
                    <span className={`text-[8px] uppercase tracking-wider font-extrabold ${
                      status === "present" ? "text-emerald-700" : "text-red-700"
                    }`}>
                      {status}
                    </span>
                  ) : (
                    <span className="text-[8px] uppercase tracking-wider font-extrabold text-zinc-300">Unmarked</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right (1/3 width): Assigned Customers List */}
        <div className="bento p-6 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <UsersIcon size={18} className="text-zinc-600" weight="bold" />
              <span className="label-tag text-sm">Assigned Students</span>
            </div>
            <p className="text-xs text-zinc-500 mb-6">Students who train with {trainer.name} for slots and course days.</p>

            {students.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-200 bg-zinc-50 p-6 text-xs text-zinc-400">
                No active students assigned to this trainer yet.
              </div>
            ) : (
              <div className="space-y-4">
                {students.map((s) => (
                  <div key={s.id} className="p-3 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors flex justify-between items-start">
                    <div>
                      <Link to={`/students/${s.id}`} className="font-semibold text-xs text-zinc-900 hover:text-blue-700 block">
                        {s.name}
                      </Link>
                      <span className="text-[10px] text-zinc-500 font-mono-data block mt-0.5 capitalize">
                        {s.license_type} · Slot: {s.slot_time || "—"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-data text-[10px] font-bold block text-zinc-800">
                        {s.classes_completed}/{s.total_classes}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-sm block mt-1">
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
