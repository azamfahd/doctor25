
import React, { useState, useEffect } from 'react';
import { 
  Home, Settings, MessageSquareQuote, Menu, LogOut, Zap, Database, TrendingUp, BarChart2, Activity
} from 'lucide-react';
import { SystemSettings } from '../types';

const AlHakimLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="medGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
      <linearGradient id="techGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    
    {/* Outer Tech Ring */}
    <circle cx="50" cy="50" r="45" stroke="url(#techGrad)" strokeWidth="1" strokeDasharray="4 6" opacity="0.5" className="animate-[spin_20s_linear_infinite]" />
    <circle cx="50" cy="50" r="38" stroke="url(#medGrad)" strokeWidth="0.5" opacity="0.3" />

    {/* Stethoscope Tube */}
    <path d="M30 25 C 30 10, 70 10, 70 25 V 45 C 70 65, 45 65, 45 80" stroke="url(#medGrad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* Earpieces */}
    <rect x="26" y="22" width="8" height="6" rx="3" fill="url(#techGrad)" />
    <rect x="66" y="22" width="8" height="6" rx="3" fill="url(#techGrad)" />
    
    {/* Chest Piece */}
    <circle cx="45" cy="80" r="12" fill="white" stroke="url(#medGrad)" strokeWidth="4" />
    <circle cx="45" cy="80" r="5" fill="url(#techGrad)" filter="url(#glow)" className="animate-pulse" />
    
    {/* AI / Future Nodes */}
    <path d="M70 45 L 82 55 L 75 75" stroke="url(#techGrad)" strokeWidth="2" strokeDasharray="3 3" />
    <circle cx="82" cy="55" r="4" fill="url(#techGrad)" filter="url(#glow)" />
    <circle cx="75" cy="75" r="3" fill="url(#techGrad)" />
    
    <path d="M45 60 L 25 55 L 20 70" stroke="url(#techGrad)" strokeWidth="2" strokeDasharray="3 3" />
    <circle cx="25" cy="55" r="3" fill="url(#techGrad)" />
    <circle cx="20" cy="70" r="4" fill="url(#techGrad)" filter="url(#glow)" />
    
    {/* Digital Cross */}
    <rect x="48" y="35" width="4" height="14" rx="1" fill="url(#techGrad)" />
    <rect x="43" y="40" width="14" height="4" rx="1" fill="url(#techGrad)" />
  </svg>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: SystemSettings;
  onUpdateSettings: (newSettings: SystemSettings) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, settings, onUpdateSettings }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const tabs = [
    { id: 'home', icon: Home, label: 'لوحة التحكم' },
    { id: 'diagnosis', icon: Zap, label: 'الكشف الخوارزمي' },
    { id: 'sensors', icon: Activity, label: 'المستشعرات الحيوية' },
    { id: 'analytics', icon: BarChart2, label: 'التحليل البصري' },
    { id: 'powerbi', icon: TrendingUp, label: 'التحليل الذكي (Power BI)' },
    { id: 'consult', icon: MessageSquareQuote, label: 'الاستشارة' },
    { id: 'records', icon: Database, label: 'السجلات' },
    { id: 'settings', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900 overflow-x-hidden">
      {/* Sidebar Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] lg:hidden animate-in fade-in duration-300" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar Content - White Sidebar for professional look */}
      <aside className={`fixed top-0 right-0 bottom-0 z-[110] w-[75%] sm:w-64 bg-white border-l border-slate-100 shadow-2xl transition-transform duration-500 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 flex flex-col items-center border-b border-slate-50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-50"></div>
            <div className="relative group mb-3">
              <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-xl blur opacity-10 group-hover:opacity-30 transition-opacity duration-500"></div>
              <AlHakimLogo className="w-10 h-10 relative transition-transform duration-500 group-hover:scale-110" />
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight text-center leading-tight">{settings.centerName}</h1>
            <div className="flex items-center gap-1.5 mt-1">
               <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></span>
               <p className="text-[7px] text-blue-600 font-black uppercase tracking-[0.2em]">AI Medical Core</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id} 
                  onClick={() => { setActiveTab(tab.id); setIsSidebarOpen(false); }} 
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-[11px] transition-all group relative overflow-hidden ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                  <span className="tracking-tight">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-50">
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-500 font-black text-[9px] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all group uppercase tracking-widest">
              <LogOut className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container - Adjusted margin-right to mr-64 */}
      <div className={`flex-1 flex flex-col h-screen transition-all lg:mr-64 overflow-hidden`}>
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-2xl px-4 lg:px-6 h-14 lg:h-16 flex items-center justify-between shadow-sm sticky top-0 z-[90] border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors shadow-sm">
              <Menu className="w-4.5 h-4.5" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-sm lg:text-base font-black text-slate-900 leading-none mb-0.5 tracking-tight">د. {settings.doctorName}</h2>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`}></div>
                <span className="text-[8px] text-slate-400 font-black uppercase tracking-[0.15em]">{isOnline ? 'نظام التشخيص متصل' : 'وضع عدم الاتصال'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex flex-col items-end mr-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">المستوى المهني</span>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">استشاري أول</span>
             </div>
             <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative w-9 h-9 lg:w-10 lg:h-10 rounded-lg border-2 border-white shadow-lg overflow-hidden bg-slate-50 cursor-pointer transition-all duration-500 group-hover:scale-105 flex items-center justify-center">
                  <AlHakimLogo className="w-6 h-6 lg:w-7 lg:h-7" />
                </div>
             </div>
          </div>
        </header>

        {!isOnline && (
          <div className="bg-rose-500 text-white text-[10px] lg:text-xs py-1.5 lg:py-2 text-center font-bold sticky top-[56px] lg:top-[64px] z-[85] flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top-2">
            <Zap className="w-3 h-3 lg:w-4 lg:h-4 opacity-80" />
            <span>تنبيه: أنت تعمل الآن في وضع عدم الاتصال (Offline). بعض الميزات السحابية قد لا تتوفر.</span>
          </div>
        )}

        {/* Main Content Area - Increased max-width for better utilization */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-none w-full flex flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
