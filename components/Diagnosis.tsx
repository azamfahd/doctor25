
import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Activity, Thermometer, Droplets, HeartPulse, Trash, 
  ImagePlus, FileSearch, Home, FileText, UploadCloud, CheckCircle2
} from 'lucide-react';
import { PatientCase, VitalSigns } from '../types';
import { VitalSignsScanner } from './VitalSignsScanner';
import { AnimatePresence } from 'motion/react';

interface DiagnosisProps {
  onAnalyze: (data: Partial<PatientCase>) => void;
  isAnalyzing: boolean;
  onNavigateHome?: () => void;
  initialVitals?: VitalSigns;
}

const Diagnosis: React.FC<DiagnosisProps> = ({ onAnalyze, isAnalyzing, onNavigateHome, initialVitals }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'ذكر' | 'أنثى'>('ذكر');
  const [symptoms, setSymptoms] = useState('');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [vitals, setVitals] = useState<VitalSigns>({
    bloodPressure: '',
    pulse: '',
    temperature: '',
    spo2: ''
  });

  useEffect(() => {
    if (initialVitals) {
      setVitals(initialVitals);
    }
  }, [initialVitals]);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = [
    "بدء المسح السريري...", 
    "تحليل المؤشرات الحيوية...", 
    "معالجة البيانات البصرية...", 
    "توليد التقرير التشخيصي...",
    "مراجعة البروتوكولات الطبية..."
  ];

  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      interval = setInterval(() => setAnalysisStep(prev => (prev + 1) % steps.length), 2500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleSubmit = () => {
    if (!name || !symptoms) {
      alert("يرجى إكمال البيانات الأساسية (الاسم والأعراض).");
      return;
    }
    onAnalyze({ name, age, gender, symptoms, vitals, images: images.length > 0 ? images : undefined });
  };

  const [isDragging, setIsDragging] = useState(false);

  const processFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const processed = await Promise.all(
      files.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onerror = () => resolve('');

          // If file is a PDF medical test/report
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            reader.onload = (e) => {
              const res = e.target?.result as string;
              resolve(res || '');
            };
            reader.readAsDataURL(file);
            return;
          }

          // If image: compress via canvas with graceful fallback
          reader.onload = (event) => {
            const rawData = event.target?.result as string;
            if (!rawData) {
              resolve('');
              return;
            }
            const img = new Image();
            img.onerror = () => resolve(rawData); // Fallback to raw data if canvas fails
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const MAX_DIM = 1400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                  if (width > MAX_DIM) {
                    height = Math.round(height * (MAX_DIM / width));
                    width = MAX_DIM;
                  }
                } else {
                  if (height > MAX_DIM) {
                    width = Math.round(width * (MAX_DIM / height));
                    height = MAX_DIM;
                  }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                resolve(canvas.toDataURL(mime, 0.85));
              } catch (err) {
                resolve(rawData);
              }
            };
            img.src = rawData;
          };
          reader.readAsDataURL(file);
        });
      })
    );

    const valid = processed.filter(Boolean);
    if (valid.length > 0) {
      setImages(prev => [...prev, ...valid]);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    await processFiles(files);
    if (e.target) e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="relative animate-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto w-full">
      {isAnalyzing && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="w-8 h-8 text-blue-400 animate-pulse-soft" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white mb-3 tracking-tight">جاري التحليل السريري الذكي</h2>
          <div className="max-w-[200px] w-full bg-white/5 h-1 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((analysisStep + 1) / steps.length) * 100}%` }}></div>
          </div>
          <p className="text-blue-400 font-black text-[10px] uppercase tracking-[0.2em]">{steps[analysisStep]}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl lg:rounded-3xl shadow-xl border border-slate-100 overflow-hidden mb-6">
        <div className="p-5 lg:p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
           <div className="flex items-center gap-3">
              {onNavigateHome && (
                <button 
                  onClick={onNavigateHome}
                  className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-4 py-2 rounded-xl font-bold text-xs border border-slate-200/85 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all duration-200 active:scale-95 cursor-pointer ml-1"
                  title="العودة للرئيسية"
                >
                  <Home className="w-4 h-4 text-slate-500" />
                  <span>الرئيسية</span>
                </button>
              )}
              <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <FileSearch className="w-5 h-5" />
              </div>
              <div>
                 <h2 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight">وحدة التشخيص المتطورة</h2>
                 <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.3em] mt-0.5">Diagnostic Intelligence Engine v4.0</p>
              </div>
           </div>
           <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-100">
              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">النظام نشط</span>
           </div>
        </div>

        <div className="p-5 lg:p-6 space-y-6">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 pr-2 uppercase tracking-widest">اسم المريض الكامل</label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none font-black text-xs transition-all text-slate-800 placeholder:text-slate-300" 
                placeholder="أدخل الاسم هنا..." 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 pr-2 uppercase tracking-widest">العمر (سنوات)</label>
              <input 
                type="number" 
                value={age} 
                onChange={e => setAge(e.target.value)} 
                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none font-black text-xs transition-all text-slate-800 placeholder:text-slate-300" 
                placeholder="00" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 pr-2 uppercase tracking-widest">الجنس السريري</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setGender('ذكر')} 
                  className={`flex-1 py-2.5 rounded-xl font-black text-[10px] transition-all border-2 ${gender === 'ذكر' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                >
                  ذكر
                </button>
                <button 
                  onClick={() => setGender('أنثى')} 
                  className={`flex-1 py-2.5 rounded-xl font-black text-[10px] transition-all border-2 ${gender === 'أنثى' ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                >
                  أنثى
                </button>
              </div>
            </div>
          </div>

          {/* Symptoms Area */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 pr-2 uppercase tracking-widest">وصف الأعراض / التاريخ المرضي / التحاليل المخبرية</label>
              <textarea 
                value={symptoms} 
                onChange={e => setSymptoms(e.target.value)}
                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-xl p-4 h-32 outline-none font-bold text-xs text-slate-700 resize-none leading-relaxed transition-all placeholder:text-slate-300 shadow-inner" 
                placeholder="يرجى كتابة الأعراض بالتفصيل، أو نسخ ولصق نتائج التحاليل المخبرية (Lab Results)، أو تقارير الأشعة، وسيقوم النظام الذكي باستخراج وتحليل كافة البيانات..."
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {['لصق تقرير دم (CBC)', 'لصق تقرير أشعة', 'حمى مستمرة', 'صداع نصفي', 'سعال جاف', 'ألم في الصدر'].map((sym) => (
                <button 
                  key={sym}
                  onClick={() => setSymptoms(prev => prev ? `${prev}، ${sym}` : sym)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600 transition-colors"
                >
                  + {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Vitals Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">المؤشرات الحيوية الحالية</h4>
              <button onClick={() => setIsScannerOpen(true)} className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-emerald-100/80 transition-colors cursor-pointer">
                <Activity className="w-3 h-3 animate-pulse" /> المستشعر الفسيولوجي الذكي (PPG & Sensors)
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                { label: 'الحرارة', icon: Thermometer, key: 'temperature', unit: '°C', color: 'text-orange-500', bg: 'bg-orange-50' },
                { label: 'الضغط', icon: HeartPulse, key: 'bloodPressure', unit: 'mmHg', color: 'text-rose-500', bg: 'bg-rose-50' },
                { label: 'النبض', icon: Activity, key: 'pulse', unit: 'BPM', color: 'text-cyan-500', bg: 'bg-cyan-50' },
                { label: 'الأكسجين', icon: Droplets, key: 'spo2', unit: '%', color: 'text-blue-500', bg: 'bg-blue-50' }
              ].map((v) => {
                const Icon = v.icon;
                return (
                <div key={v.key} className={`${v.bg} p-3 rounded-xl border border-white shadow-sm group hover:scale-105 transition-transform`}>
                   <div className={`flex items-center gap-1 ${v.color} mb-1.5`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[7px] font-black uppercase tracking-widest">{v.label}</span>
                   </div>
                   <div className="flex items-end gap-1">
                     <input 
                       value={(vitals as any)[v.key]} 
                       onChange={e => setVitals({...vitals, [v.key]: e.target.value})}
                       className="bg-transparent border-none outline-none font-black text-slate-900 text-lg w-full placeholder:text-slate-300" 
                       placeholder="--" 
                     />
                     <span className="text-[7px] font-black text-slate-400 mb-1">{v.unit}</span>
                   </div>
                </div>
              )})}
            </div>
            {vitals.livenessReport && (
              <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl space-y-2 text-right mt-3">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
                  <span className="text-[9px] font-black text-emerald-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-600" /> تم رفق تقرير رصد العلامات الحيوية المتصل بنجاح
                  </span>
                  <button 
                    onClick={() => setVitals({ ...vitals, livenessReport: undefined, livenessChecked: false })}
                    className="text-[8px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    حذف تقرير الرصد
                  </button>
                </div>
                <div className="text-[10px] text-emerald-900 overflow-y-auto max-h-[200px] leading-relaxed no-scrollbar space-y-2 pr-1">
                  {vitals.livenessReport.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('###')) {
                      return <h4 key={i} className="text-[11px] font-black text-emerald-950 border-b border-emerald-100 pb-1 mt-2 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />{trimmed.replace('###', '').trim()}</h4>;
                    }
                    if (trimmed.startsWith('####')) {
                      return <h5 key={i} className="text-[10px] font-black text-emerald-700 mt-2 mb-0.5">{trimmed.replace('####', '').trim()}</h5>;
                    }
                    if (trimmed.startsWith('*')) {
                      return (
                        <div key={i} className="flex items-start gap-1 pr-1 text-emerald-900 font-medium">
                          <span className="text-emerald-600 mt-0.5 shrink-0">•</span>
                          <span>{trimmed.substring(1).trim()}</span>
                        </div>
                      );
                    }
                    if (trimmed.startsWith('|')) {
                      if (trimmed.includes('---') || trimmed.includes('الثانية')) return null;
                      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
                      if (cells.length === 0) return null;
                      return (
                        <div key={i} className="grid grid-cols-6 gap-1 bg-white p-1 rounded border border-emerald-100 text-[8px] font-mono text-emerald-800 mb-0.5">
                          {cells.map((cell, cidx) => (
                            <span key={cidx} className="text-center truncate font-bold">{cell}</span>
                          ))}
                        </div>
                      );
                    }
                    return <p key={i} className="leading-relaxed text-emerald-950 font-medium">{trimmed}</p>;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Image and Medical Document Uploader */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[8px] font-black text-slate-400 pr-2 uppercase tracking-widest flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5 text-blue-500" />
                <span>إرفاق الأشعة، التحاليل المخبرية، أو تقارير الفحص الطبي</span>
              </label>
              {images.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-blue-500" /> تم إرفاق {images.length} ملف
                  </span>
                  <button 
                    onClick={() => setImages([])}
                    className="text-[8px] font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    حذف الكل
                  </button>
                </div>
              )}
            </div>
            
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = Array.from(e.dataTransfer.files || []) as File[];
                processFiles(files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer group ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50/80 scale-[1.01]' 
                  : 'border-slate-200 bg-slate-50/40 hover:bg-blue-50/50 hover:border-blue-300'
              }`}
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 group-hover:shadow-md transition-all text-blue-500">
                <UploadCloud className="w-6 h-6 animate-pulse-soft" />
              </div>
              <p className="text-xs font-black text-slate-700 mb-1">
                اضغط لاختيار أو اسحب وأفلت صور الأشعة والتقارير الطبية هنا
              </p>
              <p className="text-[9px] text-slate-400 font-bold max-w-md text-center leading-relaxed">
                يدعم صور الأشعة السينية (X-Ray)، الرنين المغناطيسي (MRI)، الأشعة المقطعية (CT)، تحاليل الدم (CBC)، وتقارير الفحص بصيغ JPG, PNG, WebP, PDF
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                hidden 
                accept="image/*,application/pdf" 
                multiple 
                onChange={handleImageChange} 
              />
            </div>
            
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-3">
                {images.map((img, idx) => {
                  const isPdf = img.startsWith('data:application/pdf');
                  return (
                    <div key={idx} className="relative group/img aspect-square rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm bg-slate-900 flex flex-col items-center justify-center p-2">
                      {isPdf ? (
                        <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-2 text-center">
                          <FileText className="w-8 h-8 text-rose-500 mb-1 animate-pulse" />
                          <span className="text-[8px] font-black text-slate-700 truncate max-w-full">تقرير طبي PDF</span>
                          <span className="text-[7px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">جاهز للتحليل</span>
                        </div>
                      ) : (
                        <img src={img} className="w-full h-full object-cover" alt={`doc-${idx}`} />
                      )}
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-[9px] text-white font-bold bg-black/60 px-2 py-0.5 rounded-full">ملف {idx + 1}</span>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }} 
                        className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1.5 rounded-full shadow-lg opacity-90 hover:opacity-100 transition-all hover:scale-110 cursor-pointer z-10"
                        title="حذف هذا الملف"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button 
              disabled={isAnalyzing || !name}
              onClick={handleSubmit}
              className="w-full bg-[#0F172A] text-white py-3.5 rounded-xl font-black text-sm shadow-xl shadow-slate-900/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] group"
            >
              <Sparkles className="w-4.5 h-4.5 text-blue-400 group-hover:rotate-12 transition-transform" />
              بدء التحليل السريري الفوري
            </button>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {isScannerOpen && (
          <VitalSignsScanner 
            onClose={() => setIsScannerOpen(false)}
            onSaveVitals={(scannedVitals) => setVitals(scannedVitals)}
            currentVitals={vitals}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Diagnosis;
