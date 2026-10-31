import React, { useEffect, useState } from 'react';
import { RefreshCw, ArrowUpCircle, X } from 'lucide-react';
import { APP_VERSION } from '../constants';

export const UpdateNotification: React.FC = () => {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsVisibleDismissed] = useState(false);

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const isNative = (window as any).Capacitor?.isNativePlatform?.();
        
        // التحقق من GitHub API للحصول على أحدث Release رسمي
        const githubResponse = await fetch('https://api.github.com/repos/azamfahd25/Al-Hakim-Pro-Smart-Medical/releases/latest');
        
        if (githubResponse.ok) {
          const releaseData = await githubResponse.json();
          const latestTag = releaseData.tag_name; // مثلاً 4.5.12

          // تنظيف رقم الإصدار من الحروف (v) للمقارنة
          const currentClean = APP_VERSION.replace('v', '');
          const latestClean = latestTag.replace('v', '');

          if (latestClean !== currentClean) {
            setNewVersion(latestTag);
            setIsVisible(true);
          }
        }
      } catch (e) {
        // فشل التحقق، قد يكون بسبب حدود الـ API أو انقطاع الإنترنت
      }
    };

    // التحقق فور التشغيل ثم كل ساعة
    checkUpdates();
    const interval = setInterval(checkUpdates, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[300] animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-blue-500/30 flex items-center gap-4 max-w-sm">
        <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center shrink-0">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin-slow" />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <h4 className="text-sm font-black flex items-center gap-1.5 justify-end">
            تحديث جديد متوفر
            <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
          </h4>
          <p className="text-[11px] text-slate-400 font-bold mt-0.5 truncate">
            الإصدار {newVersion} جاهز للعمل الآن
          </p>
          <div className="flex items-center gap-2 mt-2 justify-end">
             <button 
               onClick={() => {
                 const isNative = (window as any).Capacitor?.isNativePlatform?.();
                 if (isNative) {
                   // التوجيه لصفحة الإصدارات في GitHub لتحميل أحدث APK
                   window.open('https://github.com/azamfahd25/Al-Hakim-Pro-Smart-Medical/releases', '_blank');
                 } else {
                   window.location.reload();
                 }
               }}
               className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-all active:scale-95"
             >
               تحديث الآن
             </button>
             <button 
               onClick={() => setIsVisibleDismissed(true)}
               className="p-1 text-slate-500 hover:text-white transition-colors"
             >
               <X className="w-4 h-4" />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
