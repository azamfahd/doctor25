
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Brain, Trash2, Save, 
  Database, CheckCircle2, AlertCircle, Palette, UserCog, HardDrive, 
  RefreshCcw, Cpu, Zap, Globe, Image as ImageIcon,
  Wind, Sliders, Headphones, LogIn, LogOut, UserPlus, ExternalLink, Home,
  Download, Upload, ChevronDown, Sparkles, FileText
} from 'lucide-react';
import { SystemSettings, ModelType, PatientCase, AIPersonality, ThemeMode } from '../types';
import { supabase } from '../src/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (settings: SystemSettings) => void;
  onSave: () => void;
  onClear: () => void;
  records: PatientCase[];
  onImport: (records: PatientCase[]) => void;
  onNavigateHome?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, setSettings, onSave, onClear, records, onImport, onNavigateHome }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportDB = () => {
    const dataStr = JSON.stringify(records);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `alhakim_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const obj = JSON.parse(event.target?.result as string);
        if (Array.isArray(obj)) {
          if (window.confirm(`تم العثور على ${obj.length} سجل. هل أنت متأكد من رغبتك في استيرادها دمجاً مع سجلاتك الحالية؟`)) {
            onImport(obj);
            alert('تم الاستيراد بنجاح!');
          }
        } else {
          alert('ملف النسخة الاحتياطية غير صالح.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف. يرجى التأكد من أنه ملف JSON صحيح.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('patients').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
          console.log("Supabase connection info:", error);
          setDbStatus('disconnected');
        } else {
          setDbStatus('connected');
        }
      } catch (err) {
        setDbStatus('disconnected');
      }
    };
    checkConnection();

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      setAuthError(error.message || 'حدث خطأ أثناء تسجيل الدخول بواسطة جوجل');
      setAuthLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول.');
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error.message || 'حدث خطأ أثناء المصادقة');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const models = [
    {
      id: ModelType.PRO,
      name: 'Gemini 3.1 Pro Ultra (الافتراضي القوي)',
      desc: 'النموذج الأعلى قوة ودقة واستدلالاً عميقاً للتشخيصات السريرية المعقدة والتشخيص التفريقي المتطور.',
      icon: Brain,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      caps: ['الافتراضي الأساسي', 'استدلال عميق', 'دقة فائقة', 'مجاني']
    },
    {
      id: ModelType.FLASH_3_6,
      name: 'Gemini 3.6 Flash Ultra',
      desc: 'أحدث نماذج جيميناي 3.6 الأسرع والأكثر تطوراً ودقة في معالجة الاستشارات الطبية الفورية والتحليل العميق.',
      icon: Zap,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      border: 'border-violet-200',
      caps: ['إصدار 3.6 الأحدث', 'سرعة فائقة', 'استدلال ذكي', 'مجاني']
    },
    {
      id: ModelType.PRO_3_5,
      name: 'Gemini 3.5 Pro Advanced',
      desc: 'نموذج احترافي عالي الدقة موجه للاستدلال السريري المركب واستخراج الأبعاد التشخيصية النادرة.',
      icon: Sparkles,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      caps: ['إصدار 3.5 Pro', 'تحليل متعمق', 'دقة علمية', 'مجاني']
    },
    {
      id: ModelType.FLASH_3_5,
      name: 'Gemini 3.5 Flash Super',
      desc: 'الأحدث والأسرع في الاستجابة مع ذكاء فائق لتحليل الاستشارات الطبية اليومية بنطاق زمني فوري.',
      icon: Zap,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      caps: ['استجابة سريعة', 'ذكاء متطور', 'تفاعلي فوري', 'مجاني']
    },
    {
      id: ModelType.PRO_2_5,
      name: 'Gemini 2.5 Pro Clinical',
      desc: 'نموذج استدلالي عالي الدقة متخصص في البحوث المتقدمة وقواعد المعرفة الطبية الموثوقة.',
      icon: Sparkles,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      caps: ['استدلال سريري', 'دقة علمية', 'تحليل متعمق', 'مجاني']
    },
    {
      id: ModelType.FLASH_2_5,
      name: 'Gemini 2.5 Flash Balanced',
      desc: 'نموذج متزن للغاية يجمع بين السرعة العالية والموثوقية في تقييم العلامات الحيوية.',
      icon: Cpu,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      border: 'border-teal-100',
      caps: ['سرعة متوازنة', 'موثوقية دقيقة', 'أداء خفيف', 'مجاني']
    },
    {
      id: ModelType.PRO_1_5,
      name: 'Gemini 1.5 Pro Long-Context',
      desc: 'قدرة فائقة على استيعاب وقراءة التاريخ الطبي المطول والملفات الطبية والتحاليل الضخمة.',
      icon: FileText,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      border: 'border-cyan-100',
      caps: ['سياق ضخم 2M', 'قراءة تقارير مطولة', 'شامل', 'مجاني']
    },
    {
      id: ModelType.LITE,
      name: 'Flash Lite Ultra',
      desc: 'النموذج الأخف والشارح، مثالي لعمليات الفرز الأولية والدردشة المباشرة بلمحة.',
      icon: Wind,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      caps: ['سرعة لحظية', 'كفاءة طاقة', 'أداء استثنائي', 'مجاني']
    },
    {
      id: ModelType.IMAGE_PRO,
      name: 'Pro Vision Multimodal',
      desc: 'متخصص في قراءة وتحليل الأشعة بجميع أنواعها والصور الطبية بدقة عالية.',
      icon: ImageIcon,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      caps: ['تحليل صور بصرية', 'رؤية حاسوبية', 'تشخيص الأشعة', 'مجاني']
    },
    {
      id: ModelType.AUDIO_NATIVE,
      name: 'Audio Native Voice',
      desc: 'تحليل صوتي وتفاعل حوار المريض الصوتي الحقيقي المباشر.',
      icon: Headphones,
      color: 'text-rose-500',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      caps: ['حوار صوتي', 'تحليل نبرة', 'رد حي', 'مجاني']
    }
  ];

  const handleThinkingBudgetChange = (val: string) => {
    setSettings({ ...settings, thinkingBudget: parseInt(val) });
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-10 duration-700 font-['Tajawal'] max-w-4xl mx-auto w-full">
      
      {/* Dynamic Header */}
      <div className="bg-white p-3.5 lg:p-5 rounded-2xl lg:rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 lg:gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 lg:w-32 lg:h-32 bg-blue-50 rounded-full blur-[60px] lg:blur-[80px] -mr-12 -mt-12 lg:-mr-16 lg:-mt-16 opacity-60"></div>
        <div className="flex items-center gap-3.5 lg:gap-4 relative z-10">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-slate-900 rounded-lg lg:rounded-xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
            <SettingsIcon className="w-5 h-5 lg:w-6 lg:h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">إعدادات المحرك الذكي</h2>
            <p className="text-slate-400 text-[7px] lg:text-[9px] font-bold uppercase tracking-[0.2em] mt-0.5">AI Core Configuration & Identity</p>
          </div>
        </div>
        <div className="flex gap-2 lg:gap-2.5 relative z-10 w-full md:w-auto">
           {onNavigateHome && (
             <button 
               onClick={onNavigateHome}
               className="w-full md:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl font-bold text-xs border border-slate-200/85 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all duration-200 active:scale-95 cursor-pointer"
             >
               <Home className="w-4 h-4 text-slate-500" />
                الرئيسية
             </button>
           )}
           <button onClick={onSave} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl font-black text-[9px] lg:text-[11px] shadow-lg shadow-blue-100 transition-all active:scale-95">
              <Save className="w-3 h-3 lg:w-3.5 lg:h-3.5" /> حفظ التكوين الحالي
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Selection Area */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Auth Section */}
          <section className="bg-white rounded-xl lg:rounded-2xl p-5 lg:p-6 shadow-sm border border-slate-50">
             <div className="flex items-center justify-between mb-5 lg:mb-6">
                <div className="flex items-center gap-2 lg:gap-2.5">
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><UserCog className="w-4 h-4 lg:w-4.5 lg:h-4.5" /></div>
                  <h3 className="text-base lg:text-lg font-black text-slate-800">حساب الطبيب (اختياري)</h3>
                </div>
             </div>

             {session ? (
               <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div>
                   <p className="text-xs font-bold text-slate-500 mb-1">مسجل الدخول كـ:</p>
                   <p className="text-sm font-black text-slate-800">{session.user.email}</p>
                   <p className="text-[9px] text-slate-400 mt-1">يتم الآن مزامنة بيانات مرضاك مع هذا الحساب بشكل آمن.</p>
                 </div>
                 <button 
                   onClick={handleLogout}
                   className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-rose-500 rounded-lg text-xs font-bold hover:bg-rose-50 transition-colors"
                 >
                   <LogOut className="w-4 h-4" /> تسجيل الخروج
                 </button>
               </div>
             ) : (
               <form onSubmit={handleAuth} className="space-y-4 max-w-md">
                 <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                   يمكنك إنشاء حساب لحفظ بيانات مرضاك في السحابة والوصول إليها من أي جهاز. إذا لم تقم بتسجيل الدخول، سيتم حفظ البيانات في متصفحك الحالي فقط.
                 </p>
                 
                 {authError && (
                   <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-100 flex items-start gap-2">
                     <AlertCircle className="w-4 h-4 shrink-0" />
                     <span>{authError}</span>
                   </div>
                 )}

                 <button 
                   type="button"
                   onClick={handleGoogleLogin}
                   disabled={authLoading}
                   className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm mb-4"
                 >
                   <svg className="w-4 h-4" viewBox="0 0 24 24">
                     <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                     <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                     <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                     <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                   </svg>
                   المتابعة باستخدام Google
                 </button>

                 <div className="relative flex items-center py-2">
                   <div className="flex-grow border-t border-slate-200"></div>
                   <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-bold">أو باستخدام البريد الإلكتروني</span>
                   <div className="flex-grow border-t border-slate-200"></div>
                 </div>

                 <div className="space-y-3">
                   <div>
                     <label className="text-[10px] font-bold text-slate-500 block mb-1">البريد الإلكتروني</label>
                     <input 
                       type="email" 
                       required
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                       placeholder="doctor@example.com"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-bold text-slate-500 block mb-1">كلمة المرور</label>
                     <input 
                       type="password" 
                       required
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                       placeholder="••••••••"
                     />
                   </div>
                 </div>

                 <div className="flex items-center gap-3 pt-2">
                   <button 
                     type="submit" 
                     disabled={authLoading}
                     className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                   >
                     {authLoading ? 'جاري المعالجة...' : (authMode === 'login' ? <><LogIn className="w-4 h-4"/> تسجيل الدخول</> : <><UserPlus className="w-4 h-4"/> إنشاء حساب</>)}
                   </button>
                   <button 
                     type="button"
                     onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                     className="flex-1 py-2.5 text-indigo-600 text-xs font-bold hover:bg-indigo-50 rounded-lg transition-colors"
                   >
                     {authMode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
                   </button>
                 </div>
               </form>
             )}
          </section>

          {/* Advanced Model Selection */}
          <section className="bg-white rounded-xl lg:rounded-2xl p-5 lg:p-6 shadow-sm border border-slate-50">
             <div className="flex items-center justify-between mb-5 lg:mb-6">
                <div className="flex items-center gap-2 lg:gap-2.5">
                  <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><Cpu className="w-4 h-4 lg:w-4.5 lg:h-4.5" /></div>
                  <h3 className="text-base lg:text-lg font-black text-slate-800">اختيار النموذج المتخصص</h3>
                </div>
             </div>

             <div className="flex flex-col gap-4">
                <div className="relative">
                  <select
                    value={settings.model}
                    onChange={(e) => setSettings({...settings, model: e.target.value as ModelType})}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-sm lg:text-base font-bold rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    style={{ backgroundPosition: 'left 0.75rem center' }}
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>
                
                {/* Active Model Info */}
                {models.filter(m => m.id === settings.model).map(m => (
                  <div key={m.id} className={`flex flex-col sm:flex-row items-start gap-4 p-4 lg:p-5 rounded-xl lg:rounded-2xl border-2 bg-white ${m.border}`}>
                     <div className={`p-3 rounded-xl ${m.bg} ${m.color} shrink-0`}>
                       {React.createElement(m.icon, { className: "w-6 h-6 lg:w-7 lg:h-7" })}
                     </div>
                     <div className="flex-1">
                       <h4 className="text-sm lg:text-base font-black mb-1 lg:mb-2 text-slate-800">{m.name}</h4>
                       <p className="text-[10px] lg:text-xs font-bold leading-relaxed mb-3 lg:mb-4 text-slate-500">{m.desc}</p>
                       <div className="flex flex-wrap gap-1.5 lg:gap-2">
                         {m.caps.map((cap, i) => (
                           <span key={i} className="text-[8px] lg:text-[9px] font-black px-2 lg:px-2.5 py-1 rounded-md lg:rounded-lg bg-slate-50 text-slate-500 uppercase tracking-wider border border-slate-100">
                             {cap}
                           </span>
                         ))}
                       </div>
                     </div>
                  </div>
                ))}
             </div>
          </section>

          {/* Logic & Precision Controls */}
          <section className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-5 shadow-sm border border-slate-50 space-y-5 lg:space-y-6">
             <div className="flex items-center gap-2 lg:gap-2 border-b border-slate-50 pb-3 lg:pb-4">
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><Sliders className="w-3.5 h-3.5 lg:w-4 lg:h-4" /></div>
                <h3 className="text-xs lg:text-sm font-black text-slate-800">منطق التفكير والدقة المعرفية</h3>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                <div className="space-y-3 lg:space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 lg:gap-2">
                        <div className="p-1.5 lg:p-1.5 bg-amber-50 rounded-lg text-amber-500"><Brain className="w-3.5 h-3.5 lg:w-4 lg:h-4" /></div>
                        <div>
                          <p className="text-[10px] lg:text-[11px] font-black text-slate-800">وضع التفكير العميق</p>
                          <p className="text-[6px] lg:text-[7px] text-slate-400 font-bold uppercase tracking-widest">Neural Logic Processing</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, deepThinking: !settings.deepThinking})} 
                        className={`w-9 lg:w-10 h-4.5 lg:h-5 rounded-full transition-all relative shadow-inner ${settings.deepThinking ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 lg:top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all shadow-md ${settings.deepThinking ? 'right-5 lg:right-6' : 'right-0.5 lg:right-0.5'}`}></div>
                      </button>
                   </div>

                   {settings.deepThinking && (
                     <div className="space-y-2 lg:space-y-3 animate-in slide-in-from-top-4 duration-500 p-3 lg:p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between text-[7px] lg:text-[8px] font-black text-slate-500 uppercase tracking-widest">
                           <span>ميزانية التفكير</span>
                           <span className="text-blue-600">{settings.thinkingBudget.toLocaleString()} Token</span>
                        </div>
                        <input 
                          type="range" 
                          min="4000" 
                          max="32000" 
                          step="1000"
                          value={settings.thinkingBudget}
                          onChange={(e) => handleThinkingBudgetChange(e.target.value)}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between gap-1">
                           {[8000, 16000, 24000, 32000].map(v => (
                             <button key={v} onClick={() => setSettings({...settings, thinkingBudget: v})} className={`flex-1 py-0.5 rounded-md text-[6px] lg:text-[7px] font-black border transition-all ${settings.thinkingBudget === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                               {v/1000}K
                             </button>
                           ))}
                        </div>
                     </div>
                   )}
                </div>

                <div className="space-y-3 lg:space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 lg:gap-2">
                        <div className="p-1.5 lg:p-1.5 bg-emerald-50 rounded-lg text-emerald-500"><Globe className="w-3.5 h-3.5 lg:w-4 lg:h-4" /></div>
                        <div>
                          <p className="text-[10px] lg:text-[11px] font-black text-slate-800">البحث في جوجل</p>
                          <p className="text-[6px] lg:text-[7px] text-slate-400 font-bold uppercase tracking-widest">Real-time Grounding</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, googleSearch: !settings.googleSearch})} 
                        className={`w-9 lg:w-10 h-4.5 lg:h-5 rounded-full transition-all relative shadow-inner ${settings.googleSearch ? 'bg-emerald-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 lg:top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all shadow-md ${settings.googleSearch ? 'right-5 lg:right-6' : 'right-0.5 lg:right-0.5'}`}></div>
                      </button>
                   </div>
                   <p className="text-[8px] lg:text-[9px] text-slate-400 font-bold leading-relaxed pr-1 lg:pr-1">تفعيل هذا الخيار يسمح للذكاء الاصطناعي بالتحقق من أحدث البروتوكولات الطبية العالمية والأبحاث الحديثة عبر الإنترنت.</p>
                </div>
             </div>
          </section>
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-5 lg:space-y-6">
           
           <section className="bg-[#0F172A] p-5 lg:p-6 rounded-xl lg:rounded-2xl text-white shadow-xl space-y-5 lg:space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 lg:w-28 lg:h-28 bg-blue-600 rounded-full blur-[60px] lg:blur-[80px] -mr-10 -mt-10 lg:-mr-14 lg:-mt-14 opacity-30"></div>
              <div className="relative z-10 flex items-center gap-2 lg:gap-2.5 border-b border-white/5 pb-3 lg:pb-4">
                <div className="p-1.5 bg-white/5 rounded-lg lg:rounded-xl text-blue-400"><UserCog className="w-3.5 h-3.5 lg:w-4 lg:h-4" /></div>
                <h3 className="text-xs lg:text-sm font-black">الشخصية الرقمية</h3>
              </div>

              <div className="relative z-10 space-y-2 lg:space-y-2.5">
                {Object.values(AIPersonality).map((p) => (
                  <button 
                    key={p}
                    onClick={() => setSettings({...settings, personality: p})}
                    className={`w-full flex items-center justify-between p-2.5 lg:p-3.5 rounded-lg lg:rounded-xl border transition-all duration-300 ${settings.personality === p ? 'bg-blue-600 border-blue-500 shadow-lg scale-[1.02]' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                  >
                    <span className="text-[10px] lg:text-[11px] font-black">{p}</span>
                    {settings.personality === p && <CheckCircle2 className="w-3 h-3 lg:w-3.5 lg:h-3.5" />}
                  </button>
                ))}
              </div>
           </section>

           <section className="bg-white rounded-xl lg:rounded-2xl p-5 lg:p-6 shadow-sm border border-slate-50 space-y-3 lg:space-y-5">
              <div className="flex items-center gap-2 lg:gap-2.5 border-b border-slate-50 pb-3 lg:pb-4">
                <div className="p-1.5 bg-blue-50 rounded-lg lg:rounded-xl text-blue-600"><Palette className="w-3.5 h-3.5 lg:w-4 lg:h-4" /></div>
                <h3 className="text-xs lg:text-sm font-black text-slate-800">البيانات المهنية</h3>
              </div>
              <div className="space-y-2.5 lg:space-y-3.5">
                 <div className="space-y-1 lg:space-y-1.5">
                    <label className="text-[7px] lg:text-[8px] font-black text-slate-400 uppercase tracking-widest block mr-1 lg:mr-1.5">اسم الطبيب المعالج</label>
                    <input 
                      value={settings.doctorName} 
                      onChange={(e) => setSettings({...settings, doctorName: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg lg:rounded-xl p-2.5 lg:p-3.5 font-bold text-[10px] lg:text-[11px] outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="د. أحمد..."
                    />
                 </div>
                 <div className="space-y-1 lg:space-y-1.5">
                    <label className="text-[7px] lg:text-[8px] font-black text-slate-400 uppercase tracking-widest block mr-1 lg:mr-1.5">المركز أو المستشفى</label>
                    <input 
                      value={settings.centerName} 
                      onChange={(e) => setSettings({...settings, centerName: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg lg:rounded-xl p-2.5 lg:p-3.5 font-bold text-[10px] lg:text-[11px] outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="مركز الشفاء..."
                    />
                 </div>
              </div>
           </section>

           <section className="bg-white rounded-xl lg:rounded-2xl p-5 lg:p-6 shadow-sm border border-slate-50 space-y-3 lg:space-y-5">
              <div className="flex items-center gap-2 lg:gap-2.5 border-b border-slate-50 pb-3 lg:pb-4">
                <div className="p-1.5 bg-amber-50 rounded-lg lg:rounded-xl text-amber-600"><Zap className="w-3.5 h-3.5 lg:w-4 lg:h-4" /></div>
                <h3 className="text-xs lg:text-sm font-black text-slate-800">ربط حساب الذكاء الاصطناعي</h3>
              </div>
              <div className="space-y-2.5 lg:space-y-3.5">
                 <div className="space-y-1 lg:space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[7px] lg:text-[8px] font-black text-slate-400 uppercase tracking-widest block mr-1 lg:mr-1.5">مفتاح Gemini API الخاص بك (اختياري)</label>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[7px] lg:text-[8px] font-black text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md transition-colors">
                        الحصول على مفتاح <ExternalLink className="w-2 h-2 lg:w-2.5 lg:h-2.5" />
                      </a>
                    </div>
                    <input 
                      type="password"
                      value={settings.apiKey || ''} 
                      onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg lg:rounded-xl p-2.5 lg:p-3.5 font-bold text-[10px] lg:text-[11px] outline-none focus:ring-2 focus:ring-amber-100 font-mono"
                      placeholder="AIzaSy..."
                    />
                    <p className="text-[7px] lg:text-[8px] text-slate-400 font-bold leading-relaxed pr-1 lg:pr-1 mt-1">
                      إذا قمت بإدخال مفتاحك هنا، سيستخدمه البرنامج بدلاً من المفتاح الافتراضي. هذا مفيد إذا أردت استخدام حسابك الخاص لتجنب حدود الاستخدام.
                    </p>
                 </div>
              </div>
           </section>

           <section className="bg-white rounded-xl lg:rounded-2xl p-5 lg:p-6 shadow-sm border border-slate-50 space-y-5 lg:space-y-6">
              <div className="flex items-center gap-2.5 lg:gap-3">
                <div className="p-1.5 lg:p-2 bg-indigo-50 rounded-lg lg:rounded-xl text-indigo-600"><Database className="w-4 h-4 lg:w-5 lg:h-5" /></div>
                <div>
                  <h3 className="text-sm lg:text-base font-black text-slate-800">قاعدة البيانات والمزامنة</h3>
                  <p className="text-slate-400 text-[7px] lg:text-[8px] font-bold uppercase tracking-widest mt-0.5">Cloud Database & Persistence</p>
                </div>
              </div>

              <div className="space-y-2.5 lg:space-y-3">
                <div className={`p-3.5 lg:p-5 rounded-xl lg:rounded-2xl border flex items-center justify-between ${
                  dbStatus === 'connected' ? 'bg-blue-50/50 border-blue-100' : 
                  dbStatus === 'disconnected' ? 'bg-rose-50/50 border-rose-100' : 
                  'bg-slate-50/50 border-slate-100'
                }`}>
                  <div className="flex items-center gap-2.5 lg:gap-3">
                    <div className={`w-8 h-8 lg:w-10 lg:h-10 bg-white rounded-lg lg:rounded-xl flex items-center justify-center shadow-sm ${
                      dbStatus === 'connected' ? 'text-blue-600' : 
                      dbStatus === 'disconnected' ? 'text-rose-600' : 
                      'text-slate-400'
                    }`}>
                      <RefreshCcw className={`w-4 h-4 lg:w-5 lg:h-5 ${dbStatus === 'checking' ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <h4 className="text-[10px] lg:text-xs font-black text-slate-800">حالة Supabase</h4>
                      <p className={`text-[7px] lg:text-[8px] font-bold uppercase ${
                        dbStatus === 'connected' ? 'text-blue-500' : 
                        dbStatus === 'disconnected' ? 'text-rose-500' : 
                        'text-slate-500'
                      }`}>
                        {dbStatus === 'connected' ? 'Cloud Sync Active' : 
                         dbStatus === 'disconnected' ? 'Connection Failed' : 
                         'Checking Connection...'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 lg:gap-1.5">
                    <div className={`w-1 h-1 rounded-full ${
                      dbStatus === 'connected' ? 'bg-blue-500 animate-pulse' : 
                      dbStatus === 'disconnected' ? 'bg-rose-500' : 
                      'bg-slate-400 animate-pulse'
                    }`}></div>
                    <span className={`text-[7px] lg:text-[8px] font-black uppercase tracking-widest ${
                      dbStatus === 'connected' ? 'text-blue-600' : 
                      dbStatus === 'disconnected' ? 'text-rose-600' : 
                      'text-slate-500'
                    }`}>
                      {dbStatus === 'connected' ? 'متصل' : 
                       dbStatus === 'disconnected' ? 'غير متصل' : 
                       'جاري التحقق'}
                    </span>
                  </div>
                </div>

                {dbStatus === 'disconnected' && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2 text-rose-600">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[9px] lg:text-[10px] font-bold leading-relaxed">
                      تعذر الاتصال بقاعدة البيانات. يرجى التحقق من اتصال الإنترنت، أو التأكد من صحة مفاتيح Supabase في إعدادات Netlify.
                    </p>
                  </div>
                )}

                <div className="p-3.5 lg:p-5 rounded-xl lg:rounded-2xl bg-slate-50/50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 lg:gap-3">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white rounded-lg lg:rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                      <HardDrive className="w-4 h-4 lg:w-5 lg:h-5" />
                    </div>
                    <div>
                      <h4 className="text-[10px] lg:text-xs font-black text-slate-800">النسخ الاحتياطي</h4>
                      <p className="text-[7px] lg:text-[8px] font-bold text-slate-500 uppercase">LocalStorage Ready</p>
                    </div>
                  </div>
                  <span className="text-[7px] lg:text-[8px] font-black text-slate-400 uppercase tracking-widest">نشط</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button 
                    onClick={handleExportDB}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-blue-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                       <Download className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] lg:text-[10px] font-black text-slate-700">تصدير النسخة</span>
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-emerald-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                       <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] lg:text-[10px] font-black text-slate-700">استيراد النسخة</span>
                  </button>
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportDB} 
                    ref={fileInputRef} 
                    className="hidden" 
                  />
                </div>
              </div>
           </section>

           <div className="mt-8 pt-8 border-t border-rose-100 border-dashed">
             <h3 className="text-rose-500 font-bold mb-4 text-xs">منطقة الخطر</h3>
             <button 
              onClick={onClear} 
              className="w-full py-3 lg:py-4 bg-rose-500 text-white rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-[11px] uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center justify-center gap-2 lg:gap-2.5 shadow-sm"
             >
               <Trash2 className="w-4 h-4" /> إعادة ضبط النظام ومسح كل شيء
             </button>
             <p className="text-[9px] text-slate-500 mt-2 text-center">سيؤدي هذا الإجراء إلى حذف جميع السجلات والإعدادات محلياً وسحابياً</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
