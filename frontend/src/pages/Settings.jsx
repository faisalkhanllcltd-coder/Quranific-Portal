import { useState, useEffect } from 'react';
import api from '../api';
import {
  Shield, UserX, UserCheck, Search, ShieldAlert,
  GraduationCap, Briefcase, BookOpen, Key, Lock, CheckCircle,
  User, Mail, Phone, FileText, Save, Loader2, UserCog
} from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'access'
  const [msg, setMsg] = useState({ type: '', text: '' });

  // --- Role Check ---
  const userType = localStorage.getItem('user_type') || 'student';
  const isAdmin = ['owner', 'head_manager'].includes(userType.toLowerCase());

  // --- Profile State ---
  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '', whatsapp: '', bio: '' });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // --- Password State ---
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [passLoading, setPassLoading] = useState(false);

  // --- Access Control State ---
  const [users, setUsers] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (activeTab === 'profile') fetchProfile();
    if (activeTab === 'access' && isAdmin) fetchUsers();
  }, [activeTab, isAdmin]);

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await api.get('accounts/me/');
      setProfile({
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
        email: res.data.email || '',
        whatsapp: res.data.whatsapp || '',
        bio: res.data.bio || ''
      });
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setMsg({ type: '', text: '' });
    try {
      await api.patch('accounts/me/', profile);
      setMsg({ type: 'success', text: 'Your profile has been updated successfully.' });
      setTimeout(() => setMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (passwords.new !== passwords.confirm) {
      return setMsg({ type: 'error', text: 'New passwords do not match.' });
    }
    setPassLoading(true);
    try {
      await api.post('accounts/change-password/', { old_password: passwords.old, new_password: passwords.new });
      setMsg({ type: 'success', text: 'Password updated successfully. Use this next time you log in.' });
      setPasswords({ old: '', new: '', confirm: '' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to verify current password.' });
    } finally {
      setPassLoading(false);
    }
  };

  const fetchUsers = async () => {
    setAccessLoading(true);
    setAccessError('');
    try {
      // A-P4-01 FIX: system-access/ now returns paginated {count, next, results}.
      // Follow 'next' URLs until exhausted to accumulate the full user list.
      let allUsers = [];
      let url = 'accounts/system-access/';
      while (url) {
        const res = await api.get(url);
        const page = Array.isArray(res.data) ? res.data : (res.data.results || []);
        allUsers = [...allUsers, ...page];
        // res.data.next is an absolute URL; extract the path+query for api.get()
        const nextUrl = res.data?.next;
        if (nextUrl) {
          // Strip origin so api.get() receives only the relative path
          url = nextUrl.replace(/^https?:\/\/[^/]+/, '');
        } else {
          url = null;
        }
      }
      setUsers(allUsers);
    } catch (err) {
      if (err.response?.status === 403) {
        setAccessError("Access Denied: Administrator privileges required to view system access control.");
      }
    } finally {
      setAccessLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setSavingId(userId);
    try {
      await api.patch(`accounts/system-access/${userId}/`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert("Error updating user role.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleAccess = async (userId, currentStatus) => {
    setSavingId(userId);
    try {
      await api.patch(`accounts/system-access/${userId}/`, { is_active: !currentStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
    } catch (err) {
      alert("Error toggling account lock.");
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#fbfdf9] font-sans pb-24">
      {/* Ambient Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-200/40 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-pulse pointer-events-none" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-lime-100/50 rounded-full mix-blend-multiply filter blur-[140px] opacity-70 animate-pulse pointer-events-none" style={{ animationDuration: '12s' }}></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-8 animate-in fade-in duration-500">

        {/* HEADER */}
        <div className="pb-8 mb-8 border-b border-slate-200">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Settings</h1>
          <p className="text-slate-500 text-sm font-medium mt-2">Manage your account preferences and system security.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">

          {/* SIDEBAR NAVIGATION */}
          <aside className="w-full md:w-64 shrink-0">
            <nav className="flex flex-col gap-2">
              <button
                onClick={() => { setActiveTab('profile'); setMsg({ type: '', text: '' }); }}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'profile'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                <UserCog size={18} /> General Profile
              </button>

              <button
                onClick={() => { setActiveTab('security'); setMsg({ type: '', text: '' }); }}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'security'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                <Lock size={18} /> Password & Security
              </button>

              {/* ONLY RENDER IF ADMIN */}
              {isAdmin && (
                <button
                  onClick={() => { setActiveTab('access'); setMsg({ type: '', text: '' }); }}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'access'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  <Shield size={18} /> Access Control Panel
                </button>
              )}
            </nav>
          </aside>

          {/* MAIN CONTENT PANEL */}
          <main className="flex-1 min-w-0">

            {/* Global Alert Messaging */}
            {msg.text && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-bold border shadow-sm animate-in slide-in-from-top-2 ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                {msg.type === 'success' ? <CheckCircle size={18} className="shrink-0" /> : <ShieldAlert size={18} className="shrink-0" />}
                {msg.text}
              </div>
            )}

            {/* TAB 1: GENERAL PROFILE */}
            {activeTab === 'profile' && (
              <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center gap-5">
                  <div className="h-16 w-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg border border-emerald-400/30 shrink-0">
                    {profile.first_name ? profile.first_name.charAt(0).toUpperCase() : <User size={28} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">Personal Information</h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Update your display name and contact details.</p>
                  </div>
                </div>

                {profileLoading ? (
                  <div className="p-24 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-emerald-500" size={40} />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Profile...</span>
                  </div>
                ) : (
                  <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">First Name</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-3 text-slate-400" size={18} />
                          <input
                            type="text" value={profile.first_name} onChange={e => setProfile({ ...profile, first_name: e.target.value })}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Last Name</label>
                        <input
                          type="text" value={profile.last_name} onChange={e => setProfile({ ...profile, last_name: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3 text-slate-400" size={18} />
                          <input
                            type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-3 text-slate-400" size={18} />
                          <input
                            type="text" value={profile.whatsapp} onChange={e => setProfile({ ...profile, whatsapp: e.target.value })}
                            placeholder="+1 (555) 000-0000"
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Bio / About</label>
                      <div className="relative">
                        <FileText className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                        <textarea
                          rows={4} value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })}
                          placeholder="Briefly describe your role or expertise..."
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm resize-y"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        type="submit" disabled={profileSaving}
                        className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 active:scale-95"
                      >
                        {profileSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Save Profile
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: SECURITY */}
            {activeTab === 'security' && (
              <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center gap-4">
                  <div className="h-12 w-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center shadow-inner border border-slate-200">
                    <Lock size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">Update Password</h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Ensure your account uses a strong, unique password.</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Current Password</label>
                    <input
                      type="password" required
                      value={passwords.old} onChange={e => setPasswords({ ...passwords, old: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono shadow-sm"
                    />
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">New Password</label>
                    <input
                      type="password" required minLength={8}
                      value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono shadow-sm"
                    />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Must be at least 8 characters.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Confirm New Password</label>
                    <input
                      type="password" required minLength={8}
                      value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono shadow-sm"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit" disabled={passLoading}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 active:scale-95"
                    >
                      {passLoading ? <Loader2 className="animate-spin" size={18} /> : <Key size={18} />}
                      Change Password
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: ACCESS CONTROL (ADMIN ONLY) */}
            {activeTab === 'access' && isAdmin && (
              <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">

                {accessError ? (
                  <div className="flex flex-col items-center justify-center p-16 text-center">
                    <ShieldAlert size={48} className="text-rose-400 mb-4" />
                    <h3 className="text-xl font-black text-slate-900 mb-2">Firewall Blocked Request</h3>
                    <p className="text-sm font-medium text-slate-500 max-w-sm">{accessError}</p>
                  </div>
                ) : (
                  <>
                    <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner border border-rose-200">
                          <Shield size={24} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-slate-900">System Access</h2>
                          <p className="text-slate-500 text-sm mt-1 font-medium">Manage platform roles and account locks.</p>
                        </div>
                      </div>
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
                        <input
                          type="text" placeholder="Search accounts..."
                          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                          className="w-full pl-11 pr-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-8 py-5">Account Identity</th>
                            <th className="px-8 py-5 w-56">System Role</th>
                            <th className="px-8 py-5 w-40 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {accessLoading ? (
                            <tr><td colSpan="3" className="p-16 flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={32} /></td></tr>
                          ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="3" className="p-16 text-center text-slate-500 font-bold">No accounts found.</td></tr>
                          ) : (
                            filteredUsers.map(u => (
                              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">

                                <td className="px-8 py-4">
                                  <div className="flex items-center gap-4">
                                    <div className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center font-black text-white shadow-sm text-lg border border-white/20
                                      ${u.role === 'owner' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' :
                                        u.role === 'teacher' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                                          'bg-gradient-to-br from-slate-400 to-slate-600'}`}
                                    >
                                      {u.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-900">{u.username}</p>
                                      <p className="text-xs font-semibold text-slate-500 truncate max-w-[200px]">{u.email || 'No email set'}</p>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-8 py-4">
                                  <div className="relative">
                                    <select
                                      value={u.role}
                                      onChange={e => handleRoleChange(u.id, e.target.value)}
                                      disabled={savingId === u.id}
                                      className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none disabled:opacity-50 cursor-pointer"
                                    >
                                      <option value="owner">Owner</option>
                                      <option value="head_manager">Head Manager</option>
                                      <option value="manager">Manager</option>
                                      <option value="teacher">Ustad / Teacher</option>
                                      <option value="student">Student</option>
                                    </select>
                                    <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">▼</div>
                                  </div>
                                </td>

                                <td className="px-8 py-4 flex justify-center">
                                  <button
                                    onClick={() => toggleAccess(u.id, u.is_active)}
                                    disabled={savingId === u.id}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 ${u.is_active
                                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                                      : 'text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100'
                                      }`}
                                  >
                                    {savingId === u.id ? <Loader2 size={14} className="animate-spin" /> : (u.is_active ? <UserCheck size={14} /> : <UserX size={14} />)}
                                    {u.is_active ? 'Active' : 'Locked'}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}