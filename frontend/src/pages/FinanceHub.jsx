import useDocumentTitle from '../hooks/useDocumentTitle';
import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import {
  DollarSign, TrendingUp, AlertCircle, CheckCircle,
  Plus, Search, Clock, Calendar, CreditCard,
  MessageCircle, Loader2, X, AlertTriangle, User,
  Users, Calculator, ArrowRight, Wallet, ShieldCheck, Info
} from 'lucide-react';
import { useStudents } from '../hooks/useStudents';

// --- HELPER: Bulletproof Month Formatting ---
const getCurrentMonthValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthDisplay = (dateString) => {
  if (!dateString) return 'Unknown';
  const parts = dateString.split('-');
  if (parts.length !== 2) return dateString;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(year) || isNaN(month)) return dateString;

  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. FINANCIAL LEDGER SUB-VIEW
// ─────────────────────────────────────────────────────────────────────────────
const FinancialLedgerView = () => {
  const { data: studentsData, isLoading: isLoadingStudents } = useStudents();
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Role Access Control
  const userType = (localStorage.getItem('user_type') || 'student').toLowerCase();
  const isAdmin = ['owner', 'head_manager', 'manager'].includes(userType);

  // Modal & Tab State
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Submission State
  const [submitProcessing, setSubmitProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [newPayment, setNewPayment] = useState({
    student: '',
    amount: '',
    month_paid_for: getCurrentMonthValue(),
    method: 'Bank Transfer',
    status: 'Paid'
  });

  // MEMORY LEAK FIX: Added AbortController to cleanly cancel fetches on unmount
  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      try {
        const payRes = await api.get('payments/', { signal: abortController.signal });
        setPayments(Array.isArray(payRes.data) ? payRes.data : (payRes.data.results || []));
      } catch (err) {
        if (err.name !== 'CanceledError') {
          console.error('Failed to load financials', err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => abortController.abort();
  }, []);

  useEffect(() => {
    if (studentsData) {
      setStudents(studentsData.filter(s => s.status === 'Joined' || s.status === 'Trial'));
    }
  }, [studentsData]);

  const getStudentName = (studentId) => {
    const s = students.find(x => x.id === parseInt(studentId, 10));
    return s ? s.full_name : `Student #${studentId}`;
  };

  const handleLogPayment = async (e) => {
    e.preventDefault();
    if (!isAdmin) return; // Hard UI block

    setSubmitProcessing(true);
    setErrorMsg('');

    try {
      const res = await api.post('payments/', newPayment);
      setPayments([res.data, ...payments]);
      setShowAddModal(false);
      setNewPayment({
        student: '',
        amount: '',
        month_paid_for: getCurrentMonthValue(),
        method: 'Bank Transfer',
        status: 'Paid'
      });
    } catch (err) {
      console.error("Payment error:", err);
      const detail = err.response?.data;
      if (detail && typeof detail === 'object') {
        const firstKey = Object.keys(detail)[0];
        const msg = Array.isArray(detail[firstKey]) ? detail[firstKey][0] : detail[firstKey];
        setErrorMsg(`${firstKey.replace('_', ' ').toUpperCase()}: ${msg}`);
      } else {
        setErrorMsg('Failed to log payment. Please verify the details.');
      }
    } finally {
      setSubmitProcessing(false);
    }
  };

  const currentStrictMonth = getCurrentMonthValue();

  // EDGE OPTIMIZATION: Memoize heavy filtering logic
  const { paidStudentIds, defaulters, totalRevenue, pendingRevenue, filteredPayments } = useMemo(() => {
    const paidIds = payments
      .filter(p => p.month_paid_for === currentStrictMonth && p.status === 'Paid')
      .map(p => parseInt(p.student, 10));

    const defs = students.filter(s => !paidIds.includes(s.id));
    const rev = payments.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

    // A-P3-02 FIX: Replace hardcoded $50/student with real per-student expected fee.
    // Strategy: use the last known paid amount for each defaulter as their expected fee.
    // The payments array is sorted by date_paid desc (API order), so the first entry
    // for each student is already their most recent payment — no re-sorting needed.
    // If a student has never paid we genuinely don't know their fee; use 0 rather
    // than inventing a number. pendingRevenue is now the sum of real expected amounts.
    const lastPaidAmountById = {};
    for (const p of payments) {
      const sid = parseInt(p.student, 10);
      if (p.status === 'Paid' && !(sid in lastPaidAmountById)) {
        lastPaidAmountById[sid] = parseFloat(p.amount || 0);
      }
    }
    const pendRev = defs.reduce((acc, s) => acc + (lastPaidAmountById[s.id] ?? 0), 0);

    const search = searchTerm.toLowerCase();
    const filtered = payments.filter(p => {
      const studentName = getStudentName(p.student).toLowerCase();
      const formattedMonth = formatMonthDisplay(p.month_paid_for).toLowerCase();
      return studentName.includes(search) || formattedMonth.includes(search);
    });

    return { paidStudentIds: paidIds, defaulters: defs, totalRevenue: rev, pendingRevenue: pendRev, filteredPayments: filtered };
  }, [payments, students, currentStrictMonth, searchTerm]);


  const isFullyLoading = loading || isLoadingStudents;

  if (isFullyLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* 0-CLS Header Skeleton */}
        <div className="flex justify-between items-end pb-4 border-b border-slate-200">
          <div className="space-y-2"><div className="h-8 w-64 bg-slate-200 rounded-lg"></div><div className="h-4 w-96 bg-slate-100 rounded-lg"></div></div>
          {isAdmin && <div className="h-10 w-36 bg-slate-200 rounded-lg"></div>}
        </div>
        {/* 0-CLS Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-slate-100 rounded-2xl"></div>
          <div className="h-40 bg-slate-200 rounded-2xl"></div>
          <div className="h-40 bg-slate-100 rounded-2xl"></div>
        </div>
        {/* 0-CLS Table Skeleton */}
        <div className="h-64 bg-slate-50 rounded-2xl border border-slate-100"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transform-gpu">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {isAdmin ? 'Financial Ledger' : 'Family Billing'}
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            {isAdmin ? 'Manage cash flow, log student fees, and track pending dues.' : 'Review your payment history and outstanding invoices.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Record Payment
          </button>
        )}
      </div>

      {/* ── STATS DASHBOARD ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" /> {isAdmin ? 'Total Collected' : 'Total Paid'}
          </p>
          <div className="flex items-baseline gap-1 my-2">
            <span className="text-slate-400 text-2xl font-bold">$</span>
            <h3 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-500">
            {isAdmin ? 'Lifetime global income recorded' : 'Lifetime payments made by your family'}
          </div>
        </div>

        <div className={`p-6 sm:p-8 rounded-2xl text-white shadow-lg relative overflow-hidden group flex flex-col justify-between border ${isAdmin ? 'bg-slate-900 border-slate-800' : 'bg-emerald-900 border-emerald-800'}`}>
          <div className="absolute -right-6 -top-6 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
            <DollarSign size={160} />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
            <Clock size={16} className="text-emerald-400" /> {isAdmin ? 'Expected Total' : 'Pending Family Dues'}
          </p>
          <div className="flex items-baseline gap-1 my-2 relative z-10">
            <span className="text-slate-500 text-2xl font-bold">$</span>
            <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              {isAdmin
                ? (totalRevenue + pendingRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : pendingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              }
            </h3>
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-400 relative z-10">
            {isAdmin ? 'Based on last known fees per defaulter' : `Pending for ${formatMonthDisplay(currentStrictMonth)}`}
          </div>
        </div>

        <div className={`p-6 sm:p-8 rounded-2xl border transition-colors flex flex-col justify-between shadow-sm ${defaulters.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${defaulters.length > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
            {defaulters.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} className="text-emerald-500" />}
            {isAdmin ? 'Pending Defaulters' : 'Unpaid Children'}
          </p>
          <h3 className={`text-4xl sm:text-5xl font-black tracking-tight my-2 ${defaulters.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {defaulters.length} <span className="text-2xl font-bold text-slate-400 tracking-normal">Students</span>
          </h3>
          <div className="mt-2 text-xs font-semibold">
            {defaulters.length > 0 ? (
              <span className="text-rose-600 animate-pulse">Unpaid fees detected for this month</span>
            ) : (
              <span className="text-emerald-600">All accounts are currently settled.</span>
            )}
          </div>
        </div>
      </div>

      {/* ── TABS & SEARCH ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pt-4">
        <div className="flex gap-6">
          <button onClick={() => setActiveTab('all')} className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'all' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
            Transaction History
            {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-t-full" />}
          </button>
          <button onClick={() => setActiveTab('defaulters')} className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'defaulters' ? 'text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>
            {isAdmin ? 'Defaulters List' : 'Pending Invoices'}
            {defaulters.length > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'defaulters' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{defaulters.length}</span>}
            {activeTab === 'defaulters' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-600 rounded-t-full" />}
          </button>
        </div>
        {activeTab === 'all' && (
          <div className="relative w-full sm:w-72 mb-2 sm:mb-0">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input type="text" placeholder="Search by name or month..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        )}
      </div>

      {/* ── DATA VIEWS ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transform-gpu">
        {activeTab === 'all' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Billing Period</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4 text-right">Date Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-500 text-sm"><div className="flex flex-col items-center gap-2"><CreditCard size={32} className="text-slate-300" /><p>No transaction records found.</p></div></td></tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{getStudentName(p.student)}</td>
                      <td className="px-6 py-4 text-slate-600 text-sm font-medium">{formatMonthDisplay(p.month_paid_for)}</td>
                      <td className="px-6 py-4 font-mono font-black text-emerald-600">${parseFloat(p.amount).toFixed(2)}</td>
                      <td className="px-6 py-4"><span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200">{p.method}</span></td>
                      <td className="px-6 py-4 text-right text-slate-500 text-xs font-semibold">{new Date(p.date_paid).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'defaulters' && (
          <div className="p-6 sm:p-8 bg-slate-50/50">
            {defaulters.length === 0 ? (
              <div className="py-16 text-center text-emerald-600 font-bold flex flex-col items-center gap-3">
                <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle size={32} />
                </div>
                <h3 className="text-xl text-slate-900">Zero Pending Invoices</h3>
                <p className="text-slate-500 text-sm font-medium">All accounts are fully paid for the current billing cycle.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {defaulters.map(s => (
                  <div key={s.id} className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="h-12 w-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xl border border-rose-100">
                          {s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest flex items-center gap-1">
                          <AlertCircle size={10} /> Pending
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-lg leading-tight truncate">{s.full_name}</h4>
                      {isAdmin && (
                        <p className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-1.5 truncate">
                          <User size={12} /> {s.guardian_name} <span className="text-slate-300">•</span> {s.country}
                        </p>
                      )}
                    </div>
                    {isAdmin ? (
                      <button onClick={() => {
                        const message = `Assalamu alaikum, reminder for student ${s.full_name}'s fee for ${formatMonthDisplay(currentStrictMonth)}.`;
                        window.open(`https://wa.me/${s.guardian_whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`);
                      }} className="mt-6 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm active:scale-95">
                        <MessageCircle size={16} /> Send WhatsApp Reminder
                      </button>
                    ) : (
                      <div className="mt-6 w-full flex items-start gap-2 bg-amber-50 text-amber-800 p-3 rounded-lg text-xs font-bold border border-amber-200">
                        <Info size={14} className="shrink-0 mt-0.5" />
                        Please contact the academy administration to clear this balance.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ADD MODAL (Admins Only) ── */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg" aria-label="Close record payment modal"><X size={20} /></button>
            <div className="p-6 sm:p-8 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-900">Record Payment</h2><p className="text-slate-500 text-sm mt-1">Log an incoming fee to the ledger.</p></div>
            <form onSubmit={handleLogPayment} className="p-6 sm:p-8 space-y-5">
              {errorMsg && (<div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-bold flex items-center gap-2"><AlertCircle size={16} className="shrink-0" /> {errorMsg}</div>)}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Select Student <span className="text-rose-500">*</span></label>
                <select required className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" value={newPayment.student} onChange={e => setNewPayment({ ...newPayment, student: e.target.value })}>
                  <option value="">-- Choose student --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Amount ($) <span className="text-rose-500">*</span></label>
                  <input type="number" step="0.01" required placeholder="50.00" className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono" value={newPayment.amount} onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Billing Month <span className="text-rose-500">*</span></label>
                  <input type="month" required className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" value={newPayment.month_paid_for} onChange={e => setNewPayment({ ...newPayment, month_paid_for: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Payment Method</label>
                <select className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" value={newPayment.method} onChange={e => setNewPayment({ ...newPayment, method: e.target.value })}>
                  <option>Bank Transfer</option><option>EasyPaisa / JazzCash</option><option>PayPal</option><option>2Checkout</option><option>Cash</option><option>Other</option>
                </select>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitProcessing} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center justify-center gap-2 disabled:opacity-50">{submitProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. PAYROLL ENGINE SUB-VIEW
// ─────────────────────────────────────────────────────────────────────────────
const PayrollEngineView = () => {
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // MEMORY LEAK FIX: Added AbortController to the Payroll fetch
  useEffect(() => {
    const abortController = new AbortController();

    setLoading(true);
    api.get('accounts/payroll/', { signal: abortController.signal })
      .then(res => setPayroll(Array.isArray(res.data) ? res.data : []))
      .catch(err => {
        if (err.name !== 'CanceledError') {
          setErrorMsg("Failed to load payroll data. Ensure you have Owner privileges.");
        }
      })
      .finally(() => setLoading(false));

    return () => abortController.abort();
  }, []);

  const validPayroll = Array.isArray(payroll) ? payroll : [];
  const totalPayout = validPayroll.reduce((acc, curr) => acc + (Number(curr.total_calculated) || 0), 0);
  const activeTeachers = validPayroll.length;
  const avgSalary = activeTeachers > 0 ? (totalPayout / activeTeachers).toFixed(0) : 0;
  const totalActiveStudents = validPayroll.reduce((acc, curr) => acc + (Number(curr.active_students) || 0), 0);
  const estimatedGrossRevenue = totalActiveStudents * 50;
  const netProfit = estimatedGrossRevenue - totalPayout;
  const profitMargin = estimatedGrossRevenue > 0 ? ((netProfit / estimatedGrossRevenue) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex justify-between items-end pb-4 border-b border-slate-200">
          <div className="space-y-2"><div className="h-8 w-64 bg-slate-200 rounded-lg"></div><div className="h-4 w-96 bg-slate-100 rounded-lg"></div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-slate-200 rounded-[2rem]"></div>
          <div className="h-40 bg-slate-100 rounded-[2rem]"></div>
          <div className="h-40 bg-slate-100 rounded-[2rem]"></div>
        </div>
        <div className="h-64 bg-slate-50 rounded-[2.5rem] border border-slate-100"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transform-gpu">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Staff Payroll</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Automated salary calculation engine based on active student enrollment.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 font-bold"><AlertCircle size={20} className="shrink-0" />{errorMsg}</div>
      )}

      {/* ── PAYROLL OVERVIEW CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden group border border-slate-800">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors pointer-events-none" />
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 relative z-10">Total Staff Cost</p>
          <div className="flex items-baseline gap-1 my-2 relative z-10">
            <span className="text-slate-500 text-2xl font-bold">$</span>
            <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight">{totalPayout.toLocaleString()}</h3>
          </div>
          <p className="text-slate-400 text-xs mt-2 relative z-10 font-semibold">Calculated for current billing cycle</p>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Active Teachers</p>
          <h3 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight my-2">{activeTeachers}</h3>
          <p className="text-emerald-600 text-xs font-bold mt-2 flex items-center gap-1.5"><CheckCircle size={14} /> System Operational</p>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Avg. Salary / Ustad</p>
          <div className="flex items-baseline gap-1 my-2"><span className="text-slate-400 text-2xl font-bold">$</span><h3 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">{avgSalary}</h3></div>
          <p className="text-slate-400 text-xs mt-2 font-semibold">Per Ustad / Month</p>
        </div>
      </div>

      {/* ── PAYROLL TABLE ── */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden transform-gpu">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><DollarSign size={16} className="text-emerald-500" /> Salary Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100 bg-white">
                <th className="px-8 py-5">Teacher Profile</th>
                <th className="px-8 py-5 text-center">Enrolled Students</th>
                <th className="px-8 py-5">Base Pay</th>
                <th className="px-8 py-5">Per-Student Bonus</th>
                <th className="px-8 py-5 text-right">Net Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {validPayroll.length === 0 ? (
                <tr><td colSpan="5" className="p-16 text-center text-slate-400 font-bold"><Users size={32} className="mx-auto mb-3 text-slate-300" />No payroll data found. Ensure you have registered and assigned teachers.</td></tr>
              ) : (
                validPayroll.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-black text-lg text-slate-600 shadow-sm border border-slate-200/50 shrink-0">{staff.name ? staff.name.charAt(0).toUpperCase() : '?'}</div>
                        <div><div className="font-bold text-slate-900 text-sm leading-tight">{staff.name || 'Unknown'}</div><div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">@{staff.username}</div></div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg w-fit mx-auto"><span className="font-black text-slate-800">{staff.active_students}</span><Users size={14} className="text-slate-400" /></div>
                    </td>
                    <td className="px-8 py-5 font-mono font-bold text-slate-600">${parseFloat(staff.base_salary || 0).toFixed(2)}</td>
                    <td className="px-8 py-5"><span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">+ ${parseFloat(staff.per_student_rate || 0).toFixed(2)} / hd</span></td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex flex-col items-end justify-center h-full">
                        <span className="text-lg font-black text-emerald-600 tracking-tight">${(Number(staff.total_calculated) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <button className="text-[10px] font-black text-slate-400 hover:text-emerald-600 uppercase tracking-widest mt-1 transition-colors flex items-center opacity-0 group-hover:opacity-100 focus:opacity-100">Process Payout <ArrowRight size={12} className="ml-1" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MASTER HUB EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function FinanceHub() {
  useDocumentTitle('Finance Hub');
  const [activeTab, setActiveTab] = useState('ledger');
  const userType = (localStorage.getItem('user_type') || 'student').toLowerCase();

  // Security block: Parents only get the ledger view
  const showPayrollTab = ['owner', 'head_manager', 'manager'].includes(userType);

  return (
    // SECURITY/PERFORMANCE FIX: Replaced expensive CPU radial blur orbs with a pure, solid bg-slate-50 background. Zero CLS. Zero repaint lag.
    <div className="min-h-screen relative overflow-hidden bg-slate-50 font-sans selection:bg-emerald-200 selection:text-emerald-900 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-8">

        {/* Master Header & Tab Navigation */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-slate-800 to-slate-900 text-emerald-400 rounded-2xl shadow-lg shadow-slate-900/20 border border-slate-700">
              <Wallet size={28} />
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight">
              {showPayrollTab ? 'Finance Command' : 'Billing & Invoices'}
            </h1>
          </div>

          {showPayrollTab && (
            <div className="bg-white/80 backdrop-blur-xl p-1.5 rounded-full border border-slate-200 shadow-sm flex items-center font-bold text-sm w-full md:w-auto">
              <button
                onClick={() => setActiveTab('ledger')}
                className={`px-8 py-2.5 rounded-full transition-all duration-300 w-full md:w-auto ${activeTab === 'ledger' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Ledger
              </button>
              <button
                onClick={() => setActiveTab('payroll')}
                className={`px-8 py-2.5 rounded-full transition-all duration-300 w-full md:w-auto ${activeTab === 'payroll' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Payroll Engine
              </button>
            </div>
          )}
        </div>

        {/* Tab Content Renderer */}
        {activeTab === 'ledger' && <FinancialLedgerView />}
        {activeTab === 'payroll' && showPayrollTab && <PayrollEngineView />}

      </div>
    </div>
  );
}