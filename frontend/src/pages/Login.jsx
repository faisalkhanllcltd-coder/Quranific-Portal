import { useState, useRef, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ShieldCheck, Leaf } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const navigate = useNavigate();
  const usernameInputRef = useRef(null);

  // Auto-focus for frictionless Apple-like UX
  useEffect(() => {
    if (usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await api.post('/accounts/login/', {
        username: username,
        password: password
      });

      // ── STRICT SECURITY ──
      const { access, refresh, username: returnedUsername, user_type } = response.data;

      if (!access) throw new Error("Secure token not provided by server.");

      localStorage.setItem('access', access);
      localStorage.setItem('refresh', refresh);
      localStorage.setItem('username', returnedUsername);
      localStorage.setItem('user_type', user_type);

      navigate('/dashboard');

    } catch (error) {
      console.error("Authentication Failed:", error);
      if (error.response && error.response.status === 401) {
        setErrorMsg("Incorrect username or password. Please try again.");
      } else if (error.response?.data?.detail) {
        setErrorMsg(error.response.data.detail);
      } else {
        setErrorMsg("System unreachable. Check your network connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // ── BACKGROUND: Kimi / Apple Ambient Mesh ──
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#fbfdf9] font-sans selection:bg-emerald-200 selection:text-emerald-900">

      {/* Ambient Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-200/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-lime-100/50 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '12s' }}></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] bg-teal-100/40 rounded-full mix-blend-multiply filter blur-[150px] opacity-70 animate-pulse" style={{ animationDuration: '10s' }}></div>

      {/* ── FOREGROUND: Glassmorphism Card ── */}
      <div className="w-full max-w-[420px] p-8 sm:p-10 z-10 mx-4 bg-white/60 backdrop-blur-3xl border border-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] rounded-[2.5rem] animate-in fade-in zoom-in-95 duration-700 ease-out">

        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-[1.25rem] flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/30 mb-6 border border-white/20">
            <Leaf size={32} className="drop-shadow-sm" />
          </div>
          <h2 className="text-[28px] font-black text-slate-800 tracking-tight mb-2">
            Welcome Back
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            Sign in to your Quranific Workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Inline Error Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50/80 backdrop-blur-sm border border-rose-100/50 rounded-2xl text-sm font-bold text-rose-600 flex items-start gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
              <input
                ref={usernameInputRef}
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 bg-white/50 border border-white focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all text-slate-800 font-bold rounded-2xl placeholder:text-slate-400/70 placeholder:font-medium shadow-sm"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1 mr-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-white/50 border border-white focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all text-slate-800 font-bold rounded-2xl placeholder:text-slate-400/70 placeholder:font-medium tracking-widest shadow-sm"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !username || !password}
              className={`w-full py-4 px-4 font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm tracking-wide
                ${loading || !username || !password
                  ? 'bg-slate-300 shadow-none cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] border border-white/10'
                }`}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        <div className="text-center mt-10">
          <div className="inline-flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-100/50 border border-slate-200/50 backdrop-blur-sm">
            <ShieldCheck size={12} className="text-emerald-500" />
            End-to-End Encrypted
          </div>
        </div>
      </div>
    </div>
  );
}