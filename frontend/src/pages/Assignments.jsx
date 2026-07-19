import { useState, useEffect } from 'react';
import api from '../api';
import {
  BookOpen, Plus, FileText, CheckCircle,
  Clock, Link as LinkIcon, User, Send, Edit, AlertCircle,
  X, Loader2, Award, CalendarClock, Trash2, Edit2, AlertTriangle
} from 'lucide-react';

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal States
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Action States
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [submitProcessing, setSubmitProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form States
  const [formData, setFormData] = useState({ id: null, title: '', description: '', due_date: '', student: '' });
  const [subData, setSubData] = useState({ content_text: '', content_link: '' });
  const [gradeData, setGradeData] = useState({ grade: '', feedback: '' });

  const userType = localStorage.getItem('user_type') || 'student';
  const isTeacher = ['teacher', 'owner', 'head_manager', 'manager'].includes(userType);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await api.get('assignments/');
      // PAGINATION FIX: Handle both flat arrays and DRF paginated objects
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setAssignments(data);
    } catch (err) {
      setError('Failed to synchronize assignment data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!isTeacher) return;
    try {
      const res = await api.get('students/');
      // PAGINATION FIX: Handle both flat arrays and DRF paginated objects
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setStudents(data);
    } catch (err) {
      console.error("Could not fetch students", err);
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchStudents();
  }, [userType]);

  // --- Handlers: Assignments ---
  const openCreateAssignment = () => {
    setIsEditing(false);
    setFormData({ id: null, title: '', description: '', due_date: '', student: '' });
    setShowAssignmentModal(true);
  };

  const openEditAssignment = (task) => {
    setIsEditing(true);
    setFormData({
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.due_date ? task.due_date.slice(0, 16) : '', // format for datetime-local input
      student: task.student || ''
    });
    setShowAssignmentModal(true);
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    setSubmitProcessing(true);
    try {
      if (isEditing) {
        await api.patch(`assignments/${formData.id}/`, formData);
      } else {
        await api.post('assignments/', formData);
      }
      setShowAssignmentModal(false);
      fetchAssignments();
    } catch (err) {
      alert("Failed to save assignment. Please check your inputs.");
    } finally {
      setSubmitProcessing(false);
    }
  };

  const confirmDelete = (task) => {
    setActiveAssignment(task);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    setSubmitProcessing(true);
    try {
      await api.delete(`assignments/${activeAssignment.id}/`);
      setShowDeleteModal(false);
      fetchAssignments();
    } catch (err) {
      alert("Failed to delete assignment.");
    } finally {
      setSubmitProcessing(false);
    }
  };

  // --- Handlers: Submissions & Grading ---
  const handleSubmitWork = async (e) => {
    e.preventDefault();
    setSubmitProcessing(true);
    try {
      await api.post('submissions/', {
        assignment: activeAssignment.id,
        student: activeAssignment.student,
        content_text: subData.content_text,
        content_link: subData.content_link
      });
      setShowSubmitModal(false);
      setSubData({ content_text: '', content_link: '' });
      fetchAssignments();
    } catch (err) {
      alert("Failed to submit work. Please try again.");
    } finally {
      setSubmitProcessing(false);
    }
  };

  const handleGradeSubmission = async (e) => {
    e.preventDefault();
    setSubmitProcessing(true);
    try {
      await api.patch(`submissions/${activeSubmission.id}/`, gradeData);
      setShowGradeModal(false);
      setGradeData({ grade: '', feedback: '' });
      fetchAssignments();
    } catch (err) {
      alert("Failed to record grade.");
    } finally {
      setSubmitProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Syncing Coursework...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">

      {/* ── HEADER ── */}
      <div className="pt-8 pb-6 mb-8 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-sm border border-emerald-200/50">
              <BookOpen size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Coursework</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            {isTeacher ? "Manage assignments, track progress, and evaluate submissions." : "View your pending tasks and turn in homework."}
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={openCreateAssignment}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors active:scale-95 flex items-center gap-2"
          >
            <Plus size={18} /> Assign New Task
          </button>
        )}
      </div>

      {error && (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 font-bold animate-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── ASSIGNMENT GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {assignments.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl">
            <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
              <FileText size={32} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-1">No Assignments Yet</h3>
            <p className="text-slate-500 text-sm">When coursework is assigned, it will appear here.</p>
          </div>
        ) : (
          assignments.map(item => {
            const hasSubmission = item.submissions && item.submissions.length > 0;
            const sub = hasSubmission ? item.submissions[0] : null;
            const isGraded = sub && sub.graded_at;

            return (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md flex flex-col justify-between transition-all duration-300 relative overflow-hidden group">

                {/* Status Accent Bar */}
                <div className={`absolute top-0 left-0 w-1.5 h-full ${isGraded ? 'bg-emerald-500' : hasSubmission ? 'bg-amber-400' : 'bg-slate-300'
                  }`} />

                <div className="p-6 pl-8 flex-1">
                  <div className="flex justify-between items-start mb-3 gap-4">
                    <h3 className="text-lg font-bold text-slate-900 leading-tight pr-12">
                      {item.title}
                    </h3>

                    {/* SaaS Teacher Actions (Edit / Delete) */}
                    {isTeacher && (
                      <div className="absolute top-6 right-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditAssignment(item)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => confirmDelete(item)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="mb-4">
                    {isGraded ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                        <CheckCircle size={12} /> Graded
                      </span>
                    ) : hasSubmission ? (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                        <Clock size={12} /> Reviewing
                      </span>
                    ) : (
                      <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                        Pending
                      </span>
                    )}
                  </div>

                  <p className="text-slate-600 text-sm mb-6 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                    {item.description}
                  </p>

                  {/* Meta Tags */}
                  <div className="space-y-2 mb-6">
                    {isTeacher && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <User size={14} className="text-slate-400" />
                        Assigned to: <span className="text-slate-900">{item.student_name}</span>
                      </div>
                    )}
                    {item.due_date && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <CalendarClock size={14} className="text-slate-400" />
                        Due: <span className="text-slate-900">{new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </div>

                  {/* Submission Box */}
                  {hasSubmission && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Submitted Work</p>
                      {sub.content_text && (
                        <p className="text-sm text-slate-800 italic border-l-2 border-slate-300 pl-3 mb-3 whitespace-pre-wrap">"{sub.content_text}"</p>
                      )}
                      {sub.content_link && (
                        <a href={sub.content_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md transition-colors">
                          <LinkIcon size={12} /> Open Attachment
                        </a>
                      )}

                      {isGraded && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center gap-2 text-sm mb-1">
                            <Award size={16} className="text-emerald-500" />
                            <span className="font-bold text-slate-900">Final Grade:</span>
                            <span className="text-emerald-600 font-black">{sub.grade}</span>
                          </div>
                          {sub.feedback && <p className="text-sm text-slate-600 mt-1.5 bg-white p-2.5 rounded-lg border border-slate-100">{sub.feedback}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="p-4 pl-8 border-t border-slate-100 bg-slate-50/50">
                  {!isTeacher && !hasSubmission && (
                    <button
                      onClick={() => { setActiveAssignment(item); setShowSubmitModal(true); }}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Send size={16} /> Turn In Homework
                    </button>
                  )}
                  {isTeacher && hasSubmission && !isGraded && (
                    <button
                      onClick={() => { setActiveSubmission(sub); setShowGradeModal(true); }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Edit size={16} /> Grade Submission
                    </button>
                  )}
                  {isTeacher && !hasSubmission && (
                    <p className="text-xs text-slate-400 font-semibold flex items-center justify-center gap-1.5 py-1">
                      <Clock size={14} /> Awaiting student submission...
                    </p>
                  )}
                  {!isTeacher && isGraded && (
                    <p className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1.5 py-1 uppercase tracking-wider">
                      Assignment Completed
                    </p>
                  )}
                  {!isTeacher && hasSubmission && !isGraded && (
                    <p className="text-xs text-amber-600 font-bold flex items-center justify-center gap-1.5 py-1 uppercase tracking-wider">
                      Waiting for Teacher Review
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── MODALS ── */}

      {/* 1. Create/Edit Assignment Modal (Dynamic SaaS Pattern) */}
      {showAssignmentModal && isTeacher && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowAssignmentModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"><X size={20} /></button>
            <h2 className="text-xl font-bold text-slate-900 mb-1">{isEditing ? 'Edit Coursework' : 'Assign Coursework'}</h2>
            <p className="text-sm text-slate-500 mb-6">{isEditing ? 'Update the details of this assignment.' : 'Create a new task for a student.'}</p>

            <form onSubmit={handleSaveAssignment} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Student <span className="text-red-500">*</span></label>
                <select
                  required value={formData.student} onChange={(e) => setFormData({ ...formData, student: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">-- Select a student --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Task Title <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. Read Surah Al-Fatihah"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Detailed Instructions <span className="text-red-500">*</span></label>
                <textarea
                  required rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  placeholder="Provide clear steps for the student..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Due Date (Optional)</label>
                <input
                  type="datetime-local" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowAssignmentModal(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={submitProcessing} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitProcessing ? <Loader2 size={16} className="animate-spin" /> : (isEditing ? 'Save Changes' : 'Publish Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Delete Confirmation Modal (Safety First) */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
            <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Assignment?</h2>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete <strong>"{activeAssignment?.title}"</strong>? This action cannot be undone and will remove any associated student submissions.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={executeDelete} disabled={submitProcessing} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {submitProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Submit Work Modal (Student) */}
      {showSubmitModal && !isTeacher && activeAssignment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowSubmitModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"><X size={20} /></button>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Turn In Homework</h2>
            <p className="text-sm text-slate-500 mb-6">Submitting work for: <strong className="text-slate-800">{activeAssignment.title}</strong></p>

            <form onSubmit={handleSubmitWork} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Written Answer</label>
                <textarea
                  rows={5} value={subData.content_text} onChange={(e) => setSubData({ ...subData, content_text: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  placeholder="Type your response here..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Attachment Link (Optional)</label>
                <div className="relative">
                  <LinkIcon size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="url" value={subData.content_link} onChange={(e) => setSubData({ ...subData, content_link: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowSubmitModal(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={submitProcessing || (!subData.content_text && !subData.content_link)} className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Turn In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Grade Submission Modal (Teacher) */}
      {showGradeModal && isTeacher && activeSubmission && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowGradeModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"><X size={20} /></button>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Evaluate Submission</h2>
            <p className="text-sm text-slate-500 mb-6">Reviewing work from: <strong className="text-slate-800">{activeSubmission.student_name}</strong></p>

            <form onSubmit={handleGradeSubmission} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Final Grade <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={gradeData.grade} onChange={(e) => setGradeData({ ...gradeData, grade: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. A+, 95/100, Excellent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Teacher Feedback (Optional)</label>
                <textarea
                  rows={4} value={gradeData.feedback} onChange={(e) => setGradeData({ ...gradeData, feedback: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  placeholder="Provide constructive feedback..."
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowGradeModal(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={submitProcessing} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Record Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}