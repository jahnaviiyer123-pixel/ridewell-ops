import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  UsersIcon,
  MotorcycleIcon,
  CalendarCheckIcon,
  CurrencyInrIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarBlankIcon,
  AirplaneTiltIcon,
  UserIcon,
  PhoneIcon,
  TruckIcon,
  StarIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

function Stat({ label, value, sublabel, Icon, testid }) {
  return (
    <div className="bento p-6" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="label-tag">{label}</div>
        <Icon size={18} weight="bold" className="text-zinc-400" />
      </div>
      <div className="font-heading text-5xl font-black tracking-tighter mt-4 text-zinc-950">
        {value}
      </div>
      {sublabel && <div className="text-xs text-zinc-500 mt-2 font-mono-data">{sublabel}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // State for Admin
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for Trainer
  const [trainerSchedule, setTrainerSchedule] = useState(null);
  const [myAttendance, setMyAttendance] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadAdminData = async () => {
    const [s, st] = await Promise.all([
      api.get("/dashboard/stats"),
      api.get("/students"),
    ]);
    setStats(s.data);
    setStudents(st.data);
  };

  const loadTrainerData = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [st, sc, att] = await Promise.all([
      api.get("/students"),
      api.get(`/schedule/today?date=${today}`),
      api.get(`/attendance?trainer_id=${user.id}&date=${today}`),
    ]);
    setStudents(st.data);
    setTrainerSchedule(sc.data);
    if (att.data && att.data.length > 0) {
      setMyAttendance(att.data[0]);
    } else {
      setMyAttendance(null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        await loadAdminData();
      } else {
        await loadTrainerData();
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [isAdmin]);

  // Trainer attendance mark
  const markMyAttendance = async (status) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.post("/attendance", { trainer_id: user.id, date: today, status });
      toast.success(`Marked as ${status}!`);
      // Refetch
      const att = await api.get(`/attendance?trainer_id=${user.id}&date=${today}`);
      if (att.data && att.data.length > 0) {
        setMyAttendance(att.data[0]);
      }
    } catch (e) {
      toast.error(e.message || "Failed to check-in");
    }
  };

  // Trainer student class attendance mark
  const markStudentClass = async (classId, status, studentName, num) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload = { status };
      if (status === "completed") payload.completed_date = today;
      await api.patch(`/classes/${classId}`, payload);
      toast.success(`Class ${num} for ${studentName} → ${status}`);
      // Reload trainer schedule
      const sc = await api.get(`/schedule/today?date=${today}`);
      setTrainerSchedule(sc.data);
    } catch (e) {
      toast.error(e.message || "Failed to mark class status");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="label-tag animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  // --- RENDER TRAINER DASHBOARD ---
  if (!isAdmin) {
    // Process today's schedule for this trainer
    const mySessions = [];
    if (trainerSchedule) {
      // Roster matching slots
      trainerSchedule.slots.forEach((slot) => {
        const allRows = trainerSchedule.by_slot[slot.label] || [];
        allRows.forEach((r) => {
          if (r.assigned_trainer_id === user.id || r.pickup_trainer_id === user.id || r.drop_trainer_id === user.id) {
            mySessions.push({
              ...r,
              slotLabel: slot.label,
              roleInClass: r.assigned_trainer_id === user.id ? "Main Trainer" : r.pickup_trainer_id === user.id ? "Pickup" : "Drop"
            });
          }
        });
      });
      // Roster matching unassigned
      (trainerSchedule.unassigned || []).forEach((r) => {
        if (r.assigned_trainer_id === user.id || r.pickup_trainer_id === user.id || r.drop_trainer_id === user.id) {
          mySessions.push({
            ...r,
            slotLabel: "Unassigned Time",
            roleInClass: r.assigned_trainer_id === user.id ? "Main Trainer" : r.pickup_trainer_id === user.id ? "Pickup" : "Drop"
          });
        }
      });
    }

    // Active students assigned to me
    const myStudents = students.filter(s => s.assigned_trainer_id === user.id);
    const filteredStudents = myStudents.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery)
    );

    return (
      <div data-testid="trainer-dashboard" className="space-y-8 animate-fadeIn">
        {/* Banner with Greeting & Quick Check-in */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950 text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden border border-zinc-800 shadow-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-400 text-zinc-900 text-[10px] font-extrabold uppercase tracking-widest leading-none">
              Trainer Portal
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter leading-none">
              Welcome back, {user.name}
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm font-medium">
              Ready to help students conquer the road? Here is your game plan for today.
            </p>
          </div>

          {/* Self check-in container */}
          <div className="relative z-10 bg-zinc-900/50 backdrop-blur-md border border-zinc-700/50 p-4 md:min-w-[280px]">
            <div className="label-tag text-zinc-400 mb-2">My Attendance Status</div>
            {myAttendance ? (
              <div className="flex items-center gap-3">
                <span className={`inline-block w-3.5 h-3.5 rounded-full ${
                  myAttendance.status === "present" ? "bg-emerald-500 animate-pulse" :
                  myAttendance.status === "leave" ? "bg-yellow-400" : "bg-red-500"
                }`} />
                <div>
                  <div className="text-sm font-bold uppercase tracking-wider text-white">
                    {myAttendance.status}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono-data mt-0.5">
                    Marked today at {new Date(myAttendance.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-300">You haven't checked in yet today.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => markMyAttendance("present")}
                    data-testid="mark-present-btn"
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    Present
                  </button>
                  <button
                    onClick={() => markMyAttendance("leave")}
                    className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold uppercase tracking-wider border border-zinc-700 transition-all"
                  >
                    Leave
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Roster & Roster Marking */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main: Sessions list */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div>
                <div className="label-tag"> Roster logs </div>
                <h2 className="font-heading text-2xl font-black tracking-tighter mt-1">
                  Today's Classes &amp; Tasks
                </h2>
              </div>
              <div className="text-xs font-mono-data text-zinc-500 bg-zinc-100 px-2.5 py-1 font-bold">
                {mySessions.length} SESSION{mySessions.length !== 1 ? "S" : ""}
              </div>
            </div>

            {mySessions.length === 0 ? (
              <div className="bento p-12 text-center border-dashed border-2 border-zinc-200 bg-zinc-50/50">
                <CalendarBlankIcon size={32} className="text-zinc-300 mx-auto mb-3" />
                <div className="font-semibold text-zinc-700">No classes assigned today</div>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Take a breather! If this seems incorrect, ask the administrator to assign classes or slots to your name.
                </p>
                <Link
                  to="/schedule"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 hover:underline"
                >
                  View full schedule <ArrowUpRightIcon size={12} weight="bold" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {mySessions.map((session) => {
                  const targetCls = session.today_class || session.next_class;
                  return (
                    <div
                      key={session.id}
                      data-testid={`session-card-${session.id}`}
                      className="bento p-5 border-l-4 border-l-zinc-900 bg-white hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-zinc-200">
                              <ClockIcon size={10} weight="bold" /> {session.slotLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-yellow-400/10 text-yellow-800 border border-yellow-400/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                              {session.roleInClass}
                            </span>
                            {session.needs_pickup && (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                <TruckIcon size={10} weight="bold" /> Pickup Needed
                              </span>
                            )}
                          </div>
                          <Link
                            to={`/students/${session.id}`}
                            className="block font-heading text-xl font-bold tracking-tight text-zinc-950 hover:text-blue-700 transition-colors mt-2"
                          >
                            {session.name}
                          </Link>
                          <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono-data mt-1">
                            <span className="flex items-center gap-1"><PhoneIcon size={11} /> {session.phone}</span>
                            {targetCls && (
                              <span>· Class {targetCls.class_number}/10 · Status: <span className="font-bold capitalize">{targetCls.status}</span></span>
                            )}
                          </div>
                        </div>

                        {/* Quick Mark Attendance Widget */}
                        <div className="flex items-center gap-2 self-center flex-wrap">
                          {targetCls && targetCls.status === "pending" ? (
                            <>
                              <button
                                onClick={() => markStudentClass(targetCls.id, "completed", session.name, targetCls.class_number)}
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                              >
                                <CheckCircleIcon size={12} weight="bold" /> Attended
                              </button>
                              <button
                                onClick={() => markStudentClass(targetCls.id, "missed", session.name, targetCls.class_number)}
                                className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                              >
                                <XCircleIcon size={12} weight="bold" /> Missed
                              </button>
                            </>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1.5 font-bold uppercase tracking-wider border ${
                              targetCls?.status === "completed" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                              targetCls?.status === "missed" ? "bg-red-50 text-red-800 border-red-200" :
                              "bg-zinc-100 text-zinc-500 border-zinc-200"
                            }`}>
                              {targetCls?.status === "completed" ? "✓ Attended" : targetCls?.status === "missed" ? "✗ Missed" : "No Pending Today"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pickup Address block */}
                      {session.needs_pickup && session.pickup_address && (
                        <div className="text-xs text-zinc-600 bg-zinc-50 border-l-2 border-yellow-400 p-2.5 mt-3">
                          <div className="font-bold text-[9px] uppercase tracking-wider text-zinc-500 mb-0.5">Pickup Location</div>
                          {session.pickup_address}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar: Assigned Students */}
          <div className="space-y-6">
            <div className="pb-2 border-b border-zinc-200">
              <div className="label-tag">My Cohort</div>
              <h2 className="font-heading text-2xl font-black tracking-tighter mt-1">
                Your Students
              </h2>
            </div>

            {/* Quick search */}
            <div className="bento p-3 flex items-center gap-2.5 bg-white">
              <MagnifyingGlassIcon size={16} className="text-zinc-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your students…"
                className="bg-transparent outline-none text-xs flex-1"
              />
            </div>

            {filteredStudents.length === 0 ? (
              <div className="bento p-6 text-center text-zinc-500 italic text-xs">
                {myStudents.length === 0 ? "No active students assigned to you." : "No matching students found."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStudents.map((s) => (
                  <div key={s.id} className="bento p-4 bg-white hover:border-zinc-400 transition-colors">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <Link to={`/students/${s.id}`} className="font-bold text-sm text-zinc-950 hover:text-blue-700 truncate">
                        {s.name}
                      </Link>
                      <span className="text-[9px] font-mono-data px-1.5 py-0.5 border border-zinc-300 font-bold uppercase whitespace-nowrap">
                        {s.license_type}
                      </span>
                    </div>

                    {/* Progress tracking */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-500 font-mono-data">
                        <span>Class Progress</span>
                        <span>{s.classes_completed}/{s.total_classes} completed</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-100 relative">
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-emerald-600 transition-all duration-500"
                          style={{ width: `${(s.classes_completed / s.total_classes) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER ADMIN DASHBOARD (UNCHANGED) ---
  const recent = students.slice(0, 6);

  return (
    <div data-testid="dashboard-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-tag">Overview</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mt-2">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-600 mt-3 max-w-xl">
            Live operational snapshot — students, trainers, classes, fees.
          </p>
        </div>
        <div className="font-mono-data text-xs text-zinc-500">
          {new Date().toDateString().toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat
          label="Total Students"
          value={stats?.total_students ?? 0}
          sublabel={`${stats?.active_students ?? 0} active`}
          Icon={UsersIcon}
          testid="stat-total-students"
        />
        <Stat
          label="Trainers"
          value={stats?.total_trainers ?? 0}
          sublabel={`${stats?.present_today ?? 0} present today · ${stats?.absent_today ?? 0} absent`}
          Icon={MotorcycleIcon}
          testid="stat-trainers"
        />
        <Stat
          label="Classes Today"
          value={stats?.classes_today ?? 0}
          sublabel="completed sessions"
          Icon={CalendarCheckIcon}
          testid="stat-classes-today"
        />
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bento p-6 lg:col-span-2" data-testid="recent-students">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="label-tag">Recent Enrollments</div>
              <h2 className="font-heading text-2xl font-bold tracking-tight mt-1">
                Latest students
              </h2>
            </div>
            <Link
              to="/students"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:text-blue-700"
            >
              View all <ArrowUpRightIcon size={12} weight="bold" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="border border-dashed border-zinc-300 p-10 text-center">
              <div className="label-tag mb-2">No students yet</div>
              <Link to="/students" className="text-sm font-bold text-blue-700 hover:underline">
                + Enroll your first student
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-y border-zinc-200 bg-zinc-100">
                  <th className="label-tag p-3">Name</th>
                  <th className="label-tag p-3 hidden md:table-cell">Phone</th>
                  <th className="label-tag p-3">Type</th>
                  <th className="label-tag p-3 text-right">Progress</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="p-3">
                      <Link
                        to={`/students/${s.id}`}
                        className="font-semibold hover:text-blue-700"
                        data-testid={`student-row-${s.id}`}
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="p-3 hidden md:table-cell font-mono-data text-xs text-zinc-600">
                      {s.phone}
                    </td>
                    <td className="p-3">
                      <span className="inline-block text-[10px] px-2 py-0.5 border border-zinc-300 uppercase tracking-wider font-bold">
                        {s.license_type}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono-data text-xs">
                      {s.classes_completed}/{s.total_classes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bento p-6" data-testid="today-summary">
          <div className="label-tag">Today</div>
          <h2 className="font-heading text-2xl font-bold tracking-tight mt-1 mb-6">
            Live counters
          </h2>

          <div className="space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="text-sm font-semibold text-zinc-700">Trainers present</div>
              <div className="font-heading text-3xl font-black tracking-tighter">
                {stats?.present_today ?? 0}
              </div>
            </div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="text-sm font-semibold text-zinc-700">Trainers absent</div>
              <div className="font-heading text-3xl font-black tracking-tighter text-red-700">
                {stats?.absent_today ?? 0}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-700">Classes completed</div>
              <div className="font-heading text-3xl font-black tracking-tighter text-emerald-700">
                {stats?.classes_today ?? 0}
              </div>
            </div>
          </div>

          <Link
            to="/attendance"
            className="mt-8 w-full inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-4 py-3 transition-colors"
            data-testid="mark-attendance-link"
          >
            Mark attendance <ArrowUpRightIcon size={12} weight="bold" />
          </Link>
        </div>
      </div>
    </div>
  );
}
