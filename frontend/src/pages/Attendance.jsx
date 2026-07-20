import useDocumentTitle from '../hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import api from '../api';
import {
  CheckCircle, XCircle, Clock, Calendar,
  UserCheck, AlertCircle, RefreshCw, BookOpen, User, Loader2
} from 'lucide-react';

// ── STATUS CONFIGURATION ───────────────────────────────────────────────────
const STATUSES = [
  {
    value: 'Present',
    label: 'Present',
    icon: CheckCircle,
    active: 'bg-emerald-500 text-white shadow-md border-emerald-600 z-10',
    hover: 'bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 border-slate-200',
  },
  {
    value: 'Absent',
    label: 'Absent',
    icon: XCircle,
    active: 'bg-rose-500 text-white shadow-md border-rose-600 z-10',
    hover: 'bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 border-slate-200',
  },
  {
    value: 'Late',
    label: 'Late',
    icon: Clock,
    active: 'bg-amber-500 text-white shadow-md border-amber-600 z-10',
    hover: 'bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-600 border-slate-200',
  },
  {
    value: 'Leave',
    label: 'Leave',
    icon: BookOpen,
    active: 'bg-blue-500 text-white shadow-md border-blue-600 z-10',
    hover: 'bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border-slate-200',
  },
];

const STATUS_BADGE = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Absent: 'bg-rose-50 text-rose-700 border-rose-200',
  Late: 'bg-amber-50 text-amber-700 border-amber-200',
  Leave: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function Attendance() {
  useDocumentTitle('Attendance');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState({});
  const [errorMsg, setErrorMsg] = useState('');

  const today = new Date().toLocaleDateString('en-CA');
  const userType = (localStorage.getItem('user_type') || '').toLowerCase();
  const username = localStorage.getItem('username') || '';

  useEffect(() => {
    loadDailyRollCall();
  }, []);

  const loadDailyRollCall = async () => {
    setLoading(true);
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        api.get('students/'),
        api.get(`attendance/?date=${today}`)
      ]);

      let allStudents = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes.data.results || []);
      const history = Array.isArray(attendanceRes.data) ? attendanceRes.data : (attendanceRes.data.results || []);

      if (userType === 'teacher') {
        allStudents = allStudents.filter(s =>
          s.assigned_teacher &&
          s.assigned_teacher.toLowerCase() === username.toLowerCase() &&
          (s.status || '').toLowerCase() === 'joined'
        );
      } else {
        allStudents = allStudents.filter(s => (s.status || '').toLowerCase() === 'joined');
      }

      const mergedData = allStudents.map(student => {
        const record = history.find(r => r.student === student.id);
        return {
          ...student,
          tempStatus: record ? record.status : null,
          attendanceRecordId: record ? record.id : null
        };
      });

      setStudents(mergedData);
      setErrorMsg('');
    } catch (error) {
      console.error('Attendance Sync Error:', error);
      setErrorMsg('Failed to synchronize attendance records. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (studentId, status) => {
    if (marking[studentId]) return;
    setMarking(prev => ({ ...prev, [studentId]: status }));

    try {
      const student = students.find(s => s.id === studentId);
      if (student && student.attendanceRecordId) {
        await api.patch(`attendance/${student.attendanceRecordId}/`, { status });
      } else {
        await api.post('attendance/', { student: studentId, status: status, date: today });
      }

      // Optistic UI Update for zero latency feel
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, tempStatus: status } : s));

      // Background sync to ensure ID is captured if it was a new record
      const attendanceRes = await api.get(`attendance/?date=${today}`);
      const history = Array.isArray(attendanceRes.data) ? attendanceRes.data : (attendanceRes.data.results || []);
      setStudents(prev => prev.map(s => {
        if (s.id === studentId) {
          const updatedRecord = history.find(r => r.student === studentId);
          return { ...s, attendanceRecordId: updatedRecord?.id };
        }
        return s;
      }));

    } catch (error) {
      console.error('Save Error:', error);
      alert('Failed to record attendance. Please try again.');
      // Revert optimistic update on failure
      loadDailyRollCall();
    } finally {
      setMarking(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const presentCount = students.filter(s => s.tempStatus === 'Present').length;
  const absentCount = students.filter(s => s.tempStatus === 'Absent').length;
  const lateCount = students.filter(s => s.tempStatus === 'Late').length;
  const leaveCount = students.filter(s => s.tempStatus === 'Leave').length;
  const pendingCount = students.filter(s => !s.tempStatus).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Loading Register...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">

      {/* ── HEADER ── */}
      <div className="pt-8 pb-6 mb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-sm border border-emerald-200/50">
              <Calendar size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Daily Roll Call</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
            Recording attendance for:
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadDailyRollCall}
            className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
            title="Sync Data"
          >
            <RefreshCw size={18} />
          </button>
          <div className="px-4 py-2 bg-white text-slate-700 rounded-lg text-sm font-bold border border-slate-200 shadow-sm flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-500" />
            Class Size: {students.length}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 font-bold animate-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* ── SUMMARY DASHBOARD ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-emerald-600">{presentCount}</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Present</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-rose-600">{absentCount}</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Absent</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-amber-600">{lateCount}</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Late</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-blue-600">{leaveCount}</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">On Leave</span>
        </div>
        <div className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center justify-center ${pendingCount > 0 ? 'ring-2 ring-slate-200 bg-slate-50' : ''}`}>
          <span className="text-2xl font-black text-slate-700">{pendingCount}</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Unmarked</span>
        </div>
      </div>

      {/* ── ATTENDANCE TABLE ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {students.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <User size={32} className="text-slate-300" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">No Students Found</h3>
            <p className="text-sm text-slate-500 max-w-sm">Students must be actively enrolled and assigned to you to appear on this register.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                  <th className="p-4 pl-8 font-semibold">Student Name</th>
                  <th className="p-4 font-semibold w-40">Current Status</th>
                  <th className="p-4 font-semibold text-center w-[340px]">Mark Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const isProcessing = marking[student.id];

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">

                      {/* Identity Column */}
                      <td className="p-4 pl-8">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold shadow-sm border border-slate-200">
                            {student.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{student.full_name}</div>
                            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">ID: #{student.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border flex w-fit items-center gap-1.5 ${STATUS_BADGE[student.tempStatus] || 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                          {student.tempStatus ? (
                            <>
                              {student.tempStatus === 'Present' && <CheckCircle size={12} />}
                              {student.tempStatus === 'Absent' && <XCircle size={12} />}
                              {student.tempStatus === 'Late' && <Clock size={12} />}
                              {student.tempStatus === 'Leave' && <BookOpen size={12} />}
                              {student.tempStatus}
                            </>
                          ) : (
                            'Pending'
                          )}
                        </span>
                      </td>

                      {/* Action Column (Segmented Control) */}
                      <td className="p-4 text-center">
                        <div className="inline-flex rounded-lg shadow-sm border border-slate-200 bg-white overflow-hidden">
                          {STATUSES.map(({ value, label, icon: Icon, active, hover }, index) => {
                            const isSelected = student.tempStatus === value;
                            const isWaiting = isProcessing === value;

                            return (
                              <button
                                key={value}
                                onClick={() => markAttendance(student.id, value)}
                                disabled={!!isProcessing || isSelected}
                                title={`Mark ${label}`}
                                className={`
                                  relative px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200
                                  ${index !== 0 ? 'border-l border-slate-200' : ''}
                                  ${isSelected ? active : hover}
                                  ${!!isProcessing && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                              >
                                {isWaiting ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Icon size={16} />
                                )}
                                <span className="hidden sm:inline">{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}