import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2, ShieldCheck, Github, ExternalLink } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const isNative = (window as any).Capacitor?.isNativePlatform?.();

  // If already running in standalone native mode or inside Capacitor, hide the ambient install button
  if (isInstalled || isNative) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => {
          if (isInstallable) {
            install();
          } else if (isIOS) {
            setShowIOSGuide(true);
          } else {
            setShowModal(true);
          }
        }}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-black text-white shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 cursor-pointer"
        title="تثبيت التطبيق على جهازك أو تصدير APK"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>تثبيت التطبيق / APK</span>
      </button>

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                تثبيت على iPhone / iPad
              </h3>
              <button onClick={() => setShowIOSGuide(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p className="font-bold text-slate-800">
                لتثبيت تطبيق الحكيم الذكي Pro على جهاز iOS كأنه تطبيق من متجر التطبيقات:
              </p>
              <div className="bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0">1</span>
                  <span>اضغط على زر <strong>المشاركة (Share)</strong> في أسفل متصفح Safari.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0">2</span>
                  <span>مرر للأسفل واضغط على <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0">3</span>
                  <span>اضغط <strong>إضافة (Add)</strong> في الزاوية العلوية.</span>
                </div>
              </div>
              <p className="text-xs text-emerald-600 font-bold">
                ✓ سيعمل التطبيق بشاشة كاملة وبدون إطار المتصفح مع دعم التخزين المحلي الكامل.
              </p>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              تم الفهم
            </button>
          </div>
        </div>
      )}

      {/* APK & App Export Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تثبيت وتصدير التطبيق (APK & PWA)</h3>
                  <p className="text-xs text-slate-500 font-bold">حزم التطبيق لنظام Android وأجهزة الهاتف</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 space-y-2">
                <h4 className="font-black text-blue-900 flex items-center gap-1.5 text-sm">
                  <Github className="w-4 h-4 text-slate-900" /> البناء التلقائي لملف APK عبر GitHub Actions
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم إعداد وتجهيز ملف البناء الآلي <code>.github/workflows/build-apk.yml</code> داخل مشروعك. بمجرد عمل مزامنة (Push / Sync) مع مستودع GitHub الخاص بك:
                </p>
                <ul className="space-y-1 text-[11px] text-slate-700 font-bold pr-2 list-disc list-inside">
                  <li>يقوم خادم GitHub بتشغيل بيئة Android SDK و Gradle تلقائياً.</li>
                  <li>يتم بناء ملف <code>alhakim-pro.apk</code> مباشرة.</li>
                  <li>تجد ملف الـ APK جاهزاً للتحميل في تبويب <strong>Actions</strong> داخل مستودعك على GitHub!</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-black text-slate-900 text-xs">
                  أو التثبيت الفوري كـ تطبيق مستقل (PWA):
                </h4>
                <p className="text-[11px] text-slate-600">
                  يمكنك تثبيت هذا التطبيق فوراً بنقرة واحدة من متصفحك (Chrome / Edge / Safari) ليعمل كتطبيق سطح مكتب أو تطبيق هاتف بكامل ميزات الحفظ المحلي ودون أي متطلبات إضافية.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  if (isInstallable) install();
                }}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-600/20"
              >
                تثبيت فوري الآن
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
