import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  GaugeIcon,
  UsersIcon,
  MotorcycleIcon,
  CalendarCheckIcon,
  CurrencyInrIcon,
  ChartLineIcon,
  SignOutIcon,
  ClockIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: GaugeIcon },
  { to: "/schedule", label: "Schedule", Icon: CalendarBlankIcon },
  { to: "/students", label: "Students", Icon: UsersIcon },
  { to: "/trainers", label: "Trainers", Icon: MotorcycleIcon, adminOnly: true },
  { to: "/attendance", label: "Attendance", Icon: CalendarCheckIcon },
  { to: "/payments", label: "Payments", Icon: CurrencyInrIcon, adminOnly: true },
];

const SETTINGS_NAV = [
  { to: "/slots", label: "Slots", Icon: ClockIcon, adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside
      data-testid="sidebar"
      className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-zinc-50 border-r border-zinc-200 z-40"
    >
      <div className="p-6 border-b border-zinc-200">
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
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="label-tag px-3 py-2">Menu</div>
        {NAV.filter((n) => !n.adminOnly || user?.role === "admin").map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`nav-${label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-200"
              }`
            }
          >
            <Icon size={18} weight="bold" />
            <span>{label}</span>
          </NavLink>
        ))}

        {SETTINGS_NAV.filter((n) => !n.adminOnly || user?.role === "admin").length > 0 && (
          <>
            <div className="label-tag px-3 py-2 pt-6">Settings</div>
            {SETTINGS_NAV.filter((n) => !n.adminOnly || user?.role === "admin").map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-200"
                  }`
                }
              >
                <Icon size={18} weight="bold" />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-zinc-200">
        <div className="px-3 py-2 mb-2">
          <div className="label-tag">Signed in as</div>
          <div className="text-sm font-semibold text-zinc-900 truncate">{user?.name}</div>
          <div className="text-xs text-zinc-500 truncate">{user?.email}</div>
          <div className="mt-1 inline-block text-[10px] px-2 py-0.5 bg-yellow-400 text-zinc-900 font-bold uppercase tracking-wider">
            {user?.role}
          </div>
        </div>
        <button
          onClick={onLogout}
          data-testid="logout-btn"
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider border border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-colors"
        >
          <SignOutIcon size={14} weight="bold" />
          Log out
        </button>
      </div>
    </aside>
  );
}
