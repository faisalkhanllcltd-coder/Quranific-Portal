import useDocumentTitle from '../hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import {
  User, Calendar, Edit2, Save, X,
  ArrowLeft, CheckCircle, Clock, Phone, Key, Shield, Loader2, Link as LinkIcon
} from 'lucide-react';

export default function StudentProfile() {
  useDocumentTitle('Student Profile');
  const { id } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [teachers, setTeachers] = useState([]); // For the Teacher Dropdown
  const [parents, setParents] = useState([]);   // For the Parent Dropdown
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Security Form State
  const [credData, setCredData] = useState({ username: '', password: '' });
  const [credStatus, setCredStatus] = useState(null);

  const userType = (localStorage.getItem('user_type') || 'student').toLowerCase();
  const isAdmin = ['owner', 'head_manager', 'manager'].includes(userType);

  useEffect(() => {
    fetchStudent();
    if (isAdmin) {
      fetchTeachers();
      fetchParents();
    }
  }, [id, isAdmin]);

  const fetchStudent = async () => {
    try {
      const res = await api.get(`students/${id}/`);
      setStudent(res.data);
      setFormData({
        full_name: res.data.full_name || '',
        status: res.data.status || 'Trial',
        assigned_teacher: res.data.assigned_teacher || '',
        whatsapp: res.data.whatsapp || '',
        class_timing: res.data.class_timing || '',
        gender: res.data.gender || '',
        // PHASE 5: Parent Binding Support
        parent_account_id: res.data.parent_account || ''
      });
    } catch (err) {
      console.error("Error loading student", err);
      navigate('/all-students');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await api.get('accounts/teachers/');
      const teacherList = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
      setTeachers(teacherList);
    } catch (err) {
      console.error("Failed to load teachers", err);
    }
  };

  const fetchParents = async () => {
    try {
      // A-P4-01 FIX: was calling system-access/ (IsOwner-only) and filtering client-side.
      // Replaced with the scoped /parents/ endpoint (IsOwnerOrManager, DB-filtered).
      const res = await api.get('accounts/parents/');
      setParents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load parents", err);
    }
  };

  const handleUpdate = async () => {
    setSaveStatus('loading');
    try {
      // Prevent empty strings from breaking integer foreign keys
      const payload = { ...formData };
      if (payload.parent_account_id === '') {
        payload.parent_account_id = null;
      }

      await api.patch(`students/${id}/`, payload);
      setSaveStatus('success');
      setIsEditing(false);
      fetchStudent();
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('error');
      console.error(err);
      alert("Error saving changes. Check your connection.");
    }
  };

  const handleUpdateCredentials = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setCredStatus('loading');
    try {
      await api.post(`students/${id}/update_credentials/`, credData);
      setCredStatus('success');
      setCredData({ username: '', password: '' }); // Clear fields
      setTimeout(() => setCredStatus(null), 4000);
    } catch (err) {
      setCredStatus('error');
      const errorMsg = err.response?.data?.error || "Failed to update credentials.";
      alert(errorMsg);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Synchronizing Profile...</p>
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">

      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6 pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <button
            onClick={() => navigate('/all-students')}
            className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm w-fit shrink-0 focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Back to students list"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {isEditing ? 'Editing Profile' : student.full_name}
              </h1>
              {!isEditing && (
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${student.status === 'Joined' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  student.status === 'Trial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                  {student.status || 'Trial'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-slate-500 text-sm font-semibold">
              <span>Student ID: <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">#{student.id}</span></span>
              {student.parent_account && !isEditing && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    <LinkIcon size={12} /> Family Portal Bound
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {saveStatus === 'success' && (
            <span className="text-emerald-600 font-bold text-sm flex items-center gap-1.5 mr-2 animate-in fade-in slide-in-from-right-4">
              <CheckCircle size={16} /> Saved!
            </span>
          )}

          {!isEditing && isAdmin && (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-6 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm focus:ring-2 focus:ring-slate-200"
            >
              <Edit2 size={16} /> Edit Profile
            </button>
          )}

          {isEditing && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 sm:flex-none px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-sm transition-colors focus:ring-2 focus:ring-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saveStatus === 'loading'}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-colors active:scale-95 disabled:opacity-50 focus:ring-2 focus:ring-emerald-500/50"
              >
                {saveStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── LEFT: PRIMARY INFO & EDIT FORM ── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
            <div className="h-28 w-28 bg-gradient-to-br from-slate-100 to-slate-200 rounded-[1.5rem] mx-auto flex items-center justify-center text-4xl font-black text-slate-400 shadow-inner mb-8 border border-white">
              {student.full_name?.charAt(0).toUpperCase()}
            </div>

            {isEditing ? (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Enrollment Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                  >
                    <option value="Trial">Trial</option>
                    <option value="Joined">Joined</option>
                    <option value="Left">Left</option>
                  </select>
                </div>

                {/* PHASE 5: Family Portal Binding */}
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <LinkIcon size={12} /> Family Portal Link
                  </label>
                  <select
                    value={formData.parent_account_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_account_id: e.target.value })}
                    className="w-full bg-white border border-emerald-200 p-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                  >
                    <option value="">-- No Parent Linked --</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name} (@{p.username})</option>
                    ))}
                  </select>
                  <p className="text-[10px] font-medium text-emerald-600/70 mt-1.5 leading-snug">
                    Linking this account allows the parent to view this student on their Family Dashboard.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Teacher</label>
                  <select
                    value={formData.assigned_teacher || ''}
                    onChange={(e) => setFormData({ ...formData, assigned_teacher: e.target.value })}
                    className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                  >
                    <option value="">-- Unassigned --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.username}>{t.first_name ? `${t.first_name} ${t.last_name}` : t.username}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Class Timing</label>
                  <input
                    type="text"
                    value={formData.class_timing}
                    onChange={(e) => setFormData({ ...formData, class_timing: e.target.value })}
                    className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student WhatsApp</label>
                  <input
                    type="text"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Assigned Ustad</p>
                  <p className="font-bold text-slate-900 flex items-center justify-center gap-1.5 text-sm">
                    <User size={16} className="text-emerald-600" /> {student.assigned_teacher || <span className="italic text-slate-400">UNASSIGNED</span>}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-4">
                  {student.parent_username && (
                    <div className="flex items-center gap-3 text-slate-700 py-2">
                      <LinkIcon size={16} className="text-emerald-500 shrink-0" />
                      <span className="text-sm font-semibold truncate text-emerald-700">Family Bound (@{student.parent_username})</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-slate-700 py-2">
                    <Phone size={16} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold truncate">{student.whatsapp || <span className="italic text-slate-400">No Number</span>}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 py-2">
                    <Clock size={16} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold truncate">{student.class_timing || <span className="italic text-slate-400">No Schedule</span>}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 py-2">
                    <User size={16} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold truncate">Gender: {student.gender || 'Not specified'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: SECURITY & HISTORY ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* SECURITY PANEL (ADMIN OVERRIDE) */}
          {isAdmin && (
            <div className="bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-lg relative overflow-hidden border border-slate-800">
              <div className="absolute right-0 top-0 p-8 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                <Shield size={160} className="text-white" />
              </div>

              <h3 className="font-black text-lg text-white mb-1.5 flex items-center gap-2.5 relative z-10">
                <Key size={18} className="text-emerald-400" />
                Portal Access Override
              </h3>
              <p className="text-slate-400 text-sm mb-6 relative z-10">Manually overwrite the student's login credentials. Changes take effect immediately.</p>

              <form onSubmit={handleUpdateCredentials} className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">New Username</label>
                  <input
                    type="text"
                    value={credData.username}
                    onChange={e => setCredData({ ...credData, username: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-sm text-slate-200 placeholder:text-slate-600 shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">New Password</label>
                  <input
                    type="text"
                    value={credData.password}
                    onChange={e => setCredData({ ...credData, password: e.target.value })}
                    placeholder="Enter new password"
                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-sm text-emerald-400 placeholder:text-slate-600 shadow-inner"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
                  <button
                    type="submit"
                    disabled={(!credData.username && !credData.password) || credStatus === 'loading'}
                    className="w-full sm:w-auto bg-white text-slate-900 px-6 py-2.5 rounded-lg font-bold text-sm transition-colors active:scale-95 disabled:opacity-50 hover:bg-slate-200 focus:ring-2 focus:ring-white/20"
                  >
                    {credStatus === 'loading' ? 'Updating Securely...' : 'Force Update Credentials'}
                  </button>
                  {credStatus === 'success' && <span className="text-emerald-400 text-sm font-bold flex items-center gap-1.5 animate-in fade-in"><CheckCircle size={16} /> Updated Successfully</span>}
                </div>
              </form>
            </div>
          )}

          {/* ATTENDANCE HISTORY */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <h3 className="font-black text-lg text-slate-900 mb-6 flex items-center gap-2.5">
              <Calendar size={20} className="text-emerald-600" />
              Recent Attendance Log
            </h3>

            {student.attendance_history?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {student.attendance_history.slice(0, 8).map(record => (
                  <div key={record.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="font-bold text-slate-700 text-sm">Class Session</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${record.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      record.status === 'Absent' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        record.status === 'Late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                      {record.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center">
                <Calendar size={32} className="text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium text-sm">No class history found for this student.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}