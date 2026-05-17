import React, { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { MotorcycleIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

const BG = "https://static.prod-images.emergentagent.com/jobs/4c1dca04-8039-4071-823b-fcb736b5e79c/images/783521f8f52360b1d95831b3d4c8135d4818308909f8ac85702a73cdf81e568e.png";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      toast.success("Welcome back");
      navigate("/dashboard");
    } else {
      setError(res.error);
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-zinc-50">
      {/* Left - form */}
      <div className="flex flex-col justify-between p-8 lg:p-16 bg-white">
        <div className="flex items-center gap-3">
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

        <div className="max-w-md w-full mx-auto">
          <div className="label-tag mb-4">Internal Access · V1.0</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] text-zinc-950">
            Run the
            <br />
            driving school.
            <br />
            <span className="text-zinc-400">Not the paperwork.</span>
          </h1>
          <p className="text-sm text-zinc-600 mt-6 leading-relaxed max-w-sm">
            Track every student's 10 classes, trainer attendance, and fees —
            all in one grid. Built for two-wheeler driving schools.
          </p>

          <form onSubmit={submit} className="mt-10 space-y-4" data-testid="login-form">
            <div>
              <label className="label-tag block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="w-full bg-white border border-zinc-300 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                placeholder="you@ridewell.com"
              />
            </div>
            <div>
              <label className="label-tag block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="w-full bg-white border border-zinc-300 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-2.5 font-medium" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-[0.2em] px-6 py-4 transition-colors disabled:opacity-60"
            >
              {loading ? "Authenticating…" : "Enter console"}
              <ArrowRightIcon size={14} weight="bold" />
            </button>
          </form>

          <div className="mt-8 text-[11px] text-zinc-500 border-t border-zinc-200 pt-4">
            <div className="text-xs text-zinc-600">
              New trainer?{" "}
              <Link to="/register" className="text-blue-700 font-bold hover:underline" data-testid="register-link">
                Sign up here
              </Link>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-zinc-400 font-mono-data">
          © {new Date().getFullYear()} RIDEWELL OPS · INTERNAL USE ONLY
        </div>
      </div>

      {/* Right - image */}
      <div className="hidden lg:block relative bg-yellow-400 overflow-hidden">
        <img
          src={BG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute bottom-8 left-8 right-8 bg-zinc-900 text-white p-6">
          <div className="label-tag text-yellow-400 mb-2">Today's stats</div>
          <div className="font-heading text-3xl font-black tracking-tighter">
            10-class tracker · trainer attendance · fees — all grid, zero fluff.
          </div>
        </div>
      </div>
    </div>
  );
}
