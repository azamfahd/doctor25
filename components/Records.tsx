import React, { useState } from 'react';
import { 
  Search, MessageSquare, Trash2, X, 
  Thermometer, Activity, User, Eye, Printer, ChevronLeft,
  AlertCircle, ShieldAlert, CheckCircle2, Clock, HeartPulse, 
  Zap, Pill, Droplets,
  Apple, Dumbbell, LifeBuoy, Plus, Home
} from 'lucide-react';
import { PatientCase, SystemSettings } from '../types';
import AIResult from './AIResult';

interface RecordsProps {
  records: PatientCase[];
  onStartSession?: (patient: PatientCase) => void;
  onDeleteRecord?: (id: string) => void;
  onNewCase?: () => void;
  onNavigateHome?: () => void;
  settings?: SystemSettings;
}

const Records: React.FC<RecordsProps> = ({ records, onStartSession, onDeleteRecord, onNewCase, onNavigateHome, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('الكل');
  const [selectedRecord, setSelectedRecord] = useState<PatientCase | null>(null);

  const filteredRecords = records.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = r.name.toLowerCase().includes(searchLower);
    const diagnosisMatch = r.diagnosis?.conditionName?.toLowerCase().includes(searchLower) || 
                          r.diagnosis?.summary?.toLowerCase().includes(searchLower);
    const statusMatch = filter === 'الكل' || r.status === filter;
    return (nameMatch || diagnosisMatch) && statusMatch;
  });

  const getStatusConfig = (record: PatientCase) => {
    const status = record.status;
    if (status === 'حرجة') {
      return { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', accent: 'bg-rose-600', icon: ShieldAlert, label: 'حالة حرجة' };
    }
    if (status === 'تدخل طبي') {
      return { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', accent: 'bg-orange-600', icon: AlertCircle, label: 'تدخل طبي' };
    }
    if (status === 'متابعة') {
      return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', accent: 'bg-blue-600', icon: Clock, label: 'متابعة مستمرة' };
    }
    return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', accent: 'bg-emerald-600', icon: CheckCircle2, label: 'حالة مستقرة' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 font-['Tajawal'] max-w-7xl mx-auto w-full">
      {/* Detail Modal Overlay */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-900/60 backdrop-blur-md">
           <div className="min-h-full p-0 sm:p-4 lg:p-8 flex items-center justify-center">
             <div className="w-full max-w-6xl shadow-2xl relative">
                {selectedRecord.diagnosis ? (
                  <AIResult 
                    diagnosis={selectedRecord.diagnosis} 
                    patientName={selectedRecord.name}
                    patientGender={selectedRecord.gender}
                    onClose={() => setSelectedRecord(null)} 
                    settings={settings}
                  />
                ) : (
                  <div className="bg-white p-8 rounded-3xl text-center space-y-4">
                     <p className="text-xl font-bold">بانتظار التحليل</p>
                     <button onClick={() => setSelectedRecord(null)} className="px-6 py-2 bg-slate-900 text-white rounded-xl">إغلاق</button>
                  </div>
                )}
             </div>
           </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">سجلات المرضى</h2>
          <p className="text-slate-400 text-xs font-medium">إدارة ومراجعة كافة التقارير الطبية المسجلة في النظام.</p>
        </div>
        <div className="flex gap-2">
          {onNavigateHome && (
            <button 
              onClick={onNavigateHome}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-5 py-2.5 rounded-xl font-bold text-xs border border-slate-200/85 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <Home className="w-4 h-4 text-slate-500" />
              الرئيسية
            </button>
          )}
          <button 
            onClick={onNewCase}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-600/15 active:scale-95 group cursor-pointer"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            إضافة سجل جديد
          </button>
        </div>
      </div>

      {/* Main List UI - Simplified for space */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-4 rounded-2xl lg:rounded-3xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث في الأرشيف الطبي..."
            className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-50 rounded-xl py-3 pr-12 pl-5 outline-none transition-all font-bold text-slate-700 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {['الكل', 'حرجة', 'تدخل طبي', 'متابعة', 'مستقرة'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 lg:px-5 py-2 lg:py-2.5 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-black whitespace-nowrap transition-all border-2 ${
                filter === f ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto w-full" dir="rtl">
          <table className="w-full text-right border-collapse text-[11px] sm:text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-150">
                <th className="py-2.5 px-4 font-semibold">المريض / المعرف</th>
                <th className="py-2.5 px-4 font-semibold">التشخيص المقترح</th>
                <th className="py-2.5 px-4 text-center font-semibold">العمر والجنس</th>
                <th className="py-2.5 px-4 font-semibold">المؤشرات (BP/SPO2)</th>
                <th className="py-2.5 px-4 font-semibold">تاريخ الكشف</th>
                <th className="py-2.5 px-4 text-center font-semibold">الخطورة السريرية</th>
                <th className="py-2.5 px-4 text-center font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => {
                const cfg = getStatusConfig(record);
                return (
                  <tr 
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="py-2.5 px-4 font-medium">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{record.name}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">#{record.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-indigo-700 leading-tight">
                        {record.diagnosis?.conditionName || 'بانتظار التحليل السريري'}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-600 font-medium">
                      {record.age} سنة / {record.gender}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">
                      BP: {record.vitals.bloodPressure || '-'} | SPO2: {record.vitals.spo2 || '-'}%
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono">
                      {record.date}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          className="w-7 h-7 flex items-center justify-center bg-slate-50 text-slate-500 rounded-md hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-100"
                          title="عرض التفاصيل"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => onDeleteRecord?.(record.id)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-50 text-rose-500 rounded-md hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-slate-100"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center bg-white">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <h4 className="text-slate-800 font-bold mb-1 text-sm">لا توجد سجلات مطابقة</h4>
                    <p className="text-xs text-slate-500">حاول تغيير كلمات البحث أو فلاتر التصفية</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Records;
