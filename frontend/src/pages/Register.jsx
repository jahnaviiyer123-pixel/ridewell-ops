import React, { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MotorcycleIcon, ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/dashboard" replace />;

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", form);
      toast.success("Registration submitted");
      setDone(true);
    } catch (err) {
      const msg = formatApiError(err.response?.data?.detail) || err.message;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <div className="flex items-center gap-3 p-8 lg:p-12">
        <div className="w-10 h-10 bg-zinc-900 flex items-center justify-center">
          <MotorcycleIcon size={22} weight="bold" className="text-yellow-400" />
        </div>
        <div>
          <div className="font-heading font-black text-lg leading-none tracking-tighter">
            RIDEWELL
          </div>
          <div className="label-tag mt-1">Ops Console</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md bg-white border border-zinc-200 p-8" data-testid="register-card">
          {done ? (
            <div className="text-center py-6">
              <CheckCircleIcon size={48} weight="fill" className="text-emerald-600 mx-auto mb-4" />
              <h1 className="font-heading text-3xl font-black tracking-tighter mb-3">
                Submitted ✓
              </h1>
              <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                Your trainer account is now <strong>pending admin approval</strong>.
                Once approved, you can log in with your email and password.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-5 py-3"
                data-testid="back-to-login-link"
              >
                Back to login <ArrowRightIcon size={12} weight="bold" />
              </Link>
            </div>
          ) : (
            <>
              <div className="label-tag mb-3">New Trainer Sign-up</div>
              <h1 className="font-heading text-3xl font-black tracking-tighter leading-none">
                Register as trainer
              </h1>
              <p className="text-sm text-zinc-600 mt-2">
                Admin approval required before you can access the console.
              </p>

              <form onSubmit={submit} className="mt-8 space-y-4" data-testid="register-form">
                <div>
                  <label className="label-tag block mb-2">Full name</label>
                  <input
                    required
                    value={form.name}
                    onChange={upd("name")}
                    data-testid="register-name-input"
                    className="w-full bg-white border border-zinc-300 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                    placeholder="Ravi Kumar"
                  />
                </div>
                <div>
                  <label className="label-tag block mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={upd("email")}
                    data-testid="register-email-input"
                    className="w-full bg-white border border-zinc-300 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                    placeholder="ravi@example.com"
                  />
                </div>
                <div>
                  <label className="label-tag block mb-2">Phone</label>
                  <input
                    value={form.phone}
                    onChange={upd("phone")}
                    data-testid="register-phone-input"
                    className="w-full bg-white border border-zinc-300 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="label-tag block mb-2">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={upd("password")}
                    data-testid="register-password-input"
                    className="w-full bg-white border border-zinc-300 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                    placeholder="Min 6 characters"
                  />
                </div>

                {error && (
                  <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-2.5 font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  data-testid="register-submit-btn"
                  className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-6 py-4 transition-colors disabled:opacity-60"
                >
                  {loading ? "Submitting…" : "Submit registration"}
                  <ArrowRightIcon size={14} weight="bold" />
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-zinc-500">
                Already have an account?{" "}
                <Link to="/login" className="text-blue-700 font-bold hover:underline">
                  Log in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
