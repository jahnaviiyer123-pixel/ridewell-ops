import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import {
  CheckCircleIcon,
  XCircleIcon,
  AirplaneTiltIcon,
  UsersIcon,
  MotorcycleIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState("students");

  return (
    <div data-testid="attendance-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-tag">Daily log</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mt-2">
            Attendance
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-zinc-200" data-testid="attendance-tabs">
        <button
          onClick={() => setTab("students")}
          data-testid="tab-students"
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
            tab === "students"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-900"
          }`}
        >
          <UsersIcon size={14} weight="bold" /> Student Attendance
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("trainers")}
            data-testid="tab-trainers"
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
              tab === "trainers"
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <MotorcycleIcon size={14} weight="bold" /> Trainer Attendance
          </button>
        )}
      </div>

      {tab === "students" ? (
        <StudentAttendance user={user} isAdmin={isAdmin} />
      ) : (
        <TrainerAttendance />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   STUDENT ATTENDANCE — Easy bulk class marking
   ──────────────────────────────────────────── */
function StudentAttendance({ user, isAdmin }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState({}); // {studentId: [classes]}
  const [trainers, setTrainers] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterSlot, setFilterSlot] = useState("");
  const [filterTrainer, setFilterTrainer] = useState("");
  const [slots, setSlots] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, tRes, slotRes] = await Promise.all([
        api.get("/students"),
        api.get("/trainers"),
        api.get("/slots"),
      ]);
      setStudents(sRes.data.filter((s) => s.status === "active"));
      setTrainers(tRes.data);
      setSlots(slotRes.data);

      // Load classes for all active students
      const activeStudents = sRes.data.filter((s) => s.status === "active");
      const classMap = {};
      await Promise.all(
        activeStudents.map(async (s) => {
          try {
            const res = await api.get(`/students/${s.id}/classes`);
            classMap[s.id] = res.data;
          } catch {
            classMap[s.id] = [];
          }
        })
      );
      setClasses(classMap);
    } catch (e) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const markClass = async (classId, status, studentName, classNumber) => {
    try {
      const payload = { status };
      if (status === "completed") payload.completed_date = date;
      await api.patch(`/classes/${classId}`, payload);
      toast.success(`Class ${classNumber} for ${studentName} → ${status}`);
      // Re-fetch only that student's classes
      const studentId = Object.keys(classes).find((sid) =>
        classes[sid]?.some((c) => c.id === classId)
      );
      if (studentId) {
        const res = await api.get(`/students/${studentId}/classes`);
        setClasses((prev) => ({ ...prev, [studentId]: res.data }));
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const trainerName = (tid) => trainers.find((t) => t.id === tid)?.name || "—";

  // Filters
  let filtered = students;
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.phone.includes(q)
    );
  }
  if (filterSlot) {
    filtered = filtered.filter((s) => s.slot_time === filterSlot);
  }
  if (filterTrainer) {
    filtered = filtered.filter((s) => s.assigned_trainer_id === filterTrainer);
  }
  // For trainer view: only show their assigned students
  if (!isAdmin) {
    filtered = filtered.filter((s) => s.assigned_trainer_id === user.id);
  }

  // Sort by slot_time
  filtered.sort((a, b) => (a.slot_time || "").localeCompare(b.slot_time || ""));

  // Date navigation
  const goDate = (offset) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().slice(0, 10));
  };

  if (loading) {
    return <div className="label-tag animate-pulse">Loading student data…</div>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Controls bar */}
      <div className="bento p-4 flex flex-wrap items-center gap-4">
        {/* Date Picker */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goDate(-1)}
            className="p-2 border border-zinc-300 hover:bg-zinc-100 transition-colors"
            data-testid="date-prev"
          >
            <CaretLeftIcon size={14} weight="bold" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="attendance-date"
            className="border border-zinc-300 px-3 py-2 text-sm font-mono-data"
          />
          <button
            onClick={() => goDate(1)}
            className="p-2 border border-zinc-300 hover:bg-zinc-100 transition-colors"
            data-testid="date-next"
          >
            <CaretRightIcon size={14} weight="bold" />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-zinc-300 px-3 py-2">
          <MagnifyingGlassIcon size={16} className="text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="bg-transparent outline-none text-sm flex-1"
            data-testid="student-search"
          />
        </div>

        {/* Slot filter */}
        <select
          value={filterSlot}
          onChange={(e) => setFilterSlot(e.target.value)}
          className="border border-zinc-300 px-3 py-2 text-sm"
          data-testid="filter-slot"
        >
          <option value="">All Slots</option>
          {slots.map((s) => (
            <option key={s.id} value={s.label}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Trainer filter (admin only) */}
        {isAdmin && (
          <select
            value={filterTrainer}
            onChange={(e) => setFilterTrainer(e.target.value)}
            className="border border-zinc-300 px-3 py-2 text-sm"
            data-testid="filter-trainer"
          >
            <option value="">All Trainers</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        <div className="label-tag whitespace-nowrap">{filtered.length} students</div>
      </div>

      {/* Student Attendance Grid */}
      {filtered.length === 0 ? (
        <div className="bento p-12 text-center border-dashed border-2 border-zinc-200 bg-zinc-50/50">
          <UsersIcon size={32} className="text-zinc-300 mx-auto mb-3" />
          <div className="font-semibold text-zinc-700">No active students found</div>
          <p className="text-xs text-zinc-500 mt-1">
            {!isAdmin
              ? "No students are assigned to you yet."
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="bento overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-100 border-y border-zinc-200 text-left">
                <th className="label-tag p-3">Student</th>
                <th className="label-tag p-3 hidden md:table-cell">Phone</th>
                <th className="label-tag p-3 hidden md:table-cell">Slot</th>
                <th className="label-tag p-3 hidden lg:table-cell">Trainer</th>
                <th className="label-tag p-3 text-center">Progress</th>
                <th className="label-tag p-3 text-right">Mark Today's Class</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const studentClasses = classes[s.id] || [];
                const completed = studentClasses.filter(
                  (c) => c.status === "completed"
                ).length;
                const nextPending = studentClasses.find(
                  (c) => c.status === "pending"
                );
                // Check if any class was already marked for this date
                const todayClass = studentClasses.find(
                  (c) =>
                    c.completed_date === date ||
                    (c.status === "missed" && c.updated_at && c.updated_at.startsWith(date))
                );

                return (
                  <tr
                    key={s.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                    data-testid={`student-att-row-${s.id}`}
                  >
                    <td className="p-3">
                      <Link
                        to={`/students/${s.id}`}
                        className="font-semibold hover:text-blue-700 transition-colors"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="p-3 hidden md:table-cell font-mono-data text-xs text-zinc-600">
                      {s.phone}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {s.slot_time ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-zinc-100 border border-zinc-200 uppercase tracking-wider font-bold">
                          <ClockIcon size={10} weight="bold" /> {s.slot_time}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell text-xs">
                      {trainerName(s.assigned_trainer_id)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-mono-data text-xs font-bold">
                          {completed}/{s.total_classes}
                        </span>
                        <span className="w-16 h-1.5 bg-zinc-100 relative inline-block">
                          <span
                            className="absolute left-0 top-0 bottom-0 bg-emerald-600 transition-all duration-500"
                            style={{
                              width: `${(completed / s.total_classes) * 100}%`,
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        {todayClass ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1.5 font-bold uppercase tracking-wider border ${
                              todayClass.status === "completed"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-red-50 text-red-800 border-red-200"
                            }`}
                          >
                            {todayClass.status === "completed"
                              ? "✓ Attended"
                              : "✗ Missed"}
                            <span className="text-[9px] opacity-70 ml-1">
                              (Class {todayClass.class_number})
                            </span>
                          </span>
                        ) : nextPending ? (
                          <>
                            <button
                              onClick={() =>
                                markClass(
                                  nextPending.id,
                                  "completed",
                                  s.name,
                                  nextPending.class_number
                                )
                              }
                              data-testid={`mark-attended-${s.id}`}
                              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                              <CheckCircleIcon size={12} weight="bold" />{" "}
                              Attended
                            </button>
                            <button
                              onClick={() =>
                                markClass(
                                  nextPending.id,
                                  "missed",
                                  s.name,
                                  nextPending.class_number
                                )
                              }
                              data-testid={`mark-missed-${s.id}`}
                              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                              <XCircleIcon size={12} weight="bold" /> Missed
                            </button>
                            <span className="text-[9px] text-zinc-400 font-mono-data whitespace-nowrap">
                              Class {nextPending.class_number}
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1.5 font-bold uppercase tracking-wider border bg-zinc-100 text-zinc-500 border-zinc-200">
                            All classes done
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   TRAINER ATTENDANCE — Admin marks trainer presence
   ──────────────────────────────────────────── */
function TrainerAttendance() {
  const [trainers, setTrainers] = useState([]);
  const [records, setRecords] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [t, a] = await Promise.all([
      api.get("/trainers"),
      api.get(`/attendance?date=${date}`),
    ]);
    setTrainers(t.data);
    setRecords(a.data);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [date]);

  const statusFor = (trainerId) =>
    records.find((r) => r.trainer_id === trainerId)?.status;

  const mark = async (trainerId, status) => {
    try {
      await api.post("/attendance", { trainer_id: trainerId, date, status });
      toast.success("Marked");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const markAll = async (status) => {
    try {
      await Promise.all(
        trainers.map((t) =>
          api.post("/attendance", { trainer_id: t.id, date, status })
        )
      );
      toast.success(`All trainers marked as ${status}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const pill = (active, color) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
      active ? color : "border-zinc-300 text-zinc-500 hover:bg-zinc-100"
    }`;

  // Date navigation
  const goDate = (offset) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().slice(0, 10));
  };

  // Summary counts
  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const leaveCount = records.filter((r) => r.status === "leave").length;
  const unmarked = trainers.length - records.length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Controls & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bento p-4 flex items-center gap-3">
          <button
            onClick={() => goDate(-1)}
            className="p-2 border border-zinc-300 hover:bg-zinc-100 transition-colors"
          >
            <CaretLeftIcon size={14} weight="bold" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="trainer-attendance-date"
            className="border border-zinc-300 px-3 py-2 text-sm font-mono-data flex-1"
          />
          <button
            onClick={() => goDate(1)}
            className="p-2 border border-zinc-300 hover:bg-zinc-100 transition-colors"
          >
            <CaretRightIcon size={14} weight="bold" />
          </button>
        </div>
        <div className="bento p-4 flex items-center gap-4 justify-between flex-wrap">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-black tracking-tighter text-emerald-700">
                {presentCount}
              </div>
              <div className="label-tag">Present</div>
            </div>
            <div className="text-center">
              <div className="font-heading text-2xl font-black tracking-tighter text-red-700">
                {absentCount}
              </div>
              <div className="label-tag">Absent</div>
            </div>
            <div className="text-center">
              <div className="font-heading text-2xl font-black tracking-tighter text-yellow-700">
                {leaveCount}
              </div>
              <div className="label-tag">Leave</div>
            </div>
            {unmarked > 0 && (
              <div className="text-center">
                <div className="font-heading text-2xl font-black tracking-tighter text-zinc-400">
                  {unmarked}
                </div>
                <div className="label-tag">Unmarked</div>
              </div>
            )}
          </div>
          {trainers.length > 0 && (
            <button
              onClick={() => markAll("present")}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2 transition-colors"
              data-testid="mark-all-present"
            >
              <CheckCircleIcon size={12} weight="bold" /> Mark all present
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="label-tag animate-pulse">Loading…</div>
      ) : (
        <div className="bento overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-100 border-y border-zinc-200">
                <th className="label-tag p-3 text-left">Trainer</th>
                <th className="label-tag p-3 text-left">Phone</th>
                <th className="label-tag p-3 text-right">Mark</th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => {
                const s = statusFor(t.id);
                return (
                  <tr
                    key={t.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50"
                    data-testid={`attendance-row-${t.id}`}
                  >
                    <td className="p-3 font-semibold">{t.name}</td>
                    <td className="p-3 text-xs font-mono-data text-zinc-600">
                      {t.phone || "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => mark(t.id, "present")}
                          data-testid={`mark-present-${t.id}`}
                          className={pill(
                            s === "present",
                            "bg-emerald-600 border-emerald-700 text-white"
                          )}
                        >
                          <CheckCircleIcon size={12} weight="bold" /> Present
                        </button>
                        <button
                          onClick={() => mark(t.id, "absent")}
                          data-testid={`mark-absent-${t.id}`}
                          className={pill(
                            s === "absent",
                            "bg-red-600 border-red-700 text-white"
                          )}
                        >
                          <XCircleIcon size={12} weight="bold" /> Absent
                        </button>
                        <button
                          onClick={() => mark(t.id, "leave")}
                          data-testid={`mark-leave-${t.id}`}
                          className={pill(
                            s === "leave",
                            "bg-yellow-400 border-yellow-500 text-zinc-900"
                          )}
                        >
                          <AirplaneTiltIcon size={12} weight="bold" /> Leave
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {trainers.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-10 text-center label-tag">
                    No trainers yet — add one from the Trainers page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
