
import React, { useState, useEffect } from 'react';
import { 
  Plus, Clock, Database, ShieldCheck, Activity, Search, Zap, 
  Stethoscope, Users, Settings, Mic, HeartPulse, BrainCircuit, 
  TrendingUp, Sparkles, RotateCw, Award, AlertTriangle, BarChart2 
} from 'lucide-react';
import { PatientCase } from '../types';

interface DashboardProps {
  doctorName: string;
  records: PatientCase[];
  onNewCase: () => void;
  onViewAll: () => void;
  activeModel: string;
  isThinking: boolean;
  onNavigate?: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ doctorName, records, onNewCase, onViewAll, activeModel, isThinking, onNavigate }) => {
  const [currentAccuracy] = useState(() => {
    const saved = localStorage.getItem('heakim_ml_accuracy');
    return saved ? parseFloat(saved) : 99.81;
  });

  const recentRecords = records.slice(0, 4);

  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'gemini-3.6-flash': return 'Gemini 3.6 Flash Ultra';
      case 'gemini-3.5-pro': return 'Gemini 3.5 Pro Advanced';
      case 'gemini-3.5-flash': return 'Gemini 3.5 Flash Super';
      case 'gemini-3.1-pro-preview': return 'Gemini 3.1 Pro Ultra';
      case 'gemini-2.5-pro': return 'Gemini 2.5 Pro Clinical';
      case 'gemini-2.5-flash': return 'Gemini 2.5 Flash Balanced';
      case 'gemini-1.5-pro': return 'Gemini 1.5 Pro Long-Context';
      case 'gemini-3.1-flash-lite-preview': return 'Gemini 3.1 Flash Lite';
      case 'gemini-3-pro-image-preview': return 'Gemini 3 Pro Image';
      case 'gemini-3.1-flash-live-preview': return 'Gemini 3.1 Flash Live';
      default: return model;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto pb-4 md:pb-8 animate-in fade-in duration-500">
      {/* Welcome Hero - Premium Design */}
      <div className="relative rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-[#0B0F19] via-[#0F172A] to-[#1E293B] p-4 sm:p-5 lg:p-7 text-white group border border-blue-500/15">
        <style>{`
          @keyframes ekg-pulse-drawing {
            0% {
              stroke-dashoffset: 1000;
            }
            100% {
              stroke-dashoffset: 0;
            }
          }
          @keyframes heartbeat-double {
            0%, 100% {
              transform: scale(1);
              opacity: 0.25;
              filter: drop-shadow(0 0 2px rgba(34, 211, 238, 0.4)) brightness(1);
            }
            14% {
              transform: scale(1.18);
              opacity: 1;
              filter: drop-shadow(0 0 25px rgba(34, 211, 238, 1)) drop-shadow(0 0 50px rgba(6, 182, 212, 0.95)) brightness(2);
            }
            28% {
              transform: scale(1.05);
              opacity: 0.45;
              filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.7)) brightness(1.2);
            }
            42% {
              transform: scale(1.3);
              opacity: 1;
              filter: drop-shadow(0 0 35px rgba(34, 211, 238, 1)) drop-shadow(0 0 65px rgba(6, 182, 212, 1)) brightness(2.2);
            }
            70% {
              transform: scale(1);
              opacity: 0.25;
              filter: drop-shadow(0 0 2px rgba(34, 211, 238, 0.4)) brightness(1);
            }
          }
          .ekg-active-line {
            stroke-dasharray: 220 780;
            animation: ekg-pulse-drawing 3.4s linear infinite;
            filter: drop-shadow(0 0 8px #22d3ee) drop-shadow(0 0 18px #06b6d4);
          }
          .beating-medical-heart {
            animation: heartbeat-double 1.2s infinite cubic-bezier(0.21, 0.85, 0.45, 1);
            transform-origin: center;
          }
          .glow-container {
            position: relative;
          }
        `}</style>

        {/* Medical Grid Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="heart-grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(6, 182, 212, 0.08)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#heart-grid-pattern)" />
          </svg>
        </div>

        {/* Ambient Darkened Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F19] via-[#0B0F19]/90 to-transparent z-0"></div>

        {/* Live EKG Pulse Wave */}
        <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none opacity-60 z-0 overflow-hidden">
          <svg className="w-full h-full min-w-[800px] absolute right-0 bottom-x" viewBox="0 0 1000 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ekgGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            {/* Soft background stationary EKG line for realism */}
            <path 
              d="M 0,100 L 120,100 L 135,90 L 145,110 L 155,100 L 170,40 L 185,180 L 200,100 L 220,100 L 235,80 L 250,100 L 420,100 L 435,90 L 445,110 L 455,100 L 470,40 L 485,180 L 500,100 L 520,100 L 535,80 L 550,100 L 720,100 L 735,90 L 745,110 L 755,100 L 770,40 L 785,180 L 800,100 L 820,100 L 835,80 L 850,100 L 1000,100" 
              fill="none" 
              stroke="rgba(6, 182, 212, 0.12)" 
              strokeWidth="2" 
            />
            {/* Active sweep pulse trace */}
            <path 
              className="ekg-active-line"
              d="M 0,100 L 120,100 L 135,90 L 145,110 L 155,100 L 170,40 L 185,180 L 200,100 L 220,100 L 235,80 L 250,100 L 420,100 L 435,90 L 445,110 L 455,100 L 470,40 L 485,180 L 500,100 L 520,100 L 535,80 L 550,100 L 720,100 L 735,90 L 745,110 L 755,100 L 770,40 L 785,180 L 800,100 L 820,100 L 835,80 L 850,100 L 1000,100" 
              fill="none" 
              stroke="url(#ekgGlow)" 
              strokeWidth="3.5" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Pulsing Medical Heart Outline decoration */}
        <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none z-0 hidden md:block">
          <div className="beating-medical-heart w-48 h-48 flex items-center justify-center text-cyan-400">
            <svg className="w-full h-full" viewBox="0 0 24 24" fill="rgba(6, 182, 212, 0.18)" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {/* Perfect medical heart path */}
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              {/* EKG wave line passing through the heart directly */}
              <path d="M4 11h3l2-3 2 6 1.5-4h2.5" className="opacity-95 stroke-cyan-200" strokeWidth="2.2" />
            </svg>
          </div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-8">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 rounded-full border border-cyan-500/20 mb-2 sm:mb-3">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></div>
              <span className="text-[7.5px] lg:text-[9px] font-bold text-cyan-400 uppercase tracking-wider">نظام الحكيم المطور v4.0</span>
            </div>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-black mb-2 sm:mb-3 leading-tight tracking-tight">مرحباً دكتور {doctorName.split(' ')[0]}</h2>
            <p className="text-slate-400 text-[10px] sm:text-[11px] lg:text-xs font-medium mb-4 sm:mb-6 leading-relaxed max-w-md">الذكاء الاصطناعي جاهز لتحليل الحالات المعقدة وتوفير الوقت والجهد في التشخيص السريري الدقيق.</p>
            <div className="flex flex-row gap-2 flex-wrap">
              <button 
                onClick={onNewCase}
                className="flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 sm:px-4.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs lg:text-sm transition-all shadow-md shadow-cyan-600/10 active:scale-95 group cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
                بدء كشف جديد
              </button>
              <button 
                onClick={onViewAll}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white px-3.5 py-1.5 sm:px-4.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs lg:text-sm transition-all border border-white/10 cursor-pointer"
              >
                سجلات المرضى
              </button>
            </div>
          </div>
          <div className="hidden md:flex w-20 h-20 lg:w-24 lg:h-24 bg-white/5 backdrop-blur-xl rounded-xl lg:rounded-2xl items-center justify-center border border-white/10 shadow-lg relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <ShieldCheck className="w-10 h-10 lg:w-12 lg:h-12 text-cyan-400 relative z-10 transition-transform group-hover:scale-110" />
          </div>
        </div>
      </div>

      {/* Quick Actions / Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
        <button onClick={() => onNavigate?.('diagnosis')} className="w-full p-2.5 sm:p-3.5 lg:p-4 bg-white text-slate-800 rounded-xl sm:rounded-xl lg:rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 lg:gap-3 group pro-3d-card glow-border-blue cursor-pointer">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors shrink-0">
            <Stethoscope className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <span className="font-bold text-[10px] sm:text-[11px] lg:text-xs group-hover:text-blue-600 transition-colors">تشخيص جديد</span>
        </button>
        <button onClick={() => onNavigate?.('sensors')} className="w-full p-2.5 sm:p-3.5 lg:p-4 bg-white text-slate-800 rounded-xl sm:rounded-xl lg:rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 lg:gap-3 group pro-3d-card glow-border-cyan cursor-pointer">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-cyan-50 group-hover:bg-cyan-100 flex items-center justify-center transition-colors shrink-0">
            <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 text-cyan-600 group-hover:scale-110 transition-transform" />
          </div>
          <span className="font-bold text-[10px] sm:text-[11px] lg:text-xs group-hover:text-cyan-600 transition-colors">المستشعرات الحيوية</span>
        </button>
        <button onClick={() => onNavigate?.('records')} className="w-full p-2.5 sm:p-3.5 lg:p-4 bg-white text-slate-800 rounded-xl sm:rounded-xl lg:rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 lg:gap-3 group pro-3d-card glow-border-emerald cursor-pointer">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors shrink-0">
            <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <span className="font-bold text-[10px] sm:text-[11px] lg:text-xs group-hover:text-emerald-600 transition-colors">سجلات المرضى</span>
        </button>
        <button onClick={() => onNavigate?.('analytics')} className="w-full p-2.5 sm:p-3.5 lg:p-4 bg-white text-slate-800 rounded-xl sm:rounded-xl lg:rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 lg:gap-3 group pro-3d-card glow-border-violet cursor-pointer">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-violet-50 group-hover:bg-violet-100 flex items-center justify-center transition-colors shrink-0">
            <BarChart2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 text-violet-600 group-hover:scale-110 transition-transform" />
          </div>
          <span className="font-bold text-[10px] sm:text-[11px] lg:text-xs group-hover:text-violet-600 transition-colors">التحليل البصري</span>
        </button>
        <button onClick={() => onNavigate?.('powerbi')} className="w-full p-2.5 sm:p-3.5 lg:p-4 bg-white text-slate-800 rounded-xl sm:rounded-xl lg:rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 lg:gap-3 group pro-3d-card glow-border-amber cursor-pointer">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center transition-colors shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <span className="font-bold text-[10px] sm:text-[11px] lg:text-xs group-hover:text-amber-600 transition-colors">التحليل الذكي (Power BI)</span>
        </button>
        <button onClick={() => onNavigate?.('consult')} className="w-full p-2.5 sm:p-3.5 lg:p-4 bg-white text-slate-800 rounded-xl sm:rounded-xl lg:rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 lg:gap-3 group pro-3d-card glow-border-blue cursor-pointer">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors shrink-0">
            <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <span className="font-bold text-[10px] sm:text-[11px] lg:text-xs group-hover:text-indigo-600 transition-colors">جلسات المتابعة</span>
        </button>
        <button onClick={() => onNavigate?.('settings')} className="w-full p-2.5 sm:p-3.5 lg:p-4 bg-white text-slate-800 rounded-xl sm:rounded-xl lg:rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 lg:gap-3 group pro-3d-card glow-border-slate cursor-pointer">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-slate-50 group-hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
            <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 text-slate-600 group-hover:rotate-45 transition-transform" />
          </div>
          <span className="font-bold text-[10px] sm:text-[11px] lg:text-xs group-hover:text-slate-800 transition-colors">إعدادات النظام</span>
        </button>
      </div>

      {/* Unified System Dashboard */}
      <div className="bg-slate-900 rounded-xl p-0.5 shadow-xl overflow-hidden animate-in fade-in duration-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5">
          {/* Active Processing Engine */}
          <div className="md:col-span-1 p-4 sm:p-5 bg-slate-800/50 rounded-lg lg:rounded-xl relative overflow-hidden group border border-slate-700/30 flex flex-col justify-between dark-glow-card">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-8 -mt-8 blur-xl group-hover:bg-blue-500/15 transition-all"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 ${isThinking ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-blue-400'} rounded-lg flex items-center justify-center transition-all`}>
                <Activity className={`w-4 h-4 sm:w-5 sm:h-5 ${isThinking ? 'animate-pulse' : ''}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`flex h-2 w-2 relative`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isThinking ? 'bg-indigo-400' : 'bg-blue-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isThinking ? 'bg-indigo-500' : 'bg-blue-500'}`}></span>
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold text-slate-300 uppercase tracking-wider">{isThinking ? 'تفكير عميق...' : 'نشط'}</span>
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-[8px] sm:text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">محرك المعالجة النشط</h3>
              <p className="text-sm sm:text-base lg:text-lg font-bold text-white flex items-center gap-1.5">
                {getModelDisplayName(activeModel)}
                {isThinking && <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />}
              </p>
              <div className="mt-2.5 flex gap-1">
                <span className="px-1.5 py-0.5 bg-white/5 rounded text-[7px] font-bold uppercase text-slate-300 border border-white/5">Deep Thinking</span>
                <span className="px-1.5 py-0.5 bg-white/5 rounded text-[7px] font-bold uppercase text-slate-300 border border-white/5">Multi-Modal</span>
              </div>
            </div>
          </div>
 
          {/* Sub Metrics */}
          <div className="md:col-span-2 grid grid-cols-2 gap-0.5">
            <div className="bg-slate-800/30 p-4 sm:p-5 rounded-lg lg:rounded-xl flex flex-col justify-center relative overflow-hidden group hover:bg-slate-800/40 transition-colors border border-slate-700/30 dark-glow-card">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                    <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <h3 className="text-slate-400 text-[9px] sm:text-[10px] lg:text-xs font-semibold">إجمالي الحالات</h3>
                </div>
                <span className="text-[8px] sm:text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">+12%</span>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white">{records.length}</p>
              </div>
            </div>
 
            <div className="bg-slate-800/30 p-4 sm:p-5 rounded-lg lg:rounded-xl flex flex-col justify-center relative overflow-hidden group hover:bg-slate-800/40 transition-colors border border-slate-700/30 dark-glow-card">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400 shrink-0">
                    <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <h3 className="text-slate-400 text-[9px] sm:text-[10px] lg:text-xs font-semibold">دقة خوارزميات النظام</h3>
                </div>
                <span className="text-[8px] sm:text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">تعلم مستمر</span>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">{currentAccuracy.toFixed(2)}<span className="text-xs lg:text-sm text-slate-500 ml-0.5">%</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
 
      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        <div className="lg:col-span-2 pro-3d-card glow-border-purple overflow-hidden shadow-md animate-in fade-in duration-1000">
          <div className="p-4 sm:p-5 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm lg:text-base flex items-center gap-1.5 sm:gap-2">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" /> آخر السجلات السريرية
            </h3>
            <button onClick={onViewAll} className="text-[8px] sm:text-[9px] font-bold text-blue-600 hover:underline cursor-pointer">عرض كافة السجلات</button>
          </div>
          <div className="p-0">
            {recentRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-100">
                      <th className="py-2.5 px-3">السجل الطبي</th>
                      <th className="py-2.5 px-3">التشخيص المقترح</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentRecords.map((record) => (
                      <tr 
                        key={record.id} 
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shadow-sm transition-all group-hover:scale-105 shrink-0 ${
                              record.status === 'حرجة' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 
                              record.status === 'تدخل طبي' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
                              record.status === 'متابعة' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                              'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}>
                              <Activity className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-[11px] mb-0.5 group-hover:text-blue-600 transition-colors">{record.name}</h4>
                              <span className="text-[9px] text-slate-400 font-mono tracking-tight">{record.date}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-bold text-indigo-700 truncate max-w-[150px]">
                          {record.diagnosis?.conditionName || 'بانتظار التحليل'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                            record.status === 'حرجة' ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                            record.status === 'تدخل طبي' ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                            record.status === 'متابعة' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                            'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 sm:py-12 text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 shrink-0">
                  <Database className="w-5 h-5 sm:w-6 sm:h-6 text-slate-200" />
                </div>
                <p className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">لا توجد سجلات حالية</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl lg:rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl opacity-85"></div>
          <h4 className="text-sm sm:text-base font-bold mb-2 relative z-10">تحديثات النظام</h4>
          <p className="text-blue-100 text-[9px] sm:text-[10px] font-medium leading-relaxed mb-3 relative z-10">تم تحديث قاعدة البيانات الطبية لتشمل أحدث البروتوكولات العلاجية لعام 2026.</p>
          <div className="space-y-1.5 relative z-10">
            <div className="flex items-center gap-2 p-1.5 bg-white/10 rounded-lg border border-white/5">
              <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
              <span className="text-[8px] font-bold uppercase">تحسين سرعة التحليل</span>
            </div>
            <div className="flex items-center gap-2 p-1.5 bg-white/10 rounded-lg border border-white/5">
              <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
              <span className="text-[8px] font-bold uppercase">دعم الأشعة المقطعية</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
