import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Clock, CalendarCheck, BookOpen,
  CheckCircle, XCircle, AlertCircle, Video,
  FileText, DownloadCloud, ChevronRight, Sparkles,
  MapPin, ShieldCheck
} from 'lucide-react';
import api from '../../api';

// ── UI CONSTANTS ──
const STATUS_THEMES = {
  Present: { cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle },
  Absent: { cls: 'bg-rose-50 text-rose-600 border-rose-100', icon: XCircle },
  Late: { cls: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
  Leave: { cls: 'bg-blue-50 text-blue-600 border-blue-100', icon: BookOpen },
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);

  // ── ARCHITECTURAL FETCH ENGINE ──
  useEffect(() => {
    const abortController = new AbortController();

    const fetchPortalData = async () => {
      setLoading(true);
      setError('');
      try {
        // Parallelized fetch for 0-second wait time
        const [stuRes, attRes] = await Promise.all([
          api.get('students/', { signal: abortController.signal }),
          api.get('attendance/', { signal: abortController.signal }),
        ]);

        const allStudents = Array.isArray(stuRes.data) ? stuRes.data : (stuRes.data.results ?? []);
        const allAttendance = Array.isArray(attRes.data) ? attRes.data : (attRes.data.results ?? []);

        // PRODUCTION AUDIT: Strict identity matching
        const myRecord = allStudents.find(s =>
          s.username === username ||
          s.full_name?.trim().toLowerCase() === username.trim().toLowerCase()
        ) ?? null;

        setProfile(myRecord);

        if (myRecord) {
          const mine = allAttendance
            .filter(r => r.student === myRecord.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
          setRecentAttendance(mine);
        }
      } catch (err) {
        if (err.name !== 'CanceledError') {
          console.error('[Student Portal Error]', err);
          setError('System synchronization failed. Verify connection.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPortalData();
    return () => abortController.abort();
  }, [username]);

  // ── PREMIUM NAVIGATION LOGIC ──
  const handleJoinClass = () => {
    if (!profile?.assigned_teacher) return;
    const roomSlug = `class-${profile.assigned_teacher.toLowerCase().replace(/\s+/g, '-')}`;
    navigate(`/classroom/${roomSlug}`);
  };

  // ── MATH ENGINE: MEMOIZED METRICS ──
  const metrics = useMemo(() => {
    const total = recentAttendance.length;
    const present = recentAttendance.filter(r => r.status === 'Present').length;
    return {
      total,
      pct: total > 0 ? Math.round((present / total) * 100) : 0
    };
  }, [recentAttendance]);

  // ── 0-CLS SKELETON RENDERER ──
  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-8 animate-pulse pt-6 transform-gpu">
      <div className="h-48 bg-slate-200 rounded-[2.5rem] w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 h-44 bg-slate-200 rounded-[2rem]" />
        <div className="h-44 bg-slate-200 rounded-[2rem]" />
      </div>
      <div className="h-64 bg-slate-200 rounded-[2rem]" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-6 duration-700 transform-gpu">

      {/* ── 1. PREMIUM GLASS HEADER ── */}
      <div className="relative overflow-hidden p-8 sm:p-10 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl group">
        <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-700">
          <Sparkles size={160} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-emerald-500/30">
                Active Student
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500" /> Secure Portal
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">Assalamu Alaikum,</h1>
            <h2 className="text-2xl font-bold text-emerald-400/90 capitalize">{username}</h2>
          </div>

          {/* THE NEW WORLD-CLASS LIVE BUTTON */}
          <div className="shrink-0">
            <button
              onClick={handleJoinClass}
              disabled={!profile?.assigned_teacher}
              className="relative w-full sm:w-auto flex items-center justify-center gap-4 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-900 px-10 py-5 rounded-2xl font-black text-xl transition-all active:scale-95 disabled:opacity-20 shadow-xl hover:shadow-emerald-500/20 group overflow-hidden"
            >
              {profile?.assigned_teacher && (
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none group-hover:scale-150 transition-transform duration-700">
                  <Video size={100} />
                </div>
              )}
              <div className="relative flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
                </span>
                <Video size={24} />
                <span>Enter Classroom</span>
              </div>
            </button>
            {!profile?.assigned_teacher && (
              <p className="text-slate-500 text-[10px] font-black uppercase text-center mt-3 tracking-widest animate-pulse">
                Awaiting Teacher Assignment
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 p-5 rounded-[1.5rem] border border-rose-200 font-bold flex items-center gap-3 animate-in shake duration-500">
          <AlertCircle size={24} /> {error}
        </div>
      )}

      {/* ── 2. IDENTITY & ANALYTICS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Core Info Card */}
        <div className="md:col-span-2 bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-6 mb-8 border-b border-slate-100 pb-8">
            <div className="h-20 w-20 rounded-[2rem] bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-3xl shadow-inner border border-emerald-100 group-hover:scale-105 transition-transform">
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{profile?.full_name || username}</h3>
              <div className="flex items-center gap-2 mt-1.5 text-slate-500 font-bold text-sm">
                <MapPin size={14} className="text-slate-300" />
                {profile?.country || 'International'} Student
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Instructor</p>
              <div className="flex items-center gap-3 text-sm font-black text-slate-800">
                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-emerald-600 border border-slate-200">
                  <User size={16} />
                </div>
                {profile?.assigned_teacher ? `Ustad ${profile.assigned_teacher}` : 'TBD'}
              </div>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Class Schedule</p>
              <div className="flex items-center gap-3 text-sm font-black text-slate-800">
                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-emerald-600 border border-slate-200">
                  <Clock size={16} />
                </div>
                {profile?.class_timing || 'Flex Schedule'}
              </div>
            </div>
          </div>
        </div>

        {/* Circular KPI Card */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
          <div className="relative h-28 w-28 mb-4">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100" strokeWidth="3" />
              <circle cx="18" cy="18" r="16" fill="none"
                className="stroke-emerald-500 transition-all duration-1000 ease-out"
                strokeWidth="3"
                strokeDasharray={`${metrics.pct}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-3xl font-black text-slate-900">{metrics.pct}%</span>
            </div>
          </div>
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Consistency Rate</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Last 5 Sessions</p>
        </div>
      </div>

      {/* ── 3. WORLD-CLASS TOOLKIT ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/assignments')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-[1.5rem] hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/5 transition-all transform-gpu hover:-translate-y-1"
        >
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
              <FileText size={28} />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-900 text-lg">My Assignments</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Homework & Feedback</p>
            </div>
          </div>
          <ChevronRight size={24} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/library')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-[1.5rem] hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/5 transition-all transform-gpu hover:-translate-y-1"
        >
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
              <DownloadCloud size={28} />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-900 text-lg">Resource Vault</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Study Materials & PDFs</p>
            </div>
          </div>
          <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
        </button>
      </div>

      {/* ── 4. MODERN SESSION LOG ── */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight">
            <CalendarCheck size={20} className="text-emerald-500" />
            Attendance History
          </h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing latest 5 sessions</span>
        </div>

        {recentAttendance.length === 0 ? (
          <div className="p-24 text-center flex flex-col items-center">
            <div className="h-20 w-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200">
              <CalendarCheck size={40} />
            </div>
            <p className="text-slate-400 font-bold text-sm">Waiting for your first session attendance...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentAttendance.map(record => {
              const theme = STATUS_THEMES[record.status] || { cls: 'bg-slate-50 text-slate-400', icon: AlertCircle };
              const StatusIcon = theme.icon;
              return (
                <div key={record.id} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-5">
                    <div className={`p-3 rounded-xl border ${theme.cls} group-hover:scale-110 transition-transform`}>
                      <StatusIcon size={18} />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900">
                        {new Date(record.date).toLocaleDateString(undefined, {
                          weekday: 'long', month: 'short', day: 'numeric'
                        })}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Session recorded at 10:00 AM</p>
                    </div>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm ${theme.cls}`}>
                    {record.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}