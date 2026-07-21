import useDocumentTitle from '../hooks/useDocumentTitle';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import api from '../api';
import {
  Users, Mail, Phone, Search, UserPlus, BookOpen, FileText, Loader2, UserCog,
  ShieldCheck, AlertCircle, Save, X, User, Lock, Briefcase
} from 'lucide-react';

export default function Staff() {
  useDocumentTitle('Staff');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // ── DRAWER STATES (Add Staff) ──
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);

  const initialFormState = {
    first_name: '', last_name: '', username: '',
    email: '', password: '', whatsapp: '', bio: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // ── ABORT CONTROLLER LIFECYCLE (MEMORY LEAK FIX CAUGHT BY SCRIPT) ──
  useEffect(() => {
    const abortController = new AbortController();

    const fetchTeachers = async () => {
      try {
        setLoading(true);
        const res = await api.get('accounts/teachers/', { signal: abortController.signal });
        setTeachers(Array.isArray(res.data) ? res.data : (res.data.results || []));
      } catch (error) {
        if (error.name !== 'CanceledError') {
          console.error("Failed to fetch staff", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTeachers();

    return () => abortController.abort();
  }, []);

  // Normal fetch for when we need to refresh after adding a user
  const refreshTeachers = async () => {
    try {
      const res = await api.get('accounts/teachers/');
      setTeachers(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (error) {
      console.error("Failed to refresh staff", error);
    }
  };

  // ── DRAWER HANDLERS ──
  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => {
      setFormData(initialFormState);
      setSuccess(false);
      setFormError('');
    }, 300); // Wait for animation to finish
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    try {
      await api.post('accounts/register/', {
        ...formData,
        user_type: 'teacher'
      });
      setSuccess(true);
      refreshTeachers(); // Refresh table silently
    } catch (err) {
      console.error('Failed to add staff', err);
      const detail = err.response?.data;
      if (detail && typeof detail === 'object') {
        const firstKey = Object.keys(detail)[0];
        const errorMsg = Array.isArray(detail[firstKey]) ? detail[firstKey][0] : detail[firstKey];
        setFormError(`${firstKey.replace('_', ' ').toUpperCase()}: ${errorMsg}`);
      } else {
        setFormError('Failed to create staff account. Please check the inputs.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTeachers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return teachers.filter(t =>
      (t.username || '').toLowerCase().includes(term) ||
      (t.email || '').toLowerCase().includes(term) ||
      (t.first_name || '').toLowerCase().includes(term)
    );
  }, [teachers, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500 relative">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-8 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-sm border border-emerald-200/50">
              <Users size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Staff Directory</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">Manage your teaching faculty, view class rosters, and oversee staff profiles.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search staff by name or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            <UserPlus size={18} />
            <span>Onboard Staff</span>
          </button>
        </div>
      </div>

      {/* ── TEACHER CARDS GRID ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Loading Directory...</p>
        </div>
      ) : teachers.length === 0 ? (
        <div className="py-24 text-center bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl flex flex-col items-center">
          <div className="h-20 w-20 bg-white shadow-sm border border-slate-100 text-slate-300 rounded-full flex items-center justify-center mb-6">
            <UserCog size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">No Staff Found</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Your academy directory is currently empty. Click "Onboard Staff" to add your first Ustad.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeachers.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all group flex flex-col justify-between">

              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center font-black text-xl shadow-sm border border-emerald-400/20 shrink-0">
                      {teacher.first_name ? teacher.first_name.charAt(0).toUpperCase() : teacher.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 leading-tight">
                        {teacher.first_name ? `${teacher.first_name} ${teacher.last_name || ''}` : teacher.username}
                      </h3>
                      <span className="inline-flex mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded border border-emerald-100 uppercase tracking-widest">
                        Ustad
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  {teacher.email && (
                    <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                      <Mail size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate font-medium">{teacher.email}</span>
                    </div>
                  )}

                  {teacher.whatsapp && (
                    <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                      <Phone size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate font-medium">{teacher.whatsapp}</span>
                    </div>
                  )}

                  {teacher.bio && (
                    <div className="flex items-start gap-3 text-sm text-slate-600 bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100 mt-2">
                      <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="italic text-slate-500 line-clamp-2 text-xs">"{teacher.bio}"</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Active Class Roster ({teacher.classes?.length || 0})
                    </h4>
                    <BookOpen size={14} className="text-slate-300" />
                  </div>

                  {teacher.classes && teacher.classes.length > 0 ? (
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      {teacher.classes.map((cls, index) => (
                        <div key={index} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                          <span className="font-bold text-slate-700 truncate pr-2" title={cls.student_name}>
                            {cls.student_name}
                          </span>
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-mono text-[10px] font-bold whitespace-nowrap border border-emerald-100">
                            {cls.timing || 'TBD'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 font-medium italic bg-slate-50/50 p-4 rounded-xl text-center border border-slate-100 border-dashed">
                      No students assigned to this teacher yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <Link
                  to={`/teachers/${teacher.id}`}
                  className="w-full py-2.5 text-sm font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200 hover:border-emerald-200 text-center flex items-center justify-center gap-2"
                >
                  <UserCog size={16} /> Manage Profile
                </Link>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ── ONBOARDING SLIDE-OUT DRAWER ── */}
      <div className={`fixed inset-0 z-50 flex justify-end pointer-events-none overflow-hidden ${isDrawerOpen ? 'pointer-events-auto' : ''}`}>
        <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`} onClick={closeDrawer} />

        <div className={`relative w-full max-w-2xl bg-slate-50 h-full max-h-screen flex flex-col shadow-2xl transition-transform duration-300 transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

          {/* Drawer Header */}
          <div className="shrink-0 px-6 py-5 sm:px-8 sm:py-6 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Onboard New Ustad</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">Provision a new teacher account and configure access.</p>
            </div>
            <button onClick={closeDrawer} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500" aria-label="Close drawer">
              <X size={24} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-8 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300/70 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 transition-colors">
            {success ? (
              <div className="animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden mb-8">
                  <div className="p-16 text-center bg-emerald-50/50">
                    <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-200">
                      <ShieldCheck size={40} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Staff Account Created</h2>
                    <p className="text-slate-500 font-medium mb-8">The teacher profile has been securely provisioned.</p>
                    <button onClick={closeDrawer} className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-colors">
                      Done & Close
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form id="staff-form" onSubmit={handleAddSubmit} className="space-y-8">
                {formError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 font-bold animate-in slide-in-from-top-2">
                    <AlertCircle size={20} className="shrink-0" />
                    {formError}
                  </div>
                )}

                {/* 1. Identity */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <User size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Personal Identity</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">First Name <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3 text-slate-400" size={18} />
                        <input type="text" name="first_name" required value={formData.first_name} onChange={handleFormChange} placeholder="e.g. Imran"
                          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Last Name <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3 text-slate-400" size={18} />
                        <input type="text" name="last_name" required value={formData.last_name} onChange={handleFormChange} placeholder="e.g. Ullah"
                          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Credentials */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Lock size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">System Credentials</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Username <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3.5 top-3 text-slate-400" size={18} />
                        <input type="text" name="username" required value={formData.username} onChange={handleFormChange} placeholder="e.g. imranullah"
                          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Temp Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 text-slate-400" size={18} />
                        <input type="password" name="password" required value={formData.password} onChange={handleFormChange} placeholder="Secure password"
                          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Bio & Contact */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Briefcase size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Contact & Bio</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 text-slate-400" size={18} />
                        <input type="email" name="email" required value={formData.email} onChange={handleFormChange} placeholder="teacher@quranific.com"
                          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3 text-slate-400" size={18} />
                        <input type="text" name="whatsapp" value={formData.whatsapp} onChange={handleFormChange} placeholder="+92 300 1234567"
                          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Short Bio</label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-3 text-slate-400" size={18} />
                      <textarea name="bio" rows="3" value={formData.bio} onChange={handleFormChange} placeholder="e.g. Expert in Tajweed..."
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y" />
                    </div>
                  </div>
                </div>

              </form>
            )}
          </div>

          {/* Drawer Footer: Pinned to bottom */}
          {!success && (
            <div className="shrink-0 px-6 py-4 sm:px-8 sm:py-5 bg-white border-t border-slate-200 flex justify-end gap-3 z-10">
              <button type="button" onClick={closeDrawer} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" form="staff-form" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Provisioning...</> : <><Save size={16} /> Create Staff</>}
              </button>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}