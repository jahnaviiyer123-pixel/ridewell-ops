import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  PlusIcon,
  XIcon,
  PencilSimpleIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import PhotoUploader from "@/components/PhotoUploader";

function buildPhotoSrc(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const token = localStorage.getItem("rw_token");
  const base = API.replace(/\/api$/, "");
  const sep = url.includes("?") ? "&" : "?";
  return `${base}${url}${token ? `${sep}auth=${token}` : ""}`;
}

export default function Trainers() {
  const { user } = useAuth();
  const [active, setActive] = useState([]);
  const [pending, setPending] = useState([]);
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", photo_url: null });

  const isAdmin = user?.role === "admin";

  const load = async () => {
    if (isAdmin) {
      const [a, p] = await Promise.all([
        api.get("/trainers?status=active"),
        api.get("/trainers?status=pending"),
      ]);
      setActive(a.data);
      setPending(p.data);
    } else {
      const a = await api.get("/trainers");
      setActive(a.data);
    }
  };

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, []);

  const openNew = () => {
    setEditId(null);
    setForm({ name: "", email: "", phone: "", password: "", photo_url: null });
    setOpen(true);
  };

  const openEdit = (t) => {
    setEditId(t.id);
    setForm({ name: t.name, email: t.email, phone: t.phone || "", password: "", photo_url: t.photo_url || null });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        const payload = { name: form.name, phone: form.phone, photo_url: form.photo_url };
        if (form.password) payload.password = form.password;
        await api.patch(`/trainers/${editId}`, payload);
        toast.success("Trainer updated");
      } else {
        await api.post("/trainers", { name: form.name, email: form.email, phone: form.phone, password: form.password });
        if (form.photo_url) {
          // best-effort patch photo on the new trainer (need id) — refetch then patch
          const list = await api.get("/trainers?status=active");
          const created = list.data.find((u) => u.email === form.email.toLowerCase());
          if (created) {
            await api.patch(`/trainers/${created.id}`, { photo_url: form.photo_url });
          }
        }
        toast.success("Trainer added");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const approve = async (id) => {
    try {
      await api.post(`/trainers/${id}/approve`);
      toast.success("Trainer approved");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const reject = async (id) => {
    if (!window.confirm("Reject this trainer? They won't be able to log in.")) return;
    try {
      await api.post(`/trainers/${id}/reject`);
      toast.success("Trainer rejected");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this trainer? This deletes their access permanently.")) return;
    try {
      await api.delete(`/trainers/${id}`);
      toast.success("Trainer removed");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const list = tab === "pending" ? pending : active;

  return (
    <div data-testid="trainers-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-tag">Team</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mt-2">
            Trainers
          </h1>
        </div>
        {isAdmin && (
          <button
            onClick={openNew}
            data-testid="new-trainer-btn"
            className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-5 py-3 transition-colors"
          >
            <PlusIcon size={14} weight="bold" /> Add trainer
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1 mb-6 border-b border-zinc-200" data-testid="trainer-tabs">
          <button
            onClick={() => setTab("active")}
            data-testid="tab-active"
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px ${
              tab === "active" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            Active <span className="ml-1 font-mono-data">({active.length})</span>
          </button>
          <button
            onClick={() => setTab("pending")}
            data-testid="tab-pending"
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px relative ${
              tab === "pending" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            Pending approval <span className="ml-1 font-mono-data">({pending.length})</span>
            {pending.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full" />
            )}
          </button>
        </div>
      )}

      {loading ? (
        <div className="label-tag animate-pulse">Loading…</div>
      ) : list.length === 0 ? (
        <div className="bento p-12 text-center">
          <div className="label-tag">{tab === "pending" ? "No pending registrations." : "No trainers yet."}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((t) => (
            <div key={t.id} className="bento p-6 hover:shadow-[4px_4px_0_0_rgba(24,24,27,1)] transition-all" data-testid={`trainer-card-${t.id}`}>
              <div className="flex items-start gap-4">
                <Link to={t.status === "active" ? `/trainers/${t.id}` : "#"} className="flex items-start gap-4 flex-1 min-w-0 hover:text-blue-700 transition-colors">
                  <div className="w-16 h-16 bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0">
                    {t.photo_url ? (
                      <img src={buildPhotoSrc(t.photo_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserIcon size={28} weight="bold" className="text-zinc-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="label-tag">Trainer</div>
                    <h3 className="font-heading text-xl font-black tracking-tighter mt-0.5 truncate">{t.name}</h3>
                    {t.status === "pending" && (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-200 uppercase tracking-wider font-bold">
                        Pending
                      </span>
                    )}
                  </div>
                </Link>
                {isAdmin && tab === "active" && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-zinc-100" data-testid={`edit-trainer-${t.id}`}>
                      <PencilSimpleIcon size={14} weight="bold" />
                    </button>
                    <button onClick={() => remove(t.id)} className="p-1.5 hover:bg-red-600 hover:text-white">
                      <TrashIcon size={14} weight="bold" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
                <div className="flex justify-between text-xs">
                  <span className="label-tag">Email</span>
                  <span className="font-mono-data truncate ml-2">{t.email}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="label-tag">Phone</span>
                  <span className="font-mono-data">{t.phone || "—"}</span>
                </div>
              </div>
              {isAdmin && tab === "pending" && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => approve(t.id)}
                    data-testid={`approve-${t.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2"
                  >
                    <CheckCircleIcon size={12} weight="bold" /> Approve
                  </button>
                  <button
                    onClick={() => reject(t.id)}
                    data-testid={`reject-${t.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-2"
                  >
                    <XCircleIcon size={12} weight="bold" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-20 overflow-y-auto">
          <div className="bg-white border border-zinc-900 w-full max-w-lg shadow-[8px_8px_0_0_rgba(24,24,27,1)]">
            <div className="flex items-center justify-between p-5 border-b border-zinc-200">
              <h3 className="font-heading text-2xl font-bold tracking-tight">
                {editId ? "Edit trainer" : "Add trainer"}
              </h3>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-zinc-100">
                <XIcon size={18} weight="bold" />
              </button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <div>
                <div className="label-tag mb-2">Profile photo</div>
                <PhotoUploader
                  value={form.photo_url}
                  onChange={(url) => setForm({ ...form, photo_url: url })}
                  size="w-20 h-20"
                />
              </div>
              <div>
                <div className="label-tag mb-1.5">Full name</div>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-zinc-300 px-3 py-2 text-sm" data-testid="trainer-name-input" />
              </div>
              <div>
                <div className="label-tag mb-1.5">Email</div>
                <input required type="email" disabled={!!editId} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100" data-testid="trainer-email-input" />
              </div>
              <div>
                <div className="label-tag mb-1.5">Phone</div>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="label-tag mb-1.5">{editId ? "New password (leave empty to keep)" : "Password"}</div>
                <input required={!editId} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-zinc-300 px-3 py-2 text-sm" data-testid="trainer-password-input" />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-zinc-200">
                <button type="button" onClick={() => setOpen(false)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-100">Cancel</button>
                <button type="submit" data-testid="submit-trainer-btn" className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-blue-700">
                  {editId ? "Save changes" : "Add trainer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
