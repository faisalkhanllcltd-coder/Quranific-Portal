import useDocumentTitle from '../hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import {
  User, CreditCard, Edit2, Save,
  ArrowLeft, CheckCircle, Clock, Users, DollarSign
} from 'lucide-react';

export default function TeacherProfile() {
  useDocumentTitle('Teacher Profile');
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [teacher, setTeacher] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    fetchTeacher();
  }, [id]);

  const fetchTeacher = async () => {
    try {
      const res = await api.get(`accounts/teachers/${id}/`);
      setTeacher(res.data);
      
      const tData = res.data.teacher_data || {};
      setFormData({
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
        base_salary: tData.base_salary || 0,
        salary_per_student: tData.salary_per_student || 0,
      });
    } catch (err) {
      console.error("Error loading teacher", err);
      alert("Teacher profile not found.");
      navigate('/staff');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setSaveStatus(null);
    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        profile: {
          teacher_data: {
            base_salary: formData.base_salary,
            salary_per_student: formData.salary_per_student
          }
        }
      };

      await api.patch(`accounts/teachers/${id}/`, payload);
      setSaveStatus('success');
      setIsEditing(false);
      fetchTeacher(); 
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('error');
      console.error(err);
      alert("Error saving changes. Check your connection.");
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Ustad Profile...</p>
    </div>
  );

  if (!teacher) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 px-4 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8 pt-4">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => navigate('/staff')} 
            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-2xl transition shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Back to staff list"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight flex items-center gap-3">
              {teacher.first_name ? `${teacher.first_name} ${teacher.last_name}` : teacher.username}
            </h1>
            <div className="flex items-center gap-3 mt-1">
               <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  teacher.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
               }`}>
                  {teacher.is_active ? 'Active' : 'Locked'}
               </span>
               <span className="text-slate-400 text-xs font-bold">Ustad ID: #{teacher.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="text-emerald-500 font-bold text-sm flex items-center gap-1 mr-2 animate-bounce">
              <CheckCircle size={16} /> Saved!
            </span>
          )}
          
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)} 
              className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3.5 rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-xl active:scale-95"
            >
              <Edit2 size={16} /> Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
               <button 
                onClick={() => setIsEditing(false)} 
                className="px-6 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-slate-900 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdate} 
                className="flex items-center gap-2 bg-brand-primary text-white px-8 py-3.5 rounded-[1.25rem] font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-primary/30 transition active:scale-95"
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: PRIMARY INFO & FINANCIALS */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="h-32 w-32 bg-gradient-to-br from-indigo-50 to-purple-100 rounded-[2.2rem] mx-auto flex items-center justify-center text-5xl font-black text-indigo-400 shadow-inner mb-8 border border-white">
              {teacher.username?.charAt(0).toUpperCase()}
            </div>
            
            <div className="space-y-6">
              
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  <User size={12} /> Contact Info
                </p>
                {isEditing ? (
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="First Name"
                      value={formData.first_name} 
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-xl font-bold outline-none focus:border-brand-primary text-sm"
                    />
                    <input 
                      type="text" 
                      placeholder="Last Name"
                      value={formData.last_name} 
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-xl font-bold outline-none focus:border-brand-primary text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="font-black text-slate-800 text-sm">{teacher.email || 'No email'}</p>
                    <p className="font-bold text-slate-500 text-xs mt-1">{teacher.whatsapp || 'No WhatsApp'}</p>
                  </div>
                )}
              </div>

              {/* FINANCIAL ENGINE UI */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl border border-slate-800 text-white shadow-xl">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1.5 mb-4">
                  <CreditCard size={12} /> Salary Structure
                </p>
                
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Base Salary ($)</p>
                      <input 
                        type="number" 
                        value={formData.base_salary} 
                        onChange={(e) => setFormData({...formData, base_salary: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl font-black outline-none focus:border-indigo-500 focus:ring-1 ring-indigo-500"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Per-Student Bonus ($)</p>
                      <input 
                        type="number" 
                        value={formData.salary_per_student} 
                        onChange={(e) => setFormData({...formData, salary_per_student: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl font-black outline-none focus:border-indigo-500 focus:ring-1 ring-indigo-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-400">Fixed Base</span>
                      <span className="text-lg font-black text-white flex items-center gap-1"><DollarSign size={16} className="text-indigo-400"/> {teacher.teacher_data?.base_salary || '0.00'}</span>
                    </div>
                    <div className="w-full h-px bg-slate-700/50"></div>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-400">Student Bonus</span>
                      <span className="text-lg font-black text-white flex items-center gap-1"><DollarSign size={16} className="text-emerald-400"/> {teacher.teacher_data?.salary_per_student || '0.00'}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT: LIVE ROSTER */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute right-0 top-0 p-8 opacity-[0.03] pointer-events-none">
                <Users size={120} />
             </div>
             
             <h3 className="font-black text-xl text-slate-900 mb-8 flex items-center gap-3">
               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <Users size={20} />
               </div>
               Assigned Student Roster
             </h3>
             
             {teacher.classes?.length > 0 ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {teacher.classes.map((cls, idx) => (
                   <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 transition group cursor-default">
                     <div className="flex flex-col">
                        <span className="font-black text-slate-900 group-hover:text-indigo-600 transition">{cls.student_name}</span>
                        <span className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                           <Clock size={12} className="text-slate-400"/> {cls.timing || 'Unscheduled'}
                        </span>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold italic">This teacher currently has no active students.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}