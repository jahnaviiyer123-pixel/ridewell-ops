import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PlusIcon, TrashIcon, ClockIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Slots() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ start_time: "", end_time: "" });
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin";

  const load = async () => {
    const { data } = await api.get("/slots");
    setSlots(data);
  };

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.start_time || !form.end_time) return;
    setSaving(true);
    try {
      const label = `${form.start_time}-${form.end_time}`;
      await api.post("/slots", { label, start_time: form.start_time, end_time: form.end_time });
      toast.success("Slot added");
      setForm({ start_time: "", end_time: "" });
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this slot?")) return;
    try {
      await api.delete(`/slots/${id}`);
      toast.success("Slot removed");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div data-testid="slots-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-tag">Settings</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mt-2">
            Time Slots
          </h1>
          <p className="text-sm text-zinc-600 mt-3">
            Configure 1-hour class windows. Customers pick a slot during onboarding.
          </p>
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={submit} className="bento p-6 mb-6" data-testid="add-slot-form">
          <div className="label-tag mb-3">Add new slot</div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <div className="label-tag mb-1">Start</div>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
                data-testid="slot-start-input"
                className="border border-zinc-300 px-3 py-2 text-sm font-mono-data"
              />
            </div>
            <div>
              <div className="label-tag mb-1">End</div>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
                data-testid="slot-end-input"
                className="border border-zinc-300 px-3 py-2 text-sm font-mono-data"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              data-testid="add-slot-btn"
              className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-5 py-3 transition-colors disabled:opacity-60"
            >
              <PlusIcon size={14} weight="bold" />
              {saving ? "Adding…" : "Add slot"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="label-tag animate-pulse">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {slots.length === 0 ? (
            <div className="col-span-full bento p-12 text-center">
              <div className="label-tag">No slots yet — add some above.</div>
            </div>
          ) : (
            slots.map((s) => (
              <div key={s.id} className="bento p-4 flex items-center justify-between" data-testid={`slot-card-${s.id}`}>
                <div className="flex items-center gap-3">
                  <ClockIcon size={20} weight="bold" className="text-zinc-400" />
                  <div className="font-heading text-xl font-black tracking-tighter font-mono-data">
                    {s.label}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => remove(s.id)} className="p-1.5 hover:bg-red-600 hover:text-white">
                    <TrashIcon size={14} weight="bold" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
