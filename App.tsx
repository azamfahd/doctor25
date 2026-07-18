
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import Diagnosis from './components/Diagnosis.tsx';
import Records from './components/Records.tsx';
import Settings from './components/Settings.tsx';
import AIResult from './components/AIResult.tsx';
import ConsultSession from './components/ConsultSession.tsx';
import PowerBIAnalytics from './components/PowerBIAnalytics.tsx';
import { AdvancedAnalytics } from './components/AdvancedAnalytics.tsx';
import { PatientCase, SystemSettings, StructuredDiagnosis, VitalSigns } from './types.ts';
import { INITIAL_SETTINGS, STORAGE_KEYS } from './constants.ts';
import { analyzeMedicalCase } from './services/geminiService.ts';
import { MessageSquare, Activity, Home } from 'lucide-react';
import { supabase } from './src/lib/supabase.ts';
import { Session } from '@supabase/supabase-js';
import { db } from './src/db/localDb.ts';
import { SensorsHub } from './components/SensorsHub.tsx';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [records, setRecords] = useState<PatientCase[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentDiagnosis, setCurrentDiagnosis] = useState<{ diagnosis: StructuredDiagnosis, sources: any[] } | null>(null);
  const [lastDiagnosedPatient, setLastDiagnosedPatient] = useState<PatientCase | null>(null);
  const [activeSessionPatient, setActiveSessionPatient] = useState<PatientCase | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [transferredVitals, setTransferredVitals] = useState<VitalSigns | undefined>(undefined);

  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    
    // Check active session & initialize offline DB
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchRecords(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      fetchRecords(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRecords = async (currentSession: Session | null) => {
    // تحميل البيانات المحلية فورياً ليشعر الطبيب بمرونة واستجابة لحظية في التطبيق
    await loadLocalRecords();

    // إذا كان هناك جلسة نشطة للمستخدم، نقوم بالمزامنة الثنائية الآمنة
    if (currentSession) {
      try {
        // 1. جلب السجلات السحابية (Supabase)
        const { data: cloudData, error } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', currentSession.user.id);

        if (error) throw error;

        // 2. جلب السجلات المحلية الحالية المخزنة في IndexedDB
        const localRecords = await db.records.toArray();

        // 3. بناء خريطة لمقارنة السجلات من الجهتين
        const cloudRecordsMap = new Map<string, PatientCase>();
        if (cloudData) {
          cloudData.forEach(item => {
            const parsedData: PatientCase = {
              ...item.data,
              id: item.id.toString(),
              // الحفاظ على تاريخ المرضى وتجنب خلط ترويسة التواريخ
              date: item.data?.date || new Date(item.created_at).toLocaleDateString('ar-EG')
            };
            cloudRecordsMap.set(item.id, parsedData);
          });
        }

        const localRecordsMap = new Map<string, PatientCase>();
        localRecords.forEach(r => {
          localRecordsMap.set(r.id, r);
        });

        const toUpload: any[] = [];
        const finalMergedRecords: PatientCase[] = [];

        // أ) التحقق من السجلات المحلية: إذا لم تكن موجودة في السحابة، يتم إدراجها للرفع
        for (const localRec of localRecords) {
          if (!cloudRecordsMap.has(localRec.id)) {
            // محاكاة رفع السجل غير المزامن بعد وتجنب الرفع المكرر للمعرّفات الوهمية لو كانت موجودة مسبقاً
            if (localRec.id && !localRec.id.startsWith('mock-')) {
              toUpload.push({
                id: localRec.id,
                user_id: currentSession.user.id,
                data: localRec,
                status: localRec.status
              });
            }
            finalMergedRecords.push(localRec);
          } else {
            // موجود في الطرفين: نعتمد السجل الأحدث أو نسخة السحابة كنسخة مرجعية موثوقة
            finalMergedRecords.push(cloudRecordsMap.get(localRec.id) || localRec);
          }
        }

        // ب) التحقق من السجلات السحابية: الحالات الموجودة بالسحابة وغير متواجدة محلياً نقوم بتنزيلها
        for (const [cloudId, cloudRec] of cloudRecordsMap.entries()) {
          if (!localRecordsMap.has(cloudId)) {
            finalMergedRecords.push(cloudRec);
          }
        }

        // 4. رفع الحالات المنتجة محلياً (محلياً إلى السحابة) كمزامنة خلفية
        if (toUpload.length > 0) {
          const { error: uploadError } = await supabase
            .from('patients')
            .insert(toUpload);
          if (uploadError) {
             console.warn("Info: Supabase local sync skipped (offline or unconfigured):", uploadError);
          } else {
             console.log(`Successfully synced ${toUpload.length} local cases to cloud.`);
          }
        }

        // 5. حفظ البيانات المدمجة بالكامل والموثوقة في IndexedDB وتحديث واجهة المستخدم
        if (finalMergedRecords.length > 0) {
          await db.records.bulkPut(finalMergedRecords);
          
          // ترتيب السجلات تنازلياً حسب المعرِّف (وهو الطابع الزمني) لعرض الحالات الأحدث أولاً
          const sorted = [...finalMergedRecords].sort((a, b) => b.id.localeCompare(a.id));
          setRecords(sorted);
        }
      } catch (err) {
        console.log('Info: Offline or Supabase connection skipped in sync:', err);
      }
    }
  };

  const loadLocalRecords = async () => {
    try {
      // Use Dexie IndexedDB for robust large data loading including heavy base64 images
      const localData = await db.records.toArray();
      
      if (localData.length === 0) {
        // Mock default data for showcase if totally empty
        const mockData: PatientCase[] = [
          {
            id: 'mock-1',
            date: new Date().toISOString().split('T')[0],
            name: 'أحمد عبدالله',
            age: '45',
            gender: 'ذكر',
            status: 'حرجة',
            symptoms: 'ألم في الصدر، ضيق تنفس',
            vitals: { bloodPressure: '140/90', pulse: '88', temperature: '37.1', spo2: '96' }
          },
          {
            id: 'mock-2',
            date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
            name: 'فاطمة سالم',
            age: '62',
            gender: 'أنثى',
            status: 'مستقرة',
            symptoms: 'تعب عام وإرهاق',
            vitals: { bloodPressure: '120/80', pulse: '72', temperature: '36.8', spo2: '99' }
          }
        ];
        await db.records.bulkPut(mockData);
        setRecords(mockData);
      } else {
        // Sort newest first
        localData.reverse();
        setRecords(localData);
      }
    } catch (err) {
      console.error("Local DB fetch error:", err);
    }
  };

  const saveToLocalStorage = async (newRecord: PatientCase) => {
    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    
    // Save to deep local IndexedDB (no image stripping required, huge capacity)
    try {
      await db.records.put(newRecord);
    } catch (err) {
      console.error("Failed writing to Dexie IndexedDB:", err);
    }

    // Try background cloud sync if logged in
    if (session) {
      try {
        const { error } = await supabase
          .from('patients')
          .insert([{ 
            id: newRecord.id,
            data: newRecord,
            status: newRecord.status,
            user_id: session.user.id
          }]);
        if (error) throw error;
      } catch (err) {
        console.warn('Info: Supabase background save skipped (offline or unconfigured):', err);
      }
    }
  };

  const bulkSaveToSupabase = async (newRecords: PatientCase[]) => {
    setRecords(newRecords);
    
    try {
      await db.records.clear();
      await db.records.bulkPut(newRecords);
    } catch(e) { console.error('Bulk save local fail:', e); }

    if (session) {
      try {
        await supabase.from('patients').delete().eq('user_id', session.user.id);
        
        if (newRecords.length > 0) {
          const payload = newRecords.map(r => ({
            id: r.id,
            data: r,
            status: r.status,
            user_id: session.user.id
          }));

          const { error } = await supabase.from('patients').insert(payload);
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Info: Supabase background bulk save skipped:', err);
      }
    }
  };

  const updateRecordInSupabase = async (patientId: string, updatedData: Partial<PatientCase>) => {
    try {
      const targetRecord = records.find(r => r.id === patientId);
      if (!targetRecord) return;

      const newData = { ...targetRecord, ...updatedData };
      const updatedRecords = records.map(r => r.id === patientId ? newData : r);
      
      setRecords(updatedRecords);
      await db.records.put(newData);

      if (session) {
        const { error } = await supabase
          .from('patients')
          .update({ data: newData, status: newData.status })
          .eq('id', patientId)
          .eq('user_id', session.user.id);

        if (error) throw error;
      }
    } catch (err) {
      console.error('Error updating record:', err);
    }
  };

  const deleteRecord = async (id: string) => {
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    
    try {
      await db.records.delete(id as any);
    } catch(err) {}

    if (session) {
      try {
        const { error } = await supabase
          .from('patients')
          .delete()
          .eq('id', id)
          .eq('user_id', session.user.id);
        
        if (error) throw error;
      } catch (err) {
        console.warn('Info: Supabase background delete skipped:', err);
      }
    }
  };

  const updateSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
  };

  const handleAnalysis = async (patientData: Partial<PatientCase>) => {
    setIsAnalyzing(true);
    try {
      // الخدمة تتعامل الآن مع المفتاح الافتراضي داخلياً
      const result = await analyzeMedicalCase(patientData, settings);
      
      let status: 'مستقرة' | 'متابعة' | 'تدخل طبي' | 'حرجة' = 'مستقرة';
      if (result.diagnosis.severity === 'حرجة') {
        status = 'حرجة';
      } else if (result.diagnosis.severity === 'مرتفعة') {
        status = 'تدخل طبي';
      } else if (result.diagnosis.severity === 'متوسطة') {
        status = 'متابعة';
      }

      const newRecord: PatientCase = {
        id: Date.now().toString(),
        name: patientData.name || 'مجهول',
        age: patientData.age || '--',
        gender: patientData.gender || 'ذكر',
        symptoms: patientData.symptoms || '',
        vitals: patientData.vitals || { bloodPressure: '', pulse: '', temperature: '', spo2: '' },
        images: patientData.images || [],
        diagnosis: result.diagnosis,
        chatHistory: [],
        date: new Date().toLocaleDateString('ar-EG'),
        status: status
      };
      
      saveToLocalStorage(newRecord);
      setCurrentDiagnosis(result);
      setLastDiagnosedPatient(newRecord);
    } catch (error: any) {
      console.error("Analysis Error:", error);
      alert("⚠️ حدث خطأ أثناء التحليل. يرجى التأكد من استقرار الإنترنت أو التحقق من صحة مفتاح الـ API.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderContent = () => {
    // Top-level modal/overlay views
    if (activeSessionPatient) {
      return (
        <ConsultSession 
          patient={activeSessionPatient} 
          settings={settings}
          onClose={() => setActiveSessionPatient(null)}
          onUpdateHistory={(history) => {
             updateRecordInSupabase(activeSessionPatient.id, { chatHistory: history });
          }}
        />
      );
    }

    if (currentDiagnosis && lastDiagnosedPatient) {
      return (
        <AIResult 
          diagnosis={currentDiagnosis.diagnosis} 
          patientName={lastDiagnosedPatient.name}
          patientGender={lastDiagnosedPatient.gender}
          onClose={() => {
            setCurrentDiagnosis(null);
            setActiveTab('home');
          }} 
          settings={settings}
        />
      );
    }

    // Declarative tab views mapping
    const views: Record<string, React.ReactNode> = {
      home: (
        <Dashboard 
          doctorName={settings.doctorName} 
          records={records} 
          onNewCase={() => {
            setTransferredVitals(undefined);
            setActiveTab('diagnosis');
          }} 
          onViewAll={() => setActiveTab('records')} 
          activeModel={settings.model} 
          isThinking={settings.deepThinking}
          onNavigate={(tab) => {
            if (tab === 'diagnosis') {
              setTransferredVitals(undefined);
            }
            setActiveTab(tab);
          }}
        />
      ),
      diagnosis: (
        <Diagnosis 
          onAnalyze={handleAnalysis} 
          isAnalyzing={isAnalyzing} 
          onNavigateHome={() => setActiveTab('home')}
          initialVitals={transferredVitals}
        />
      ),
      sensors: (
        <SensorsHub 
          onNavigateHome={() => setActiveTab('home')}
          records={records}
          settings={settings}
          onStartDiagnosisWithVitals={(vitals) => {
            setTransferredVitals(vitals);
            setActiveTab('diagnosis');
          }}
        />
      ),
      analytics: (
        <AdvancedAnalytics 
          records={records} 
          activeModel={settings.model} 
          onNavigateHome={() => setActiveTab('home')}
        />
      ),
      powerbi: (
        <PowerBIAnalytics 
          records={records} 
          activeModel={settings.model} 
          isThinking={settings.deepThinking}
          onNavigateHome={() => setActiveTab('home')}
        />
      ),
      records: (
        <Records 
          records={records} 
          onDeleteRecord={deleteRecord}
          onStartSession={(p) => setActiveSessionPatient(p)}
          onNewCase={() => setActiveTab('diagnosis')}
          onNavigateHome={() => setActiveTab('home')}
          settings={settings}
        />
      ),
      consult: (
        <div className="space-y-4 lg:space-y-6">
          <div className="bg-slate-900 p-6 lg:p-8 rounded-2xl lg:rounded-3xl text-white flex items-center justify-between overflow-hidden relative">
            <div className="relative z-10">
              <h2 className="text-xl lg:text-2xl font-black mb-1 lg:mb-2">جلسات متابعة المرضى</h2>
              <p className="text-slate-400 text-[10px] lg:text-xs font-medium">اختر مريضاً لبدء جلسة استشارة ذكية أو متابعة سير العلاج.</p>
            </div>
            <div className="flex gap-2 relative z-10 font-sans">
               <button 
                 onClick={() => setActiveTab('home')}
                 className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-xs hover:border-white/20 transition-all backdrop-blur-sm shadow-xs hover:shadow-sm border border-white/10 active:scale-95 cursor-pointer duration-200"
               >
                 <Home className="w-4 h-4 text-white/90" />
                 الرئيسية
               </button>
            </div>
            <MessageSquare className="w-24 h-24 lg:w-32 lg:h-32 absolute -bottom-8 -left-8 text-white/5" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
             {records.map(r => (
               <div key={r.id} onClick={() => setActiveSessionPatient(r)} className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 hover:border-blue-500 cursor-pointer transition-all flex items-center justify-between group shadow-sm">
                  <div className="flex items-center gap-3 lg:gap-4">
                     <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-50 rounded-xl lg:rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Activity className="w-5 h-5 lg:w-6 lg:h-6" />
                     </div>
                     <div>
                        <p className="font-black text-sm lg:text-base text-slate-800">{r.name}</p>
                        <p className="text-[9px] lg:text-[10px] text-slate-400 font-bold">{r.diagnosis?.conditionName || 'بانتظار التحليل'}</p>
                     </div>
                  </div>
               </div>
             ))}
          </div>
        </div>
      ),
      settings: (
        <Settings 
          settings={settings} 
          setSettings={updateSettings} 
          records={records}
          onImport={(imported) => {
            const merged = [...imported, ...records];
            const uniqueRecords = Array.from(new Map(merged.map((item: any) => [item.id, item])).values());
            bulkSaveToSupabase(uniqueRecords);
          }}
          onSave={() => {
            updateSettings(settings);
            alert('✅ تم حفظ الإعدادات بنجاح.');
          }} 
          onClear={async () => {
            if(confirm('سيتم مسح كافة السجلات والإعدادات وإرجاع النظام لحالته الافتراضية. لا يمكن التراجع عن هذا الإجراء. هل أنت متأكد؟')) {
              try {
                await db.records.clear();
                await db.settings.clear();
                localStorage.clear();
                bulkSaveToSupabase([]);
                alert('تمت إعادة ضبط النظام بنجاح. سيتم الآن إعادة تحميل الصفحة.');
                window.location.reload();
              } catch (e) {
                console.error("Error during reset", e);
              }
            }
          }}
          onNavigateHome={() => setActiveTab('home')}
        />
      )
    };

    return views[activeTab] || null;
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      settings={settings} 
      onUpdateSettings={updateSettings}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
