import useDocumentTitle from '../hooks/useDocumentTitle';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  UserPlus, Search, GraduationCap, Phone,
  User, Clock, Trash2, Edit, ChevronRight,
  ShieldCheck, CalendarCheck, Loader2, AlertTriangle, X,
  Save, Copy, CheckCircle, BookOpen, Users, AlertCircle, Link as LinkIcon,
  Eye, EyeOff  // A-P3-04 / A-P3-05: password reveal toggles
} from 'lucide-react';

export default function StudentList() {
  useDocumentTitle('Students');
  const navigate = useNavigate();

  // ── CORE STATES ──
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // ── MODAL & DRAWER STATES ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [teachers, setTeachers] = useState([]);

  // ── FAMILY PORTAL BINDING STATES ──
  const [parents, setParents] = useState([]);
  const [parentMode, setParentMode] = useState('none');

  // ── PASSWORD REVEAL TOGGLES (A-P3-04 / A-P3-05) ──
  const [showStudentPass, setShowStudentPass] = useState(false);
  const [showParentPass, setShowParentPass]   = useState(false);

  // ── POST-ENROLLMENT CREDENTIAL MASK (A-P5-01) ──
  // Passwords masked by default; 60-second countdown auto-re-masks if admin forgets.
  const [showCredPass, setShowCredPass]     = useState(false);
  const [credCountdown, setCredCountdown]   = useState(60);

  const initialFormState = {
    username: '', password: '', full_name: '', gender: 'Male',
    age: '', email: '', whatsapp: '', class_timing: '',
    assigned_teacher: '', status: 'Joined', guardian_name: '',
    guardian_relation: 'Parent', country: '', city: '',
    guardian_email: '', guardian_whatsapp: '',
    parent_account_id: '', parent_username: '', parent_password: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // ── IDENTITY ──
  const userType = (localStorage.getItem('user_type') || 'student').toLowerCase();
  // NOTE: 'username' removed — teacher filtering is now handled server-side only
  // (StudentViewSet.get_queryset uses assigned_teacher__iexact=user.username at DB level).
  const isOwnerOrManager = ['owner', 'head_manager', 'manager'].includes(userType);

  // ── ABORT CONTROLLER LIFECYCLE (MEMORY LEAK FIX) ──
  // A-P5-01: Auto-mask countdown — starts when credentials are set, masks after 60s.
  useEffect(() => {
    if (!credentials) return;
    setShowCredPass(false);
    setCredCountdown(60);
    const interval = setInterval(() => {
      setCredCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowCredPass(false);  // auto-mask
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [credentials]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [studentsRes, teachersRes, parentsRes] = await Promise.all([
          api.get('students/', { signal: abortController.signal }),
          isOwnerOrManager ? api.get('accounts/teachers/', { signal: abortController.signal }) : Promise.resolve({ data: [] }),
          isOwnerOrManager ? api.get('accounts/parents/', { signal: abortController.signal }) : Promise.resolve({ data: [] })
        ]);

        let allStudents = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes.data.results || []);
        // A-P3-03 FIX: Removed redundant client-side teacher filter.
        // StudentViewSet.get_queryset() already applies
        //   queryset.filter(assigned_teacher__iexact=user.username)
        // server-side, so the response only contains that teacher's students.
        // Duplicating the filter here was dead code that implied distrust of the API.
        setStudents(allStudents);

        if (isOwnerOrManager) {
          setTeachers(Array.isArray(teachersRes.data) ? teachersRes.data : (teachersRes.data.results ?? []));
          // A-P3-01 FIX: /api/accounts/parents/ returns only parent-role users (DB-filtered).
          // No client-side .filter(u => u.role==='parent') needed; endpoint is IsOwnerOrManager.
          setParents(Array.isArray(parentsRes.data) ? parentsRes.data : []);
        }
      } catch (error) {
        if (error.name !== 'CanceledError') {
          console.error("Data fetching failed:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();

    return () => abortController.abort();
  }, [isOwnerOrManager, userType]);

  // ── NETWORK REFRESHERS ──
  const refreshStudents = async () => {
    try {
      const res = await api.get('students/');
      // A-P3-03 FIX: Removed redundant client-side teacher filter (server handles it).
      const allData = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setStudents(allData);
    } catch (error) {
      console.error("Failed to refresh students", error);
    }
  };

  const refreshParents = async () => {
    if (!isOwnerOrManager) return;
    try {
      // A-P3-01 FIX: use the scoped /parents/ endpoint (IsOwnerOrManager)
      // instead of /system-access/ (IsOwner-only) which returned 403 for managers.
      const res = await api.get('accounts/parents/');
      setParents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to refresh parents", err);
    }
  };


  // ── HANDLERS ──
  const confirmDelete = (e, student) => {
    e.stopPropagation();
    if (!isOwnerOrManager) return;
    setStudentToDelete(student);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!studentToDelete) return;
    setDeleteProcessing(true);
    try {
      await api.delete(`students/${studentToDelete.id}/`);
      setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
      setShowDeleteModal(false);
    } catch (error) {
      alert("Failed to delete student. They may have already been removed.");
    } finally {
      setDeleteProcessing(false);
      setStudentToDelete(null);
    }
  };

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setTimeout(() => {
      setFormData(initialFormState);
      setCredentials(null);
      setFormError('');
      setParentMode('none');
      setShowStudentPass(false);  // A-P3-04/05: always re-mask on close
      setShowParentPass(false);
      setShowCredPass(false);     // A-P5-01: re-mask credential reveal on close
      setCredCountdown(60);
    }, 300);
  }, []);

  const handleFormChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    try {
      let finalParentId = formData.parent_account_id;

      if (parentMode === 'new') {
        const names = formData.guardian_name.split(' ');
        const parentRes = await api.post('accounts/register-parent/', {
          username: formData.parent_username,
          password: formData.parent_password,
          first_name: names[0] || 'Parent',
          last_name: names.slice(1).join(' ') || '',
          email: formData.guardian_email
        });
        finalParentId = parentRes.data.parent_id;
      }

      const payload = {
        ...formData,
        parent_account_id: parentMode !== 'none' ? finalParentId : null
      };

      await api.post('students/', payload);

      setCredentials({
        student_user: formData.username,
        student_pass: formData.password,
        parent_user: parentMode === 'new' ? formData.parent_username : null,
        parent_pass: parentMode === 'new' ? formData.parent_password : null,
      });

      refreshStudents();
      if (parentMode === 'new') refreshParents();

    } catch (err) {
      console.error("Error adding student:", err);
      const detail = err.response?.data;
      if (detail && typeof detail === 'object') {
        const firstKey = Object.keys(detail)[0];
        const errorMsg = Array.isArray(detail[firstKey]) ? detail[firstKey][0] : detail[firstKey];
        setFormError(`${firstKey.replace('_', ' ').toUpperCase()}: ${errorMsg}`);
      } else {
        setFormError('Failed to create account. Please check your inputs or connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCredentials = () => {
    let text = `Welcome to Quranific!\nPortal: ${window.location.origin}\n\n[STUDENT LOGIN]\nUsername: ${credentials.student_user}\nPassword: ${credentials.student_pass}`;
    if (credentials.parent_user) {
      text += `\n\n[PARENT PORTAL LOGIN]\nUsername: ${credentials.parent_user}\nPassword: ${credentials.parent_pass}`;
    }
    navigator.clipboard.writeText(text);
    alert("Credentials copied to clipboard!");
  };

  // EDGE PERFORMANCE: Memoize filtering
  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return students.filter(student =>
      (student.full_name || '').toLowerCase().includes(term) ||
      (student.guardian_name || '').toLowerCase().includes(term) ||
      (student.id || '').toString().includes(term)
    );
  }, [students, searchTerm]);


  // ── RENDER HELPERS ──
  const renderTableSkeleton = () => (
    <div className="animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="h-6 w-16 bg-slate-200 rounded" />
          <div className="h-4 w-24 bg-slate-200 rounded hidden sm:block" />
          <div className="h-6 w-20 bg-slate-200 rounded hidden md:block" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500 relative">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6 pt-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 bg-emerald-50 w-fit px-2.5 py-1 rounded-full border border-emerald-200/50">
            <ShieldCheck size={14} /> {userType} Access Level
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {isOwnerOrManager ? 'Academy Student Body' : 'My Assigned Students'}
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm font-medium">
            {isOwnerOrManager
              ? 'Oversee all enrollments, manage profiles, and track assignments.'
              : `Managing ${students.length} students currently in your care.`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative group w-full sm:w-64 shrink-0">
            <Search className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search by name, guardian, or ID..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 ring-emerald-500/20 w-full transition-shadow shadow-sm text-sm"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isOwnerOrManager && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-95 shrink-0"
            >
              <UserPlus size={18} />
              <span>Enroll Student</span>
            </button>
          )}
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Listed</p>
          <p className="text-3xl font-black text-slate-900">{students.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Active</p>
          <p className="text-3xl font-black text-emerald-600">{students.filter(s => s.status?.toLowerCase() === 'joined').length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Trialing</p>
          <p className="text-3xl font-black text-amber-600">{students.filter(s => s.status?.toLowerCase() === 'trial').length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inactive / Left</p>
          <p className="text-3xl font-black text-slate-400">{students.filter(s => s.status?.toLowerCase() === 'left').length}</p>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          renderTableSkeleton()
        ) : filteredStudents.length === 0 ? (
          <div className="p-24 text-center flex flex-col items-center bg-slate-50">
            <div className="h-20 w-20 bg-white border border-slate-200 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <GraduationCap size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No Records Found</h3>
            <p className="text-slate-500 max-w-sm mt-2 text-sm font-medium">
              We couldn't find any students matching your criteria. Try adjusting your search or enroll a new student.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  <th className="px-6 py-4">Student Information</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 hidden sm:table-cell">Family Contact</th>
                  <th className="px-6 py-4 hidden md:table-cell">Schedule</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => navigate(`/students/${student.id}`)}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-600 shadow-sm text-lg">
                          {student.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors text-sm flex items-center gap-2">
                            {student.full_name}
                            {student.parent_account && (
                              <LinkIcon size={12} className="text-emerald-500" title="Linked to Family Portal" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold tracking-wider mt-0.5 uppercase">
                            AGE: {student.age} <span className="mx-1 text-slate-300">•</span> ID: #{student.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${student.status?.toLowerCase() === 'joined' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        student.status?.toLowerCase() === 'trial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                        {student.status || 'Unknown'}
                      </span>
                    </td>

                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <User size={14} className="text-slate-400" /> {student.guardian_name || 'N/A'}
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400" /> {student.guardian_whatsapp || 'No Number'}
                      </div>
                    </td>

                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md w-fit">
                        <Clock size={12} className="text-emerald-600" /> {student.class_timing || 'TBD'}
                      </div>
                      {isOwnerOrManager && (
                        <div className="text-[10px] text-slate-500 font-bold uppercase mt-1.5 tracking-wider ml-1">
                          Ustad: <span className="text-slate-800">{student.assigned_teacher || 'UNASSIGNED'}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isOwnerOrManager && (
                          <button onClick={(e) => { e.stopPropagation(); navigate('/attendance'); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Mark Attendance">
                            <CalendarCheck size={18} />
                          </button>
                        )}
                        {isOwnerOrManager && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); navigate(`/students/${student.id}`); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit Profile">
                              <Edit size={16} />
                            </button>
                            <button onClick={(e) => confirmDelete(e, student)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Remove Student">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                        <button className="p-2 text-slate-400 group-hover:text-slate-800 transition-colors">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
            <button onClick={() => setShowDeleteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"><X size={20} /></button>
            <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Remove Student?</h2>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete <strong>{studentToDelete?.full_name}</strong>? This will permanently erase their profile, attendance, and assignment history.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={executeDelete} disabled={deleteProcessing} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ENROLLMENT DRAWER (PERFECT UX SCROLLBAR) ── */}
      {/* OVERFLOW-HIDDEN added here to clip the sliding drawer and prevent horizontal page scroll */}
      <div className={`fixed inset-0 z-50 flex justify-end pointer-events-none overflow-hidden ${isDrawerOpen ? 'pointer-events-auto' : ''}`}>
        <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`} onClick={closeDrawer} />

        <div className={`relative w-full max-w-2xl bg-slate-50 h-full max-h-screen flex flex-col shadow-2xl transition-transform duration-300 transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

          <div className="shrink-0 px-6 py-5 sm:px-8 sm:py-6 bg-white border-b border-slate-200 flex items-center justify-between z-10 shadow-sm">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Enroll New Student</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">Configure profile details, family links, and portal access.</p>
            </div>
            <button onClick={closeDrawer} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* BEAUTIFUL CUSTOM SCROLLBAR (Vertical only, sleek design) */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-8 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300/70 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 transition-colors">
            {credentials ? (
              <div className="animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden mb-8">
                  <div className="p-8 text-center border-b border-slate-100 bg-emerald-50/50">
                    <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                      <CheckCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">Accounts Provisioned</h2>
                    <p className="text-slate-500 text-sm">Secure portals have been created.</p>
                  </div>

                  {/* A-P5-01: Countdown banner — warns admin before auto-mask */}
                  <div className={`flex items-center justify-between gap-3 px-5 py-3 text-xs font-bold border-b ${
                    credCountdown > 20
                      ? 'bg-amber-50 border-amber-100 text-amber-700'
                      : 'bg-rose-50 border-rose-100 text-rose-700'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={13} />
                      {credCountdown > 0
                        ? `Passwords auto-mask in ${credCountdown}s`
                        : 'Passwords masked for security'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowCredPass(v => !v); setCredCountdown(60); }}
                      className="flex items-center gap-1 underline underline-offset-2 hover:opacity-70 transition-opacity"
                      aria-label={showCredPass ? 'Hide passwords' : 'Reveal passwords'}
                    >
                      {showCredPass ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Reveal</>}
                    </button>
                  </div>

                  <div className="p-8 space-y-6">
                    <div>
                      <div className="flex items-center gap-2 text-slate-700 font-bold mb-3 pb-2 border-b border-slate-100">
                        <GraduationCap size={16} className="text-emerald-600" /> Student Login
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Username</p>
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900 select-all">{credentials.student_user}</div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Password</p>
                          {/* A-P5-01: masked by default, revealed on toggle */}
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900 select-all tracking-widest">
                            {showCredPass ? credentials.student_pass : '••••••••'}
                          </div>
                        </div>
                      </div>
                    </div>
                    {credentials.parent_user && (
                      <div>
                        <div className="flex items-center gap-2 text-slate-700 font-bold mb-3 pb-2 border-b border-slate-100 mt-2">
                          <Users size={16} className="text-emerald-600" /> Parent Portal Login
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Username</p>
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg font-mono text-sm text-amber-900 select-all">{credentials.parent_user}</div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Password</p>
                            {/* A-P5-01: masked by default */}
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg font-mono text-sm text-amber-900 select-all tracking-widest">
                              {showCredPass ? credentials.parent_pass : '••••••••'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <button onClick={copyCredentials} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition-colors">
                      <Copy size={16} /> Copy All Credentials
                    </button>
                  </div>
                </div>
                <button onClick={closeDrawer} className="w-full px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold shadow-sm transition-colors">
                  Done & Close
                </button>
              </div>
            ) : (
              <form id="enrollment-form" onSubmit={handleAddSubmit} className="space-y-8">
                {formError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 font-bold animate-in slide-in-from-top-2">
                    <AlertCircle size={20} className="shrink-0" /> {formError}
                  </div>
                )}
                {/* 1. Portal Access */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Student Portal Access</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Username <span className="text-red-500">*</span></label>
                      <input name="username" type="text" required value={formData.username} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
                      {/* A-P3-04: Changed from type="text" to masked with reveal toggle */}
                      <div className="relative">
                        <input
                          name="password"
                          type={showStudentPass ? 'text' : 'password'}
                          required
                          value={formData.password}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStudentPass(v => !v)}
                          className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                          tabIndex={-1}
                          aria-label={showStudentPass ? 'Hide password' : 'Show password'}
                        >
                          {showStudentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 2. Personal Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <User size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Personal Details</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input name="full_name" type="text" required value={formData.full_name} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Age <span className="text-red-500">*</span></label>
                      <input name="age" type="number" required min="1" value={formData.age} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                        <option value="Male">Male</option><option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input name="email" type="email" value={formData.email} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                      <input name="whatsapp" type="text" value={formData.whatsapp} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>
                </div>
                {/* 3. Academic Routing */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <BookOpen size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Academic Routing</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Teacher</label>
                      <select name="assigned_teacher" value={formData.assigned_teacher} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                        <option value="">-- Unassigned --</option>
                        {teachers.map(t => <option key={t.id} value={t.username}>{t.first_name ? `${t.first_name} ${t.last_name}` : t.username}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Class Timing</label>
                      <input name="class_timing" type="text" value={formData.class_timing} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Enrollment Status</label>
                    <div className="flex gap-3">
                      {['Trial', 'Joined', 'Left'].map(status => (
                        <label key={status} className="relative flex-1 cursor-pointer">
                          <input type="radio" name="status" value={status} checked={formData.status === status} onChange={handleFormChange} className="peer sr-only" />
                          <div className={`text-center px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${formData.status === status ? 'bg-emerald-50 border-emerald-600 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            {status}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                {/* 4. Guardian Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Users size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Guardian Info</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Relation</label>
                      <select name="guardian_relation" value={formData.guardian_relation} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                        <option value="Parent">Parent</option><option value="Brother">Brother</option><option value="Sister">Sister</option><option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Guardian Name <span className="text-red-500">*</span></label>
                      <input name="guardian_name" type="text" required value={formData.guardian_name} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp <span className="text-red-500">*</span></label>
                      <input name="guardian_whatsapp" type="text" required value={formData.guardian_whatsapp} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input name="guardian_email" type="email" value={formData.guardian_email} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>
                </div>
                {/* 5. Family Portal Binding */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <LinkIcon size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Family Portal Binding</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">Link this student to a parent account to enable unified family billing and multi-student tracking.</p>
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <button type="button" onClick={() => setParentMode('none')} className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-colors ${parentMode === 'none' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Standalone (No Link)</button>
                    <button type="button" onClick={() => setParentMode('existing')} className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-colors ${parentMode === 'existing' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'}`}>Link Existing Parent</button>
                    <button type="button" onClick={() => setParentMode('new')} className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-colors ${parentMode === 'new' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50'}`}>Create New Parent</button>
                  </div>
                  {parentMode === 'existing' && (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                      <label className="block text-sm font-bold text-emerald-800 mb-2">Select Parent Account <span className="text-red-500">*</span></label>
                      <select name="parent_account_id" required value={formData.parent_account_id} onChange={handleFormChange} className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-lg text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                        <option value="">-- Choose a registered parent --</option>
                        {parents.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} (@{p.username})</option>)}
                      </select>
                    </div>
                  )}
                  {parentMode === 'new' && (
                    <div className="p-4 bg-amber-50/30 border border-amber-200 rounded-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-2 text-amber-700 text-xs font-bold bg-amber-100/50 p-2 rounded-lg"><AlertCircle size={14} /> A new Master Parent Portal will be created using the Guardian Name/Email above.</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-bold text-amber-800 mb-1">Parent Username <span className="text-red-500">*</span></label>
                          <input name="parent_username" type="text" required value={formData.parent_username} onChange={handleFormChange} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-amber-800 mb-1">Parent Password <span className="text-red-500">*</span></label>
                          {/* A-P3-05: Changed from type="text" to masked with reveal toggle */}
                          <div className="relative">
                            <input
                              name="parent_password"
                              type={showParentPass ? 'text' : 'password'}
                              required
                              value={formData.parent_password}
                              onChange={handleFormChange}
                              className="w-full px-3 py-2 pr-10 bg-white border border-amber-200 rounded-lg text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowParentPass(v => !v)}
                              className="absolute inset-y-0 right-2 flex items-center text-amber-400 hover:text-amber-700 transition-colors"
                              tabIndex={-1}
                              aria-label={showParentPass ? 'Hide parent password' : 'Show parent password'}
                            >
                              {showParentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>

          {!credentials && (
            <div className="shrink-0 px-6 py-4 sm:px-8 sm:py-5 bg-white border-t border-slate-200 flex justify-end gap-3 z-10">
              <button type="button" onClick={closeDrawer} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-slate-200">Cancel</button>
              <button type="submit" form="enrollment-form" disabled={isSubmitting || (parentMode === 'existing' && !formData.parent_account_id) || (parentMode === 'new' && (!formData.parent_username || !formData.parent_password))} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-lg shadow-sm hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition-colors">
                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><Save size={16} /> Enroll Student</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}