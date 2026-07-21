import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Users, GraduationCap, TrendingUp, Activity,
  Briefcase, ArrowUpRight, ShieldCheck, AlertTriangle,
  ChevronRight, BarChart3, Video, Loader2
} from 'lucide-react';
import api from '../../api';
import { useStudents } from '../../hooks/useStudents';

// ── STAT CARD ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = 'emerald', trend }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <div className="bg-white rounded-2xl border border-emerald-100 hover:border-emerald-300 p-6 shadow-sm hover:shadow-md transition-all duration-300 group transform-gpu">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
          <Icon size={20} className="group-hover:scale-110 transition-transform" />
        </div>
        {trend !== undefined && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
            <TrendingUp size={10} className={trend < 0 ? 'rotate-180' : ''} />
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-2 font-medium">{sub}</p>}
    </div>
  );
}

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    students: [],
    teachers: [],
    payments: [],
    attendance: [],
  });

  const { data: studentsData, isLoading: isLoadingStudents } = useStudents();
  
  useEffect(() => {
    const abortController = new AbortController();
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7); // YYYY-MM

    Promise.all([
      api.get('accounts/teachers/', { signal: abortController.signal }).catch(() => ({ data: [] })),
      api.get(`payments/?month_paid_for=${currentMonth}`, { signal: abortController.signal }).catch(() => ({ data: [] })),
      api.get(`attendance/?date=${today}`, { signal: abortController.signal }).catch(() => ({ data: [] })),
    ])
      .then(([tchRes, payRes, attRes]) => {
        setData(prev => ({
          ...prev,
          teachers:   Array.isArray(tchRes.data) ? tchRes.data : (tchRes.data.results ?? []),
          payments:   Array.isArray(payRes.data) ? payRes.data : (payRes.data.results ?? []),
          attendance: Array.isArray(attRes.data) ? attRes.data : (attRes.data.results ?? []),
        }));
      })
      .catch(err => {
        if (err.name !== 'CanceledError') console.error('Owner dashboard fetch error:', err);
      })
      .finally(() => setLoading(false));

    return () => abortController.abort();
  }, []);

  // Sync students data into local state to maintain compatibility with existing render logic
  useEffect(() => {
    if (studentsData) {
      setData(prev => ({ ...prev, students: studentsData }));
    }
  }, [studentsData]);

  const isFullyLoading = loading || isLoadingStudents;

  const handleStartDynamicClass = async () => {
    try {
      const response = await api.post('live/create-room/');
      const newRoomName = response.data.room_name;
      navigate(`/classroom/${newRoomName}`);
    } catch (err) {
      alert("Failed to generate a secure classroom. Check your permissions.");
    }
  };

  const active = data.students.filter(s => s.status === 'Joined');
  const trial = data.students.filter(s => s.status === 'Trial');
  const left = data.students.filter(s => s.status === 'Left');

  const totalRevenue = data.payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);

  const presentToday = data.attendance.filter(r => r.status.toLowerCase() === 'present').length;
  const absentToday = data.attendance.filter(r => r.status.toLowerCase() === 'absent').length;
  const lateToday = data.attendance.filter(r => r.status.toLowerCase() === 'late').length;
  const totalMarked = data.attendance.length;

  const attendanceRate = active.length > 0
    ? Math.round((presentToday / Math.max(active.length, 1)) * 100)
    : 0;

  const retentionRate = (active.length + left.length) > 0
    ? Math.round((active.length / (active.length + left.length)) * 100)
    : 100;

  const now = new Date();
  const dbMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const displayMonthStr = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const paidIds = data.payments
    .filter(p => p.month_paid_for === dbMonthStr && p.status === 'Paid')
    .map(p => p.student);

  const defaulterCount = active.filter(s => !paidIds.includes(s.id)).length;
  const recentStudents = [...data.students].sort((a, b) => b.id - a.id).slice(0, 5);

  // ── 0-CLS SKELETON LOADER ──
  if (isFullyLoading) return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-pulse">
      <div className="h-20 bg-slate-200 rounded-xl w-full"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-slate-200 rounded-2xl"></div>
        <div className="h-64 bg-slate-200 rounded-2xl"></div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20 animate-in fade-in duration-500 transform-gpu">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-b border-emerald-100 pb-6">
        <div>
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Command Center</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Executive Overview</h1>
          <p className="text-slate-500 font-medium mt-1">Full-spectrum academy intelligence for {displayMonthStr}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Re-wired to /finance */}
          <button
            onClick={() => navigate('/finance')}
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <DollarSign size={16} className="text-emerald-600" /> Financials
          </button>

          {/* Re-wired to /students */}
          <button
            onClick={() => navigate('/students')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2"
          >
            <GraduationCap size={16} /> Manage Students
          </button>

          {/* PREMIUM UI FIX: Indigo pulsing live class button */}
          <button
            onClick={handleStartDynamicClass}
            className="relative px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-2 overflow-hidden group"
          >
            <div className="relative flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <Video size={16} /> Start Live Class
            </div>
          </button>
        </div>
      </div>

      {/* ── ROW 1: TOP-LEVEL KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          label="Total Revenue"
          value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Across all recorded payments"
          icon={DollarSign}
          color="emerald"
          trend={4.5}
        />
        <StatCard
          label="Active Students"
          value={active.length}
          sub={`${trial.length} in trial · ${left.length} left`}
          icon={GraduationCap}
          color="indigo"
        />
        <StatCard
          label="Active Teachers"
          value={data.teachers.length}
          sub="Verified ustads on roster"
          icon={Briefcase}
          color="amber"
        />
        <StatCard
          label="Retention Rate"
          value={`${retentionRate}%`}
          sub="Students who stayed enrolled"
          icon={ShieldCheck}
          color="slate"
          trend={retentionRate >= 95 ? 2.1 : -1.5}
        />
      </div>

      {/* ── ROW 2: ATTENDANCE + FEE HEALTH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Attendance Health Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-slate-900">Today's Attendance</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2 text-2xl font-black text-emerald-600">
              {attendanceRate}%
              <Activity size={20} className="text-emerald-500" />
            </div>
          </div>

          <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-6 shadow-inner">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Present', count: presentToday, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
              { label: 'Absent', count: absentToday, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
              { label: 'Late', count: lateToday, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
              { label: 'Not Marked', count: Math.max(0, active.length - totalMarked), bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
            ].map(({ label, count, bg, text, border }) => (
              <div key={label} className={`${bg} border ${border} rounded-xl p-4 text-center transform-gpu hover:scale-105 transition-transform`}>
                <p className={`text-2xl font-black ${text}`}>{count}</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${text}`}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fee Health Card */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <DollarSign size={140} className="text-emerald-400" />
          </div>
          <h3 className="font-black text-white mb-1 relative z-10">Fee Health</h3>
          <p className="text-xs text-emerald-400 mb-6 relative z-10 font-medium tracking-wide uppercase">{displayMonthStr}</p>

          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-slate-400 text-sm font-medium">Active Students</span>
              <span className="font-black text-white">{active.length}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-slate-400 text-sm font-medium">Paid This Month</span>
              <span className="font-black text-emerald-400">{active.length - defaulterCount}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <AlertTriangle size={13} className="text-amber-400" /> Defaulters
              </span>
              <span className={`font-black ${defaulterCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {defaulterCount}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/finance')}
            className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition border border-white/10 relative z-10"
          >
            View Full Ledger <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── ROW 3: RECENT STUDENTS + TEACHER ROSTER ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Students */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <GraduationCap size={16} className="text-emerald-600" /> Recent Enrollments
            </h3>
            <button onClick={() => navigate('/students')} className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 transition-colors">
              View All <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-medium">No students yet.</div>
            ) : (
              recentStudents.map(s => (
                <div key={s.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-black text-sm">
                      {s.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{s.full_name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{s.assigned_teacher || 'Unassigned'} · {s.class_timing || '—'}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${s.status === 'Joined' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : s.status === 'Trial' ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                    {s.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Teacher Roster */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <Briefcase size={16} className="text-emerald-600" /> Teaching Staff
            </h3>
            <button onClick={() => navigate('/staff')} className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 transition-colors">
              Manage <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.teachers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-medium">No teachers registered yet.</div>
            ) : (
              data.teachers.slice(0, 6).map(t => (
                <div key={t.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-inner">
                      {(t.first_name || t.username)?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {t.first_name ? `${t.first_name} ${t.last_name}`.trim() : t.username}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">@{t.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">{t.classes?.length ?? 0} Students</span>
                    <button
                      onClick={() => navigate(`/staff/${t.id}`)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 4: QUICK ACTIONS (FIXED ROUTING BUGS) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Manage Students', icon: GraduationCap, path: '/students', color: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm border border-transparent' },
          { label: 'Manage Staff', icon: Briefcase, path: '/staff', color: 'bg-slate-900 hover:bg-slate-800 text-emerald-400 shadow-sm border border-slate-800' },
          { label: 'Financial Ledger', icon: DollarSign, path: '/finance', color: 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 shadow-sm' },
          { label: 'Admin Console', icon: BarChart3, path: '/admin', color: 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 shadow-sm' },
        ].map(({ label, icon: Icon, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`${color} rounded-2xl p-5 font-bold text-sm flex flex-col items-center gap-3 transition-all duration-300 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98]`}
          >
            <Icon size={22} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}