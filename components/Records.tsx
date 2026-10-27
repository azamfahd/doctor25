import React, { useState, useRef } from 'react';
import { 
  Search, MessageSquare, Trash2, X, 
  Thermometer, Activity, User, Eye, Printer, ChevronLeft,
  AlertCircle, ShieldAlert, CheckCircle2, Clock, HeartPulse, 
  Zap, Pill, Droplets,
  Apple, Dumbbell, LifeBuoy, Plus, Home,
  Database, DownloadCloud, UploadCloud, ShieldCheck,
  FileSpreadsheet, Download, CheckSquare, Square
} from 'lucide-react';
import { PatientCase, SystemSettings } from '../types';
import AIResult from './AIResult';
import { exportDatabaseBackup, importDatabaseBackup } from '../src/db/localDb';
import { exportPatientsToExcel, downloadPatientExcelTemplate } from '../src/utils/excelHandler';
import { ExcelManagerModal } from './ExcelManagerModal';
import { INITIAL_SETTINGS } from '../constants';

interface RecordsProps {
  records: PatientCase[];
  onStartSession?: (patient: PatientCase) => void;
  onDeleteRecord?: (id: string) => void;
  onNewCase?: () => void;
  onNavigateHome?: () => void;
  settings?: SystemSettings;
  onReloadRecords?: () => void;
  onNavigateTab?: (tab: string) => void;
}

const Records: React.FC<RecordsProps> = ({ 
  records, 
  onStartSession, 
  onDeleteRecord, 
  onNewCase, 
  onNavigateHome, 
  settings, 
  onReloadRecords,
  onNavigateTab 
}) => {
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
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', accent: 'bg-rose-600', icon: ShieldAlert, label: 'حالة حرجة' };
    }
    if (status === 'تدخل طبي') {
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500', accent: 'bg-amber-600', icon: AlertCircle, label: 'تدخل طبي' };
    }
    if (status === 'متابعة') {
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', accent: 'bg-blue-600', icon: Clock, label: 'متابعة سريرية' };
    }
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', accent: 'bg-emerald-600', icon: CheckCircle2, label: 'حالة مستقرة' };
  };

  const importFileRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const jsonStr = await exportDatabaseBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AlHakim_Medical_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("فشل تصدير النسخة الاحتياطية: " + (e.message || e));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsImporting(true);
      const text = await file.text();
      const count = await importDatabaseBackup(text);
      alert(`تم استرجاع ومزامنة ${count} سجل طبي بنجاح داخل قاعدة البيانات المحلية.`);
      onReloadRecords?.();
    } catch (err: any) {
      alert("خطأ أثناء استيراد النسخة الاحتياطية: " + (err.message || err));
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleExportExcel = () => {
    try {
      const recordsToExport = selectedIds.size > 0
        ? records.filter(r => selectedIds.has(r.id))
        : filteredRecords.length > 0 ? filteredRecords : records;

      if (recordsToExport.length === 0) {
        alert("لا توجد سجلات لتصديرها.");
        return;
      }

      exportPatientsToExcel(recordsToExport);
    } catch (err: any) {
      alert("حدث خطأ أثناء تصدير Excel: " + (err.message || err));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} سجل محدد؟`)) {
      selectedIds.forEach(id => onDeleteRecord?.(id));
      setSelectedIds(new Set());
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 font-['Tajawal'] max-w-7xl mx-auto w-full">
      <input 
        type="file" 
        ref={importFileRef} 
        hidden 
        accept="application/json,.json" 
        onChange={handleImportFile} 
      />

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

      {/* Header Section with Local Storage Management */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl lg:rounded-3xl shadow-sm border border-slate-150">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">سجلات المرضى والأرشيف الطبي</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              تخزين محلي مؤمّن ({records.length} سجل)
            </span>
          </div>
          <p className="text-slate-400 text-xs font-medium">
            كافة البيانات والتقارير وصور الأشعة محفوظة محلياً (Offline-First) داخل جهازك وتستطيع الوصول إليها في أي وقت.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Excel Database Actions */}
          <button 
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-gradient-to-l from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 group"
            title="استيراد ومعالجة قاعدة بيانات إكسل ضخمة"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200 group-hover:scale-110 transition-transform" />
            <span>استيراد قاعدة بيانات Excel</span>
          </button>

          <button 
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hover:border-emerald-400 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
            title="تصدير السجلات إلى ملف Excel احترافي (.xlsx)"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>تصدير إلى Excel</span>
          </button>

          <button 
            onClick={downloadPatientExcelTemplate}
            className="hidden sm:flex items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-xl font-bold text-xs border border-slate-200 transition-all cursor-pointer"
            title="تنزيل قالب إكسل جاهز للتعبئة"
          >
            <span>قالب Excel</span>
          </button>

          {/* Export / Import Backup JSON buttons */}
          <button 
            onClick={handleExportBackup}
            disabled={isExporting}
            className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl font-bold text-xs border border-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
            title="تصدير نسخة احتياطية كاملة JSON إلى جهازك"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden md:inline">تصدير JSON</span>
          </button>

          <button 
            onClick={() => importFileRef.current?.click()}
            disabled={isImporting}
            className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl font-bold text-xs border border-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
            title="استرجاع ومزامنة نسخة احتياطية JSON سابقة"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline">استرجاع JSON</span>
          </button>

          {onNavigateHome && (
            <button 
              onClick={onNavigateHome}
              className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl font-bold text-xs border border-slate-200 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Home className="w-4 h-4 text-slate-500" />
              الرئيسية
            </button>
          )}

          <button 
            onClick={onNewCase}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-600/15 active:scale-95 group cursor-pointer"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            إضافة سجل جديد
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar when records are selected */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>تم تحديد <strong className="text-emerald-400 font-mono text-sm">{selectedIds.size}</strong> من أصل {filteredRecords.length} مريض</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportExcel} 
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير المحدد كـ Excel ({selectedIds.size})</span>
            </button>

            {onDeleteRecord && (
              <button 
                onClick={handleBulkDelete} 
                className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف المحدد</span>
              </button>
            )}

            <button 
              onClick={() => setSelectedIds(new Set())} 
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Main List UI */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-4 rounded-2xl lg:rounded-3xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث بالاسم أو التشخيص أو الأعراض في الأرشيف الطبي..."
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

      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto w-full" dir="rtl">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/90 text-slate-700 font-bold border-b border-slate-200 text-xs">
                <th className="py-3.5 px-3.5 w-12 text-center font-bold">
                  <button 
                    onClick={toggleSelectAll} 
                    className="p-1 hover:bg-slate-200/70 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    title={selectedIds.size === filteredRecords.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                  >
                    {filteredRecords.length > 0 && selectedIds.size === filteredRecords.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4 font-bold text-slate-700">المريض / المعرف</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">التشخيص السريري المقترح</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">العمر والجنس</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">المؤشرات الحيوية</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">تاريخ الكشف</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">مستوى الخطورة</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => {
                const cfg = getStatusConfig(record);
                const isSelected = selectedIds.has(record.id);
                return (
                  <tr 
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className={`transition-colors group cursor-pointer ${
                      isSelected ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-blue-50/30'
                    }`}
                  >
                    <td className="py-3.5 px-3.5 text-center align-middle" onClick={(e) => toggleSelectRow(record.id, e)}>
                      <button className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100/80">
                          {record.name ? record.name.trim().charAt(0) : 'م'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors leading-snug truncate max-w-[200px]">
                            {record.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 tabular-nums">
                              #{record.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 align-middle">
                      {record.diagnosis?.conditionName ? (
                        <div>
                          <div className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-1">
                            {record.diagnosis.conditionName}
                          </div>
                          {record.diagnosis.urgencyLevel && (
                            <span className="text-[11px] text-slate-400 font-medium mt-0.5 inline-block">
                              {record.diagnosis.urgencyLevel}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs italic font-medium flex items-center gap-1">
                          <span>بانتظار التحليل السريري</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-bold text-slate-800">
                        <span className="font-mono tabular-nums">{record.age}</span>{' '}
                        <span className="text-slate-500 font-normal text-[11px]">سنة</span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                        {record.gender || 'غير محدد'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[10px] font-bold text-slate-400">BP:</span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {record.vitals?.bloodPressure || '--'}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-[10px] font-bold text-slate-400">SPO2:</span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {record.vitals?.spo2 ? `${record.vitals.spo2}%` : '--'}
                          </span>
                        </div>
                        {(record.vitals?.pulse || record.vitals?.temperature) && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            {record.vitals?.pulse && (
                              <span>نبض: <strong className="text-slate-700 tabular-nums">{record.vitals.pulse}</strong></span>
                            )}
                            {record.vitals?.temperature && (
                              <span>حرارة: <strong className="text-slate-700 tabular-nums">{record.vitals.temperature}°C</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                        {record.date}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {record.time || 'زيارة سريرية'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                        <span>{cfg.label}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-blue-600 text-slate-500 hover:text-white rounded-lg transition-all shadow-xs border border-slate-200/80 cursor-pointer"
                          title="عرض التفاصيل الكاملة"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {onDeleteRecord && (
                          <button 
                            onClick={() => onDeleteRecord(record.id)}
                            className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-all shadow-xs border border-slate-200/80 cursor-pointer"
                            title="حذف السجل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center bg-white">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <h4 className="text-slate-800 font-bold mb-1 text-sm">لا توجد سجلات مطابقة</h4>
                    <p className="text-xs text-slate-500">حاول تغيير كلمات البحث أو فلاتر التصفية أو استيراد ملف إكسل</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel Manager Modal */}
      <ExcelManagerModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        existingRecords={records}
        onImportComplete={(_newRecords) => {
          onReloadRecords?.();
        }}
        settings={settings || INITIAL_SETTINGS}
        onNavigateTab={onNavigateTab}
        onStartSession={onStartSession}
      />
    </div>
  );
};

export default Records;
