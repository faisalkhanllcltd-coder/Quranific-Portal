import useDocumentTitle from '../hooks/useDocumentTitle';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
    ShieldCheck, Eye, FileEdit, CalendarCheck, UserCog,
    Database, ShieldAlert, Shield, Search, ArrowRight,
    ServerCrash, Activity, Lock, Clock, RefreshCw, Loader2,
    UserCheck, Trash2, Key, Download, X, Terminal, AlertTriangle,
    RefreshCcw, Users, BookOpen, FileText, CheckCircle
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// 1. OVERVIEW TAB (Formerly AdminConsole)
// ─────────────────────────────────────────────────────────────────────────────
const AdminOverview = ({ setActiveTab, navigate }) => {
    const [studentSearch, setStudentSearch] = useState('');

    const handleStudentSearch = (e) => {
        e.preventDefault();
        if (studentSearch.trim()) navigate('/students');
    };

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-500 transform-gpu">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-gradient-to-br from-slate-800 to-slate-900 text-emerald-400 rounded-2xl shadow-lg shadow-slate-900/20 border border-slate-700">
                            <ShieldCheck size={28} />
                        </div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Command Center</h1>
                    </div>
                    <p className="text-slate-600 text-sm font-medium flex items-center gap-2">
                        <ShieldAlert size={16} className="text-rose-500" />
                        Warning: Actions taken here bypass standard permissions. Use with absolute caution.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                {/* Watchtower */}
                <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="h-14 w-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                <Eye size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Logs</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Audit Trail</p>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
                            Access the immutable Audit Trail. Filter and review exact timestamps of all staff actions and data modifications.
                        </p>
                    </div>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Activity size={18} /> Open System Logs
                    </button>
                </div>

                {/* Overrides */}
                <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="h-14 w-14 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform border border-emerald-400/20">
                                <FileEdit size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Admin Overrides</h2>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Manual Data Correction</p>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
                            Reverse staff errors. You possess the clearance to edit or overwrite any data record across the platform instantly.
                        </p>
                        <div className="space-y-3 mb-8">
                            <button onClick={() => navigate('/assignments')} className="w-full flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left">
                                <div className="flex items-center gap-3">
                                    <FileEdit size={18} className="text-slate-400" />
                                    <span className="text-sm font-bold text-slate-700">Correct Grades & Assignments</span>
                                </div>
                                <ArrowRight size={16} className="text-slate-400" />
                            </button>
                            <button onClick={() => navigate('/attendance')} className="w-full flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left">
                                <div className="flex items-center gap-3">
                                    <CalendarCheck size={18} className="text-slate-400" />
                                    <span className="text-sm font-bold text-slate-700">Fix Attendance Records</span>
                                </div>
                                <ArrowRight size={16} className="text-slate-400" />
                            </button>
                        </div>
                    </div>
                    <form onSubmit={handleStudentSearch} className="relative">
                        <input type="text" placeholder="Find student to overwrite credentials..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner placeholder:text-slate-400" />
                        <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                        <button type="submit" className="absolute right-2 top-2 p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label="Search student to overwrite">
                            <UserCog size={16} />
                        </button>
                    </form>
                </div>

                {/* Recovery Vault */}
                <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden border border-slate-800 flex flex-col justify-between group">
                    <div className="absolute right-0 top-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                        <ServerCrash size={180} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className="h-14 w-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                                <Database size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Recovery Vault</h2>
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-1">Soft-Deleted Records</p>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-400 leading-relaxed mb-6 relative z-10">
                            If data is accidentally deleted from the main interface, it is held securely here. Review and restore missing records.
                        </p>
                    </div>
                    <button
                        onClick={() => setActiveTab('vault')}
                        className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2 relative z-10"
                    >
                        <Database size={18} /> Open Recovery Vault
                    </button>
                </div>

                {/* Access Control */}
                <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="h-14 w-14 bg-white border border-slate-200 text-slate-700 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Access Control</h2>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Account Permissions</p>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
                            Manage system access. Escalate staff privileges, demote accounts, or initiate global lockouts if necessary.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/settings')}
                        className="w-full py-3.5 bg-white border-2 border-slate-200 hover:border-slate-900 text-slate-800 rounded-xl text-sm font-black uppercase tracking-widest transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Lock size={18} /> Manage Permissions
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. SYSTEM LOGS TAB
// ─────────────────────────────────────────────────────────────────────────────
const SystemLogsView = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        const abortController = new AbortController();
        fetchLogs(false, abortController);
        return () => abortController.abort();
    }, []);

    const fetchLogs = async (silent = false, controller = null) => {
        if (!silent) setLoading(true);
        else setIsRefreshing(true);
        try {
            const config = controller ? { signal: controller.signal } : {};
            const res = await api.get('logs/', config).catch(() => ({ data: [] }));
            setLogs(Array.isArray(res.data) ? res.data : (res.data.results || []));
        } catch (err) {
            if (err.name !== 'CanceledError') console.error("Audit Sync Error:", err);
        }
        finally { setLoading(false); setIsRefreshing(false); }
    };

    const exportToCSV = () => {
        if (logs.length === 0) return;
        const headers = ["Timestamp", "Action", "Details", "User ID"];
        const csvContent = [
            headers.join(","),
            ...filteredLogs.map(log => `"${new Date(log.timestamp).toISOString()}","${log.action}","${log.details.replace(/"/g, '""')}","${log.user_id || 'System'}"`)
        ].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Quranific_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const getActionTheme = (action) => {
        const act = action?.toLowerCase() || '';
        if (act.includes('delete') || act.includes('remove')) return { color: 'text-rose-600 bg-rose-50 border-rose-200', icon: <Trash2 size={12} /> };
        if (act.includes('login') || act.includes('security')) return { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: <Key size={12} /> };
        if (act.includes('attendance') || act.includes('mark')) return { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: <UserCheck size={12} /> };
        return { color: 'text-slate-600 bg-slate-50 border-slate-200', icon: <Activity size={12} /> };
    };

    const filteredLogs = useMemo(() => logs.filter(log => (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) || (log.details || '').toLowerCase().includes(searchTerm.toLowerCase())), [logs, searchTerm]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4 animate-in fade-in transform-gpu">
            <Loader2 className="h-10 w-10 text-slate-900 animate-spin" />
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Decrypting Audit Trail...</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transform-gpu">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Audit Log</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Immutable record of every administrative action.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-72">
                        <Search className="absolute left-3.5 top-2.5 text-slate-400" size={18} />
                        <input type="text" placeholder="Search actions or details..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={exportToCSV} className="p-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 rounded-lg shadow-sm shrink-0 flex items-center gap-2 transition-colors"><Download size={18} /><span className="hidden sm:inline text-sm font-bold">Export</span></button>
                    <button onClick={() => fetchLogs(true)} disabled={isRefreshing} className="p-2.5 bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 rounded-lg shadow-sm shrink-0 disabled:opacity-50 transition-colors">{isRefreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Events</p>
                    <p className="text-3xl font-black text-slate-900">{logs.length}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><ShieldAlert size={12} /> High Severity</p>
                    <p className="text-3xl font-black text-rose-600">{logs.filter(l => l.action?.toLowerCase().includes('delete')).length}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="px-6 py-4 w-56">Exact Timestamp</th>
                                <th className="px-6 py-4 w-48">Action Event</th>
                                <th className="px-6 py-4 text-left">Detailed Activity Description</th>
                                <th className="px-6 py-4 text-right">Inspect</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                            {filteredLogs.length === 0 ? (
                                <tr><td colSpan="4" className="p-24 text-center text-slate-500 font-bold text-sm">No matching records found.</td></tr>
                            ) : (
                                filteredLogs.map((log) => {
                                    const theme = getActionTheme(log.action);
                                    return (
                                        <tr key={log.id} onClick={() => setSelectedLog(log)} className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
                                            <td className="px-6 py-4"><div className="flex items-center gap-2.5"><Clock size={14} className="text-slate-400" /><span className="text-slate-700 text-xs font-mono font-bold uppercase">{new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div></td>
                                            <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${theme.color}`}>{theme.icon}{log.action}</span></td>
                                            <td className="px-6 py-4"><div className="text-slate-900 text-sm font-semibold leading-relaxed truncate max-w-md">{log.details}</div></td>
                                            <td className="px-6 py-4 text-right"><button className="p-2 text-slate-400 group-hover:text-emerald-600 transition-colors bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label="Inspect log details"><Eye size={16} /></button></td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full shadow-sm"><ShieldAlert size={14} className="text-slate-400" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Logs are tamper-evident and cryptographically sealed</span></div>
            </div>

            {selectedLog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-0 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="bg-slate-900 p-6 flex items-center gap-3">
                            <Terminal size={20} className="text-emerald-400" />
                            <h2 className="text-lg font-black text-white tracking-widest uppercase">Forensic Inspector</h2>
                            <button onClick={() => setSelectedLog(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg" aria-label="Close Inspector"><X size={20} /></button>
                        </div>
                        <div className="p-6 bg-[#0f172a] text-emerald-400 font-mono text-sm space-y-4">
                            <div><span className="text-slate-500 text-xs font-bold uppercase tracking-widest block mb-1">Event ID</span><span className="text-white bg-white/10 px-2 py-0.5 rounded">#{selectedLog.id}</span></div>
                            <div><span className="text-slate-500 text-xs font-bold uppercase tracking-widest block mb-1">Timestamp</span><span className="text-white">{new Date(selectedLog.timestamp).toISOString()}</span></div>
                            <div><span className="text-slate-500 text-xs font-bold uppercase tracking-widest block mb-1">Action</span><span className="px-2 py-0.5 rounded text-white bg-emerald-600">{selectedLog.action.toUpperCase()}</span></div>
                            <div><span className="text-slate-500 text-xs font-bold uppercase tracking-widest block mb-1">Raw Payload Details</span><div className="bg-black/50 p-3 rounded-lg border border-white/10 whitespace-pre-wrap text-slate-300">{selectedLog.details}</div></div>
                        </div>
                        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
                            <button onClick={() => setSelectedLog(null)} className="px-6 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">Close Inspector</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECOVERY VAULT TAB (Fully Integrated)
// ─────────────────────────────────────────────────────────────────────────────
const RecoveryVaultView = () => {
    const [activeTab, setActiveTab] = useState('students');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Data States
    const [vaultData, setVaultData] = useState({ students: [], assignments: [], materials: [] });

    // Action States
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [itemToRestore, setItemToRestore] = useState(null);
    const [restoreProcessing, setRestoreProcessing] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // ── FETCH DATA (Memory Leak Protected) ──
    useEffect(() => {
        const abortController = new AbortController();

        const fetchVault = async () => {
            setLoading(true);
            setError('');
            try {
                const [studentsRes, assignmentsRes, materialsRes] = await Promise.all([
                    api.get('students/vault/', { signal: abortController.signal }),
                    api.get('assignments/vault/', { signal: abortController.signal }),
                    api.get('materials/vault/', { signal: abortController.signal })
                ]);

                setVaultData({
                    students: Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes.data.results || []),
                    assignments: Array.isArray(assignmentsRes.data) ? assignmentsRes.data : (assignmentsRes.data.results || []),
                    materials: Array.isArray(materialsRes.data) ? materialsRes.data : (materialsRes.data.results || [])
                });
            } catch (err) {
                if (err.name !== 'CanceledError') {
                    setError('Failed to securely access the Recovery Vault. Check your network.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchVault();
        return () => abortController.abort();
    }, []);

    // ── HANDLERS ──
    const triggerRestore = (item) => {
        setItemToRestore(item);
        setShowRestoreModal(true);
    };

    const executeRestore = async () => {
        if (!itemToRestore) return;
        setRestoreProcessing(true);

        const endpoint = activeTab === 'students' ? 'students' : activeTab === 'assignments' ? 'assignments' : 'materials';

        try {
            await api.post(`${endpoint}/${itemToRestore.id}/restore/`);
            setVaultData(prev => ({ ...prev, [activeTab]: prev[activeTab].filter(i => i.id !== itemToRestore.id) }));
            setSuccessMsg(`Successfully restored the record.`);
            setTimeout(() => setSuccessMsg(''), 4000);
            setShowRestoreModal(false);
        } catch (err) {
            setError("Failed to restore the item. It may have been permanently purged.");
        } finally {
            setRestoreProcessing(false);
            setItemToRestore(null);
        }
    };

    // ── MEMOIZED FILTERING ──
    const filteredData = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const currentList = vaultData[activeTab] || [];
        return currentList.filter(item => {
            const mainText = (item.full_name || item.title || '').toLowerCase();
            return mainText.includes(term);
        });
    }, [vaultData, activeTab, searchTerm]);

    // ── RENDER HELPERS ──
    const renderSkeleton = () => (
        <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-200 rounded-2xl border border-slate-100"></div>)}
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 transform-gpu">

            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recovery Vault</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1 flex items-center gap-1.5">
                        <ShieldAlert size={14} className="text-amber-500" />
                        Soft-deleted records are retained here for 30 days before permanent erasure.
                    </p>
                </div>

                <div className="relative group w-full sm:w-72 shrink-0">
                    <Search className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder={`Search deleted ${activeTab}...`}
                        className="pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 ring-emerald-500/20 w-full transition-shadow shadow-sm text-sm"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        value={searchTerm}
                    />
                </div>
            </div>

            {/* ── ALERTS ── */}
            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 font-bold animate-in slide-in-from-top-2">
                    <AlertCircle size={20} className="shrink-0" /> {error}
                </div>
            )}
            {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700 font-bold animate-in slide-in-from-top-2">
                    <CheckCircle size={20} className="shrink-0" /> {successMsg}
                </div>
            )}

            {/* ── TABS ── */}
            <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-xl w-fit border border-slate-200">
                <button onClick={() => { setActiveTab('students'); setSearchTerm(''); }} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'students' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Users size={16} /> Students <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] ml-1">{vaultData.students.length}</span>
                </button>
                <button onClick={() => { setActiveTab('assignments'); setSearchTerm(''); }} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'assignments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <BookOpen size={16} /> Assignments <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] ml-1">{vaultData.assignments.length}</span>
                </button>
                <button onClick={() => { setActiveTab('materials'); setSearchTerm(''); }} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'materials' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <FileText size={16} /> Library <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] ml-1">{vaultData.materials.length}</span>
                </button>
            </div>

            {/* ── VAULT LIST ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-6">{renderSkeleton()}</div>
                ) : filteredData.length === 0 ? (
                    <div className="p-24 text-center flex flex-col items-center bg-slate-50">
                        <div className="h-20 w-20 bg-white border border-slate-200 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <Database size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Vault is Empty</h3>
                        <p className="text-slate-500 max-w-sm mt-2 text-sm font-medium">
                            No deleted {activeTab} match your criteria. The system is clean.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                    <th className="px-6 py-4">Record Details</th>
                                    <th className="px-6 py-4 hidden sm:table-cell">Deleted At</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-400 shadow-sm text-lg">
                                                    {(item.full_name || item.title || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                                        {item.full_name || item.title}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-bold tracking-wider mt-0.5 uppercase">
                                                        ID: #{item.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden sm:table-cell">
                                            <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-md w-fit border border-slate-200">
                                                <Clock size={12} className="text-slate-500" />
                                                {new Date(item.deleted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => triggerRestore(item)}
                                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors active:scale-95"
                                            >
                                                <RefreshCcw size={14} /> Restore
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── RESTORE MODAL ── */}
            {showRestoreModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
                        <button onClick={() => setShowRestoreModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg" aria-label="Close restore modal"><X size={20} /></button>
                        <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                            <RefreshCcw size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Restore Record?</h2>
                        <p className="text-sm text-slate-500 mb-6">
                            You are about to restore <strong>{itemToRestore?.full_name || itemToRestore?.title}</strong>. It will immediately reappear in the main system for all relevant users.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowRestoreModal(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button onClick={executeRestore} disabled={restoreProcessing} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {restoreProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Restore'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// ─────────────────────────────────────────────────────────────────────────────
// MASTER HUB EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminHub() {
  useDocumentTitle('Admin Hub');
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    return (
        // SECURITY/PERFORMANCE FIX: Replaced expensive CPU radial gradients with a solid bg-slate-50 background. Zero CLS. Zero repaint lag.
        <div className="min-h-screen relative overflow-hidden bg-slate-50 font-sans selection:bg-emerald-200 selection:text-emerald-900 pb-24">
            <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-8">

                {/* Master Tab Navigation */}
                <div className="max-w-md mx-auto mb-10 bg-white/80 backdrop-blur-xl p-1.5 rounded-full border border-slate-200 shadow-sm flex items-center justify-between font-bold text-sm">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-2.5 rounded-full transition-all duration-300 ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Console
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex-1 py-2.5 rounded-full transition-all duration-300 ${activeTab === 'logs' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Audit Logs
                    </button>
                    <button
                        onClick={() => setActiveTab('vault')}
                        className={`flex-1 py-2.5 rounded-full transition-all duration-300 ${activeTab === 'vault' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Vault
                    </button>
                </div>

                {/* Tab Content Renderer */}
                {activeTab === 'overview' && <AdminOverview setActiveTab={setActiveTab} navigate={navigate} />}
                {activeTab === 'logs' && <SystemLogsView />}
                {activeTab === 'vault' && <RecoveryVaultView />}

            </div>
        </div>
    );
}