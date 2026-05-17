import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import {
  CurrencyInrIcon,
  CalendarBlankIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

function RecordPaymentDialog({ open, onClose, students, onCreated }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    student_id: "",
    amount: "",
    date: today,
    method: "cash",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.student_id) {
      toast.error("Please select a student");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        student_id: form.student_id,
        amount: Number(form.amount),
        date: form.date,
        method: form.method,
        notes: form.notes,
      };
      await api.post("/payments", payload);
      toast.success("Payment recorded successfully");
      onCreated();
      onClose();
      // Reset form
      setForm({
        student_id: "",
        amount: "",
        date: today,
        method: "cash",
        notes: "",
      });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Filter only active students for the payment selection
  const activeStudents = students.filter(s => s.status === "active");

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-20 overflow-y-auto">
      <div className="bg-white border border-zinc-900 w-full max-w-md shadow-[8px_8px_0_0_rgba(24,24,27,1)]" data-testid="record-payment-dialog">
        <div className="flex items-center justify-between p-5 border-b border-zinc-200">
          <div>
            <div className="label-tag">Ledger Entry</div>
            <h3 className="font-heading text-2xl font-bold tracking-tight mt-1">Record Payment</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100" data-testid="close-payment-dialog">
            <XIcon size={18} weight="bold" />
          </button>
        </div>
        
        <form onSubmit={submit} className="p-6 space-y-4">
          <label className="block">
            <span className="label-tag block mb-1.5">Select Student *</span>
            <select
              required
              value={form.student_id}
              onChange={upd("student_id")}
              className="w-full bg-white border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              data-testid="payment-student-select"
            >
              <option value="">— Pick a student —</option>
              {activeStudents.map((s) => {
                const due = (s.fees_total || 0) - (s.fees_paid || 0);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone}) {due > 0 ? `· Due: ₹${due}` : "· Fully Paid"}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="label-tag block mb-1.5">Amount (₹) *</span>
            <input
              required
              type="number"
              min="1"
              value={form.amount}
              onChange={upd("amount")}
              placeholder="e.g. 5000"
              className="w-full bg-white border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              data-testid="payment-amount-input"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="label-tag block mb-1.5">Payment Method *</span>
              <select
                value={form.method}
                onChange={upd("method")}
                className="w-full bg-white border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI / Online</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="block">
              <span className="label-tag block mb-1.5">Payment Date *</span>
              <input
                required
                type="date"
                value={form.date}
                onChange={upd("date")}
                className="w-full bg-white border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </label>
          </div>

          <label className="block">
            <span className="label-tag block mb-1.5">Notes</span>
            <textarea
              rows="2"
              value={form.notes}
              onChange={upd("notes")}
              placeholder="e.g. Receipt #1234, balance fees"
              className="w-full bg-white border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="submit-payment-btn"
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([api.get("/payments"), api.get("/students")]);
      setPayments(p.data);
      setStudents(s.data);
    } catch (e) {
      toast.error("Failed to load payments ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const studentName = (id) => students.find((s) => s.id === id)?.name || "Unknown";
  const studentPhone = (id) => students.find((s) => s.id === id)?.phone || "";
  const total = payments.reduce((a, b) => a + (b.amount || 0), 0);

  // Group payments by month for analysis
  const getMonthlyAnalysis = () => {
    const months = {};
    payments.forEach((p) => {
      if (!p.date) return;
      const monthKey = p.date.substring(0, 7);
      if (!months[monthKey]) {
        months[monthKey] = {
          label: new Date(p.date).toLocaleString("default", { month: "long", year: "numeric" }),
          total: 0,
          count: 0,
          methods: { cash: 0, online: 0, upi: 0, bank_transfer: 0, other: 0 },
        };
      }
      months[monthKey].total += p.amount || 0;
      months[monthKey].count += 1;
      
      const method = (p.method || "cash").toLowerCase();
      if (months[monthKey].methods[method] !== undefined) {
        months[monthKey].methods[method] += p.amount || 0;
      } else {
        months[monthKey].methods.other += p.amount || 0;
      }
    });

    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const monthlyData = getMonthlyAnalysis();

  return (
    <div data-testid="payments-page" className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-tag">Ledger</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mt-2">
            Payments
          </h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setOpen(true)}
            data-testid="record-payment-btn"
            className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-5 py-3 transition-colors shadow-sm"
          >
            <PlusIcon size={14} weight="bold" />
            Record Payment
          </button>
          
          <div className="bento p-4 min-w-[200px]">
            <div className="label-tag flex items-center gap-1.5 text-zinc-500">
              <CurrencyInrIcon size={14} weight="bold" /> Total collected
            </div>
            <div className="font-heading text-3xl font-black tracking-tighter mt-1 text-emerald-800">
              ₹{total.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="label-tag animate-pulse">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Payments Record */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bento p-4 bg-zinc-50 border-b-2 border-zinc-200">
              <span className="label-tag">Payments Ledger ({payments.length} records)</span>
            </div>

            {payments.length === 0 ? (
              <div className="bento p-12 text-center border-dashed border-2 border-zinc-200">
                <CurrencyInrIcon size={32} className="text-zinc-300 mx-auto mb-3" />
                <div className="font-semibold text-zinc-700">No payments recorded yet</div>
                <p className="text-xs text-zinc-500 mt-1">Payments collected during onboarding or student profiles will show up here.</p>
              </div>
            ) : (
              <div className="bento overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-100 border-y border-zinc-200 text-left">
                        <th className="label-tag p-3">Date</th>
                        <th className="label-tag p-3">Student</th>
                        <th className="label-tag p-3">Method</th>
                        <th className="label-tag p-3 hidden md:table-cell">Notes</th>
                        <th className="label-tag p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                          <td className="p-3 font-mono-data text-xs text-zinc-600 whitespace-nowrap">
                            {p.date}
                          </td>
                          <td className="p-3">
                            <div>
                              <Link to={`/students/${p.student_id}`} className="font-semibold hover:text-blue-700 transition-colors block text-zinc-950">
                                {studentName(p.student_id)}
                              </Link>
                              <span className="text-[10px] text-zinc-500 font-mono-data block">
                                {studentPhone(p.student_id)}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 border border-zinc-300 bg-zinc-50">
                              {p.method}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-zinc-500 hidden md:table-cell max-w-[200px] truncate">
                            {p.notes || "—"}
                          </td>
                          <td className="p-3 text-right font-mono-data font-black text-zinc-950">
                            ₹{p.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Monthly Analysis */}
          <div className="space-y-6">
            <div className="bento p-5 bg-white shadow-sm border-t-4 border-t-zinc-950">
              <div className="flex items-center gap-2 mb-4">
                <CalendarBlankIcon size={18} className="text-zinc-600" weight="bold" />
                <span className="label-tag text-sm">Monthly Analysis</span>
              </div>
              <p className="text-xs text-zinc-500 mb-6">Grouping collections and payment methods by month.</p>

              {monthlyData.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 italic">No transaction history found to analyze.</div>
              ) : (
                <div className="space-y-6">
                  {monthlyData.map(([key, data]) => (
                    <div key={key} className="border-b border-zinc-100 pb-5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-heading font-black text-zinc-900 text-sm">{data.label}</span>
                        <span className="font-mono-data text-xs text-zinc-500 font-bold">{data.count} txns</span>
                      </div>
                      <div className="font-heading text-xl font-black text-emerald-700 tracking-tight mb-3">
                        ₹{data.total.toLocaleString("en-IN")}
                      </div>
                      
                      {/* Method breakdown */}
                      <div className="bg-zinc-50 p-2.5 space-y-1.5">
                        <div className="label-tag text-[9px] text-zinc-400 mb-1 border-b border-zinc-200/60 pb-1">Payment Method Share</div>
                        {Object.entries(data.methods).map(([method, amount]) => {
                          if (amount === 0) return null;
                          return (
                            <div key={method} className="flex justify-between items-center text-xs font-mono-data">
                              <span className="capitalize text-zinc-500 text-[11px]">{method.replace("_", " ")}</span>
                              <span className="font-bold text-zinc-700">₹{amount.toLocaleString("en-IN")}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={open}
        onClose={() => setOpen(false)}
        students={students}
        onCreated={() => load()}
      />
    </div>
  );
}
