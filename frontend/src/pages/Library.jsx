import useDocumentTitle from '../hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import api from '../api';
import {
  Library as LibraryIcon, Plus, FileText,
  ExternalLink, User, Download, AlertCircle,
  X, Loader2, Edit2, Trash2, AlertTriangle, BookOpen
} from 'lucide-react';

export default function Library() {
  useDocumentTitle('Library');
  const [materials, setMaterials] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal States
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Action States
  const [isEditing, setIsEditing] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [submitProcessing, setSubmitProcessing] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    id: null, title: '', description: '', link: '', student: ''
  });

  const userType = localStorage.getItem('user_type') || 'student';
  const isTeacher = ['teacher', 'owner', 'head_manager', 'manager'].includes(userType);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const res = await api.get('materials/');
      // PAGINATION FIX: Handle both flat arrays and DRF paginated objects
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setMaterials(data);
      setError('');
    } catch (err) {
      setError('Failed to synchronize library resources.');
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
    fetchMaterials();
    fetchStudents();
  }, [userType]);

  // --- Handlers: Modal Triggers ---
  const openCreateModal = () => {
    setIsEditing(false);
    setFormError('');
    setFormData({ id: null, title: '', description: '', link: '', student: '' });
    setShowMaterialModal(true);
  };

  const openEditModal = (material) => {
    setIsEditing(true);
    setFormError('');
    setFormData({
      id: material.id,
      title: material.title,
      description: material.description || '',
      link: material.link,
      student: material.student || ''
    });
    setShowMaterialModal(true);
  };

  const confirmDelete = (material) => {
    setActiveMaterial(material);
    setShowDeleteModal(true);
  };

  // --- Handlers: API Submissions ---
  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    setSubmitProcessing(true);
    setFormError('');

    try {
      if (isEditing) {
        await api.patch(`materials/${formData.id}/`, formData);
      } else {
        await api.post('materials/', formData);
      }
      setShowMaterialModal(false);
      fetchMaterials();
    } catch (err) {
      const detail = err.response?.data;
      if (detail && typeof detail === 'object') {
        const firstKey = Object.keys(detail)[0];
        const msg = Array.isArray(detail[firstKey]) ? detail[firstKey][0] : detail[firstKey];
        setFormError(`${firstKey.replace('_', ' ').toUpperCase()}: ${msg}`);
      } else {
        setFormError("Failed to save resource. Please verify your inputs.");
      }
    } finally {
      setSubmitProcessing(false);
    }
  };

  const executeDelete = async () => {
    setSubmitProcessing(true);
    try {
      await api.delete(`materials/${activeMaterial.id}/`);
      setShowDeleteModal(false);
      fetchMaterials();
    } catch (err) {
      alert("Failed to delete resource. It may have already been removed.");
    } finally {
      setSubmitProcessing(false);
    }
  };

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Syncing Library...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">

      {/* ── HEADER ── */}
      <div className="pt-8 pb-6 mb-8 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-sm border border-emerald-200/50">
              <LibraryIcon size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Resource Library</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            {isTeacher ? "Manage and distribute PDFs, links, and study materials." : "Access study materials provided by your teacher."}
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={openCreateModal}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors active:scale-95 flex items-center gap-2"
          >
            <Plus size={18} /> Attach Resource
          </button>
        )}
      </div>

      {error && (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 font-bold animate-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── RESOURCE GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {materials.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl">
            <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
              <BookOpen size={32} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-1">Library is Empty</h3>
            <p className="text-slate-500 text-sm">No resources have been shared with you yet.</p>
          </div>
        ) : (
          materials.map(item => (
            <div key={item.id} className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">

              {/* Teacher Actions (Edit / Delete) */}
              {isTeacher && (
                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500" title="Edit" aria-label={`Edit resource ${item.title}`}>
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => confirmDelete(item)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500" title="Delete" aria-label={`Delete resource ${item.title}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-start gap-4 mb-4">
                  <div className="h-12 w-12 bg-slate-50 border border-slate-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <FileText size={20} />
                  </div>
                  <div className="pr-12"> {/* Padding to avoid overlapping with action buttons */}
                    <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400">
                      {new Date(item.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                <p className="text-slate-600 text-sm mb-6 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {item.description || <span className="italic text-slate-400">No description provided.</span>}
                </p>

                {isTeacher && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold bg-slate-50 px-3 py-2 rounded-lg mb-6 border border-slate-100">
                    <User size={14} className="text-slate-400" />
                    Shared with: <span className="text-slate-900">{item.student_name}</span>
                  </div>
                )}
              </div>

              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-emerald-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-emerald-500/20"
              >
                <ExternalLink size={16} /> Open Resource
              </a>
            </div>
          ))
        )}
      </div>

      {/* ── MODALS ── */}

      {/* 1. Create/Edit Material Modal */}
      {showMaterialModal && isTeacher && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowMaterialModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 rounded-lg" aria-label="Close resource modal"><X size={20} /></button>
            <h2 className="text-xl font-bold text-slate-900 mb-1">{isEditing ? 'Edit Resource' : 'Attach Resource'}</h2>
            <p className="text-sm text-slate-500 mb-6">{isEditing ? 'Update the details of this library item.' : 'Upload a new link or document for a student.'}</p>

            <form onSubmit={handleSaveMaterial} className="space-y-5">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" /> {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Student <span className="text-rose-500">*</span></label>
                <select
                  required value={formData.student} onChange={(e) => setFormData({ ...formData, student: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">-- Assign to Student --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Resource Title <span className="text-rose-500">*</span></label>
                <input
                  type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. Tajweed Rules Chapter 1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                <textarea
                  rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  placeholder="Brief notes about this resource..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Resource Link <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <ExternalLink size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="url" required value={formData.link} onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowMaterialModal(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={submitProcessing} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitProcessing ? <Loader2 size={16} className="animate-spin" /> : (isEditing ? 'Save Changes' : 'Share Resource')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
            <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Resource?</h2>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to remove <strong>"{activeMaterial?.title}"</strong>? The assigned student will no longer be able to access this link.
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

    </div>
  );
}