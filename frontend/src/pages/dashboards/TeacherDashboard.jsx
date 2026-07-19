import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, Users, Clock, CheckCircle, XCircle,
  ChevronRight, BookOpen, RefreshCw, AlertCircle, Video,
  FileText, UploadCloud, Sparkles, ShieldCheck
} from 'lucide-react';
import api from '../../api';

// ── UI THEMING ──
const STATUS_THEMES = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Absent: 'bg-rose-50 text-rose-700 border-rose-200',
  Late: 'bg-amber-50 text-amber-700 border-amber-200',
  Leave: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myStudents, setMyStudents] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);

  // Reliable Date ISO String
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // ── CORE DATA ENGINE (AbortController Protected) ──
  const fetchData = async (signal = null) => {
    if (!signal) setLoading(true); // Don't show full loader on manual refreshes
    setError('');
    try {
      const [stuRes, attRes] = await Promise.all([
        api.get('students/', { signal }),
        api.get(`attendance/?date=${today}`, { signal }),
      ]);

      const allStudents = Array.isArray(stuRes.data) ? stuRes.data : (stuRes.data.results ?? []);
      const allAttendance = Array.isArray(attRes.data) ? attRes.data : (attRes.data.results ?? []);

      // PERFORMANCE AUDIT: Strict filter for active ustad roster
      const mine = allStudents.filter(s =>
        s.assigned_teacher?.toLowerCase() === username.toLowerCase() &&
        s.status !== 'Left'
      );
      setMyStudents(mine);

      const merged = mine.map(s => ({
        ...s,
        todayStatus: allAttendance.find(r => r.student === s.id)?.status ?? null,
      }));
      setTodayAttendance(merged);
    } catch (err) {
      if (err.name !== 'CanceledError') {
        console.error('[Teacher Dashboard Error]', err);
        setError('Database synchronization failed. Check connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    fetchData(abortController.signal);
    return () => abortController.abort();
  }, [username, today]);

  const handleStartClass = () => {
    const roomSlug = `class-${username.toLowerCase().replace(/\s+/g, '-')}`;
    navigate(`/classroom/${roomSlug}`);
  };

  // ── MATH & SCHEDULING LOGIC ──
  const stats = useMemo(() => {
    const joined = myStudents.filter(s => s.status === 'Joined');
    const trial = myStudents.filter(s => s.status === 'Trial');
    const markedCount = todayAttendance.filter(s => s.todayStatus).length;

    // Grouping by time for the schedule view
    const scheduleMap = {};
    joined.forEach(s => {
      const slot = s.class_timing || 'Flexible';
      if (!scheduleMap[slot]) scheduleMap[slot] = [];
      scheduleMap[slot].push(s);
    });

    return {
      joined: joined.length,
      trial: trial.length,
      unmarked: joined.length - markedCount,
      present: todayAttendance.filter(s => s.todayStatus === 'Present').length,
      absent: todayAttendance.filter(s => s.todayStatus === 'Absent').length,
      schedule: Object.entries(scheduleMap).sort(([a], [b]) => a.localeCompare(b))
    };
  }, [myStudents, todayAttendance]);

  // ── 0-CLS SKELETON UI ──
  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-8 animate-pulse pt-6 transform-gpu">
      <div className="h-32 bg-slate-200 rounded-[2rem] w-full" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}
      </div>
      <div className="h-96 bg-slate-200 rounded-[2rem] w-full" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-6 duration-700 transform-gpu">

      {/* ── 1. PREMIUM TEACHER HEADER ── */}
      <div className="relative overflow-hidden p-8 sm:p-10 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
          <Sparkles size={160} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-indigo-500/30">
                Staff Command
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500" /> Authorized Workspace
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-1">Assalamu Alaikum,</h1>
            <h2 className="text-2xl font-bold text-emerald-400 capitalize">Ustad {username}</h2>
          </div>

          <div className="flex flex-wrap gap-4 shrink-0">
            <button
              onClick={() => fetchData()}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors"
            >
              <RefreshCw size={20} className="text-indigo-400" />
            </button>
            <button
              onClick={handleStartClass}
              className="relative group flex items-center justify-center gap-4 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl hover:shadow-indigo-500/20 overflow-hidden"
            >
              <div className="relative flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
                </span>
                <Video size={24} />
                <span>Start Live Class</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 p-5 rounded-[1.5rem] border border-rose-200 font-bold flex items-center gap-3 animate-in shake duration-500">
          <AlertCircle size={24} /> {error}
        </div>
      )}

      {/* ── 2. PERFORMANCE PILLS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: myStudents.length, color: 'text-slate-900', bg: 'bg-white' },
          { label: 'Active Roster', value: stats.joined, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Pending Trials', value: stats.trial, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Today Unmarked', value: Math.max(0, stats.unmarked), color: stats.unmarked > 0 ? 'text-rose-700' : 'text-slate-400', bg: stats.unmarked > 0 ? 'bg-rose-50' : 'bg-slate-50' },
        ].map((p, i) => (
          <div key={i} className={`${p.bg} p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow`}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{p.label}</p>
            <p className={`text-4xl font-black ${p.color}`}>{p.value}</p>
          </div>
        ))}
      </div>

      {/* ── 3. TODAY'S ROLL CALL ── */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden group">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <h3 className="font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <CalendarCheck size={20} className="text-emerald-500" />
            TODAY'S ATTENDANCE SNAPSHOT
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg">{stats.present} Present</span>
            <span className="text-xs font-bold px-3 py-1 bg-rose-100 text-rose-700 rounded-lg">{stats.absent} Absent</span>
            <button
              onClick={() => navigate('/attendance')}
              className="ml-4 flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors active:scale-95"
            >
              Manage All <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {todayAttendance.length === 0 ? (
          <div className="p-24 text-center flex flex-col items-center">
            <div className="h-20 w-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200">
              <Users size={40} />
            </div>
            <p className="text-slate-400 font-bold text-sm">No students assigned to your current schedule.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-4">Student Profile</th>
                  <th className="px-8 py-4">Timing</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayAttendance.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors group/row">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg border border-emerald-200/50 shadow-inner group-hover/row:scale-105 transition-transform">
                          {s.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-base">{s.full_name}</p>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-emerald-500" />
                        {s.class_timing || 'Flex'}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${s.todayStatus ? STATUS_THEMES[s.todayStatus] : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                        {s.todayStatus ?? 'Not Marked'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        onClick={() => navigate('/attendance')}
                        className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest hover:underline"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 4. WORLD-CLASS TOOLKIT (FIXED ROUTES) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Academic Directory', icon: Users, path: '/students', color: 'bg-white border border-slate-200 text-slate-800' },
          { label: 'Upload Materials', icon: UploadCloud, path: '/library', color: 'bg-emerald-700 text-white border border-emerald-800' },
          { label: 'Assignments Hub', icon: FileText, path: '/assignments', color: 'bg-slate-900 text-indigo-400 border border-slate-950 shadow-xl' },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={() => navigate(btn.path)}
            className={`${btn.color} rounded-3xl p-6 font-black text-sm flex items-center justify-center gap-4 transition-all duration-300 hover:-translate-y-1 active:scale-95 shadow-sm hover:shadow-lg`}
          >
            <btn.icon size={22} />
            <span className="uppercase tracking-widest">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* ── 5. SMART SCHEDULE ── */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <Clock size={20} className="text-emerald-500" />
            MY UPCOMING CLASSES
          </h3>
        </div>

        {stats.schedule.length === 0 ? (
          <div className="p-20 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
            No active students assigned to your classes yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.schedule.map(([slot, students]) => (
              <div key={slot} className="flex flex-col sm:flex-row hover:bg-slate-50/50 transition-colors">
                <div className="w-full sm:w-48 p-8 border-b sm:border-b-0 sm:border-r border-slate-100 bg-slate-50/30 flex items-center justify-center">
                  <span className="text-sm font-black text-indigo-600 uppercase tracking-widest">{slot}</span>
                </div>
                <div className="flex-1 p-8">
                  <div className="flex flex-wrap gap-3">
                    {students.map(s => (
                      <span key={s.id} className="px-4 py-2 bg-white border border-slate-200 text-slate-800 shadow-sm text-xs font-bold rounded-2xl hover:border-emerald-400 transition-colors">
                        {s.full_name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}