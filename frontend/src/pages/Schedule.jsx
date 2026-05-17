import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  ClockIcon,
  PhoneIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Schedule() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | mine

  useEffect(() => {
    if (user?.role === "trainer") {
      setFilter("mine");
    }
  }, [user]);

  const load = useCallback(async () => {
    const { data } = await api.get(`/schedule/today?date=${date}`);
    setData(data);
  }, [date]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await load(); } finally { setLoading(false); }
    })();
  }, [load]);

  const trainerName = (id) =>
    data?.trainers.find((t) => t.id === id)?.name || "—";

  const isMine = (row) =>
    user && (row.assigned_trainer_id === user.id || row.pickup_trainer_id === user.id || row.drop_trainer_id === user.id);

  const filterRows = (rows) => filter === "mine" ? rows.filter(isMine) : rows;

  const myCounts = (() => {
    if (!data || !user) return null;
    let pickups = 0, drops = 0, classes = 0;
    Object.values(data.by_slot || {}).forEach((rows) => {
      rows.forEach((r) => {
        if (r.pickup_trainer_id === user.id) pickups++;
        if (r.drop_trainer_id === user.id) drops++;
        if (r.assigned_trainer_id === user.id) classes++;
      });
    });
    (data.unassigned || []).forEach((r) => {
      if (r.pickup_trainer_id === user.id) pickups++;
      if (r.drop_trainer_id === user.id) drops++;
      if (r.assigned_trainer_id === user.id) classes++;
    });
    return { pickups, drops, classes };
  })();

  const markClass = async (classId, status, studentName, num) => {
    try {
      const payload = { status };
      if (status === "completed") payload.completed_date = date;
      await api.patch(`/classes/${classId}`, payload);
      toast.success(`Class ${num} for ${studentName} → ${status}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div data-testid="schedule-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-tag">Daily ops</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mt-2">
            Today's Schedule
          </h1>
          <p className="text-sm text-zinc-600 mt-3">
            Slot-wise customer roster with pickup info and quick attendance.
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <div className="label-tag mb-1">View</div>
            <div className="flex border border-zinc-300">
              <button
                onClick={() => setFilter("all")}
                data-testid="filter-all"
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${filter === "all" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
              >All</button>
              <button
                onClick={() => setFilter("mine")}
                data-testid="filter-mine"
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border-l border-zinc-300 ${filter === "mine" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
              >Mine</button>
            </div>
          </div>
          <div>
            <div className="label-tag mb-1">Date</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="schedule-date"
              className="border border-zinc-300 px-3 py-2 text-sm font-mono-data"
            />
          </div>
        </div>
      </div>

      {myCounts && (
        <div className="bento p-4 mb-4 flex items-center gap-6 flex-wrap" data-testid="my-summary">
          <div className="flex items-center gap-2">
            <StarIcon size={16} weight="fill" className="text-yellow-400" />
            <span className="label-tag">Your tasks today</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-xs text-zinc-500">Classes</span>
            <span className="font-heading text-xl font-black tracking-tighter">{myCounts.classes}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-xs text-zinc-500">Pickups</span>
            <span className="font-heading text-xl font-black tracking-tighter text-yellow-700">{myCounts.pickups}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-xs text-zinc-500">Drops</span>
            <span className="font-heading text-xl font-black tracking-tighter text-blue-700">{myCounts.drops}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="label-tag animate-pulse">Loading…</div>
      ) : (
        <div className="space-y-4">
          {(data?.slots || []).length === 0 && (
            <div className="bento p-12 text-center">
              <div className="label-tag mb-2">No slots configured</div>
              <Link to="/slots" className="text-sm font-bold text-blue-700 hover:underline">
                + Add time slots in Slots settings
              </Link>
            </div>
          )}

          {data?.slots.map((slot) => {
            const allRows = data.by_slot[slot.label] || [];
            const rows = filterRows(allRows);
            return (
              <div key={slot.id} className="bento p-6" data-testid={`slot-${slot.label}`}>
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-200 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-zinc-900 text-yellow-400 px-3 py-2">
                      <ClockIcon size={20} weight="bold" />
                    </div>
                    <div>
                      <div className="label-tag">Slot</div>
                      <h2 className="font-heading text-2xl font-black tracking-tighter font-mono-data">
                        {slot.label}
                      </h2>
                    </div>
                  </div>
                  <div className="label-tag">{rows.length}{filter === "mine" && allRows.length > rows.length ? ` of ${allRows.length}` : ""} customers</div>
                </div>

                {rows.length === 0 ? (
                  <div className="text-xs text-zinc-500 italic py-4">{filter === "mine" ? "Nothing assigned to you in this slot." : "No customers in this slot."}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rows.map((r) => (
                      <ScheduleCard
                        key={r.id}
                        row={r}
                        currentUserId={user?.id}
                        trainerName={trainerName}
                        onMark={markClass}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {(() => {
            const unassigned = filterRows(data?.unassigned || []);
            if (unassigned.length === 0) return null;
            return (
              <div className="bento p-6">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-200">
                  <div>
                    <div className="label-tag">No slot assigned</div>
                    <h2 className="font-heading text-2xl font-black tracking-tighter">
                      Unassigned customers
                    </h2>
                  </div>
                  <div className="label-tag">{unassigned.length}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {unassigned.map((r) => (
                    <ScheduleCard
                      key={r.id}
                      row={r}
                      currentUserId={user?.id}
                      trainerName={trainerName}
                      onMark={markClass}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function ScheduleCard({ row, trainerName, onMark }) {
  const next = row.next_class;
  const todayCls = row.today_class;
  const targetCls = todayCls || next;

  return (
    <div className="border border-zinc-200 p-4 hover:border-zinc-400 transition-colors" data-testid={`schedule-card-${row.id}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link to={`/students/${row.id}`} className="flex-1 min-w-0">
          <div className="font-heading text-lg font-bold tracking-tight hover:text-blue-700 truncate">
            {row.name}
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-600 font-mono-data mt-0.5">
            <PhoneIcon size={11} weight="bold" /> {row.phone}
          </div>
        </Link>
        {row.needs_pickup && (
          <div className="flex items-center gap-1 bg-yellow-400 text-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            <TruckIcon size={11} weight="bold" /> Pickup
          </div>
        )}
      </div>

      {row.needs_pickup && row.pickup_address && (
        <div className="text-xs text-zinc-600 bg-zinc-50 border-l-2 border-yellow-400 px-2 py-1.5 mb-3">
          <span className="label-tag block mb-0.5">Pickup</span>
          {row.pickup_address}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <UserIcon size={11} weight="bold" />
          {trainerName(row.assigned_trainer_id)}
        </span>
        {targetCls && (
          <span className="font-mono-data">
            · Class {targetCls.class_number}/10 ·{" "}
            <span
              className={
                targetCls.status === "completed"
                  ? "text-emerald-700 font-bold"
                  : targetCls.status === "missed"
                  ? "text-red-700 font-bold"
                  : "text-zinc-500"
              }
            >
              {targetCls.status}
            </span>
          </span>
        )}
      </div>

      {targetCls && targetCls.status === "pending" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onMark(targetCls.id, "completed", row.name, targetCls.class_number)}
            data-testid={`mark-attended-${row.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2"
          >
            <CheckCircleIcon size={12} weight="bold" /> Attended
          </button>
          <button
            onClick={() => onMark(targetCls.id, "missed", row.name, targetCls.class_number)}
            data-testid={`mark-missed-${row.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2"
          >
            <XCircleIcon size={12} weight="bold" /> Missed
          </button>
        </div>
      )}
      {!targetCls && (
        <div className="text-xs text-zinc-400 italic">All classes completed 🎉</div>
      )}
    </div>
  );
}
