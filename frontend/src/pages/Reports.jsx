import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Reports() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [r, t, s] = await Promise.all([
      api.get(`/reports/daily?date=${date}`),
      api.get("/trainers"),
      api.get("/students"),
    ]);
    setReport(r.data);
    setTrainers(t.data);
    setStudents(s.data);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await load(); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, [date]);

  const trainerName = (id) => trainers.find((t) => t.id === id)?.name || "—";
  const studentName = (id) => students.find((s) => s.id === id)?.name || "—";

  const totalPayments = report?.payments.reduce((a, b) => a + b.amount, 0) || 0;
  const presentCount = report?.attendance.filter((a) => a.status === "present").length || 0;
  const absentCount = report?.attendance.filter((a) => a.status === "absent").length || 0;

  return (
    <div data-testid="reports-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-tag">Daily summary</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mt-2">
            Reports
          </h1>
        </div>
        <div>
          <div className="label-tag mb-1">Select date</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="report-date"
            className="border border-zinc-300 px-3 py-2 text-sm font-mono-data"
          />
        </div>
      </div>

      {loading ? (
        <div className="label-tag animate-pulse">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="Classes" value={report?.classes.length || 0} />
            <Stat label="Present" value={presentCount} color="text-emerald-700" />
            <Stat label="Absent" value={absentCount} color="text-red-700" />
            <Stat label="Fees collected" value={`₹${totalPayments.toLocaleString("en-IN")}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bento p-6">
              <div className="label-tag">Classes conducted</div>
              <h2 className="font-heading text-2xl font-bold tracking-tight mt-1 mb-4">Sessions</h2>
              {report?.classes.length === 0 ? (
                <div className="text-xs text-zinc-500 p-4 border border-dashed border-zinc-200 text-center">
                  No classes on this date.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-100 border-y border-zinc-200">
                      <th className="label-tag p-2 text-left">Student</th>
                      <th className="label-tag p-2 text-left">Trainer</th>
                      <th className="label-tag p-2 text-right">Class #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.classes.map((c) => (
                      <tr key={c.id} className="border-b border-zinc-100">
                        <td className="p-2">{studentName(c.student_id)}</td>
                        <td className="p-2 text-xs text-zinc-600">{trainerName(c.trainer_id)}</td>
                        <td className="p-2 text-right font-mono-data font-bold">{c.class_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bento p-6">
              <div className="label-tag">Trainer attendance</div>
              <h2 className="font-heading text-2xl font-bold tracking-tight mt-1 mb-4">Roster</h2>
              {report?.attendance.length === 0 ? (
                <div className="text-xs text-zinc-500 p-4 border border-dashed border-zinc-200 text-center">
                  No attendance logged on this date.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-100 border-y border-zinc-200">
                      <th className="label-tag p-2 text-left">Trainer</th>
                      <th className="label-tag p-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.attendance.map((a) => (
                      <tr key={a.trainer_id + a.date} className="border-b border-zinc-100">
                        <td className="p-2">{trainerName(a.trainer_id)}</td>
                        <td className="p-2 text-right">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border ${
                            a.status === "present" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                            a.status === "absent" ? "bg-red-50 text-red-800 border-red-200" :
                            "bg-yellow-50 text-yellow-800 border-yellow-200"
                          }`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color = "" }) {
  return (
    <div className="bento p-6">
      <div className="label-tag">{label}</div>
      <div className={`font-heading text-4xl font-black tracking-tighter mt-2 ${color}`}>
        {value}
      </div>
    </div>
  );
}
