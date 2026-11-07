
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Brain, Trash2, Save, 
  Database, CheckCircle2, AlertCircle, Palette, UserCog, HardDrive, 
  RefreshCcw, Cpu, Zap, Globe, Image as ImageIcon,
  Wind, Sliders, Headphones, LogIn, LogOut, UserPlus, ExternalLink, Home,
  Download, Upload, ChevronDown, Sparkles, FileText, Smartphone, Github,
  ShieldCheck, UserCheck, Edit3
} from 'lucide-react';
import { SystemSettings, ModelType, PatientCase, AIPersonality, ThemeMode, LocalUser } from '../types';
import { supabase } from '../src/lib/supabase';
import { Session } from '@supabase/supabase-js';
import {
  getCurrentLocalUser,
  saveLocalUser,
  setCurrentLocalUser,
  loginOrRegisterLocalUser,
  getLocalUsers,
  exportDatabaseBackup,
  importDatabaseBackup,
  getLocalDatabaseStats
} from '../src/db/localDb';

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
  const [localUser, setLocalUserState] = useState<LocalUser>(getCurrentLocalUser());
  const [allUsers, setAllUsers] = useState<LocalUser[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(localUser.name);
  const [profileSpec, setProfileSpec] = useState(localUser.specialization || 'الطب العام');
  const [profileCenter, setProfileCenter] = useState(localUser.centerName || 'عيادة الحكيم الذكي');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showManualModels, setShowManualModels] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync state whenever settings change
  useEffect(() => {
    const cur = getCurrentLocalUser();
    setLocalUserState(cur);
    setProfileName(settings.doctorName || cur.name);
    setProfileCenter(settings.centerName || cur.centerName || '');
    getLocalUsers().then(setAllUsers);
  }, [settings.doctorName, settings.centerName]);

  const handleSaveLocalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: LocalUser = {
      ...localUser,
      name: profileName.trim() || 'د. طبيب ممارس',
      specialization: profileSpec.trim() || 'الطب العام',
      centerName: profileCenter.trim() || 'العيادة الطبية'
    };
    await saveLocalUser(updated);
    setCurrentLocalUser(updated);
    setLocalUserState(updated);
    setIsEditingProfile(false);
    setSettings({
      ...settings,
      doctorName: updated.name,
      centerName: updated.centerName || settings.centerName
    });
    const users = await getLocalUsers();
    setAllUsers(users);
    alert('تم حفظ وتحديث ملف الطبيب محلياً على الجهاز بنجاح!');
  };

  const handleSwitchUser = (user: LocalUser) => {
    setCurrentLocalUser(user);
    setLocalUserState(user);
    setProfileName(user.name);
    setProfileSpec(user.specialization || '');
    setProfileCenter(user.centerName || '');
    setSettings({
      ...settings,
      doctorName: user.name,
      centerName: user.centerName || settings.centerName
    });
  };

  const handleExportDB = async () => {
    try {
      const jsonContent = await exportDatabaseBackup();
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonContent);
      const exportFileDefaultName = `alhakim_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      // Fallback
      const dataStr = JSON.stringify(records);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `alhakim_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const count = await importDatabaseBackup(content);
        // Also parse and pass to parent state
        const parsed = JSON.parse(content);
        const importedRecords: PatientCase[] = Array.isArray(parsed) ? parsed : (parsed.records || []);
        onImport(importedRecords);
        const users = await getLocalUsers();
        setAllUsers(users);
        alert(`تم استيراد ${count} سجل طبي بنجاح ودمجها مع قاعدة البيانات المحلية!`);
      } catch (err: any) {
        alert(err.message || 'حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        loginOrRegisterLocalUser(session.user.email).then(u => {
          setLocalUserState(u);
          getLocalUsers().then(setAllUsers);
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        loginOrRegisterLocalUser(session.user.email).then(u => {
          setLocalUserState(u);
          getLocalUsers().then(setAllUsers);
        });
      }
    });

    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('patients').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
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
      // Check offline or network state
      if (!navigator.onLine || dbStatus === 'disconnected') {
        const local = await loginOrRegisterLocalUser(email, email.split('@')[0], password);
        setLocalUserState(local);
        setSettings({
          ...settings,
          doctorName: local.name,
          centerName: local.centerName || settings.centerName
        });
        const users = await getLocalUsers();
        setAllUsers(users);
        alert(`تم تسجيل الدخول محلياً بنجاح (وضع أوفلاين).\nالحساب "${local.name}" محفوظ محلياً ويعمل بالكامل بدون اتصال بالإنترنت.`);
        return;
      }

      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          // Fallback to local
          const local = await loginOrRegisterLocalUser(email, email.split('@')[0], password);
          setLocalUserState(local);
          alert('تم إنشاء الحساب محلياً على الجهاز بنجاح!');
        } else {
          await loginOrRegisterLocalUser(email, email.split('@')[0], password);
          alert('تم إنشاء الحساب بنجاح! يمكنك الآن استخدامه محلياً وسحابياً.');
          setAuthMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          // Fallback to local
          const local = await loginOrRegisterLocalUser(email, email.split('@')[0], password);
          setLocalUserState(local);
          alert(`تم الدخول محلياً بحساب: ${local.name}`);
        } else {
          const local = await loginOrRegisterLocalUser(email);
          setLocalUserState(local);
        }
      }
    } catch (error: any) {
      const local = await loginOrRegisterLocalUser(email, email.split('@')[0], password);
      setLocalUserState(local);
      alert(`تم الدخول محلياً بحساب: ${local.name}`);
    } finally {
      setAuthLoading(false);
      const users = await getLocalUsers();
      setAllUsers(users);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
  };

  const models = [
    {
      id: ModelType.AUTO,
      name: 'الموجّه السريري الذكي التلقائي (موصى به - Autonomous AI)',
      desc: 'يحدد النظام تلقائياً وبشكل ديناميكي النموذج الأمثل ويخصص ميزانية التفكير والدقة المعرفية بحسب مدخلات المريض، الصور الإشعاعية، التحاليل، وتعقيد الحالة دون أي حاجة لتدخل يدوي.',
      icon: Sparkles,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-300 ring-2 ring-indigo-200',
      caps: ['توجيه تلقائي ذكي', 'دقة معرفية ديناميكية', 'فحص الأشعة التلقائي', 'أعلى دقة سريرية']
    },
    {
      id: ModelType.PRO,
      name: 'Gemini 3.1 Pro Ultra (الاستشاري القوي)',
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
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-10 duration-700 max-w-4xl mx-auto w-full">
      
      {/* Dynamic Header */}
      <div className="bg-white p-3.5 lg:p-5 rounded-2xl lg:rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 lg:gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 lg:w-32 lg:h-32 bg-blue-50 rounded-full blur-[60px] lg:blur-[80px] -mr-12 -mt-12 lg:-mr-16 lg:-mt-16 opacity-60"></div>
        <div className="flex items-center gap-3.5 lg:gap-4 relative z-10">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-slate-900 rounded-lg lg:rounded-xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
            <SettingsIcon className="w-5 h-5 lg:w-6 lg:h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">إعدادات المحرك الذكي</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">AI Core Configuration & Identity</p>
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
          
          {/* Doctor Account & Identity Section - Offline First */}
          <section className="bg-white rounded-xl lg:rounded-2xl p-5 lg:p-6 shadow-sm border border-slate-50 space-y-5">
             <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                <div className="flex items-center gap-2 lg:gap-2.5">
                  <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><UserCog className="w-4 h-4 lg:w-4.5 lg:h-4.5" /></div>
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-slate-800">حساب وملف الطبيب (Offline-First)</h3>
                    <p className="text-slate-400 text-[8px] font-bold">محفوظ محلياً في جهازك ويعمل 100% بدون إنترنت</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] font-bold">حساب محلي نشط</span>
                </div>
             </div>

             {/* Active Doctor Profile Card */}
             <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border border-blue-100 rounded-2xl p-4 lg:p-5">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                 <div className="flex items-center gap-3.5">
                   <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                     {localUser.name ? localUser.name.replace('د. ', '').charAt(0) : 'ط'}
                   </div>
                   <div>
                     <div className="flex items-center gap-2">
                       <h4 className="text-sm lg:text-base font-black text-slate-900">{localUser.name}</h4>
                       <span className="bg-blue-100 text-blue-700 text-[8px] font-bold px-2 py-0.5 rounded-full">
                         {localUser.role || 'طبيب معالج'}
                       </span>
                     </div>
                     <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                       {localUser.specialization || 'الطب العام'} • {localUser.centerName || 'عيادة الحكيم الذكي'}
                     </p>
                     <p className="text-[9px] text-slate-400 mt-1 font-mono">
                       {session?.user?.email || localUser.email}
                     </p>
                   </div>
                 </div>

                 <button
                   onClick={() => setIsEditingProfile(!isEditingProfile)}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors shadow-xs"
                 >
                   <Edit3 className="w-3.5 h-3.5" />
                   {isEditingProfile ? 'إلغاء التعديل' : 'تعديل البيانات'}
                 </button>
               </div>

               {/* Edit Profile Form */}
               {isEditingProfile && (
                 <form onSubmit={handleSaveLocalProfile} className="mt-4 pt-4 border-t border-blue-100 space-y-3">
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                     <div>
                       <label className="text-[10px] font-bold text-slate-600 block mb-1">اسم الطبيب</label>
                       <input
                         type="text"
                         value={profileName}
                         onChange={(e) => setProfileName(e.target.value)}
                         className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
                         placeholder="د. اسم الطبيب"
                       />
                     </div>
                     <div>
                       <label className="text-[10px] font-bold text-slate-600 block mb-1">التخصص الطبي</label>
                       <input
                         type="text"
                         value={profileSpec}
                         onChange={(e) => setProfileSpec(e.target.value)}
                         className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
                         placeholder="مثال: الباطنية، الجراحة..."
                       />
                     </div>
                     <div>
                       <label className="text-[10px] font-bold text-slate-600 block mb-1">المركز الطبي / العيادة</label>
                       <input
                         type="text"
                         value={profileCenter}
                         onChange={(e) => setProfileCenter(e.target.value)}
                         className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
                         placeholder="اسم المركز أو المستشفى"
                       />
                     </div>
                   </div>
                   <div className="flex justify-end gap-2 pt-1">
                     <button
                       type="submit"
                       className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                     >
                       حفظ التعديلات محلياً
                     </button>
                   </div>
                 </form>
               )}
             </div>

             {/* Multiple Local Accounts Switcher */}
             {allUsers.length > 1 && (
               <div className="pt-2">
                 <p className="text-[10px] font-bold text-slate-500 mb-2">الحسابات المخزنة محلياً على هذا الجهاز:</p>
                 <div className="flex flex-wrap gap-2">
                   {allUsers.map((u) => (
                     <button
                       key={u.id}
                       type="button"
                       onClick={() => handleSwitchUser(u)}
                       className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                         u.id === localUser.id
                           ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                           : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                       }`}
                     >
                       <UserCheck className="w-3.5 h-3.5" />
                       {u.name}
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {/* Cloud Login Option */}
             <div className="mt-4 pt-4 border-t border-slate-100">
               <div className="flex items-center justify-between mb-3">
                 <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                   <ShieldCheck className="w-4 h-4 text-indigo-600" />
                   المزامنة السحابية الاختيارية (Supabase & Google)
                 </h4>
                 {session && (
                   <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                     متصل بالسحابة
                   </span>
                 )}
               </div>

               {session ? (
                 <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                   <div className="text-[10px] text-slate-600">
                     تم تسجيل الدخول سحابياً كـ: <strong>{session.user.email}</strong>
                   </div>
                   <button 
                     onClick={handleLogout}
                     className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-rose-500 rounded-lg text-[10px] font-bold hover:bg-rose-50"
                   >
                     <LogOut className="w-3 h-3" /> خروج سحابي
                   </button>
                 </div>
               ) : (
                 <form onSubmit={handleAuth} className="space-y-3 max-w-md">
                   <p className="text-[10px] text-slate-500 leading-relaxed">
                     إذا كنت متصلاً بالإنترنت، يمكنك تسجيل الدخول سحابياً لمزامنة البيانات بين عدة أجهزة. في حال عدم توفر الإنترنت، سيعمل التطبيق محلياً بنسبة 100%.
                   </p>

                   {authError && (
                     <div className="p-2.5 bg-rose-50 text-rose-600 text-[10px] rounded-lg border border-rose-100 flex items-start gap-1.5">
                       <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                       <span>{authError}</span>
                     </div>
                   )}

                   <button 
                     type="button"
                     onClick={handleGoogleLogin}
                     disabled={authLoading}
                     className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs"
                   >
                     <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                       <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                       <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                       <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                       <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                     </svg>
                     تسجيل الدخول عبر Google
                   </button>

                   <div className="grid grid-cols-2 gap-2">
                     <input 
                       type="email" 
                       required
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
                       placeholder="doctor@example.com"
                     />
                     <input 
                       type="password" 
                       required
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
                       placeholder="••••••••"
                     />
                   </div>

                   <div className="flex items-center gap-2 pt-1">
                     <button 
                       type="submit" 
                       disabled={authLoading}
                       className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                     >
                       {authLoading ? 'جاري المعالجة...' : (authMode === 'login' ? <><LogIn className="w-3.5 h-3.5"/> دخول / حفظ محلي</> : <><UserPlus className="w-3.5 h-3.5"/> إنشاء حساب</>)}
                     </button>
                     <button 
                       type="button"
                       onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                       className="px-3 py-2 text-indigo-600 text-[10px] font-bold hover:bg-indigo-50 rounded-lg transition-colors"
                     >
                       {authMode === 'login' ? 'إنشاء حساب جديد' : 'تسجيل دخول'}
                     </button>
                   </div>
                 </form>
               )}
             </div>
          </section>

          {/* Autonomous AI Clinical Engine & Intelligent Routing */}
          <section className="bg-white rounded-xl lg:rounded-2xl p-5 lg:p-6 shadow-sm border border-slate-50 space-y-5">
             <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><Sparkles className="w-4 h-4 lg:w-5 lg:h-5" /></div>
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-slate-800">التوجيه السريري والذكاء التلقائي</h3>
                    <p className="text-slate-400 text-[8px] font-bold">Autonomous Adaptive Clinical Intelligence</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                  <span className="text-[9px] font-black">تلقائي وذكي 100%</span>
                </div>
             </div>

             {/* Intelligent Autonomous Card */}
             <div className="p-4 lg:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-white border border-indigo-100 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white rounded-xl shadow-xs border border-indigo-100 flex items-center justify-center text-indigo-600">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">الموجّه السريري الذكي التلقائي نشط دائماً</h4>
                        <span className="text-[8px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">Autonomous Engine</span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                        يحدد تلقائياً النموذج الأنسب ويحسب ميزانية التفكير والمنطق المعرفي بحسب الحالة دون الحاجة لاختيار يدوي
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[8px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                    بدون تدخل يدوي
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2">
                  <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-blue-600 text-[10px] font-black">
                      <ImageIcon className="w-3.5 h-3.5" /> فحص الأشعة والصور
                    </div>
                    <p className="text-[8px] text-slate-500 font-bold leading-relaxed">
                      عند إرفاق أشعة سينية أو رنين أو صور سريرية، يُفعّل النظام محرك الرؤية متعدد الوسائط تلقائياً.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-purple-600 text-[10px] font-black">
                      <Sliders className="w-3.5 h-3.5" /> منطق التفكير المعرفي
                    </div>
                    <p className="text-[8px] text-slate-500 font-bold leading-relaxed">
                      يضبط عمق وميزانية التفكير الاستدلالي (Thinking Budget) آلياً بحسب تعقيد الأعراض والتحاليل.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" /> دقة طبية حقيقية
                    </div>
                    <p className="text-[8px] text-slate-500 font-bold leading-relaxed">
                      تشخيص حقيقي قائم على الأدلة يستبعد الاحتمالات المتشابهة ويضع خطة علاجية وتغذوية متكاملة.
                    </p>
                  </div>
                </div>

                {/* Google Grounding Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-indigo-100/70">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-black text-slate-800">التحقق من البروتوكولات الطبية العالمية (Google Grounding)</p>
                      <p className="text-[8px] text-slate-400 font-bold">مطابقة التشخيص مع أحدث المراجع والبروتوكولات السريرية المعتمدة</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, googleSearch: !settings.googleSearch})} 
                    className={`w-9 h-5 rounded-full transition-all relative shadow-inner ${settings.googleSearch ? 'bg-emerald-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-md ${settings.googleSearch ? 'right-4.5' : 'right-0.5'}`}></div>
                  </button>
                </div>
             </div>

             {/* Optional manual override toggle */}
             <div className="pt-1">
               <button
                 type="button"
                 onClick={() => setShowManualModels(!showManualModels)}
                 className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
               >
                 <Cpu className="w-3.5 h-3.5" />
                 {showManualModels ? 'إخفاء خيارات التحكم اليدوي' : 'خيارات متقدمة: التحكم اليدوي بالنماذج (اختياري)'}
                 <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showManualModels ? 'rotate-180' : ''}`} />
               </button>

               {showManualModels && (
                 <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-in fade-in duration-300">
                   <div>
                     <label className="text-[10px] font-bold text-slate-600 block mb-1">النموذج المحدد يدوياً</label>
                     <div className="relative">
                       <select
                         value={settings.model}
                         onChange={(e) => setSettings({...settings, model: e.target.value as ModelType, autoModelRouting: e.target.value === ModelType.AUTO})}
                         className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                       >
                         {models.map(m => (
                           <option key={m.id} value={m.id}>{m.name}</option>
                         ))}
                       </select>
                       <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                         <ChevronDown className="w-4 h-4" />
                       </div>
                     </div>
                   </div>

                   <div>
                     <div className="flex justify-between text-[9px] font-bold text-slate-600 mb-1">
                       <span>ميزانية التفكير اليدوية (Tokens):</span>
                       <span className="text-blue-600 font-mono">{settings.thinkingBudget.toLocaleString()}</span>
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
                   </div>
                 </div>
               )}
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
                 <div className="space-y-1 lg:space-y-1.5">
                    <label className="text-[7px] lg:text-[8px] font-black text-slate-400 uppercase tracking-widest block mr-1 lg:mr-1.5">الصوت المفضل للمعلق الطبي</label>
                    <select
                      value={settings.defaultVoice}
                      onChange={(e) => setSettings({...settings, defaultVoice: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg lg:rounded-xl p-2.5 lg:p-3.5 font-bold text-[10px] lg:text-[11px] outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                    >
                      <option value="WebSpeech">القارئ الفوري الذكي ⚡</option>
                      <option value="Zephyr">د. سمير (استشاري)</option>
                      <option value="Kore">د. منال (استشارية)</option>
                      <option value="Puck">أخصائية ياسمين (هادئ)</option>
                      <option value="Charon">د. عاصم (عميق)</option>
                      <option value="Fenrir">د. فواز (جاد)</option>
                    </select>
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                <div className="flex items-center gap-2.5 lg:gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Database className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">قاعدة البيانات المحلية المدمجة (SQLite / Native Engine)</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Embedded Mobile SQLite Engine & Secure Cloud Sync</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-black">قاعدة مدمجة دائمة</span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Primary SQLite Embedded Native Database Card */}
                <div className="p-4 lg:p-5 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-blue-50/30 border border-emerald-200/90 shadow-2xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100 shrink-0">
                        <HardDrive className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm lg:text-base font-black text-slate-900">محرك SQLite المحلي المدمج (AlHakimDB)</h4>
                          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                            ذاكرة هاتف دائمة (APK Persistent Storage)
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 font-bold mt-1">
                          {records.length} سجل مريض وفحص سريري محفوظ محلياً بأمان تام
                        </p>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-xs font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs inline-block">
                        ✓ محمية من الحذف التلقائي
                      </span>
                    </div>
                  </div>
                  <p className="text-xs lg:text-sm text-slate-600 font-medium leading-relaxed mt-3 pt-3 border-t border-emerald-200/60">
                    يعمل التطبيق على الهاتف وحزمة APK عبر محرك قاعدة بيانات مدمج دائم يماثل SQLite (محرك IndexedDB LevelDB المشفر في مساحة التخزين الدائمة للهاتف). لا تختفي سجلات المرضى أو التشخيصات عند انقطاع الإنترنت أو إعادة تشغيل الجهاز.
                  </p>
                </div>

                {/* Secondary Cloud Sync Card with Trigger */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  dbStatus === 'connected' 
                    ? 'bg-blue-50/50 border-blue-100' 
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
                      dbStatus === 'connected' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <RefreshCcw className={`w-4 h-4 ${dbStatus === 'checking' ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <h4 className="text-xs lg:text-sm font-black text-slate-800">المزامنة السحابية الآمنة ثنائية الاتجاه (Cloud Sync)</h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {dbStatus === 'connected' 
                          ? 'متصل بالسحابة - تتم المزامنة والحفظ التلقائي بين الهاتف والحساب' 
                          : 'وضع العمل المحلي أوفلاين نشط - البيانات محفوظة محلياً وتتزامن عند الاتصال'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        const { syncLocalDatabaseWithCloud } = await import('../src/db/localDb');
                        const res = await syncLocalDatabaseWithCloud();
                        alert(`تمت المزامنة بنجاح!\n- تم رفع ${res.pushed} سجل جديد للسحابة.\n- تم تحديث ${res.pulled} سجل من السحابة.\n- إجمالي السجلات المحلية المحفوظة: ${res.totalLocal}`);
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition-all shadow-2xs"
                    >
                      مزامنة الآن مع السحابة
                    </button>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      dbStatus === 'connected' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {dbStatus === 'connected' ? 'سحابي متصل' : 'أوفلاين محلي'}
                    </span>
                  </div>
                </div>

                {/* Backup & Restore Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button 
                    onClick={handleExportDB}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                       <Download className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-700">تصدير قاعدة البيانات (JSON)</span>
                    <span className="text-[11px] text-slate-400 font-medium">يشمل السجلات وملفات الأطباء</span>
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-sm transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                       <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-700">استيراد قاعدة البيانات (JSON)</span>
                    <span className="text-[11px] text-slate-400 font-medium">دمج فوري مع قاعدة البيانات المحلية</span>
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
