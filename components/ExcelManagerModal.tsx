import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  X, Play, Pause, ChevronLeft, ChevronRight, BarChart2, TrendingUp, 
  Users, Activity, HeartPulse, RefreshCw, Sparkles, Database, FileText, Check, ArrowRight
} from 'lucide-react';
import { PatientCase, SystemSettings } from '../types';
import { 
  parsePatientsFromExcel, 
  exportPatientsToExcel, 
  downloadPatientExcelTemplate, 
  ParseExcelResult 
} from '../src/utils/excelHandler';
import { analyzeMedicalCase } from '../services/geminiService';
import { saveRecordLocally } from '../src/db/localDb';

interface ExcelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRecords: PatientCase[];
  onImportComplete: (newRecords: PatientCase[]) => void;
  settings: SystemSettings;
  onNavigateTab?: (tab: string) => void;
  onStartSession?: (patient: PatientCase) => void;
}

export const ExcelManagerModal: React.FC<ExcelManagerModalProps> = ({
  isOpen,
  onClose,
  existingRecords,
  onImportComplete,
  settings,
  onNavigateTab,
  onStartSession,
}) => {
  const [activeStage, setActiveStage] = useState<'upload' | 'preview' | 'batch_diagnose'>('upload');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [parseResult, setParseResult] = useState<ParseExcelResult | null>(null);
  const [importedList, setImportedList] = useState<PatientCase[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Batch Diagnosis State
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState(0);
  const [batchLog, setBatchLog] = useState<{ name: string; status: string; condition?: string }[]>([]);
  const stopBatchRef = useRef(false);

  // Table pagination state
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setErrorMsg(null);
    setIsProcessingFile(true);
    try {
      const result = await parsePatientsFromExcel(file);
      setParseResult(result);
      setImportedList(result.records);
      setActiveStage('preview');
      setPage(1);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء معالجة ملف الإكسل. يرجى التحقق من صياغة الملف.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  // Commit records to local storage & app state
  const handleCommitToDatabase = async () => {
    if (importedList.length === 0) return;

    try {
      setIsProcessingFile(true);
      // Save all to local DB
      for (const rec of importedList) {
        await saveRecordLocally(rec);
      }
      onImportComplete(importedList);
      alert(`✓ تم بنجاح استيراد ومزامنة ${importedList.length} سجل في قاعدة البيانات المحلية!`);
      onClose();
    } catch (err: any) {
      alert('خطأ أثناء حفظ البيانات: ' + (err.message || err));
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Run Batch AI / Algorithmic Diagnosis
  const handleStartBatchDiagnosis = async () => {
    const unDiagnosed = importedList.filter(p => !p.diagnosis);
    if (unDiagnosed.length === 0) {
      if (!window.confirm('جميع المرضى لديهم تشخيص مسجل بالفعل. هل تريد إعادة تشغيل التشخيص الآلي عليهم؟')) {
        return;
      }
    }

    setActiveStage('batch_diagnose');
    setIsBatchRunning(true);
    stopBatchRef.current = false;
    setBatchCurrentIndex(0);
    setBatchProgress(0);
    setBatchLog([]);

    const updated = [...importedList];
    const totalToProcess = updated.length;

    for (let i = 0; i < totalToProcess; i++) {
      if (stopBatchRef.current) {
        break;
      }

      const patient = updated[i];
      setBatchCurrentIndex(i + 1);
      setBatchProgress(Math.round(((i + 1) / totalToProcess) * 100));

      try {
        // Run AI diagnosis for this patient
        const result = await analyzeMedicalCase(patient, settings);
        
        let sevStatus: 'مستقرة' | 'متابعة' | 'تدخل طبي' | 'حرجة' = 'مستقرة';
        if (result.diagnosis.severity === 'حرجة') sevStatus = 'حرجة';
        else if (result.diagnosis.severity === 'مرتفعة') sevStatus = 'تدخل طبي';
        else if (result.diagnosis.severity === 'متوسطة') sevStatus = 'متابعة';

        const updatedPatient: PatientCase = {
          ...patient,
          diagnosis: result.diagnosis,
          status: sevStatus,
        };

        updated[i] = updatedPatient;
        setImportedList([...updated]);
        await saveRecordLocally(updatedPatient);

        setBatchLog(prev => [
          {
            name: patient.name,
            status: 'تم التشخيص بنجاح',
            condition: result.diagnosis.conditionName,
          },
          ...prev.slice(0, 30),
        ]);
      } catch (err: any) {
        setBatchLog(prev => [
          {
            name: patient.name,
            status: 'فشل الفحص: ' + (err.message || 'خطأ غير معروف'),
          },
          ...prev.slice(0, 30),
        ]);
      }

      // Small delay between calls
      await new Promise(r => setTimeout(r, 600));
    }

    setIsBatchRunning(false);
    onImportComplete(updated);
  };

  const handleStopBatch = () => {
    stopBatchRef.current = true;
    setIsBatchRunning(false);
  };

  // Stats calculation
  const totalImported = importedList.length;
  const criticalCount = importedList.filter(r => r.status === 'حرجة').length;
  const interventionCount = importedList.filter(r => r.status === 'تدخل طبي').length;
  const followUpCount = importedList.filter(r => r.status === 'متابعة').length;
  const stableCount = importedList.filter(r => r.status === 'مستقرة').length;
  const diagnosedCount = importedList.filter(r => !!r.diagnosis).length;

  const totalPages = Math.ceil(totalImported / pageSize) || 1;
  const currentRows = importedList.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-l from-emerald-600 via-teal-700 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">إدارة ومعالجة قواعد بيانات Excel</h3>
                <span className="bg-emerald-400/20 text-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  XLSX / XLS / CSV
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-emerald-100/80 mt-0.5">
                استيراد وتصدير مجموعات بيانات ضخمة، وإجراء فحص سريري وتشخيص مجمع
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Stages Navigation Tabs */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-bold shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStage('upload')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeStage === 'upload' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>1. رفع الملف والربط الذكي</span>
            </button>

            {importedList.length > 0 && (
              <button
                onClick={() => setActiveStage('preview')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeStage === 'preview' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>2. معاينة السجلات ({importedList.length})</span>
              </button>
            )}

            {importedList.length > 0 && (
              <button
                onClick={() => setActiveStage('batch_diagnose')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeStage === 'batch_diagnose' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>3. التشخيص الخوارزمي المجمع</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadPatientExcelTemplate}
              className="flex items-center gap-1 px-3 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 text-[11px] transition-colors cursor-pointer"
              title="تنزيل قالب إكسل جاهز للتعبئة"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>تحميل قالب إكسل فارغ</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">تنبيه أثناء معالجة الملف: </span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* STAGE 1: UPLOAD */}
          {activeStage === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]' 
                    : 'border-slate-200 bg-slate-50/50 hover:bg-emerald-50/30 hover:border-emerald-400'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                />

                <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-600/10 animate-bounce">
                  <Upload className="w-8 h-8" />
                </div>

                <div>
                  <h4 className="text-base sm:text-lg font-black text-slate-800">
                    اسحب وأفلت ملف إكسل هنا، أو انقر للاختيار من جهازك
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    يدعم البرنامج ملفات <strong>.xlsx</strong> و <strong>.xls</strong> و <strong>.csv</strong> مع التعرف التلقائي على الأعمدة باللغة العربية والإنجليزية.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">اسم المريض</span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">العمر والجنس</span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">المؤشرات الحيوية (BP/Pulse/Temp/O2)</span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">الأعراض والتشخيص</span>
                </div>
              </div>

              {/* Template & Guidelines Card */}
              <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-emerald-950">هل تريد البدء بقالب جاهز ومنسق؟</h5>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      يمكنك تنزيل النموذج المعتمد للحكيم الذكي وتعبئة بيانات مرضاك ثم إعادة رفعه مباشرة.
                    </p>
                  </div>
                </div>

                <button
                  onClick={downloadPatientExcelTemplate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل القالب الجاهز</span>
                </button>
              </div>

              {/* Current Local Database Status */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-xs font-black text-slate-800">قاعدة البيانات المحلية الحالية</div>
                    <div className="text-[10px] text-slate-500 font-bold">
                      يوجد حالياً {existingRecords.length} سجل مريض مخزن محلياً في جهازك.
                    </div>
                  </div>
                </div>

                {existingRecords.length > 0 && (
                  <button
                    onClick={() => exportPatientsToExcel(existingRecords)}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:text-emerald-700 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تصدير السجلات الحالية كـ Excel</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STAGE 2: PREVIEW & STATS */}
          {activeStage === 'preview' && (
            <div className="space-y-5">
              
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
                  <div className="text-[10px] font-bold text-slate-500">إجمالي المرضى</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{totalImported}</div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-center">
                  <div className="text-[10px] font-bold text-emerald-700">حالات مستقرة</div>
                  <div className="text-lg font-black text-emerald-800 mt-0.5">{stableCount}</div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl text-center">
                  <div className="text-[10px] font-bold text-blue-700">متابعة دورية</div>
                  <div className="text-lg font-black text-blue-800 mt-0.5">{followUpCount}</div>
                </div>

                <div className="bg-orange-50 border border-orange-200 p-3 rounded-2xl text-center">
                  <div className="text-[10px] font-bold text-orange-700">تدخل طبي</div>
                  <div className="text-lg font-black text-orange-800 mt-0.5">{interventionCount}</div>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-bold text-rose-700">حالات حرجة</div>
                  <div className="text-lg font-black text-rose-800 mt-0.5">{criticalCount}</div>
                </div>
              </div>

              {/* Detected Column Mapping pill badges */}
              {parseResult && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="font-black text-slate-700">الأعمدة التي تم التعرف عليها تلقائياً:</span>
                  {Object.entries(parseResult.columnMappingSummary).map(([original, mapped]) => (
                    <span key={original} className="px-2 py-0.5 bg-white border border-emerald-200 rounded-md text-emerald-800 font-bold">
                      {original} ← {mapped}
                    </span>
                  ))}
                </div>
              )}

              {/* Table Preview */}
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto w-full" dir="rtl">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead className="bg-slate-50/90 text-slate-700 font-bold border-b border-slate-200 text-xs">
                      <tr>
                        <th className="py-3.5 px-3.5 w-12 text-center font-bold">#</th>
                        <th className="py-3.5 px-4 font-bold">اسم المريض</th>
                        <th className="py-3.5 px-3.5 font-bold text-center">العمر</th>
                        <th className="py-3.5 px-3.5 font-bold text-center">الجنس</th>
                        <th className="py-3.5 px-4 font-bold">العلامات الحيوية</th>
                        <th className="py-3.5 px-4 font-bold">الأعراض والشكوى</th>
                        <th className="py-3.5 px-4 font-bold">التشخيص الحالي</th>
                        <th className="py-3.5 px-4 font-bold text-center">الحالة السريرية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentRows.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3.5 px-3.5 font-mono text-slate-400 text-center align-middle tabular-nums">
                            {(page - 1) * pageSize + idx + 1}
                          </td>
                          <td className="py-3.5 px-4 align-middle">
                            <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                          </td>
                          <td className="py-3.5 px-3.5 text-center align-middle whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-800 tabular-nums">{p.age}</span>{' '}
                            <span className="text-[11px] text-slate-500 font-normal">سنة</span>
                          </td>
                          <td className="py-3.5 px-3.5 text-center align-middle whitespace-nowrap text-slate-600 font-medium text-xs">
                            {p.gender}
                          </td>
                          <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-[10px] font-bold text-slate-400">BP:</span>
                              <span className="font-mono font-bold text-slate-800 tabular-nums">{p.vitals?.bloodPressure || '--'}</span>
                              <span className="text-slate-300">|</span>
                              <span className="text-[10px] font-bold text-slate-400">SPO2:</span>
                              <span className="font-mono font-bold text-slate-800 tabular-nums">{p.vitals?.spo2 ? `${p.vitals.spo2}%` : '--'}</span>
                            </div>
                            {(p.vitals?.pulse || p.vitals?.temperature) && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {p.vitals.pulse && <span>نبض: <strong className="text-slate-700 tabular-nums">{p.vitals.pulse}</strong> </span>}
                                {p.vitals.temperature && <span>حرارة: <strong className="text-slate-700 tabular-nums">{p.vitals.temperature}°C</strong></span>}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 text-xs align-middle" title={p.symptoms}>
                            {p.symptoms || '--'}
                          </td>
                          <td className="py-3.5 px-4 align-middle">
                            {p.diagnosis?.conditionName ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate max-w-[180px]">{p.diagnosis.conditionName}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic font-medium">غير مشخص</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              p.status === 'حرجة' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              p.status === 'تدخل طبي' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              p.status === 'متابعة' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                p.status === 'حرجة' ? 'bg-rose-500' :
                                p.status === 'تدخل طبي' ? 'bg-amber-500' :
                                p.status === 'متابعة' ? 'bg-blue-500' :
                                'bg-emerald-500'
                              }`}></span>
                              <span>{p.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>عرض صفحة {page} من {totalPages} ({totalImported} مريض)</span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="p-1 rounded-lg hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="p-1 rounded-lg hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    العمليات المتاحة على قاعدة بيانات المرضى المستوردة
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    يمكنك تشغيل التشخيص الخوارزمي المجمع لكافة الحالات أو حفظها محلياً وتحليلها في Power BI.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={handleStartBatchDiagnosis}
                    className="flex-1 md:flex-none px-4 py-2 bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>تشخيص آلي مجمع</span>
                  </button>

                  <button
                    onClick={handleCommitToDatabase}
                    className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ واعتماد في السجلات المحلية</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 3: BATCH DIAGNOSIS PIPELINE */}
          {activeStage === 'batch_diagnose' && (
            <div className="space-y-6">
              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                      <Sparkles className="w-5 h-5 animate-spin-slow" />
                    </div>
                    <div>
                      <h4 className="text-base font-black">المحرك الخوارزمي للتشخيص المجمع</h4>
                      <p className="text-xs text-slate-400">
                        النموذج النشط: <strong className="text-blue-400">{settings.model}</strong>
                      </p>
                    </div>
                  </div>

                  <div>
                    {isBatchRunning ? (
                      <button
                        onClick={handleStopBatch}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <Pause className="w-4 h-4" />
                        <span>إيقاف مؤقت</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStartBatchDiagnosis}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <Play className="w-4 h-4" />
                        <span>متابعة التشخيص</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-300 font-bold">
                    <span>التقدم العام: {batchCurrentIndex} من {importedList.length} مريض</span>
                    <span className="text-amber-400 font-black">{batchProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                    <div 
                      className="bg-gradient-to-l from-amber-400 via-emerald-400 to-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${batchProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Diagnostics Log */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    سجل التشخيصات المباشرة للمرضى المستوردين
                  </h5>
                  <span className="text-[10px] text-slate-400 font-bold">
                    تم تشخيص {diagnosedCount} من أصل {importedList.length}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-100">
                  {batchLog.map((log, i) => (
                    <div key={i} className="pt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-black text-slate-900">{log.name}</span>
                      </div>
                      {log.condition ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 font-bold text-[11px]">
                          {log.condition}
                        </span>
                      ) : (
                        <span className="text-slate-500">{log.status}</span>
                      )}
                    </div>
                  ))}

                  {batchLog.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs font-bold">
                      انقر على "بدء التشخيص المجمع" للبدء في معالجة المرضى تلقائياً
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation and Export post-batch */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {onNavigateTab && (
                    <>
                      <button
                        onClick={() => {
                          handleCommitToDatabase();
                          onNavigateTab('analytics');
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                      >
                        <BarChart2 className="w-4 h-4 text-blue-600" />
                        <span>فتح التحليل البصري</span>
                      </button>

                      <button
                        onClick={() => {
                          handleCommitToDatabase();
                          onNavigateTab('powerbi');
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                      >
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        <span>عرض في Power BI</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportPatientsToExcel(importedList, `مرضى_الحكيم_بعد_التشخيص_${new Date().toISOString().split('T')[0]}.xlsx`)}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>تصدير النتائج كـ Excel جديد</span>
                  </button>

                  <button
                    onClick={handleCommitToDatabase}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
                  >
                    حفظ وإغلاق
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
