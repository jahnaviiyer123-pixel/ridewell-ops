import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatApiError, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  CircleIcon,
  PencilSimpleIcon,
  FloppyDiskIcon,
  TrashIcon,
  UserIcon,
} from "@phosphor-icons/react";
import PhotoUploader from "@/components/PhotoUploader";
import { toast } from "sonner";

export default function StudentDetail() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const load = async () => {
    const [s, c, t, p, sl] = await Promise.all([
      api.get(`/students/${id}`),
      api.get(`/students/${id}/classes`),
      api.get("/trainers"),
      api.get(`/payments?student_id=${id}`),
      api.get("/slots"),
    ]);
    setStudent(s.data);
    setClasses(c.data);
    setTrainers(t.data);
    setPayments(p.data);
    setSlots(sl.data);
    setEditForm(s.data);
  };

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveEdit = async () => {
    try {
      const fields = ["name", "phone", "email", "age", "gender", "license_type", "joining_date", "slot_time", "needs_pickup", "pickup_address", "drop_address", "assigned_trainer_id", "pickup_trainer_id", "drop_trainer_id", "photo_url", "fees_total", "fees_paid", "notes", "status"];
      const payload = {};
      fields.forEach((k) => {
        if (editForm[k] !== undefined && editForm[k] !== student[k]) {
          payload[k] = editForm[k];
        }
      });
      if (Object.keys(payload).length === 0) {
        setEditing(false);
        return;
      }
      await api.patch(`/students/${id}`, payload);
      toast.success("Saved");
      setEditing(false);
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const deleteStudent = async () => {
    if (!window.confirm("Delete this student and all their records?")) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success("Student deleted");
      navigate("/students");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  if (loading || !student) {
    return <div className="label-tag animate-pulse">Loading…</div>;
  }

  const completedCount = classes.filter((c) => c.status === "completed").length;
  const pending = (student.fees_total || 0) - (student.fees_paid || 0);
  const trainerName = (tid) => trainers.find((t) => t.id === tid)?.name || "—";

  return (
    <div data-testid="student-detail-page">
      <Link to="/students" className="inline-flex items-center gap-1 label-tag hover:text-blue-700 mb-6">
        <ArrowLeftIcon size={12} weight="bold" /> Back to roster
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bento p-8 lg:col-span-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-5 flex-1 min-w-0">
              <StudentPhoto url={student.photo_url} name={student.name} />
              <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="font-heading text-4xl font-black tracking-tighter border-b-2 border-zinc-900 bg-transparent w-full focus:outline-none"
                />
              ) : (
                <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter leading-none">
                  {student.name}
                </h1>
              )}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="inline-block text-[10px] px-2 py-0.5 border border-zinc-300 uppercase tracking-wider font-bold">
                  {student.license_type}
                </span>
                <span className={`inline-block text-[10px] px-2 py-0.5 uppercase tracking-wider font-bold border ${
                  student.status === "active" ? "bg-blue-50 text-blue-800 border-blue-200" :
                  student.status === "completed" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                  "bg-zinc-100 text-zinc-700 border-zinc-200"
                }`}>
                  {student.status}
                </span>
                <span className="font-mono-data text-xs text-zinc-500">
                  Joined {student.joining_date}
                </span>
              </div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button onClick={() => { setEditing(false); setEditForm(student); }} className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-100">
                      Cancel
                    </button>
                    <button onClick={saveEdit} data-testid="save-student-btn" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-blue-700">
                      <FloppyDiskIcon size={12} weight="bold" /> Save
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditing(true)} data-testid="edit-student-btn" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-100">
                      <PencilSimpleIcon size={12} weight="bold" /> Edit
                    </button>
                    <button onClick={deleteStudent} data-testid="delete-student-btn" className="p-2 border border-zinc-300 hover:bg-red-600 hover:text-white hover:border-red-600">
                      <TrashIcon size={14} weight="bold" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 border-t border-zinc-200 pt-6">
            <DetailField label="Phone" editing={editing} value={student.phone}
              onChange={(v) => setEditForm({ ...editForm, phone: v })} editValue={editForm.phone} />
            <DetailField label="Email" editing={editing} value={student.email || "—"}
              onChange={(v) => setEditForm({ ...editForm, email: v })} editValue={editForm.email || ""} />
            <DetailField label="Age" editing={editing} value={student.age || "—"}
              onChange={(v) => setEditForm({ ...editForm, age: v ? Number(v) : null })} editValue={editForm.age || ""} />
            <div>
              <div className="label-tag mb-1.5">Gender</div>
              {editing ? (
                <select
                  value={editForm.gender || ""}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value || null })}
                  className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <div className="text-sm font-semibold capitalize">{student.gender || "—"}</div>
              )}
            </div>
            <div>
              <div className="label-tag mb-1.5">Time Slot</div>
              {editing ? (
                <select
                  value={editForm.slot_time || ""}
                  onChange={(e) => setEditForm({ ...editForm, slot_time: e.target.value })}
                  className="w-full border border-zinc-300 px-2 py-1.5 text-sm font-mono-data"
                  data-testid="student-slot-select"
                >
                  <option value="">— Pick a slot —</option>
                  {slots.map((s) => (
                    <option key={s.id} value={s.label}>
                      {s.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm font-semibold font-mono-data">{student.slot_time || "—"}</div>
              )}
            </div>
            <div>
              <div className="label-tag mb-1.5">Pickup</div>
              {editing ? (
                <select
                  value={editForm.needs_pickup ? "yes" : "no"}
                  onChange={(e) => setEditForm({ ...editForm, needs_pickup: e.target.value === "yes" })}
                  className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              ) : (
                <div className="text-sm font-semibold">{student.needs_pickup ? "Yes" : "No"}</div>
              )}
            </div>
            <div>
              <div className="label-tag mb-1.5">Trainer</div>
              {editing ? (
                <select
                  value={editForm.assigned_trainer_id || ""}
                  onChange={(e) => setEditForm({ ...editForm, assigned_trainer_id: e.target.value || null })}
                  className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="">— Unassigned —</option>
                  {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : (
                <div className="text-sm font-semibold">{trainerName(student.assigned_trainer_id)}</div>
              )}
            </div>
            <div>
              <div className="label-tag mb-1.5">Status</div>
              {editing ? (
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="dropped">Dropped</option>
                </select>
              ) : (
                <div className="text-sm font-semibold capitalize">{student.status}</div>
              )}
            </div>
          </div>

          {(student.needs_pickup || editing) && (
            <div className="mt-6 border-t border-zinc-200 pt-6">
              <div className="label-tag mb-3">Pickup &amp; drop</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="label-tag mb-1.5">Pickup trainer</div>
                  {editing ? (
                    <select
                      value={editForm.pickup_trainer_id || ""}
                      onChange={(e) => setEditForm({ ...editForm, pickup_trainer_id: e.target.value || null })}
                      className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
                      data-testid="pickup-trainer-edit"
                    >
                      <option value="">— None —</option>
                      {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : (
                    <div className="text-sm font-semibold">{trainerName(student.pickup_trainer_id)}</div>
                  )}
                </div>
                <div>
                  <div className="label-tag mb-1.5">Drop trainer</div>
                  {editing ? (
                    <select
                      value={editForm.drop_trainer_id || ""}
                      onChange={(e) => setEditForm({ ...editForm, drop_trainer_id: e.target.value || null })}
                      className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
                      data-testid="drop-trainer-edit"
                    >
                      <option value="">— None —</option>
                      {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : (
                    <div className="text-sm font-semibold">{trainerName(student.drop_trainer_id)}</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="label-tag mb-1.5">Pickup address</div>
                  {editing ? (
                    <textarea rows="2" value={editForm.pickup_address || ""} onChange={(e) => setEditForm({ ...editForm, pickup_address: e.target.value })} className="w-full border border-zinc-300 px-2 py-1.5 text-sm" />
                  ) : (
                    <div className="text-sm">{student.pickup_address || "—"}</div>
                  )}
                </div>
                <div>
                  <div className="label-tag mb-1.5">Drop address</div>
                  {editing ? (
                    <textarea rows="2" value={editForm.drop_address || ""} onChange={(e) => setEditForm({ ...editForm, drop_address: e.target.value })} className="w-full border border-zinc-300 px-2 py-1.5 text-sm" />
                  ) : (
                    <div className="text-sm">{student.drop_address || "—"}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {editing && (
            <div className="mt-6 border-t border-zinc-200 pt-6">
              <div className="label-tag mb-3">Profile photo</div>
              <PhotoUploader
                value={editForm.photo_url}
                onChange={(url) => setEditForm({ ...editForm, photo_url: url })}
                size="w-24 h-24"
              />
            </div>
          )}
        </div>

        <div className="bento p-8">
          <div className="label-tag">Progress</div>
          <div className="font-heading text-6xl font-black tracking-tighter mt-2 leading-none">
            {completedCount}<span className="text-zinc-300 text-4xl">/{student.total_classes}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-2 font-mono-data">classes completed</div>

          <div className="mt-6 pt-6 border-t border-zinc-200">
            <div className="label-tag">Fees</div>
            <div className="flex items-baseline gap-2 mt-2">
              <div className="font-heading text-3xl font-black tracking-tighter">
                ₹{(student.fees_paid || 0).toLocaleString("en-IN")}
              </div>
              <div className="text-sm text-zinc-500 font-mono-data">/ ₹{(student.fees_total || 0).toLocaleString("en-IN")}</div>
            </div>
            {pending > 0 && (
              <div className="text-xs text-red-700 font-bold mt-1 font-mono-data">
                ₹{pending.toLocaleString("en-IN")} pending
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 10 class tracker */}
      <div className="bento p-6 mb-4" data-testid="class-tracker">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label-tag">Class tracker</div>
            <h2 className="font-heading text-2xl font-bold tracking-tight mt-1">10-class progress</h2>
          </div>
        </div>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          {classes.map((c) => (
            <ClassBlock key={c.id} cls={c} />
          ))}
        </div>
      </div>

      {/* Class list editable */}
      <div className="bento overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-100 border-y border-zinc-200">
              <th className="label-tag p-3 text-left">#</th>
              <th className="label-tag p-3 text-left">Date</th>
              <th className="label-tag p-3 text-left">Trainer</th>
              <th className="label-tag p-3 text-left">Status</th>
              <th className="label-tag p-3 text-left">Notes</th>
              <th className="label-tag p-3 text-right">—</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <ClassRow key={c.id} cls={c} trainers={trainers} onSaved={load} isAdmin={isAdmin} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments */}
      <div className="mt-10">
        <PaymentSection studentId={id} payments={payments} onReload={load} isAdmin={isAdmin} />
      </div>
    </div>
  );
}


function StudentPhoto({ url, name }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("rw_token") : null;
  const src = url
    ? url.startsWith("http")
      ? url
      : `${API.replace(/\/api$/, "")}${url}${url.includes("?") ? "&" : "?"}auth=${token || ""}`
    : null;
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-100 border border-zinc-300 overflow-hidden flex-shrink-0 flex items-center justify-center">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-1">
          <UserIcon size={28} weight="bold" className="text-zinc-400" />
          <span className="font-heading text-2xl font-black text-zinc-500">{initial}</span>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value, editing, editValue, onChange }) {
  return (
    <div>
      <div className="label-tag mb-1.5">{label}</div>
      {editing ? (
        <input
          value={editValue || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
        />
      ) : (
        <div className="text-sm font-semibold font-mono-data">{value}</div>
      )}
    </div>
  );
}

function ClassBlock({ cls }) {
  const base = "aspect-square flex flex-col items-center justify-center border";
  const style =
    cls.status === "completed"
      ? "bg-emerald-600 border-emerald-700 text-white"
      : cls.status === "missed"
      ? "bg-red-600 border-red-700 text-white"
      : "bg-zinc-50 border-zinc-200 text-zinc-400";
  return (
    <div className={`${base} ${style}`} title={`Class ${cls.class_number} — ${cls.status}`}>
      <div className="font-heading font-black text-2xl leading-none">{cls.class_number}</div>
      <div className="text-[9px] uppercase tracking-wider mt-1 font-bold">
        {cls.status === "completed" ? "✓" : cls.status === "missed" ? "✗" : "·"}
      </div>
    </div>
  );
}

function ClassRow({ cls, trainers, onSaved, isAdmin }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    scheduled_date: cls.scheduled_date || "",
    completed_date: cls.completed_date || "",
    trainer_id: cls.trainer_id || "",
    status: cls.status,
    notes: cls.notes || "",
  });

  const save = async () => {
    try {
      const payload = { ...f };
      if (!payload.scheduled_date) delete payload.scheduled_date;
      if (!payload.completed_date) delete payload.completed_date;
      if (!payload.trainer_id) payload.trainer_id = null;
      if (payload.notes === "") delete payload.notes;
      await api.patch(`/classes/${cls.id}`, payload);
      toast.success(`Class ${cls.class_number} updated`);
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const quickMark = async (status) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload = { status };
      if (status === "completed") payload.completed_date = today;
      await api.patch(`/classes/${cls.id}`, payload);
      toast.success(`Class ${cls.class_number} marked as ${status}`);
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const icon =
    cls.status === "completed" ? (
      <CheckCircleIcon weight="fill" className="text-emerald-600" size={18} />
    ) : cls.status === "missed" ? (
      <XCircleIcon weight="fill" className="text-red-600" size={18} />
    ) : (
      <CircleIcon weight="bold" className="text-zinc-300" size={18} />
    );

  return (
    <tr className="border-b border-zinc-100 hover:bg-zinc-50" data-testid={`class-row-${cls.class_number}`}>
      <td className="p-3 font-mono-data text-xs font-bold">{cls.class_number}</td>
      <td className="p-3">
        {editing ? (
          <input type="date" value={f.completed_date} onChange={(e) => setF({ ...f, completed_date: e.target.value })} className="border border-zinc-300 px-2 py-1 text-xs" />
        ) : (
          <span className="font-mono-data text-xs text-zinc-600">{cls.completed_date || cls.scheduled_date || "—"}</span>
        )}
      </td>
      <td className="p-3">
        {editing ? (
          <select value={f.trainer_id} onChange={(e) => setF({ ...f, trainer_id: e.target.value })} className="border border-zinc-300 px-2 py-1 text-xs">
            <option value="">— None —</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <span className="text-xs">{trainers.find((t) => t.id === cls.trainer_id)?.name || "—"}</span>
        )}
      </td>
      <td className="p-3">
        {editing ? (
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="border border-zinc-300 px-2 py-1 text-xs">
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
          </select>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            {icon} {cls.status}
          </div>
        )}
      </td>
      <td className="p-3">
        {editing ? (
          <input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="border border-zinc-300 px-2 py-1 text-xs w-full" />
        ) : (
          <span className="text-xs text-zinc-600">{cls.notes || "—"}</span>
        )}
      </td>
      <td className="p-3 text-right">
        {cls.status === "pending" ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => quickMark("completed")}
              data-testid={`quick-attended-${cls.class_number}`}
              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <CheckCircleIcon size={10} weight="bold" /> Attended
            </button>
            <button
              onClick={() => quickMark("missed")}
              data-testid={`quick-missed-${cls.class_number}`}
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <XCircleIcon size={10} weight="bold" /> Missed
            </button>
            {isAdmin && (
              <button onClick={() => setEditing(true)} data-testid={`edit-class-${cls.class_number}`} className="p-1.5 hover:bg-zinc-100 text-zinc-500 border border-zinc-200">
                <PencilSimpleIcon size={11} weight="bold" />
              </button>
            )}
          </div>
        ) : (
          isAdmin ? (
            editing ? (
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => setEditing(false)} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider border border-zinc-300">Cancel</button>
                <button onClick={save} data-testid={`save-class-${cls.class_number}`} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-blue-700">
                  Save
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} data-testid={`edit-class-${cls.class_number}`} className="p-1.5 hover:bg-zinc-100">
                <PencilSimpleIcon size={14} weight="bold" />
              </button>
            )
          ) : (
            <span className="text-[10px] text-zinc-400 italic">No actions</span>
          )
        )}
      </td>
    </tr>
  );
}

function PaymentSection({ studentId, payments, onReload, isAdmin }) {
  const [form, setForm] = useState({ amount: "", method: "cash", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount) return;
    setSaving(true);
    try {
      await api.post("/payments", {
        student_id: studentId,
        amount: Number(form.amount),
        method: form.method,
        date: form.date,
        notes: form.notes || undefined,
      });
      toast.success("Payment recorded");
      setForm({ ...form, amount: "", notes: "" });
      onReload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={`bento p-6 ${isAdmin ? "lg:col-span-2" : "lg:col-span-3"}`}>
        <div className="label-tag">Ledger</div>
        <h2 className="font-heading text-2xl font-bold tracking-tight mt-1 mb-4">Payments</h2>
        {payments.length === 0 ? (
          <div className="text-sm text-zinc-500 p-6 border border-dashed border-zinc-200 text-center">
            No payments recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-100 border-y border-zinc-200">
                <th className="label-tag p-2 text-left">Date</th>
                <th className="label-tag p-2 text-left">Method</th>
                <th className="label-tag p-2 text-left">Notes</th>
                <th className="label-tag p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                let formattedDate = p.date;
                try {
                  if (p.date) {
                    formattedDate = new Date(p.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                  }
                } catch(e) {}
                return (
                  <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                    <td className="p-2.5 font-mono-data text-xs text-zinc-600">{formattedDate}</td>
                    <td className="p-2.5">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 border border-zinc-300 bg-zinc-50">
                        {p.method}
                      </span>
                    </td>
                    <td className="p-2.5 text-xs text-zinc-500">{p.notes || "—"}</td>
                    <td className="p-2.5 text-right font-mono-data font-black text-zinc-950">
                      ₹{p.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isAdmin && (
        <form onSubmit={submit} className="bento p-6" data-testid="add-payment-form">
          <div className="label-tag">New</div>
          <h2 className="font-heading text-2xl font-bold tracking-tight mt-1 mb-4">Add payment</h2>
          <div className="space-y-3">
            <div>
              <div className="label-tag mb-1">Amount (₹)</div>
              <input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full border border-zinc-300 px-3 py-2 text-sm" data-testid="payment-amount-input" />
            </div>
            <div>
              <div className="label-tag mb-1">Method</div>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full border border-zinc-300 px-3 py-2 text-sm">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div>
              <div className="label-tag mb-1">Date</div>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="label-tag mb-1">Notes</div>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <button
              type="submit"
              disabled={saving}
              data-testid="submit-payment-btn"
              className="w-full bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-4 py-3 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Record payment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
