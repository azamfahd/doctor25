
import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, Brain, 
  Mic, MicOff, Activity, HeartPulse, Loader2,
  Thermometer, Droplets, ShieldAlert, Pill, FileText, ChevronLeft,
  Settings, Download, ImagePlus, XCircle, Zap,
  X, LayoutPanelLeft, UserCircle, MessageCircle, AlertCircle, Square, Play, Volume2
} from 'lucide-react';
import { PatientCase, ChatMessage, SystemSettings, ModelType } from '../types';
import { startFollowUpChat, generateSpeech, getAI } from '../services/geminiService';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// Audio Helpers
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

interface ConsultSessionProps {
  patient: PatientCase;
  settings: SystemSettings;
  onClose: () => void;
  onUpdateHistory: (messages: ChatMessage[]) => void;
}

const ConsultSession: React.FC<ConsultSessionProps> = ({ patient, settings, onClose, onUpdateHistory }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(patient.chatHistory || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 1024);
  const [streamingText, setStreamingText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const activeAudioContext = useRef<AudioContext | null>(null);
  const speechSessionIdRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextStartTimeRef = useRef(0);
  const [chatInstance, setChatInstance] = useState<any>(null);

  useEffect(() => {
    const chat = startFollowUpChat(patient, settings);
    setChatInstance(chat);

    const handleStopAllAudio = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.sender !== 'ConsultSession') {
        stopAISpeaking();
        stopLiveSession();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('app-stop-all-audio', handleStopAllAudio);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('app-stop-all-audio', handleStopAllAudio);
      }
      stopLiveSession();
      stopAISpeaking();
    };
  }, [patient]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, streamingText, isLoading]);

  useEffect(() => {
    stopAISpeaking();
    setMessages(prev => {
      const updated = prev.map(msg => ({ ...msg, audioData: undefined }));
      onUpdateHistory(updated);
      return updated;
    });
  }, [selectedVoice]);

  const stopAISpeaking = () => {
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
      activeAudioContext.current.close().catch(() => {});
      activeAudioContext.current = null;
    }
    setIsSpeaking(false);
    setIsAudioLoading(false);
    setPlayingMessageIndex(null);
  };

  const stopLiveSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsLiveActive(false);
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
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

    utterance.rate = 1.0;

    utterance.onend = () => {
      if (sessionId === speechSessionIdRef.current) {
        onEnd();
      }
    };

    utterance.onerror = (e: any) => {
      console.warn("SpeechSynthesis error in ConsultSession:", e);
      if (sessionId === speechSessionIdRef.current && e.error !== 'interrupted' && e.error !== 'canceled') {
        onEnd();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const playAIResponse = async (text: string, msgIndex?: number) => {
    if (msgIndex !== undefined && playingMessageIndex === msgIndex) {
      stopAISpeaking();
      return;
    }
    
    // Dispatch a global stop audio event to stop other speech players in the app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-stop-all-audio', { detail: { sender: 'ConsultSession' } }));
    }
    
    stopAISpeaking();
    const sessionId = ++speechSessionIdRef.current;
    
    try {
      if (msgIndex !== undefined) setPlayingMessageIndex(msgIndex);

      const apiKey = settings?.apiKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
      const hasKey = apiKey && apiKey.trim() !== "" && apiKey.length > 10;

      if (selectedVoice === 'WebSpeech' || !hasKey) {
        setIsSpeaking(true);
        speakWithWebSpeech(text, sessionId, () => {
          if (sessionId !== speechSessionIdRef.current) return;
          setIsSpeaking(false);
          setPlayingMessageIndex(null);
        });
        return;
      }

      setIsAudioLoading(true);
      
      let base64Audio = msgIndex !== undefined ? messages[msgIndex]?.audioData : undefined;
      
      if (!base64Audio) {
        try {
          const speechPromise = generateSpeech(text, settings, selectedVoice);
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error("AUDIO_GENERATION_TIMEOUT")), 2200)
          );
          
          base64Audio = await Promise.race([speechPromise, timeoutPromise]);
          if (sessionId !== speechSessionIdRef.current) return;
          
          if (!base64Audio) {
            throw new Error("No high-fidelity audio returned (Quota limits or API unavailable)");
          }

          if (msgIndex !== undefined) {
            setMessages(prev => {
              const newMessages = [...prev];
              if (newMessages[msgIndex]) {
                newMessages[msgIndex] = { ...newMessages[msgIndex], audioData: base64Audio! };
                onUpdateHistory(newMessages); // trigger sync
              }
              return newMessages;
            });
          }
        } catch (apiError) {
          console.warn("Gemini TTS high-fidelity failed in ConsultSession, falling back to Web Speech API:", apiError);
          if (sessionId !== speechSessionIdRef.current) return;
          setIsAudioLoading(false);
          setIsSpeaking(true);
          
          speakWithWebSpeech(text, sessionId, () => {
            if (sessionId !== speechSessionIdRef.current) return;
            setIsSpeaking(false);
            setPlayingMessageIndex(null);
          });
          return;
        }
      }

      if (sessionId !== speechSessionIdRef.current) return;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      activeAudioContext.current = ctx;
      
      const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (sessionId !== speechSessionIdRef.current) return;
        setIsSpeaking(false);
        setPlayingMessageIndex(null);
        activeAudioSource.current = null;
      };
      
      activeAudioSource.current = source;
      setIsAudioLoading(false);
      setIsSpeaking(true);
      source.start();
    } catch (e) {
      console.warn("Audio Context player failed, falling back to Web Speech API:", e);
      if (sessionId !== speechSessionIdRef.current) return;
      setIsAudioLoading(false);
      setIsSpeaking(true);
      
      speakWithWebSpeech(text, sessionId, () => {
        if (sessionId !== speechSessionIdRef.current) return;
        setIsSpeaking(false);
        setPlayingMessageIndex(null);
      });
    }
  };

  const startLiveSession = async () => {
    if (isLiveActive) { stopLiveSession(); return; }

    // Dispatch a global stop audio event to stop other speech players in the app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-stop-all-audio', { detail: { sender: 'ConsultSession' } }));
    }

    try {
      const ai = getAI(settings);
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            const audioData = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: (selectedVoice && selectedVoice !== 'WebSpeech') ? selectedVoice : 'Puck' } } },
          systemInstruction: `أنت الآن الطبيب الاستشاري المباشر المشرف على حالة هذا المريض عبر اتصال صوتي.
          السياق السريري:
          الاسم: ${patient.name} | العمر: ${patient.age} | الجنس: ${patient.gender}
          الأعراض: ${patient.symptoms}
          التشخيص: ${patient.diagnosis?.conditionName}
          المؤشرات الحيوية: حرارة ${patient.vitals.temperature} | ضغط ${patient.vitals.bloodPressure} | نبض ${patient.vitals.pulse} | أكسجين ${patient.vitals.spo2}
          
          تعليمات صارمة:
          1. تحدث كطبيب بشري خبير في عيادته، وليس كذكاء اصطناعي.
          2. كن دقيقاً، مهنياً، ومطمئناً في نبرة صوتك.
          3. اربط إجاباتك دائماً بحالة المريض الحالية وتشخيصه.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Live Audio Connection Error:", err);
      const errMsg = err?.message || String(err);
      if (errMsg === "MISSING_API_KEY" || errMsg.includes("API key")) {
        alert("فشل الاتصال الصوتي المباشر.\n\nهذا القسم (الاستشارة الصوتية الحية بالزمن الفعلي) يتطلب إدخال مفتاح الـ API الخاص بك في صفحة الإعدادات لتأمين الاتصال المباشر بنموذج Gemini Live API.");
      } else {
        alert("فشل الاتصال الصوتي المباشر. يرجى التحقق من اتصال الإنترنت ومن صلاحية مفتاح الـ API الخاص بك في صفحة الإعدادات.");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file as File);
    });
  };

  const handleSend = async (customMsg?: string) => {
    const textToSend = customMsg || input;
    if ((!textToSend.trim() && attachments.length === 0) || !chatInstance || isLoading) return;
    
    const userMessage: ChatMessage = { 
      role: 'user', 
      text: textToSend || 'مرفق', 
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      images: attachments.length > 0 ? [...attachments] : undefined
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setIsLoading(true);
    setStreamingText('');

    try {
      let messageContent: any = textToSend || 'تحليل المرفق';
      
      if (currentAttachments.length > 0) {
        messageContent = [];
        if (textToSend) messageContent.push({ text: textToSend });
        else messageContent.push({ text: "قم بتحليل هذه المرفقات السريرية واستنتج التطورات في حالة المريض." });
        
        currentAttachments.forEach(img => {
          messageContent.push({
            inlineData: {
              data: img.split(',')[1],
              mimeType: img.substring(img.indexOf(':') + 1, img.indexOf(';'))
            }
          });
        });
      }

      let result;
      let activeChat = chatInstance;
      try {
        result = await activeChat.sendMessageStream({ message: messageContent });
      } catch (streamError) {
        console.warn("Primary chat model stream failed, falling back to Gemini 3 Flash:", streamError);
        setStreamingText("جاري تحويل طلبك لنموذج مساند لضمان استجابة سريعة ودائمة...");
        
        // Re-initialize a standard stable chat
        const fallbackChat = startFollowUpChat(patient, settings, ModelType.FLASH);
        setChatInstance(fallbackChat);
        activeChat = fallbackChat;
        
        // Retry message sending on the fallback chat
        result = await fallbackChat.sendMessageStream({ message: messageContent });
      }

      let fullText = '';
      for await (const chunk of result) {
        const chunkText = chunk.text;
        fullText += chunkText;
        setStreamingText(fullText);
      }
      
      const botMessage: ChatMessage = { 
        role: 'model', 
        text: fullText, 
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) 
      };
      
      const newHistory = [...messages, userMessage, botMessage];
      setMessages(newHistory);
      setStreamingText('');
      onUpdateHistory(newHistory);
      if (settings.voiceOutputEnabled) {
        playAIResponse(fullText, newHistory.length - 1);
      }
    } catch (e) {
      console.error(e);
      setStreamingText('عذراً، حدث خطأ أثناء الاتصال السريري. الرجاء التأكد من مفتاح الـ API الخاص بك إذا تم إدخاله.');
    } finally {
      setIsLoading(false);
    }
  };

  const QuickAction = ({ icon: Icon, label, msg }: { icon: any, label: string, msg: string }) => (
    <button 
      onClick={() => handleSend(msg)} 
      className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-slate-300 hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap shrink-0 group"
    >
      <Icon className="w-3 h-3 group-hover:scale-110 transition-transform" /> {label}
    </button>
  );

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
          if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
            return (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 mt-1.5 lg:mt-2 shrink-0"></span>
                <span className="leading-[1.6] lg:leading-[1.8]">{line.replace(/^[-*]\s*/, '')}</span>
              </div>
            );
          }
          return <p key={i} className="leading-[1.6] lg:leading-[1.8]">{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full bg-[#0A0F1E] lg:rounded-[2rem] shadow-2xl overflow-hidden border border-white/5 animate-in fade-in duration-500 relative">
      
      {/* Sidebar Overlay for Mobile */}
      {showSidebar && window.innerWidth < 1024 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] lg:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Sidebar - Patient Data Engine */}
      <aside className={`fixed inset-y-0 right-0 z-[160] w-[85%] sm:w-80 bg-[#0F172A] border-l border-white/5 flex flex-col transition-transform duration-500 lg:relative lg:translate-x-0 ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Active Patient Card */}
          <div className="p-4 lg:p-6 bg-gradient-to-br from-blue-600/20 via-blue-900/10 to-transparent border-b border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                <span className="text-[6px] font-black text-blue-400 uppercase tracking-[0.15em]">ملف الحالة النشطة</span>
              </div>
              <button onClick={() => setShowSidebar(false)} className="lg:hidden p-1 text-slate-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-lg blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative w-10 h-10 lg:w-12 lg:h-12 rounded-lg overflow-hidden border-2 border-white/10 shadow-xl bg-slate-800">
                  {patient.images && patient.images.length > 0 ? (
                     <img src={patient.images[0]} className="w-full h-full object-cover" alt={patient.name} />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-900"><UserCircle className="w-6 h-6 lg:w-8 lg:h-8" /></div>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm lg:text-base font-black text-white tracking-tight">{patient.name}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{patient.age} سنة</span>
                  <span className="w-0.5 h-0.5 bg-slate-700 rounded-full"></span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{patient.gender}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10 relative overflow-hidden group hover:bg-white/10 transition-all duration-500">
                 <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                 <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1 bg-blue-500/20 rounded-md text-blue-400"><Brain className="w-3 h-3" /></div>
                    <p className="text-[7px] text-blue-400 font-black uppercase tracking-[0.15em]">التشخيص الحالي</p>
                 </div>
                 <p className="text-[11px] lg:text-xs font-black text-white leading-tight">{patient.diagnosis?.conditionName}</p>
              </div>

              <div className="bg-rose-500/5 rounded-xl p-3 border border-rose-500/10 flex items-start gap-2">
                 <div className="p-1 bg-rose-500/20 rounded-md text-rose-500"><ShieldAlert className="w-3.5 h-3.5 shrink-0" /></div>
                 <div>
                    <p className="text-[7px] text-rose-400 font-black uppercase tracking-[0.15em] mb-0.5">تنبيهات حرجة</p>
                    <p className="text-[9px] text-slate-300 font-bold leading-relaxed">{patient.diagnosis?.urgentWarnings?.[0] || 'لا توجد تنبيهات عاجلة'}</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Vitals Monitor */}
          <div className="p-4 lg:p-6 space-y-6">
            <section>
              <h5 className="text-[8px] font-black text-slate-500 uppercase mb-3 tracking-[0.2em] flex items-center justify-between">
                <span>المؤشرات السريرية</span>
                <div className="flex gap-1">
                  {[1,2,3].map(i => <div key={i} className="w-0.5 h-0.5 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: `${i*0.2}s`}}></div>)}
                </div>
              </h5>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'الحرارة', val: `${patient.vitals.temperature}°C`, icon: Thermometer, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { label: 'الضغط', val: patient.vitals.bloodPressure, icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                  { label: 'النبض', val: patient.vitals.pulse, icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                  { label: 'الأكسجين', val: `${patient.vitals.spo2}%`, icon: Droplets, color: 'text-blue-400', bg: 'bg-blue-500/10' }
                ].map((v, i) => {
                  const Icon = v.icon;
                  return (
                  <div key={i} className={`p-3 rounded-xl border border-white/5 ${v.bg} group cursor-default transition-all hover:border-white/20 hover:scale-[1.02]`}>
                     <Icon className={`w-3.5 h-3.5 ${v.color} mb-1.5 transition-transform group-hover:scale-110`} />
                     <p className="text-base font-black text-white">{v.val}</p>
                     <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{v.label}</p>
                  </div>
                )})}
              </div>
            </section>
          </div>
        </div>

        <div className="p-4 lg:p-5 bg-black/40 border-t border-white/5">
           <button onClick={() => window.print()} className="w-full py-3 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black text-white hover:bg-blue-600 hover:border-blue-500 transition-all flex items-center justify-center gap-2 group shadow-lg">
             <Download className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" /> تصدير السجل السريري الموحد
           </button>
        </div>
      </aside>

      {/* Main Consultation Core */}
      <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#0A0F1E] to-[#0D1224] relative overflow-hidden">
        
        {/* Dynamic Header */}
        <header className="p-2.5 lg:p-4 border-b border-white/5 flex items-center justify-between backdrop-blur-3xl bg-black/40 z-50">
          <div className="flex items-center gap-2.5 lg:gap-4">
            <button onClick={() => { stopAISpeaking(); onClose(); }} className="p-2 lg:p-3 bg-white/5 hover:bg-white/10 rounded-lg lg:rounded-xl transition-all text-slate-400 border border-white/5 group shadow-lg">
              <ChevronLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="flex items-center gap-2.5 lg:gap-4">
               <div className="relative group">
                 <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-lg blur opacity-20 group-hover:opacity-60 transition duration-1000 animate-pulse"></div>
                 <div className="relative w-9 h-9 lg:w-12 lg:h-12 bg-slate-900 rounded-lg flex items-center justify-center shadow-2xl border border-white/10 overflow-hidden">
                    <Brain className="w-5 h-5 lg:w-7 lg:h-7 text-blue-400 group-hover:scale-110 transition-transform" />
                    {isSpeaking && (
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-blue-500 animate-pulse"></div>
                    )}
                 </div>
               </div>
               <div className="max-w-[100px] sm:max-w-none">
                  <h3 className="font-black text-[11px] lg:text-lg text-white tracking-tight">
                    المستشار الرقمي
                  </h3>
                  <div className="flex items-center gap-1 lg:gap-1.5 mt-0.5">
                     <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                     <span className="text-[7px] lg:text-[9px] text-slate-400 font-bold uppercase tracking-widest">المريض: {patient.name}</span>
                  </div>
               </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 lg:gap-3">
             {isSpeaking && (
               <button 
                onClick={stopAISpeaking}
                className="p-2 lg:p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg lg:rounded-xl hover:bg-rose-500/20 transition-all flex items-center gap-1.5 shadow-lg"
                title="إيقاف صوت المستشار"
               >
                 <Square className="w-3 h-3 fill-current" />
                 <span className="hidden lg:inline text-[9px] font-black uppercase tracking-widest">إيقاف</span>
               </button>
             )}
             <div className="flex items-center gap-1.5 bg-white/5 p-1.5 px-2.5 rounded-lg lg:rounded-xl border border-white/10 shadow-lg">
               <span className="text-[9px] font-black text-slate-400 px-1 font-['Tajawal'] hidden md:inline">صوت المستشار:</span>
               <select
                 value={selectedVoice}
                 onChange={(e) => {
                   setSelectedVoice(e.target.value);
                   stopAISpeaking();
                 }}
                 className="bg-transparent text-[10px] font-black text-slate-300 px-1 py-0.5 focus:outline-none cursor-pointer"
               >
                 <option value="WebSpeech" className="bg-slate-900 text-white">القارئ الفوري الذكي (فائق السرعة ومجاني ⚡)</option>
                 <option value="Zephyr" className="bg-slate-900 text-white">د. سمير (استشاري سحابي)</option>
                 <option value="Kore" className="bg-slate-900 text-white">د. منال (استشارية سحابية)</option>
                 <option value="Puck" className="bg-slate-900 text-white">أخصائية ياسمين (هادئ سحابي)</option>
                 <option value="Charon" className="bg-slate-900 text-white">د. عاصم (عميق سحابي)</option>
                 <option value="Fenrir" className="bg-slate-900 text-white">د. فواز (جاد سحابي)</option>
               </select>
             </div>
             <button onClick={() => setShowSidebar(!showSidebar)} className={`p-2 lg:p-3 rounded-lg lg:rounded-xl transition-all border shadow-lg ${showSidebar ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                <LayoutPanelLeft className="w-4 h-4 lg:w-5 lg:h-5" />
             </button>
             <button onClick={startLiveSession} className={`p-2 lg:px-6 lg:py-3 rounded-lg lg:rounded-xl transition-all flex items-center gap-2 font-black text-[8px] lg:text-[11px] group relative overflow-hidden shadow-xl ${isLiveActive ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'}`}>
                {isLiveActive ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4 group-hover:scale-110" />}
                <span className="hidden sm:inline uppercase tracking-widest">{isLiveActive ? 'إغلاق الجلسة' : 'عيادة مباشرة'}</span>
             </button>
          </div>
        </header>

        {/* Message Canvas */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 lg:p-6 no-scrollbar z-10">
          <div className="max-w-4xl mx-auto space-y-5 lg:space-y-8 w-full">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-1000 py-10 lg:py-20">
                 <div className="relative">
                    <div className="absolute -inset-6 lg:-inset-10 bg-blue-600/10 rounded-full blur-[50px] animate-pulse"></div>
                    <div className="relative w-14 h-14 lg:w-20 lg:h-20 bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-2xl">
                      <MessageCircle className="w-7 h-7 lg:w-10 lg:h-10 text-blue-500" />
                    </div>
                 </div>
                 <div className="max-w-sm px-4">
                    <h4 className="text-base lg:text-xl font-black text-white mb-2">بدء الاستشارة</h4>
                    <p className="text-[10px] lg:text-xs font-bold text-slate-500 leading-relaxed">
                      مرحباً، أنا المستشار الرقمي المخصص للمريض <span className="text-blue-400 font-black">{patient.name}</span>. تم تحميل كافة البيانات السريرية. كيف نبدأ؟
                    </p>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md px-4">
                    <QuickAction icon={AlertCircle} label="علامات الخطر" msg={`بناءً على تشخيص (${patient.diagnosis?.conditionName})، ما هي علامات الخطر التي يجب مراقبتها؟`} />
                    <QuickAction icon={Pill} label="مراجعة العلاج" msg={`هل خطة العلاج المتبعة للمريض (${patient.name}) تتطلب أي تعديلات؟`} />
                 </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-3 duration-500`}>
                <div className={`flex gap-2.5 lg:gap-5 max-w-[95%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0 shadow-2xl border transition-all duration-500 ${msg.role === 'user' ? 'bg-[#1E293B] text-slate-400 border-white/5' : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-400/20 shadow-blue-600/20'}`}>
                    {msg.role === 'user' ? <UserCircle className="w-4.5 h-4.5 lg:w-6 lg:h-6" /> : <Brain className="w-4.5 h-4.5 lg:w-6 lg:h-6" />}
                  </div>
                  <div className={`relative p-3.5 lg:p-6 rounded-xl lg:rounded-[2rem] shadow-2xl border group transition-all duration-500 ${msg.role === 'user' ? 'bg-[#1E293B] text-slate-200 rounded-tr-none border-white/5 hover:bg-slate-800' : 'bg-gradient-to-tr from-blue-900/40 to-blue-800/40 backdrop-blur-2xl text-white rounded-tl-none border-blue-500/20 hover:from-blue-900/50 hover:to-blue-800/50'}`}>
                    <FormattedText text={msg.text} className="text-[11px] lg:text-[13px] font-bold" />
                    
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3 mb-2">
                        {msg.images.map((img, idx) => (
                           <img key={idx} src={img} alt="مرفق سريري" className="w-20 h-20 lg:w-32 lg:h-32 object-cover rounded-lg border border-slate-700 shadow-md" />
                        ))}
                      </div>
                    )}
                    
                    <div className={`flex items-center gap-3 mt-3 lg:mt-4 ${msg.role === 'model' ? 'justify-end' : ''}`}>
                      {msg.role === 'model' && (
                        <div className="flex items-center gap-2 ml-auto">
                           <button 
                             onClick={() => playAIResponse(msg.text, i)}
                             disabled={isAudioLoading && playingMessageIndex === i}
                             className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] lg:text-[11px] font-bold transition-all shadow-lg ${playingMessageIndex === i ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-black/20 text-slate-300 hover:bg-black/40 hover:text-white border border-white/5'} ${isAudioLoading && playingMessageIndex === i ? 'opacity-70 cursor-wait' : ''}`}
                           >
                             {isAudioLoading && playingMessageIndex === i ? (
                               <>
                                 <Loader2 className="w-3 h-3 lg:w-3.5 lg:h-3.5 animate-spin" />
                                 <span>جاري التجهيز...</span>
                               </>
                             ) : playingMessageIndex === i ? (
                               <>
                                 <Square className="w-3 h-3 lg:w-3.5 lg:h-3.5 fill-current" />
                                 <span>إيقاف التشغيل</span>
                               </>
                             ) : (
                               <>
                                 <Volume2 className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                                 <span>استماع للتحليل</span>
                               </>
                             )}
                           </button>
                           {isSpeaking && playingMessageIndex === i && (
                             <div className="flex gap-0.5 items-end h-3 lg:h-4 mr-1">
                               {[1, 2, 3, 4, 5].map(j => <div key={j} className="w-0.5 lg:w-1 bg-blue-400 rounded-full animate-bounce" style={{height: `${j * 15 + 25}%`, animationDelay: `${j * 0.1}s`}}></div>)}
                             </div>
                           )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 opacity-30">
                        <span className="text-[7px] lg:text-[9px] font-black uppercase tracking-[0.15em]">{msg.timestamp}</span>
                        <div className="h-[1px] w-4 lg:w-8 bg-current"></div>
                        <span className="text-[7px] lg:text-[9px] font-black uppercase tracking-[0.15em]">{msg.role === 'user' ? 'Medical Staff' : 'AI Consultant'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {streamingText && (
              <div className="flex justify-end animate-in fade-in duration-300">
                 <div className="flex gap-2.5 lg:gap-4 max-w-[95%] sm:max-w-[85%] flex-row-reverse">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xl border border-blue-400/20"><Brain className="w-4.5 h-4.5 lg:w-6 lg:h-6 animate-pulse" /></div>
                    <div className="p-3.5 lg:p-6 rounded-xl lg:rounded-[2rem] rounded-tl-none bg-blue-900/40 backdrop-blur-xl text-white shadow-2xl border border-blue-500/20">
                      <FormattedText text={streamingText} className="text-[11px] lg:text-[13px] font-bold" />
                      <div className="flex gap-1 mt-3">
                         <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                         <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                         <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      </div>
                    </div>
                 </div>
              </div>
            )}

            {isLoading && !streamingText && (
              <div className="flex justify-end">
                 <div className="bg-blue-600/10 p-2.5 lg:p-4 rounded-lg lg:rounded-xl flex items-center gap-2.5 border border-blue-500/20 backdrop-blur-xl">
                    <div className="relative">
                      <Loader2 className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-blue-400 animate-spin" />
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] lg:text-[9px] font-black text-blue-400 uppercase tracking-widest">تحليل المعطيات</p>
                      <p className="text-[5px] lg:text-[7px] text-slate-500 font-bold uppercase mt-0.5">Processing History...</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Dock */}
        <div className="p-3 lg:p-6 bg-black/60 backdrop-blur-3xl border-t border-white/5 z-20">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-1.5 lg:mb-3">
               <QuickAction icon={ShieldAlert} label="تقييم الخطورة" msg={`أجرِ تقييماً لدرجة الخطورة الحالية لـ (${patient.name}).`} />
               <QuickAction icon={FileText} label="ملخص الجلسة" msg="لخص هذه الجلسة في نقاط فنية." />
               <QuickAction icon={Settings} label="توصيات الخطة" msg={`هل هناك فحوصات مخبرية إضافية تنصح بها لـ (${patient.name})؟`} />
               <QuickAction icon={Activity} label="تحليل العلامات" msg="حلل المؤشرات الحيوية الحالية للمريض." />
            </div>

            <div className="relative flex items-center gap-2 lg:gap-3 group/input">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" multiple />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 lg:p-4 bg-[#1E293B] hover:bg-slate-700 text-slate-400 hover:text-blue-400 rounded-lg lg:rounded-2xl border border-white/5 transition-all shadow-2xl shrink-0"
                title="إرفاق تقارير أو صور"
              >
                <ImagePlus className="w-4.5 h-4.5 lg:w-6 lg:h-6 transition-transform" />
              </button>

              <button className="p-3 lg:p-4 bg-[#1E293B] hover:bg-slate-700 text-slate-400 hover:text-blue-400 rounded-lg lg:rounded-2xl border border-white/5 transition-all shadow-2xl group/mic shrink-0">
                <Mic className="w-4.5 h-4.5 lg:w-6 lg:h-6 group-hover/mic:scale-110 transition-transform" />
              </button>

              <div className="relative flex-1 bg-[#1E293B] border border-white/10 rounded-lg lg:rounded-2xl shadow-2xl transition-all focus-within:ring-4 focus-within:ring-blue-500/20 px-2 lg:px-4">
                {attachments.length > 0 && (
                  <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar border-b border-white/5">
                    {attachments.map((src, index) => (
                      <div key={index} className="relative shrink-0">
                        <img src={src} className="w-12 h-12 lg:w-16 lg:h-16 object-cover rounded-md border border-slate-700" alt={`مرفق ${index + 1}`} />
                        <button 
                          onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                          className="absolute -top-2 -right-2 p-0.5 bg-rose-500 text-white rounded-full hover:scale-110 shadow-lg"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
                  placeholder={isLiveActive ? "المستشار يستمع..." : `اسأل عن حالة ${patient.name.split(' ')[0]}...`} 
                  className="w-full bg-transparent border-none outline-none font-bold text-[11px] lg:text-base text-white py-2.5 lg:py-4 placeholder:text-slate-600 focus:ring-0" 
                />
              </div>

              <button 
                onClick={() => handleSend()} 
                disabled={isLoading || (!input.trim() && attachments.length === 0)} 
                className={`p-3 lg:p-4 rounded-lg lg:rounded-2xl transition-all shadow-2xl shrink-0 ${isLoading || (!input.trim() && attachments.length === 0) ? 'bg-white/5 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20 hover:scale-105 active:scale-95'}`}
              >
                <Send className="w-4.5 h-4.5 lg:w-6 lg:h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultSession;
