import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import {
  PlusIcon,
  XIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  ArchiveIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import PhotoUploader from "@/components/PhotoUploader";
import { API } from "@/lib/api";

function StudentAvatar({ url, name }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("rw_token") : null;
  const src = url
    ? url.startsWith("http")
      ? url
      : `${API.replace(/\/api$/, "")}${url}${url.includes("?") ? "&" : "?"}auth=${token || ""}`
    : null;
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className="w-9 h-9 bg-zinc-200 border border-zinc-300 overflow-hidden flex-shrink-0 flex items-center justify-center">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-heading font-black text-sm text-zinc-600">{initial}</span>
      )}
    </div>
  );
}

function EnrollDialog({ open, onClose, trainers, onCreated }) {
  const today = new Date().toISOString().slice(0, 10);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    age: "",
    gender: "",
    license_type: "gearless",
    joining_date: today,
    slot_time: "",
    needs_pickup: false,
    pickup_address: "",
    drop_address: "",
    total_classes: 10,
    assigned_trainer_id: "",
    fees_total: 0,
    fees_paid: 0,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      api.get("/slots").then((r) => setSlots(r.data)).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.assigned_trainer_id) delete payload.assigned_trainer_id;
      if (!payload.pickup_trainer_id) delete payload.pickup_trainer_id;
      if (!payload.drop_trainer_id) delete payload.drop_trainer_id;
      if (!payload.email) delete payload.email;
      if (!payload.slot_time) delete payload.slot_time;
      if (!payload.gender) delete payload.gender;
      if (!payload.photo_url) delete payload.photo_url;
      if (payload.age === "" || payload.age == null) delete payload.age;
      else payload.age = Number(payload.age);
      if (!payload.pickup_address) delete payload.pickup_address;
      if (!payload.drop_address) delete payload.drop_address;
      payload.total_classes = Number(payload.total_classes) || 10;
      payload.fees_total = Number(payload.fees_total) || 0;
      payload.fees_paid = Number(payload.fees_paid) || 0;
      const { data } = await api.post("/students", payload);
      toast.success("Student enrolled");
      onCreated(data);
      onClose();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-20 overflow-y-auto">
      <div className="bg-white border border-zinc-900 w-full max-w-2xl shadow-[8px_8px_0_0_rgba(24,24,27,1)]" data-testid="enroll-dialog">
        <div className="flex items-center justify-between p-5 border-b border-zinc-200">
          <div>
            <div className="label-tag">New Enrollment</div>
            <h3 className="font-heading text-2xl font-bold tracking-tight mt-1">Add Student</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100" data-testid="close-enroll-dialog">
            <XIcon size={18} weight="bold" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full Name *">
            <input required value={form.name} onChange={upd("name")} className={inputCls} data-testid="student-name-input" />
          </Field>
          <Field label="Phone *">
            <input required value={form.phone} onChange={upd("phone")} className={inputCls} data-testid="student-phone-input" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={upd("email")} className={inputCls} />
          </Field>
          <Field label="Age">
            <input type="number" min="10" max="100" value={form.age} onChange={upd("age")} className={inputCls} data-testid="student-age-input" />
          </Field>
          <Field label="Gender">
            <select value={form.gender} onChange={upd("gender")} className={inputCls} data-testid="student-gender-select">
              <option value="">— Select —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="License Type">
            <select value={form.license_type} onChange={upd("license_type")} className={inputCls} data-testid="license-type-select">
              <option value="gearless">Gearless</option>
              <option value="geared">Geared</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <Field label="Joining Date">
            <input type="date" value={form.joining_date} onChange={upd("joining_date")} className={inputCls} />
          </Field>
          <Field label="Time Slot">
            <select value={form.slot_time} onChange={upd("slot_time")} className={inputCls} data-testid="student-slot-select">
              <option value="">— Pick a slot —</option>
              {slots.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Total Classes (Course Days)">
            <input type="number" min="1" max="30" value={form.total_classes} onChange={upd("total_classes")} className={inputCls} />
          </Field>
          <Field label="Assigned Trainer">
            <select value={form.assigned_trainer_id} onChange={upd("assigned_trainer_id")} className={inputCls}>
              <option value="">— Unassigned —</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Pickup Trainer">
            <select value={form.pickup_trainer_id} onChange={upd("pickup_trainer_id")} className={inputCls} data-testid="pickup-trainer-select">
              <option value="">— None —</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Drop Trainer">
            <select value={form.drop_trainer_id} onChange={upd("drop_trainer_id")} className={inputCls} data-testid="drop-trainer-select">
              <option value="">— None —</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Fees Total (₹)">
            <input type="number" value={form.fees_total} onChange={upd("fees_total")} className={inputCls} />
          </Field>
          <Field label="Fees Paid (₹)">
            <input type="number" value={form.fees_paid} onChange={upd("fees_paid")} className={inputCls} />
          </Field>
          <div className="md:col-span-2 border-t border-zinc-200 pt-4">
            <div className="label-tag mb-2">Profile photo</div>
            <PhotoUploader value={form.photo_url} onChange={(url) => setForm({ ...form, photo_url: url })} size="w-20 h-20" />
          </div>
          <div className="md:col-span-2 border-t border-zinc-200 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.needs_pickup} onChange={(e) => setForm({ ...form, needs_pickup: e.target.checked })} data-testid="needs-pickup-checkbox" className="w-4 h-4" />
              <span className="label-tag">Pickup &amp; drop required</span>
            </label>
          </div>
          {form.needs_pickup && (
            <>
              <div className="md:col-span-2">
                <Field label="Pickup Address">
                  <textarea rows="2" value={form.pickup_address} onChange={upd("pickup_address")} className={inputCls} data-testid="pickup-address-input" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Drop Address (if different)">
                  <textarea rows="2" value={form.drop_address} onChange={upd("drop_address")} className={inputCls} />
                </Field>
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea rows="2" value={form.notes} onChange={upd("notes")} className={inputCls} />
            </Field>
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2 border-t border-zinc-200">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="submit-enroll-btn"
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Enroll student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-white border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700";

const Field = ({ label, children }) => (
  <label className="block">
    <span className="label-tag block mb-1.5">{label}</span>
    {children}
  </label>
);

/* ────────────────────────────────────────────
   Student Table — Reused for both tabs
   ──────────────────────────────────────────── */
function StudentTable({ students, loading, onEnroll, onReload, isAdmin }) {
  if (loading) {
    return <div className="p-10 text-center label-tag animate-pulse">Loading…</div>;
  }
  if (students.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="label-tag mb-2">No students found</div>
        {onEnroll && (
          <button onClick={onEnroll} className="text-sm font-bold text-blue-700 hover:underline">
            + Enroll your first student
          </button>
        )}
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-zinc-100 border-y border-zinc-200 text-left">
          <th className="label-tag p-3">Name</th>
          <th className="label-tag p-3">Phone</th>
          <th className="label-tag p-3 hidden md:table-cell">Joined</th>
          <th className="label-tag p-3 hidden md:table-cell">Type</th>
          <th className="label-tag p-3 text-right">Progress</th>
          <th className="label-tag p-3 text-right">Fees</th>
          <th className="label-tag p-3 text-right">Status</th>
          {isAdmin && <th className="label-tag p-3 text-right">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {students.map((s) => {
          const pending = (s.fees_total || 0) - (s.fees_paid || 0);
          return (
            <tr
              key={s.id}
              className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
              onClick={() => (window.location.href = `/students/${s.id}`)}
              data-testid={`student-row-${s.id}`}
            >
              <td className="p-3">
                <div className="flex items-center gap-3">
                  <StudentAvatar url={s.photo_url} name={s.name} />
                  <Link to={`/students/${s.id}`} className="font-semibold hover:text-blue-700" onClick={(e) => e.stopPropagation()}>
                    {s.name}
                  </Link>
                </div>
              </td>
              <td className="p-3 font-mono-data text-xs text-zinc-600">{s.phone}</td>
              <td className="p-3 hidden md:table-cell font-mono-data text-xs text-zinc-600">
                {s.joining_date}
              </td>
              <td className="p-3 hidden md:table-cell">
                <span className="inline-block text-[10px] px-2 py-0.5 border border-zinc-300 uppercase tracking-wider font-bold">
                  {s.license_type}
                </span>
              </td>
              <td className="p-3 text-right font-mono-data text-xs">
                <div className="inline-flex items-center gap-2 justify-end">
                  <span>{s.classes_completed}/{s.total_classes}</span>
                  <span className="w-16 h-1.5 bg-zinc-100 relative">
                    <span
                       className="absolute left-0 top-0 bottom-0 bg-emerald-600"
                      style={{ width: `${(s.classes_completed / s.total_classes) * 100}%` }}
                    />
                  </span>
                </div>
              </td>
              <td className="p-3 text-right font-mono-data text-xs">
                {pending > 0 ? (
                  <span className="text-red-700 font-bold">₹{pending.toLocaleString("en-IN")} due</span>
                ) : (
                  <span className="text-emerald-700 font-bold">Paid</span>
                )}
              </td>
              <td className="p-3 text-right">
                <span className={`inline-block text-[10px] px-2 py-0.5 uppercase tracking-wider font-bold border ${
                  s.status === "active" ? "bg-blue-50 text-blue-800 border-blue-200" :
                  s.status === "completed" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                  "bg-zinc-100 text-zinc-700 border-zinc-200"
                }`}>
                  {s.status}
                </span>
              </td>
              {isAdmin && (
                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (window.confirm(`Delete ${s.name} and all their records permanently?`)) {
                        try {
                          await api.delete(`/students/${s.id}`);
                          toast.success("Student deleted");
                          if (onReload) onReload();
                        } catch (err) {
                          toast.error(err.message || "Failed to delete student");
                        }
                      }
                    }}
                    className="p-1.5 border border-zinc-300 hover:bg-red-600 hover:text-white hover:border-red-600 inline-flex items-center justify-center transition-colors"
                    title="Delete Student"
                    data-testid={`delete-btn-${s.id}`}
                  >
                    <TrashIcon size={13} weight="bold" />
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ────────────────────────────────────────────
   Main Students Page with Active / Old tabs
   ──────────────────────────────────────────── */
export default function Students() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");

  const load = async () => {
    const [sRes, tRes] = await Promise.all([api.get("/students"), api.get("/trainers")]);
    setStudents(sRes.data);
    setTrainers(tRes.data);
  };

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
  }, []);

  // Split students by status
  const activeStudents = students.filter((s) => s.status === "active");
  const oldStudents = students.filter((s) => s.status === "completed" || s.status === "dropped");

  const currentList = tab === "active" ? activeStudents : oldStudents;

  const filtered = currentList.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.phone.includes(query)
  );

  return (
    <div data-testid="students-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-tag">Roster</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mt-2">
            Students
          </h1>
        </div>
        <button
          onClick={() => setOpen(true)}
          data-testid="new-student-btn"
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-5 py-3 transition-colors"
        >
          <PlusIcon size={14} weight="bold" />
          Enroll student
        </button>
      </div>

      {/* Tabs: Active / Old Students */}
      <div className="flex items-center gap-1 mb-6 border-b border-zinc-200" data-testid="student-tabs">
        <button
          onClick={() => setTab("active")}
          data-testid="tab-active-students"
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
            tab === "active"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-900"
          }`}
        >
          <UsersIcon size={14} weight="bold" /> Active Students
          <span className="font-mono-data ml-1">({activeStudents.length})</span>
        </button>
        <button
          onClick={() => setTab("old")}
          data-testid="tab-old-students"
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
            tab === "old"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-900"
          }`}
        >
          <ArchiveIcon size={14} weight="bold" /> Old Students
          <span className="font-mono-data ml-1">({oldStudents.length})</span>
        </button>
      </div>

      {/* Search */}
      <div className="bento mb-4 p-4 flex items-center gap-3">
        <MagnifyingGlassIcon size={18} weight="bold" className="text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone…"
          data-testid="students-search"
          className="flex-1 bg-transparent outline-none text-sm"
        />
        <div className="label-tag">{filtered.length} records</div>
      </div>

      {/* Table */}
      <div className="bento overflow-x-auto">
        <StudentTable
          students={filtered}
          loading={loading}
          onEnroll={tab === "active" ? () => setOpen(true) : null}
          onReload={load}
          isAdmin={isAdmin}
        />
      </div>

      <EnrollDialog
        open={open}
        onClose={() => setOpen(false)}
        trainers={trainers}
        onCreated={() => load()}
      />
    </div>
  );
}
