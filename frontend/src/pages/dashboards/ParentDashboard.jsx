import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, User, Video, CalendarCheck, BookOpen,
    DollarSign, Activity, AlertCircle, ChevronRight,
    Clock, CheckCircle, ShieldCheck
} from 'lucide-react';
import api from '../../api';

export default function ParentDashboard() {
    const navigate = useNavigate();
    const username = localStorage.getItem('username') || 'Parent';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [children, setChildren] = useState([]);
    const [activeChildId, setActiveChildId] = useState(null);

    // ── MEMORY LEAK FIX: AbortController injected ──
    useEffect(() => {
        const abortController = new AbortController();

        const fetchFamilyData = async () => {
            setLoading(true);
            setError('');
            try {
                // Phase 2 Magic: Strictly returns ONLY the students linked to this parent.
                const res = await api.get('students/', { signal: abortController.signal });
                const kids = Array.isArray(res.data) ? res.data : (res.data.results ?? []);

                setChildren(kids);
                if (kids.length > 0) {
                    setActiveChildId(kids[0].id);
                }
            } catch (err) {
                if (err.name !== 'CanceledError') {
                    console.error('Family data fetch error:', err);
                    setError('Cannot connect to the server. Please check your connection.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchFamilyData();

        return () => abortController.abort();
    }, []);

    const activeChild = children.find(c => c.id === activeChildId);

    const handleJoinClass = () => {
        if (!activeChild?.assigned_teacher) return;
        // Mathematically syncs with the Teacher's generated room string
        const teacherRoom = `class-${activeChild.assigned_teacher.toLowerCase()}`;
        navigate(`/classroom/${teacherRoom}`);
    };

    // ── 0-CLS SKELETON LOADER ──
    if (loading) {
        return (
            <div className="max-w-6xl mx-auto space-y-8 animate-pulse transform-gpu">
                <div className="h-20 bg-slate-200 rounded-xl w-3/4 mb-10"></div>
                <div className="h-48 bg-slate-200 rounded-3xl w-full"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-200 rounded-3xl"></div>)}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl border border-rose-200 font-bold flex flex-col items-center justify-center h-[40vh] gap-3">
                <AlertCircle size={32} />
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition-colors">
                    Retry Connection
                </button>
            </div>
        );
    }

    if (children.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-lg mx-auto animate-in fade-in duration-500">
                <div className="h-24 w-24 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Users size={48} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">No Children Linked</h2>
                <p className="text-slate-500 mb-8 font-medium">
                    Your parent account is active, but no student profiles have been linked to you yet. Please contact the academy administration to bind your children to this account.
                </p>
            </div>
        );
    }

    // --- Derived Metrics for the Active Child ---
    const attHistory = activeChild?.attendance_history || [];
    const presentCount = attHistory.filter(a => a.status === 'Present').length;
    const attRate = attHistory.length > 0 ? Math.round((presentCount / attHistory.length) * 100) : 0;

    const assignments = activeChild?.assignments || [];
    const completedAssignments = assignments.filter(a => a.submissions && a.submissions.length > 0).length;
    const pendingAssignments = assignments.length - completedAssignments;

    const payments = activeChild?.payment_history || [];
    const sortedPayments = [...payments].sort((a, b) => new Date(b.date_paid) - new Date(a.date_paid));
    const lastPayment = sortedPayments.length > 0 ? sortedPayments[0] : null;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500 transform-gpu">

            {/* ── HEADER & CHILD SWITCHER ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4 border-b border-slate-200 pb-6">
                <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Family Portal</p>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Student Progress</h1>
                    <p className="text-slate-500 font-medium mt-1">Managing records for {children.length} enrolled {children.length === 1 ? 'student' : 'students'}.</p>
                </div>

                {/* The Core Multi-Tenant Context Switcher */}
                {children.length > 1 && (
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto custom-scrollbar">
                        {children.map(child => (
                            <button
                                key={child.id}
                                onClick={() => setActiveChildId(child.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeChildId === child.id
                                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50 ring-1 ring-emerald-500/20'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <User size={16} className={activeChildId === child.id ? 'text-emerald-500' : 'text-slate-400'} />
                                {child.full_name.split(' ')[0]} {/* First name only for tabs */}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── ACTIVE CHILD DASHBOARD ── */}
            {activeChild && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">

                    {/* Main Context Card */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500" />

                        <div className="h-24 w-24 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-black text-3xl shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                            {activeChild.full_name.charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{activeChild.full_name}</h2>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wide border border-slate-200">
                                    {activeChild.status}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                                    <User size={16} className="text-slate-400" /> Ustad {activeChild.assigned_teacher || 'Pending'}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                                    <Clock size={16} className="text-slate-400" /> {activeChild.class_timing || 'Unscheduled'}
                                </span>
                            </div>
                        </div>

                        {/* PREMIUM UI FIX: Animated Pulsing Live Class Button */}
                        <div className="w-full md:w-auto shrink-0">
                            <button
                                onClick={handleJoinClass}
                                disabled={!activeChild.assigned_teacher}
                                className="w-full md:w-auto relative flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
                            >
                                {activeChild.assigned_teacher && (
                                    <span className="absolute flex h-3 w-3 top-3 right-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                    </span>
                                )}
                                <Video size={20} className={activeChild.assigned_teacher ? "group-hover:scale-110 transition-transform" : ""} />
                                Join Live Class
                            </button>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Attendance Metric */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                                    <CalendarCheck size={24} />
                                </div>
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 uppercase tracking-widest border border-emerald-100">
                                    {attHistory.length} Sessions
                                </span>
                            </div>
                            <p className="text-sm font-bold text-slate-500 mb-1">Attendance Rate</p>
                            <p className="text-4xl font-black text-slate-900">{attRate}%</p>

                            <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${attRate}%` }} />
                            </div>
                        </div>

                        {/* Assignments Metric */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                                    <BookOpen size={24} />
                                </div>
                            </div>
                            <p className="text-sm font-bold text-slate-500 mb-1">Pending Assignments</p>
                            <p className="text-4xl font-black text-slate-900">{pendingAssignments}</p>
                            <p className="text-xs font-semibold text-slate-400 mt-4 flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-emerald-500" /> {completedAssignments} tasks completed
                            </p>
                        </div>

                        {/* Financial Health Metric */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 flex flex-col justify-between">
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-200">
                                        <DollarSign size={24} />
                                    </div>
                                    {lastPayment && (
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${lastPayment.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                            }`}>
                                            {lastPayment.status}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-slate-500 mb-1">Last Payment</p>
                                <p className="text-3xl font-black text-slate-900">
                                    {lastPayment ? `$${parseFloat(lastPayment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                </p>
                            </div>
                            <div className="mt-4 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                <ShieldCheck size={14} className="text-slate-400" />
                                {lastPayment ? `Recorded on ${new Date(lastPayment.date_paid).toLocaleDateString()}` : 'No payment history'}
                            </div>
                        </div>

                    </div>

                    {/* Quick Action Bar (FIXED ROUTING) */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => navigate('/assignments')}
                            className="py-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 shadow-sm hover:shadow flex items-center justify-center gap-2"
                        >
                            View Full Academic Record <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => navigate('/finance')}
                            className="py-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 shadow-sm hover:shadow flex items-center justify-center gap-2"
                        >
                            View Unified Billing Ledger <ChevronRight size={16} />
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
}