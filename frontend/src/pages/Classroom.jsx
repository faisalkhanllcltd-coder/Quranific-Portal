import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useConnectionState,
  useRoomContext
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import api from '../api';
import { Video, LogOut, AlertCircle, RefreshCw, Shield, Loader2, Wifi } from 'lucide-react';

// ── CONFIG ─────────────────────────────────────────────────────────────────
// IMPORTANT: Ensure VITE_LIVEKIT_URL is set in your frontend/.env file!
// Example: VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
const LIVEKIT_WS_URL = import.meta.env.VITE_LIVEKIT_URL;

// ── SUB-COMPONENT: CONNECTION STATUS INDICATOR ────────────────────────────
function ConnectionStatusBadge() {
  const state = useConnectionState();

  if (state === ConnectionState.Connecting) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Connecting</span>
      </div>
    );
  }
  if (state === ConnectionState.Reconnecting) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-bounce" />
        <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Reconnecting...</span>
      </div>
    );
  }
  if (state === ConnectionState.Connected) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/30 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Secure Connection</span>
      </div>
    );
  }
  if (state === ConnectionState.Disconnected) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        <span className="text-rose-400 text-[10px] font-black uppercase tracking-widest">Disconnected</span>
      </div>
    );
  }
  return null;
}

// ── SUB-COMPONENT: DYNAMIC HEADER ─────────────────────────────────────────
// Placed inside LiveKitRoom so it can access the active room context.
function ClassroomHeader({ roomName }) {
  const room = useRoomContext();

  const handleCleanDisconnect = async () => {
    if (room) {
      // Cleanly sever the WebRTC connection. 
      // This will automatically trigger the 'onDisconnected' prop on the parent.
      await room.disconnect();
    }
  };

  return (
    <header className="h-16 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 sm:px-6 shrink-0 z-50">
      {/* Left: Branding & Room Info */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/50 shrink-0">
          <Video size={20} className="text-white" />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-slate-200 text-sm sm:text-base font-black tracking-tight leading-none mb-0.5 flex items-center gap-2">
            Quranific Live <Wifi size={14} className="text-emerald-500 hidden sm:block" />
          </p>
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-none">
            Session: <span className="text-emerald-400 font-mono">{roomName}</span>
          </p>
        </div>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        <ConnectionStatusBadge />

        <button
          onClick={handleCleanDisconnect}
          className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg text-xs sm:text-sm font-bold transition-all shadow-lg shadow-rose-900/20 active:scale-95 border border-rose-500/50"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">End Session</span>
        </button>
      </div>
    </header>
  );
}

// ── MAIN CLASSROOM COMPONENT ──────────────────────────────────────────────
export default function Classroom() {
  const { roomName } = useParams();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const unmounted = useRef(false);

  // Configuration guard
  useEffect(() => {
    if (!LIVEKIT_WS_URL) {
      console.error("[Configuration Error] VITE_LIVEKIT_URL is not defined in the environment. WebRTC connections cannot be established.");
      setError('Configuration error — contact support');
      setLoading(false);
    }
  }, []);

  // ── FETCH TOKEN FROM BACKEND ────────────────────────────────────────────
  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await api.post('live/token/', {
        room_name: roomName,
      });

      if (!unmounted.current) {
        setToken(res.data.token);
      }
    } catch (err) {
      if (!unmounted.current) {
        const detail =
          err.response?.data?.detail ??
          'Failed to securely connect to the classroom. Please try again.';
        setError(detail);
      }
    } finally {
      if (!unmounted.current) setLoading(false);
    }
  }, [roomName]);

  useEffect(() => {
    if (!LIVEKIT_WS_URL) return; // Handled by configuration guard

    if (roomName) {
      unmounted.current = false;
      fetchToken();
    } else {
      setError('No room designation provided. Access Denied.');
      setLoading(false);
    }

    return () => {
      unmounted.current = true;
    };
  }, [roomName, fetchToken]);

  // ── LEAVE HANDLER (Fired when WebRTC disconnects) ───────────────────────
  const handleLeave = useCallback(() => {
    // Fire and forget endpoint to log session end manually as a fallback
    api.post('live/end-session/', { room_name: roomName }).catch(() => { });
    navigate('/dashboard');
  }, [roomName, navigate]);

  const handleMediaDeviceFailure = (e) => {
    console.error("[Hardware] Media Device Failure:", e);
    setError("Camera or Microphone access blocked. Please grant browser permissions and try again.");
    setToken("");
  };

  // ── PREMIUM LOADING STATE ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white gap-8 relative overflow-hidden animate-in fade-in duration-500">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
            <div className="absolute inset-0 border-2 border-emerald-500/40 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]" />
            <div className="h-24 w-24 bg-emerald-900/50 backdrop-blur-md border border-emerald-500/30 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <Shield className="text-emerald-400 w-10 h-10" />
            </div>
          </div>

          <h2 className="text-2xl font-black mb-2 tracking-tight">Establishing Secure Connection</h2>
          <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
            <Loader2 size={16} className="animate-spin text-emerald-500" />
            Negotiating handshakes for room: <span className="text-emerald-400 font-mono bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900">{roomName}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── PREMIUM ERROR STATE ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-4 relative overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-rose-500/20 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="h-20 w-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 border border-rose-500/20">
              <AlertCircle size={36} className="text-rose-400" />
            </div>

            <h2 className="text-2xl font-black mb-3 text-white tracking-tight">Access Restricted</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">{error}</p>

            <div className="flex flex-col w-full gap-3">
              <button
                onClick={fetchToken}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/50"
              >
                <RefreshCw size={16} /> Attempt Reconnection
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-colors border border-white/10 flex items-center justify-center"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN CLASSROOM UI ──────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-[#09090b] flex flex-col overflow-hidden font-sans animate-in fade-in duration-700" data-lk-theme="default">

      {/* ── SECURE ROOM FRAME ── */}
      <LiveKitRoom
        serverUrl={LIVEKIT_WS_URL}
        token={token}
        connect={true}
        video={true}
        audio={true}
        onDisconnected={handleLeave}
        onMediaDeviceFailure={handleMediaDeviceFailure}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <ClassroomHeader roomName={roomName} />

        {/* LiveKit Workspace (Video Grid & Controls) */}
        <div className="flex-1 min-h-0 bg-black relative">
          <VideoConference />
          <RoomAudioRenderer />
        </div>
      </LiveKitRoom>

    </div>
  );
}