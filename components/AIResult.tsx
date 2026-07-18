
import React, { useState, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, CheckCircle2, ChevronDown,
  Pill, ShieldCheck, 
  Activity, Zap, BarChart3, Microscope, Target, Volume2, Printer, Square, UserCog,
  Apple, Dumbbell, LifeBuoy, HeartPulse, AlertOctagon, Image as ImageIcon, Stethoscope, FileText, Leaf, Download, Share2, Copy,
  Play, Pause
} from 'lucide-react';
import { StructuredDiagnosis, SystemSettings } from '../types';
import { generateSpeech } from '../services/geminiService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface AIResultProps {
  diagnosis: StructuredDiagnosis;
  sources?: any[];
  patientName: string;
  patientGender: string;
  onClose: () => void;
  settings?: SystemSettings;
}

// Helper to decode Base64 into binary array
function decodeBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to construct AudioBuffer from raw Int16 PCM (Gemini TTS outputs raw 24KHz Int16 mono)
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const AIResult: React.FC<AIResultProps> = ({ diagnosis, patientName, patientGender, onClose, settings: propsSettings }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const settings = React.useMemo(() => {
    if (propsSettings) return propsSettings;
    try {
      const saved = localStorage.getItem('smart_sage_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return null;
  }, [propsSettings]);
  const [speechState, setSpeechState] = useState<{
    isPlaying: boolean;
    isPaused: boolean;
    currentChapter: number;
    playbackRate: number;
  }>({
    isPlaying: false,
    isPaused: false,
    currentChapter: 0,
    playbackRate: 1.0,
  });

  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  const [loadingChapters, setLoadingChapters] = useState<Set<number>>(new Set());
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);

  const cachedAudiosRef = useRef<Map<number, AudioBuffer>>(new Map());
  const preFetchingChaptersRef = useRef<Set<number>>(new Set());
  const activeAudioContext = useRef<AudioContext | null>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const speechSessionIdRef = useRef<number>(0);

  // Dynamic report chapters list for the audio reader
  const chapters = [
    {
      id: 'intro',
      title: 'مقدمة التقرير وتفاصيل المريض',
      text: `تقرير تشخيص حالة المريض ${patientName}. جنس المريض ${patientGender}. التشخيص المقترح هو ${diagnosis.conditionName}. دقة التحليل ${diagnosis.confidenceScore} بالمئة. مستوى خطورة الحالة ${diagnosis.severity}.`
    },
    diagnosis.summary ? {
      id: 'summary',
      title: 'الملخص السريري',
      text: `الملخص السريري للحالة: ${diagnosis.summary}`
    } : null,
    diagnosis.labResultsAnalysis ? {
      id: 'labResults',
      title: 'تحليل المؤشرات والتحاليل',
      text: `تحليل المؤشرات الحيوية والمخبرية: ${diagnosis.labResultsAnalysis}`
    } : null,
    diagnosis.severityReasoning ? {
      id: 'severityReasoning',
      title: 'أسباب تحديد خطورة الحالة',
      text: `أسباب تحديد خطورة الحالة: ${diagnosis.severityReasoning}`
    } : null,
    diagnosis.urgentWarnings && diagnosis.urgentWarnings.length > 0 ? {
      id: 'urgentWarnings',
      title: 'التحذيرات الطبية العاجلة',
      text: `التحذيرات الطبية العاجلة: ${diagnosis.urgentWarnings.join('. ')}`
    } : null,
    diagnosis.conditionSymptoms && diagnosis.conditionSymptoms.length > 0 ? {
      id: 'symptoms',
      title: 'الأعراض المرتبطة بالمرض',
      text: `الأعراض المرتبطة بالمرض: ${diagnosis.conditionSymptoms.join('. ')}`
    } : null,
    diagnosis.conditionCauses && diagnosis.conditionCauses.length > 0 ? {
      id: 'causes',
      title: 'المسببات المؤدية للمرض',
      text: `المسببات المؤدية للمرض: ${diagnosis.conditionCauses.join('. ')}`
    } : null,
    diagnosis.detailedAnalysis ? {
      id: 'detailedAnalysis',
      title: 'التفسير الطبي الأعمق للحالة',
      text: `التفسير الطبي الأعمق للحالة: ${diagnosis.detailedAnalysis}`
    } : null,
    diagnosis.specialistReferral ? {
      id: 'specialistReferral',
      title: 'التخصص الطبي والمراجعة',
      text: `التوجيه الطبي والتخصص المقترح للمراجعة: ${diagnosis.specialistReferral}`
    } : null,
    diagnosis.treatmentPlan && diagnosis.treatmentPlan.length > 0 ? {
      id: 'treatmentPlan',
      title: 'الخطة العلاجية الدوائية',
      text: `الخطة العلاجية والمسار الدوائي المقترح: ${diagnosis.treatmentPlan.join('. ')}`
    } : null,
    diagnosis.herbalMedicine && diagnosis.herbalMedicine.length > 0 ? {
      id: 'herbalMedicine',
      title: 'العلاج الطبيعي والأعشاب',
      text: `العلاج بالأعشاب الطبيعية والطب البديل المقترح: ${diagnosis.herbalMedicine.join('. ')}`
    } : null,
    diagnosis.dietaryAdvice && diagnosis.dietaryAdvice.length > 0 ? {
      id: 'dietaryAdvice',
      title: 'نصائح وإرشادات التغذية العلاجية',
      text: `التوصيات والإرشادات الغذائية المحددة: ${diagnosis.dietaryAdvice.join('. ')}`
    } : null,
    diagnosis.physicalTherapy && diagnosis.physicalTherapy.length > 0 ? {
      id: 'physicalTherapy',
      title: 'التأهيل العلاجي والفيزيائي',
      text: `التأهيل البدني والعلاج الطبيعي الموصى به: ${diagnosis.physicalTherapy.join('. ')}`
    } : null,
    diagnosis.lifestyleChanges && diagnosis.lifestyleChanges.length > 0 ? {
      id: 'lifestyleChanges',
      title: 'تغييرات نمط الحياة المقترحة',
      text: `تعديلات نمط الحياة والأنشطة الصحية الموصى بها: ${diagnosis.lifestyleChanges.join('. ')}`
    } : null,
    diagnosis.suggestedTests && diagnosis.suggestedTests.length > 0 ? {
      id: 'suggestedTests',
      title: 'الفحوصات والتحاليل الإضافية المقترحة',
      text: `الفحوصات والتحاليل المخبرية المقترحة: ${diagnosis.suggestedTests.join('. ')}`
    } : null,
    diagnosis.preventionTips && diagnosis.preventionTips.length > 0 ? {
      id: 'preventionTips',
      title: 'نصائح وإرشادات الوقاية العامة',
      text: `نصائح وإرشادات الوقاية العامة وحماية الصحة: ${diagnosis.preventionTips.join('. ')}`
    } : null,
  ].filter(Boolean) as { id: string; title: string; text: string }[];

  // Stop speaking and cancel everything
  const stopSpeech = () => {
    speechSessionIdRef.current++;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioSource.current) {
      try {
        activeAudioSource.current.stop();
      } catch (e) {}
      activeAudioSource.current = null;
    }
    if (activeAudioContext.current) {
      try {
        activeAudioContext.current.close();
      } catch (e) {}
      activeAudioContext.current = null;
    }
    setSpeechState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false
    }));
    setIsSpeaking(false);
  };

  const pauseSpeech = async () => {
    if (activeAudioContext.current && activeAudioContext.current.state === 'running') {
      try {
        await activeAudioContext.current.suspend();
        setSpeechState(prev => ({ ...prev, isPaused: true }));
      } catch (e) {
        console.error("Error pausing audio context:", e);
      }
    }
  };

  const resumeSpeech = async () => {
    if (activeAudioContext.current && activeAudioContext.current.state === 'suspended') {
      try {
        await activeAudioContext.current.resume();
        setSpeechState(prev => ({ ...prev, isPaused: false }));
      } catch (e) {
        console.error("Error resuming audio context:", e);
      }
    } else {
      playChapter(speechState.currentChapter);
    }
  };

  // Background audio pre-fetcher
  const preFetchChapter = async (index: number) => {
    if (index < 0 || index >= chapters.length) return;
    if (selectedVoice === 'WebSpeech') return;
    if (cachedAudiosRef.current.has(index)) return;
    if (preFetchingChaptersRef.current.has(index)) return;

    const apiKey = settings?.apiKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
    const hasKey = apiKey && apiKey.trim() !== "" && apiKey.length > 10;
    if (!hasKey) return;

    preFetchingChaptersRef.current.add(index);
    try {
      const activeVoiceName = selectedVoice;
      const chapterText = chapters[index].text;
      const base64Audio = await generateSpeech(chapterText, settings || undefined, activeVoiceName);
      if (base64Audio) {
        const ctxClass = window.AudioContext || (window as any).webkitAudioContext;
        const tempCtx = new ctxClass({ sampleRate: 24000 });
        const buffer = await decodeAudioData(decodeBytes(base64Audio), tempCtx, 24000, 1);
        cachedAudiosRef.current.set(index, buffer);
      }
    } catch (e) {
      console.warn(`Background pre-fetch audio failed for chapter ${index}:`, e);
    } finally {
      preFetchingChaptersRef.current.delete(index);
    }
  };

  const speakWithWebSpeech = (text: string, sessionId: number, onEnd: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd();
      return;
    }
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*#`~_\-●•]/g, " ").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';

    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }

    utterance.rate = speechState.playbackRate;

    utterance.onend = () => {
      if (sessionId === speechSessionIdRef.current) {
        onEnd();
      }
    };

    utterance.onerror = (e: any) => {
      console.warn("SpeechSynthesis error:", e);
      if (sessionId === speechSessionIdRef.current && e.error !== 'interrupted' && e.error !== 'canceled') {
        onEnd();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const playChapter = async (index: number) => {
    // Dispatch a global stop audio event with AIResult as sender to silence other players
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-stop-all-audio', { detail: { sender: 'AIResult' } }));
    }

    // 1. Instantly stop any currently active playing context to fully resolve overlaps/collisions!
    stopSpeech();

    if (index < 0 || index >= chapters.length) {
      return;
    }

    const sessionId = ++speechSessionIdRef.current;

    setSpeechState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      currentChapter: index
    }));
    setIsSpeaking(true);

    const apiKey = settings?.apiKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
    const hasKey = apiKey && apiKey.trim() !== "" && apiKey.length > 10;

    if (selectedVoice === 'WebSpeech' || !hasKey) {
      const chapterText = chapters[index].text;
      speakWithWebSpeech(chapterText, sessionId, () => {
        if (sessionId !== speechSessionIdRef.current) return;
        if (index + 1 < chapters.length) {
          playChapter(index + 1);
        } else {
          stopSpeech();
        }
      });
      return;
    }

    try {
      let buffer = cachedAudiosRef.current.get(index);
      
      if (!buffer) {
        // Needs loading, add index to loadingChapters
        setLoadingChapters(prev => {
          const next = new Set(prev);
          next.add(index);
          return next;
        });

        const activeVoiceName = selectedVoice;
        const chapterText = chapters[index].text;
        
        try {
          // Fetch base64 audio with a fast 2.2 seconds timeout
          const speechPromise = generateSpeech(chapterText, settings || undefined, activeVoiceName);
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error("AUDIO_GENERATION_TIMEOUT")), 2200)
          );
          
          const base64Audio = await Promise.race([speechPromise, timeoutPromise]);
          if (sessionId !== speechSessionIdRef.current) return;
          if (!base64Audio) {
            throw new Error("No audio returned from high-fidelity Gemini TTS engine");
          }

          const ctxClass = window.AudioContext || (window as any).webkitAudioContext;
          const tempCtx = new ctxClass({ sampleRate: 24000 });
          buffer = await decodeAudioData(decodeBytes(base64Audio), tempCtx, 24000, 1);
          
          // Cache
          cachedAudiosRef.current.set(index, buffer);
        } catch (apiError) {
          console.warn("Gemini TTS high-fidelity failed on AIResult chapter, falling back to Web Speech Synthesis:", index, apiError);
          
          if (sessionId !== speechSessionIdRef.current) return;

          // Remove from loading set
          setLoadingChapters(prev => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });

          // Perform Web Speech synthesis directly as a high-durability backup
          speakWithWebSpeech(chapterText, sessionId, () => {
            if (sessionId !== speechSessionIdRef.current) return;
            if (index + 1 < chapters.length) {
              playChapter(index + 1);
            } else {
              stopSpeech();
            }
          });
          return; // Skip native AudioContext player
        }
        
        if (sessionId !== speechSessionIdRef.current) return;

        // Remove from loading set
        setLoadingChapters(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }

      if (sessionId !== speechSessionIdRef.current) return;

      // Configure Web Audio API node context for playing
      const ctxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new ctxClass({ sampleRate: 24000 });
      activeAudioContext.current = ctx;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speechState.playbackRate;
      source.connect(ctx.destination);

      source.onended = () => {
        if (sessionId !== speechSessionIdRef.current) return;
        // Only autoplay next if we ended naturally
        if (activeAudioSource.current === source) {
          activeAudioSource.current = null;
          if (index + 1 < chapters.length) {
            playChapter(index + 1);
          } else {
            stopSpeech();
          }
        }
      };

      activeAudioSource.current = source;
      source.start();

      // Non-blocking pre-fetch the NEXT chapter!
      preFetchChapter(index + 1);

    } catch (err) {
      console.error("Failed to play medical report chapter:", err);
      if (sessionId !== speechSessionIdRef.current) return;
      setLoadingChapters(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      stopSpeech();
    }
  };

  const handleListen = () => {
    if (speechState.isPlaying) {
      stopSpeech();
    } else {
      playChapter(0);
    }
  };

  // Clear cache and voice selection when voice changes
  const handleVoiceChange = (newVoice: string) => {
    setSelectedVoice(newVoice);
    stopSpeech();
    cachedAudiosRef.current.clear();
    preFetchingChaptersRef.current.clear();
  };

  // Proactively pre-fetch initial chapters in the background on mount / voice change to eliminate lag
  React.useEffect(() => {
    const timer = setTimeout(() => {
      preFetchChapter(0);
      preFetchChapter(1);
    }, 800);

    return () => clearTimeout(timer);
  }, [selectedVoice]);

  // Clean up all speech activities, global listeners & contexts when component unmounts
  React.useEffect(() => {
    const handleStopAllAudio = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.sender !== 'AIResult') {
        stopSpeech();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('app-stop-all-audio', handleStopAllAudio);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('app-stop-all-audio', handleStopAllAudio);
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (activeAudioSource.current) {
        try { activeAudioSource.current.stop(); } catch (e) {}
      }
      if (activeAudioContext.current) {
        try { activeAudioContext.current.close(); } catch (e) {}
      }
    };
  }, []);

  const severityColors: any = {
    'حرجة': 'bg-rose-600',
    'مرتفعة': 'bg-orange-600',
    'متوسطة': 'bg-blue-600',
    'منخفضة': 'bg-emerald-600'
  };

  const FormattedText = ({ text, className = "" }: { text?: any, className?: string }) => {
    if (!text) return null;
    let safeText = "";
    if (typeof text === 'string') {
      safeText = text;
    } else if (Array.isArray(text)) {
      safeText = text.join('\n');
    } else if (typeof text === 'object') {
      safeText = text.text || text.message || JSON.stringify(text);
    } else {
      safeText = String(text);
    }

    return (
      <div className={`space-y-2.5 ${className}`}>
        {safeText.split('\n').filter(l => l.trim()).map((line, i) => {
          let content = line;
          const isListItem = content.trim().startsWith('-') || content.trim().startsWith('*');
          if (isListItem) {
             content = content.replace(/^[-*]\s*/, '');
          }
          
          // Basic markdown bold to HTML
          const renderLine = (str: string) => {
            const parts = str.split(/(\*\*.*?\*\*)/g);
            return parts.map((part, index) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-black opacity-100">{part.slice(2, -2)}</strong>;
              }
              return part;
            });
          };

          if (isListItem) {
            return (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 mt-1.5 lg:mt-2 shrink-0"></span>
                <span className="leading-[1.8]">{renderLine(content)}</span>
              </div>
            );
          }
          return <p key={i} className="leading-[1.8]">{renderLine(content)}</p>;
        })}
      </div>
    );
  };



  const CollapsibleSection = ({ title, icon: Icon, items, colorClass, bgColor, defaultOpen = false }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
      <div className={`rounded-xl lg:rounded-2xl border shadow-sm transition-all duration-300 ${bgColor} ${colorClass} overflow-hidden`}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-4 lg:p-5 flex items-center justify-between hover:bg-black/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg lg:rounded-xl bg-white/60 backdrop-blur-md border border-white/30 shadow-sm`}>
              <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
            </div>
            <h4 className="font-black text-[10px] lg:text-[11px] uppercase tracking-[0.15em]">{title}</h4>
          </div>
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>
        
        <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="p-4 lg:p-5 pt-0 border-t border-black/5">
              <ul className="space-y-2 lg:space-y-2.5 mt-3">
                {items && items.length > 0 ? items.map((item: string, i: number) => (
                  <li key={i} className="flex gap-2 text-[10px] lg:text-[12px] font-bold leading-relaxed opacity-90">
                     <div className="w-1.5 h-1.5 rounded-full bg-current shrink-0 mt-2 opacity-50"></div>
                     <div className="flex-1">
                       <FormattedText text={item} className="text-current" />
                     </div>
                  </li>
                )) : <li className="text-[9px] opacity-50 italic">لا توجد توصيات محددة</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const pdfRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!pdfRef.current) return;
    try {
      // Temporary style modification for better PDF rendering
      const originalContainer = pdfRef.current;
      const originalWidth = originalContainer.style.width;
      // We want to force a specific width and no scrolling for capturing
      originalContainer.style.width = '800px';
      
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F8FAFC',
        windowWidth: 800
      });

      originalContainer.style.width = originalWidth;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'px', [canvas.width, canvas.height]);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`تشخيص_${patientName}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const shareText = `تشخيص طبي: ${diagnosis.conditionName}\nالمريض: ${patientName}\n\nالملخص:\n${diagnosis.summary}\n\nتاريخ التشخيص: ${new Date().toLocaleDateString('ar-SA')}`;

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      alert('تم نسخ التقرير بنجاح');
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <>
      {/* Interactive Screen View */}
      <div className="bg-[#F8FAFC] w-full min-h-full relative lg:rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500 font-['Tajawal'] shrink-0 print:hidden" ref={pdfRef}>
      {/* Dynamic Header */}
      <div className={`${severityColors[diagnosis.severity] || 'bg-blue-600'} p-5 lg:p-10 text-white relative overflow-hidden`}>
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 100 C 20 0 50 0 100 100" stroke="white" fill="transparent" strokeWidth="0.5" />
            <path d="M0 50 C 50 100 80 0 100 50" stroke="white" fill="transparent" strokeWidth="0.5" />
            <path d="M0 0 C 30 100 70 100 100 0" stroke="white" fill="transparent" strokeWidth="0.5" />
          </svg>
        </div>
        
        <div className="absolute top-0 right-0 w-64 h-64 lg:w-96 lg:h-96 bg-white/10 rounded-full blur-[100px] lg:blur-[120px] -mr-32 -mt-32 lg:-mr-48 lg:-mt-48"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-8 lg:mb-12">
             <button onClick={onClose} data-html2canvas-ignore="true" className="p-2 lg:p-3 bg-white/10 hover:bg-white/20 rounded-xl lg:rounded-2xl transition-all backdrop-blur-md border border-white/10" title="عودة"><ChevronLeft className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5 rotate-180" /></button>
             <div className="flex gap-2 lg:gap-2.5 flex-wrap justify-end" data-html2canvas-ignore="true">
                <button onClick={handleListen} className="px-3.5 lg:px-5 py-2 lg:py-3 bg-white/10 hover:bg-white/20 rounded-xl lg:rounded-2xl flex items-center gap-2 lg:gap-2.5 text-[9px] lg:text-[10px] font-black transition-all backdrop-blur-md border border-white/10 uppercase tracking-widest">
                   {isSpeaking ? <Square className="w-3 h-3 lg:w-3.5 lg:h-3.5 fill-current" /> : <Volume2 className="w-3 h-3 lg:w-3.5 lg:h-3.5" />}
                   {isSpeaking ? 'إيقاف' : 'استماع'}
                </button>
                <button onClick={handleCopyText} title="نسخ التقرير" className="p-2 lg:p-3 bg-white/10 hover:bg-white/20 rounded-xl lg:rounded-2xl transition-all backdrop-blur-md border border-white/10"><Copy className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5" /></button>
                <button onClick={handleShareWhatsApp} title="مشاركة عبر واتساب" className="p-2 lg:p-3 bg-white/10 hover:bg-white/20 rounded-xl lg:rounded-2xl transition-all backdrop-blur-md border border-white/10"><Share2 className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5" /></button>
                <button onClick={handleDownloadPDF} title="تحميل PDF" className="p-2 lg:p-3 bg-white/10 hover:bg-white/20 rounded-xl lg:rounded-2xl transition-all backdrop-blur-md border border-white/10"><Download className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5" /></button>
                <button onClick={() => window.print()} title="طباعة" className="p-2 lg:p-3 bg-white/10 hover:bg-white/20 rounded-xl lg:rounded-2xl transition-all backdrop-blur-md border border-white/10"><Printer className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5" /></button>
             </div>
          </div>
          <div className="max-w-4xl mx-auto text-center">
             <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-white/10 rounded-full text-[7px] lg:text-[9px] font-black uppercase tracking-[0.2em] mb-5 lg:mb-6 backdrop-blur-md border border-white/10">
                <ShieldCheck className="w-3 h-3 text-blue-200" /> تحليل طبي متقدم
             </div>
             <h2 className="text-2xl lg:text-4xl font-black mb-3 lg:mb-5 tracking-tight leading-tight drop-shadow-2xl">{diagnosis.conditionName}</h2>
             <div className="flex flex-wrap justify-center items-center gap-2.5 lg:gap-6 text-[9px] lg:text-xs font-bold opacity-90">
               <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg lg:rounded-xl border border-white/5">
                 <Target className="w-3 h-3" /> دقة التحليل: {diagnosis.confidenceScore}%
               </span>
               <span className="w-1 h-1 bg-white/30 rounded-full hidden sm:block"></span>
               <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg lg:rounded-xl border border-white/5">
                 <UserCog className="w-3 h-3" /> المريض: {patientName}
               </span>
               <span className="w-1 h-1 bg-white/30 rounded-full hidden sm:block"></span>
               <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg lg:rounded-xl border border-white/5 uppercase tracking-widest">
                 <Activity className="w-3 h-3" /> الخطورة: {diagnosis.severity}
               </span>
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-8 -mt-6 lg:-mt-8 pb-12 lg:pb-20 space-y-5 lg:space-y-6 relative z-20">
        
        {/* لوحة التحكم بالقارئ الصوتي المدمج (قائمة منسدلة أنيقة وموفرة للمساحة والواجهة) */}
        <div className="bg-white rounded-xl lg:rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden" data-html2canvas-ignore="true">
          <div 
            onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
            className="p-3 lg:p-4 flex items-center justify-between gap-3 cursor-pointer select-none bg-gradient-to-l from-slate-50/50 to-white hover:from-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg transition-all duration-500 ${speechState.isPlaying ? 'bg-blue-600 text-white animate-pulse shadow-sm shadow-blue-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                {loadingChapters.has(speechState.currentChapter) ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block"></span>
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </div>
              <div className="text-right">
                <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                  القارئ الصوتي الطبي الذكي
                  {speechState.isPlaying && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-black bg-blue-100 text-blue-700 animate-pulse">
                      جاري التشغيل
                    </span>
                  )}
                </span>
                {speechState.isPlaying ? (
                  loadingChapters.has(speechState.currentChapter) ? (
                    <span className="text-[9px] text-amber-600 font-bold animate-pulse block mt-0.5">جاري التحضير الصوتي وبناء النبرة البشرية...</span>
                  ) : (
                    <span className="text-[9px] text-blue-600 font-bold block mt-0.5 max-w-xs sm:max-w-md truncate">
                      {selectedVoice === 'WebSpeech' ? 'القارئ الفوري الذكي' : `صوت ${selectedVoice === 'Zephyr' ? 'د. سمير' : selectedVoice === 'Kore' ? 'د. منال' : selectedVoice === 'Puck' ? 'ياسمين' : selectedVoice === 'Charon' ? 'د. عاصم' : 'د. فواز'}`}: {chapters[speechState.currentChapter]?.title} ({speechState.currentChapter + 1}/{chapters.length})
                    </span>
                  )
                ) : (
                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">اضغط هنا لفتح القارئ والاستماع للتقرير بالكامل بنبرة طبية حقيقية</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {/* أزرار تحكم سريعة حتى في حالة الإغلاق لسهولة الحركة */}
              {speechState.isPlaying ? (
                <div className="flex items-center gap-1">
                  {speechState.isPaused ? (
                    <button 
                      onClick={resumeSpeech}
                      title="استئناف"
                      className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" /> استئناف
                    </button>
                  ) : (
                    <button 
                      onClick={pauseSpeech}
                      title="إيقاف مؤقت"
                      className="p-1 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[9px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      <Pause className="w-2.5 h-2.5 fill-current" /> مؤقت
                    </button>
                  )}
                  <button 
                    onClick={stopSpeech}
                    title="إنهاء الاستماع"
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-100 transition-all cursor-pointer"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => playChapter(0)}
                  className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Volume2 className="w-2.5 h-2.5" /> استماع سريع
                </button>
              )}
              
              <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

              {/* سهم التمدد */}
              <button 
                onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
                className={`p-1 text-slate-400 hover:text-slate-600 transition-transform duration-300 ${isAudioMenuOpen ? 'rotate-180' : 'rotate-0'}`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* الخيارات التفصيلية المنسدلة من الداخل */}
          {isAudioMenuOpen && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-3 lg:p-4 space-y-3 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* ضبط الطبيب والسرعة */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/60 shadow-sm">
                    <span className="text-[9px] font-black text-slate-400 px-1 font-['Tajawal']">الطبيب المعلق:</span>
                    <select
                      value={selectedVoice}
                      onChange={(e) => handleVoiceChange(e.target.value)}
                      className="bg-transparent text-[10px] font-black text-slate-700 px-1 py-0.5 focus:outline-none cursor-pointer"
                    >
                      <option value="WebSpeech">القارئ الفوري الذكي (فائق السرعة ومجاني ⚡)</option>
                      <option value="Zephyr">د. سمير (استشاري سحابي)</option>
                      <option value="Kore">د. منال (استشارية سحابية)</option>
                      <option value="Puck">أخصائية ياسمين (هادئ سحابي)</option>
                      <option value="Charon">د. عاصم (عميق سحابي)</option>
                      <option value="Fenrir">د. فواز (جاد سحابي)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/60 shadow-sm">
                    <span className="text-[9px] font-black text-slate-400 px-1 font-['Tajawal']">السرعة:</span>
                    {[1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setSpeechState(prev => {
                            const newState = { ...prev, playbackRate: rate };
                            if (activeAudioSource.current) {
                              try {
                                activeAudioSource.current.playbackRate.value = rate;
                              } catch (e) {
                                console.warn("Could not dynamically set playback rate:", e);
                              }
                            }
                            return newState;
                          });
                        }}
                        className={`px-1.5 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer ${speechState.playbackRate === rate ? 'bg-blue-600 text-white font-bold' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* أزرار التنقل بين الأقسام */}
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => {
                      if (speechState.currentChapter > 0) {
                        playChapter(speechState.currentChapter - 1);
                      }
                    }}
                    disabled={speechState.currentChapter === 0}
                    className="p-1 px-2.5 bg-white hover:bg-slate-50 disabled:opacity-30 rounded-lg border border-slate-200 text-slate-600 cursor-pointer text-[10px] font-bold flex items-center gap-1 transition-all disabled:cursor-not-allowed"
                  >
                    السابق <ChevronRight className="w-3 h-3" />
                  </button>

                  <button 
                    onClick={() => {
                      if (speechState.currentChapter < chapters.length - 1) {
                        playChapter(speechState.currentChapter + 1);
                      }
                    }}
                    disabled={speechState.currentChapter === chapters.length - 1}
                    className="p-1 px-2.5 bg-white hover:bg-slate-50 disabled:opacity-30 rounded-lg border border-slate-200 text-slate-600 cursor-pointer text-[10px] font-bold flex items-center gap-1 transition-all disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3 h-3" /> التالي
                  </button>
                </div>
              </div>

              {/* الفهرس التفاعلي للأقسام الطبية المتاحة */}
              <div className="border-t border-slate-200/60 pt-2">
                <p className="text-[8px] font-black text-slate-400 mb-1.5 font-['Tajawal']">انقر لتشغيل أي قسم طبي مباشرة:</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {chapters.map((chapter, index) => {
                    const isActive = speechState.isPlaying && speechState.currentChapter === index;
                    const isChapterLoading = loadingChapters.has(index);
                    const isChapterCached = cachedAudiosRef.current.has(index);
                    
                    return (
                      <button
                        key={chapter.id}
                        onClick={() => playChapter(index)}
                        className={`px-2.5 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap border flex items-center gap-1 shrink-0 ${
                          isActive 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-black' 
                            : isChapterLoading
                              ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                              : isChapterCached
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200/60'
                        }`}
                      >
                        {isChapterLoading ? (
                          <span className="w-2 h-2 border border-amber-600 border-t-transparent rounded-full animate-spin"></span>
                        ) : isActive ? (
                          <span className="flex gap-0.5 items-end justify-center h-2 w-2">
                            <span className="w-[1.2px] bg-white rounded-full animate-[bounce_0.6s_infinite_0ms]" style={{ height: '50%' }}></span>
                            <span className="w-[1.2px] bg-white rounded-full animate-[bounce_0.6s_infinite_150ms]" style={{ height: '100%' }}></span>
                          </span>
                        ) : isChapterCached ? (
                          <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                        ) : null}
                        {chapter.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Clinical Summary & Differential */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
           <div className="lg:col-span-2 bg-white rounded-xl lg:rounded-3xl p-5 lg:p-8 shadow-xl border border-slate-100 flex flex-col justify-between group hover:border-blue-100/50 transition-all duration-500">
              <div>
                <div className="flex items-center gap-2.5 lg:gap-3 mb-6 lg:mb-8">
                  <div className="p-2 lg:p-2.5 bg-blue-50 rounded-xl lg:rounded-2xl text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                    <FileText className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5" />
                  </div>
                  <h3 className="font-black text-sm lg:text-base text-slate-800 uppercase tracking-widest">التقرير الطبي التوضيحي</h3>
                </div>
                
                <div className="space-y-4 lg:space-y-5">
                  <div className="bg-gradient-to-br from-blue-50/80 to-blue-50/30 p-5 lg:p-6 rounded-xl lg:rounded-3xl border border-blue-100/50 relative overflow-hidden shadow-sm">
                    <div className="absolute top-0 left-0 p-4 opacity-5"><FileText className="w-24 h-24 text-blue-600" /></div>
                    <div className="relative z-10">
                      <strong className="text-blue-900 flex items-center gap-2.5 mb-1.5 lg:mb-2 text-sm lg:text-base font-black">
                        <Target className="w-4.5 h-4.5 text-blue-500" /> التشخيص المحتمل: {diagnosis.conditionName} <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs tracking-widest">{diagnosis.confidenceScore}%</span>
                      </strong>
                      <div className="text-xs font-bold text-blue-600/80 mb-3 lg:mb-4">ملخص الحالة والعلاج الأولي</div>
                      <FormattedText text={diagnosis.summary} className="text-xs lg:text-sm text-slate-700 font-bold leading-relaxed mb-4" />
                      
                      {diagnosis.treatmentPlan && diagnosis.treatmentPlan.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-blue-100/60">
                          <p className="text-[10px] lg:text-xs font-black text-blue-800 flex items-center gap-1.5 mb-2">
                             <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> أبرز سبل العلاج المقترحة:
                          </p>
                          <p className="text-xs lg:text-sm text-blue-900/80 font-bold leading-relaxed pr-5 border-r-2 border-blue-200">
                             {diagnosis.treatmentPlan[0]}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {diagnosis.labResultsAnalysis && (
                    <div className="p-4 lg:p-5 bg-indigo-50/30 rounded-xl lg:rounded-2xl border border-indigo-100/50">
                      <strong className="text-indigo-800 block mb-2 lg:mb-3 text-xs lg:text-sm flex items-center gap-2">
                        <Microscope className="w-4 h-4 text-indigo-500" /> قراءة في المؤشرات الحيوية والمخبرية:
                      </strong>
                      <FormattedText text={diagnosis.labResultsAnalysis} className="text-[11px] lg:text-sm text-indigo-900/80 font-medium" />
                    </div>
                  )}

                  {diagnosis.severityReasoning && (
                    <div className={`p-4 lg:p-5 rounded-xl lg:rounded-2xl border ${severityColors[diagnosis.severity]?.replace('bg-', 'bg-opacity-[0.03] border-') || 'bg-slate-50 border-slate-100'}`}>
                      <strong className={`flex items-center gap-2 mb-2 lg:mb-3 text-xs lg:text-sm ${severityColors[diagnosis.severity]?.replace('bg-', 'text-') || 'text-slate-800'}`}>
                        <AlertOctagon className="w-4 h-4" /> أسباب تحديد مستوى الخطورة ({diagnosis.severity}):
                      </strong>
                      <FormattedText text={diagnosis.severityReasoning} className={`text-[11px] lg:text-sm font-medium opacity-90 ${severityColors[diagnosis.severity]?.replace('bg-', 'text-') || 'text-slate-700'}`} />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-4 lg:space-y-5 mt-6 lg:mt-8">
                {diagnosis.urgentWarnings && diagnosis.urgentWarnings.length > 0 && (
                  <div className="p-4 lg:p-6 bg-rose-50 border border-rose-200 rounded-xl lg:rounded-3xl flex flex-col sm:flex-row items-start gap-4 lg:gap-5 shadow-sm">
                    <div className="p-2.5 lg:p-3 bg-white rounded-xl lg:rounded-2xl shadow-sm">
                      <AlertOctagon className="w-6 h-6 lg:w-8 lg:h-8 text-rose-500 shrink-0" />
                    </div>
                    <div>
                      <h5 className="text-[10px] lg:text-xs font-black text-rose-800 uppercase tracking-widest mb-2 lg:mb-3">التحذيرات العامة والحالات العاجلة</h5>
                      <ul className="text-[11px] lg:text-[13px] text-rose-700 font-bold space-y-2 lg:space-y-2.5">
                        {diagnosis.urgentWarnings.map((w, i) => <li key={i} className="flex items-start gap-2 leading-relaxed"><div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0"></div> {w}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                {diagnosis.conditionSymptoms && diagnosis.conditionSymptoms.length > 0 && (
                  <div className="p-4 lg:p-6 bg-slate-50 rounded-xl lg:rounded-3xl border border-slate-200 shadow-sm mb-4 lg:mb-5">
                    <strong className="text-slate-800 block mb-3 lg:mb-4 text-xs lg:text-sm flex items-center gap-2.5 font-black">
                      <Stethoscope className="w-5 h-5 text-slate-500" /> الأعراض المرتبطة بالمرض (للتأكد):
                    </strong>
                    <ul className="text-xs lg:text-[13px] text-slate-700 font-bold leading-relaxed list-disc list-inside space-y-1.5">
                       {diagnosis.conditionSymptoms.map((symptom, idx) => (
                         <li key={idx}>{symptom}</li>
                       ))}
                    </ul>
                  </div>
                )}
                
                {diagnosis.conditionCauses && diagnosis.conditionCauses.length > 0 && (
                  <div className="p-4 lg:p-6 bg-slate-50 rounded-xl lg:rounded-3xl border border-slate-200 shadow-sm mb-4 lg:mb-5">
                    <strong className="text-slate-800 block mb-3 lg:mb-4 text-xs lg:text-sm flex items-center gap-2.5 font-black">
                      <AlertOctagon className="w-5 h-5 text-slate-500" /> الأسباب المؤدية للمرض:
                    </strong>
                    <ul className="text-xs lg:text-[13px] text-slate-700 font-bold leading-relaxed list-disc list-inside space-y-1.5">
                       {diagnosis.conditionCauses.map((cause, idx) => (
                         <li key={idx}>{cause}</li>
                       ))}
                    </ul>
                  </div>
                )}

                {diagnosis.detailedAnalysis && (
                  <div className="p-4 lg:p-6 bg-slate-50 rounded-xl lg:rounded-3xl border border-slate-200 shadow-sm">
                    <strong className="text-slate-800 block mb-3 lg:mb-4 text-xs lg:text-sm flex items-center gap-2.5 font-black">
                      <Activity className="w-5 h-5 text-slate-500" /> التفسير الطبي الأعمق للحالة:
                    </strong>
                    <FormattedText text={diagnosis.detailedAnalysis} className="text-xs lg:text-[13px] text-slate-700 font-bold leading-relaxed" />
                  </div>
                )}
              </div>
           </div>

           <div className="space-y-5 lg:space-y-6">
             {diagnosis.specialistReferral && (
               <div className="bg-indigo-50 rounded-xl lg:rounded-3xl p-5 lg:p-6 shadow-sm border border-indigo-100">
                 <div className="flex items-center gap-2.5 mb-4 lg:mb-5">
                   <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                     <Stethoscope className="w-4.5 h-4.5" />
                   </div>
                   <h3 className="font-black text-xs lg:text-sm text-indigo-900 uppercase tracking-widest">إلى أي طبيب يجب أن أذهب؟</h3>
                 </div>
                 <FormattedText text={diagnosis.specialistReferral} className="text-[11px] lg:text-sm text-indigo-900/80 font-bold" />
               </div>
             )}

             <div className="bg-white rounded-xl lg:rounded-3xl p-5 lg:p-6 shadow-xl border border-slate-100 group hover:border-amber-100 transition-all duration-500">
                <div className="flex items-center gap-2.5 lg:gap-3 mb-5 lg:mb-6">
                  <div className="p-2 lg:p-2.5 bg-amber-50 rounded-xl lg:rounded-2xl text-amber-600 shadow-sm group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5" />
                  </div>
                  <h3 className="font-black text-xs lg:text-sm text-slate-800 uppercase tracking-widest">تشخيصات أخرى محتملة</h3>
                </div>
                <div className="space-y-2.5 lg:space-y-3">
                  {diagnosis.differentialDiagnosis.map((item, i) => (
                    <div key={i} className="p-3.5 lg:p-4 bg-slate-50 rounded-xl lg:rounded-2xl border border-slate-100 group/item hover:bg-white hover:border-amber-200 hover:shadow-lg transition-all duration-300">
                      <div className="flex justify-between items-start mb-1.5">
                        <p className="font-black text-slate-800 text-[10px] lg:text-[13px]">{item.condition}</p>
                        <span className="text-[8px] lg:text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 lg:px-2 lg:py-0.5 rounded-lg border border-amber-100">{item.probability}%</span>
                      </div>
                      <p className="text-[9px] lg:text-[10px] text-slate-500 font-bold leading-relaxed mb-2">{item.reasoning}</p>
                      {item.symptoms && item.symptoms.length > 0 && (
                        <div className="mt-2 border-t border-slate-100 pt-2">
                          <p className="text-[9px] lg:text-[10px] font-bold text-slate-700 mb-1">الأعراض المتوقعة:</p>
                          <ul className="list-disc list-inside text-[8px] lg:text-[9px] text-slate-500 space-y-0.5">
                             {item.symptoms.map((s, idx) => <li key={idx}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {item.causes && item.causes.length > 0 && (
                        <div className="mt-2 border-t border-slate-100 pt-2">
                          <p className="text-[9px] lg:text-[10px] font-bold text-slate-700 mb-1">المسببات المحتملة:</p>
                          <ul className="list-disc list-inside text-[8px] lg:text-[9px] text-slate-500 space-y-0.5">
                             {item.causes.map((c, idx) => <li key={idx}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
             </div>
           </div>
        </div>

        {/* Image Findings (If any) */}
        {diagnosis.imageFindings && (
          <div className="bg-white rounded-xl lg:rounded-3xl p-5 lg:p-8 shadow-xl border border-purple-100">
            <div className="flex items-center gap-2.5 lg:gap-3 mb-5 lg:mb-6">
              <div className="p-2 lg:p-2.5 bg-purple-50 rounded-xl lg:rounded-2xl text-purple-600 shadow-sm">
                <ImageIcon className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5" />
              </div>
              <h3 className="font-black text-sm lg:text-base text-slate-800 uppercase tracking-widest">قراءة نتائج الأشعة والصور المرفقة</h3>
            </div>
            <div className="bg-purple-50/30 p-5 lg:p-6 rounded-xl lg:rounded-2xl border border-purple-100/50">
              <FormattedText text={diagnosis.imageFindings} className="text-[11px] lg:text-sm text-slate-700 font-medium" />
            </div>
          </div>
        )}

        {/* Integrated Medical Plan Grid */}
        <h3 className="text-center text-lg font-black text-slate-800 pt-6 flex items-center justify-center gap-3">
          <div className="h-[1.5px] w-10 bg-slate-200"></div>
          خطة الرعاية الطبية المتكاملة
          <div className="h-[1.5px] w-10 bg-slate-200"></div>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <CollapsibleSection 
            title="التشخيص والمسار العلاجي" 
            icon={Pill} 
            items={diagnosis.treatmentPlan} 
            colorClass="text-blue-800 border-blue-100" 
            bgColor="bg-blue-50/50" 
            defaultOpen={true}
          />
          {diagnosis.herbalMedicine && diagnosis.herbalMedicine.length > 0 && (
            <CollapsibleSection 
              title="العلاج الطبيعي (الأعشاب)" 
              icon={Leaf} 
              items={diagnosis.herbalMedicine} 
              colorClass="text-teal-800 border-teal-100" 
              bgColor="bg-teal-50/50" 
              defaultOpen={true}
            />
          )}
          <CollapsibleSection 
            title="التغذية العلاجية" 
            icon={Apple} 
            items={diagnosis.dietaryAdvice} 
            colorClass="text-emerald-800 border-emerald-100" 
            bgColor="bg-emerald-50/50" 
            defaultOpen={true}
          />
          <CollapsibleSection 
            title="التأهيل البدني" 
            icon={Dumbbell} 
            items={diagnosis.physicalTherapy} 
            colorClass="text-orange-800 border-orange-100" 
            bgColor="bg-orange-50/50" 
          />
          <CollapsibleSection 
            title="نمط الحياة" 
            icon={LifeBuoy} 
            items={diagnosis.lifestyleChanges} 
            colorClass="text-indigo-800 border-indigo-100" 
            bgColor="bg-indigo-50/50" 
          />
        </div>

        {/* Diagnostics & Prevention */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-3">
           <div className="bg-slate-900 rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-xl border border-slate-800 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-[40px] -mr-10 -mt-10"></div>
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400">
                  <Microscope className="w-5 h-5" />
                </div>
                <h4 className="font-black text-sm lg:text-base uppercase tracking-widest text-slate-100">فحوصات وتحاليل مقترحة</h4>
              </div>
              <div className="grid grid-cols-1 gap-3 relative z-10">
                 {diagnosis.suggestedTests?.map((test, i) => (
                   <div key={i} className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 text-xs lg:text-sm font-black text-slate-300 transition-colors">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      {test}
                   </div>
                 ))}
                 {(!diagnosis.suggestedTests || diagnosis.suggestedTests.length === 0) && (
                   <p className="text-slate-500 text-xs font-medium">لا توجد فحوصات إضافية مقترحة حالياً.</p>
                 )}
              </div>
           </div>

           <div className="bg-emerald-50/50 rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-sm border border-emerald-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-600">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <h4 className="font-black text-sm lg:text-base uppercase tracking-widest text-emerald-900">نصائح الوقاية العامة</h4>
              </div>
              <div className="grid grid-cols-1 gap-3">
                 {diagnosis.preventionTips?.map((tip, i) => (
                   <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-emerald-100/50 text-xs lg:text-sm font-bold text-emerald-800 shadow-sm transition-transform hover:-translate-y-0.5">
                      <Target className="w-4 h-4 text-emerald-500 shrink-0" />
                      {tip}
                   </div>
                 ))}
                 {(!diagnosis.preventionTips || diagnosis.preventionTips.length === 0) && (
                   <p className="text-emerald-500/60 text-xs font-medium">لا توجد نصائح وقائية إضافية.</p>
                 )}
              </div>
           </div>
        </div>

        {/* Final Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 lg:gap-3.5 pt-6 lg:pt-10 print:hidden">
           <button 
             onClick={onClose} 
             className="flex-1 bg-slate-900 hover:bg-black text-white py-3.5 lg:py-5 rounded-xl lg:rounded-2xl font-black text-sm lg:text-base shadow-2xl transition-all active:scale-[0.98]"
           >
             حفظ وإغلاق التقرير
           </button>
           <button 
             onClick={() => window.print()} 
             className="px-6 lg:px-10 bg-white border-2 border-slate-100 py-3.5 lg:py-5 rounded-xl lg:rounded-2xl font-black text-slate-600 text-sm lg:text-base hover:bg-slate-50 transition-all flex items-center justify-center gap-2 lg:gap-2.5 hover:border-blue-200 hover:text-blue-600"
           >
             <Printer className="w-4.5 h-4.5 lg:w-5.5 lg:h-5.5" /> إصدار الوصفة الطبية (PDF)
           </button>
        </div>
        
        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] py-8">
          إخلاء مسؤولية: هذا التحليل استرشادي مدعوم بالذكاء الاصطناعي ويجب مراجعة طبيب متخصص.
        </p>
      </div>
    </div>

      {/* Print View: Formal Medical Prescription */}
      <div className="hidden print:block print:w-full print:bg-white print:p-8 font-['Tajawal'] text-slate-900" dir="rtl">
        {/* Prescription Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-black mb-2 flex items-center gap-2">
              <Stethoscope className="w-8 h-8 text-slate-900" />
              العيادة الذكية التخصصية
            </h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Medical Prescription & Report</p>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold mb-1">تاريخ الإصدار: {new Date().toLocaleDateString('ar-SA')}</p>
            <p className="text-sm font-bold opacity-70">رقم المرجع: #{Math.floor(Math.random() * 1000000)}</p>
          </div>
        </div>

        {/* Patient Details */}
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl mb-8 flex flex-wrap gap-8">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">اسم المريض</p>
            <p className="text-lg font-black">{patientName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">الجنس</p>
            <p className="text-lg font-black">{patientGender}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">التشخيص النهائي</p>
            <p className="text-lg font-black text-rose-700">{diagnosis.conditionName}</p>
          </div>
        </div>

        {/* Rx - Prescription */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
             <span className="text-4xl font-serif italic font-black text-slate-900 border-2 border-slate-900 rounded-lg px-2 py-1">Rx</span>
             <h2 className="text-2xl font-black">الوصفة العلاجية (Medications & Plan)</h2>
          </div>
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="py-3 px-4 font-black border-b border-slate-300 w-16 text-center">#</th>
                  <th className="py-3 px-4 font-black border-b border-slate-300">التوجيه الطبي / الدواء (Medication/Instruction)</th>
                </tr>
              </thead>
              <tbody>
                {diagnosis.treatmentPlan.map((treatment, idx) => (
                  <tr key={idx} className="even:bg-slate-50">
                    <td className="py-4 px-4 border-b border-slate-200 text-center font-black text-slate-500">{idx + 1}</td>
                    <td className="py-4 px-4 border-b border-slate-200 text-base font-bold text-slate-900 leading-relaxed">{treatment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!diagnosis.treatmentPlan || diagnosis.treatmentPlan.length === 0) && (
              <div className="p-6 text-center text-slate-500 font-bold">لا توجد أدوية موصوفة (No medications prescribed)</div>
            )}
          </div>
        </div>

        {/* Advice and Guidance */}
        <div className="grid grid-cols-2 gap-8 mb-12">
           {diagnosis.dietaryAdvice && diagnosis.dietaryAdvice.length > 0 && (
             <div className="border border-slate-200 p-6 rounded-2xl">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                   <Apple className="w-5 h-5 text-emerald-600" /> نصائح غذائية
                </h3>
                <ul className="space-y-2 pr-4 list-disc marker:text-slate-400">
                  {diagnosis.dietaryAdvice.map((item, idx) => (
                    <li key={idx} className="text-sm font-bold opacity-80">{item}</li>
                  ))}
                </ul>
             </div>
           )}
           {diagnosis.lifestyleChanges && diagnosis.lifestyleChanges.length > 0 && (
             <div className="border border-slate-200 p-6 rounded-2xl">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                   <LifeBuoy className="w-5 h-5 text-indigo-600" /> نمط الحياة
                </h3>
                <ul className="space-y-2 pr-4 list-disc marker:text-slate-400">
                  {diagnosis.lifestyleChanges.map((item, idx) => (
                    <li key={idx} className="text-sm font-bold opacity-80">{item}</li>
                  ))}
                </ul>
             </div>
           )}
        </div>

        {/* Footer & Signature */}
        <div className="flex justify-between items-end pt-12 border-t border-slate-200 mt-20">
           <div className="w-1/2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                تم إنشاء هذا التقرير آلياً عبر نظام الذكاء الاصطناعي المتقدم.<br />
                يعتبر هذا المستند صالحاً كمرجع طبي للمريض ويجب تقديمه للصيدلي لصرف الأدوية.
              </p>
           </div>
           <div className="text-center px-12">
              <p className="text-sm font-black mb-8 border-b-2 border-slate-400 pb-2 inline-block px-8">توقيع الطبيب المعالج</p>
              <h4 className="text-lg font-black text-blue-700 font-serif">Dr. AI Assistant</h4>
              <p className="text-xs font-bold text-slate-500">Chief Medical Consultant</p>
           </div>
        </div>
      </div>
    </>
  );
};

export default AIResult;
