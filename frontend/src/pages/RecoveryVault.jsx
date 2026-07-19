import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import {
    Database, RefreshCcw, Search, AlertCircle, Loader2,
    Users, BookOpen, FileText, CheckCircle, X, ShieldAlert,
    Clock, ArrowLeft
} from 'lucide-react';

export default function RecoveryVault() {
    const [activeTab, setActiveTab] = useState('students');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Data States
    const [vaultData, setVaultData] = useState({
        students: [],
        assignments: [],
        materials: []
    });

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

        // Determine which endpoint to hit based on the active tab
        const endpoint = activeTab === 'students' ? 'students'
            : activeTab === 'assignments' ? 'assignments'
                : 'materials';

        try {
            await api.post(`${endpoint}/${itemToRestore.id}/restore/`);

            // Remove the item from the local vault state
            setVaultData(prev => ({
                ...prev,
                [activeTab]: prev[activeTab].filter(i => i.id !== itemToRestore.id)
            }));

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
            {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-slate-200 rounded-2xl border border-slate-100"></div>
            ))}
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500 relative transform-gpu">

            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-8 pb-6 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl shadow-lg border border-slate-800">
                            <Database size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Recovery Vault</h1>
                    </div>
                    <p className="text-slate-500 text-sm font-medium flex items-center gap-1.5">
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
                <button
                    onClick={() => { setActiveTab('students'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'students' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Users size={16} /> Students
                    <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] ml-1">{vaultData.students.length}</span>
                </button>
                <button
                    onClick={() => { setActiveTab('assignments'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'assignments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <BookOpen size={16} /> Assignments
                    <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] ml-1">{vaultData.assignments.length}</span>
                </button>
                <button
                    onClick={() => { setActiveTab('materials'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'materials' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FileText size={16} /> Library
                    <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] ml-1">{vaultData.materials.length}</span>
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
                        <button onClick={() => setShowRestoreModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"><X size={20} /></button>
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
}