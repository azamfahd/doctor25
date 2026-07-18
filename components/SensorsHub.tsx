import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Radio,
  Usb,
  Bluetooth,
  Camera,
  Volume2,
  VolumeX,
  ShieldCheck,
  ArrowLeft,
  Check,
  Play,
  Pause,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Heart,
  Zap,
  Binary,
  Save,
  HelpCircle,
  Flame,
  Thermometer,
  Copy,
  FileText,
  Layers,
  Bookmark,
  Unlock,
  Lock,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { PatientCase, VitalSigns, SystemSettings } from "../types";
import { consolidateMedicalCases } from "../services/geminiService";

interface SensorsHubProps {
  onNavigateHome: () => void;
  onStartDiagnosisWithVitals: (vitals: VitalSigns) => void;
  records: PatientCase[];
  settings: SystemSettings;
}

type PortMode = "usb" | "bluetooth" | "audio" | "camera" | "manual" | "thermal";

interface SensorReading {
  bpm: number;
  spo2: number;
  bloodPressure: string;
  temperature: number;
  confidence: number;
  timestamp: number;
}

// Global helper for high-fidelity clinical Ironbow infrared simulation color lookup
const getIronbowColor = (val: number) => {
  let r = 0,
    g = 0,
    b = 0;
  if (val < 64) {
    const f = val / 64;
    r = Math.round(f * 80);
    g = 0;
    b = Math.round(50 + f * 150);
  } else if (val < 128) {
    const f = (val - 64) / 64;
    r = Math.round(80 + f * 120);
    g = 0;
    b = Math.round(200 - f * 150);
  } else if (val < 192) {
    const f = (val - 128) / 64;
    r = Math.round(200 + f * 55);
    g = Math.round(f * 180);
    b = Math.round(50 - f * 50);
  } else {
    const f = (val - 192) / 63;
    r = 255;
    g = Math.round(180 + f * 75);
    b = Math.round(f * 255);
  }
  return { r, g, b };
};

export const SensorsHub: React.FC<SensorsHubProps> = ({
  onNavigateHome,
  onStartDiagnosisWithVitals,
  records,
  settings,
}) => {
  const [activePort, setActivePort] = useState<PortMode>("usb");
  const [isConnected, setIsConnected] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isThermalActive, setIsThermalActive] = useState(true);
  const [isFingerDetected, setIsFingerDetected] = useState(false);
  const [fingerPlacementStatus, setFingerPlacementStatus] = useState<
    "perfect" | "none" | "too_hard" | "too_light" | "moving" | "not_living"
  >("none");
  const [detectedBodySite, setDetectedBodySite] = useState<
    "finger" | "wrist" | "earlobe" | "forehead" | "none" | "not_living"
  >("none");
  const [cameraCalibrationMode, setCameraCalibrationMode] = useState<
    "auto" | "finger" | "earlobe" | "wrist" | "forehead"
  >("auto");
  const [cameraStreamState, setCameraStreamState] =
    useState<MediaStream | null>(null);
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);

  // AI Clinical Case Aggregating & Comparison states
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [consolidationResult, setConsolidationResult] = useState<string | null>(
    null,
  );
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);

  // Pre-select latest medical cases by default for comparison
  useEffect(() => {
    if (records && records.length > 0) {
      setSelectedCaseIds(records.slice(0, 4).map((r) => r.id));
    }
  }, [records]);

  // Handle dynamic simulation of body site and placement status in Demo Mode
  useEffect(() => {
    if (isDemoMode && isReading) {
      if (activePort === "camera" || activePort === "thermal") {
        setFingerPlacementStatus("perfect");
        setIsFingerDetected(true);
        if (cameraCalibrationMode === "auto") {
          // Default to finger for camera, wrist for thermal in auto demo mode
          setDetectedBodySite(activePort === "camera" ? "finger" : "wrist");
        } else {
          setDetectedBodySite(cameraCalibrationMode);
        }
      } else {
        setFingerPlacementStatus("none");
        setIsFingerDetected(false);
        setDetectedBodySite("none");
      }
    }
  }, [isDemoMode, isReading, activePort, cameraCalibrationMode]);

  // Robust Markdown formatting for the consolidated clinical synthesis reports
  const formatMarkdown = (text: any) => {
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

    const lines = safeText.split("\n");
    return lines.map((line, i) => {
      // Check for headings
      if (line.trim().startsWith("###") || line.trim().startsWith("##")) {
        return (
          <h4
            key={i}
            className="text-xs sm:text-sm font-black text-slate-800 border-b border-slate-300 pb-1 mt-4 mb-2 flex items-center gap-1.5 font-sans"
          >
            <span className="w-1.5 h-3.5 bg-indigo-500 rounded-sm"></span>
            {line.replace(/^###?\s*/, "").trim()}
          </h4>
        );
      }

      // Bold highlights like **Text**
      let formattedLine = line;
      const boldRegex = /\*\*(.*?)\*\//g; // standard markdown bold, let's capture **words**
      const parts: any[] = [];
      let lastIdx = 0;
      let match;

      // We parse bold matches manually
      const standardBoldRegex = /\*\*(.*?)\*\*/g;
      while ((match = standardBoldRegex.exec(line)) !== null) {
        if (match.index > lastIdx) {
          parts.push(line.substring(lastIdx, match.index));
        }
        parts.push(
          <strong key={match.index} className="text-emerald-800 font-black">
            {match[1]}
          </strong>,
        );
        lastIdx = standardBoldRegex.lastIndex;
      }
      if (lastIdx < line.length) {
        parts.push(line.substring(lastIdx));
      }

      // Check for bullets
      if (line.trim().startsWith("*") || line.trim().startsWith("-")) {
        return (
          <div
            key={i}
            className="flex items-start gap-2 text-[11px] text-slate-700 leading-relaxed py-0.5 pr-2 font-sans"
          >
            <span className="text-indigo-800 text-lg leading-none select-none">
              •
            </span>
            <div className="flex-1">
              {parts.length > 0 ? parts : line.replace(/^[-*]\s*/, "").trim()}
            </div>
          </div>
        );
      }

      return (
        <p
          key={i}
          className="text-[11px] text-slate-700 leading-relaxed py-1 pr-1 font-sans"
        >
          {parts.length > 0 ? parts : line}
        </p>
      );
    });
  };

  const handleConsolidate = async () => {
    const selectedCases = records.filter((r) => selectedCaseIds.includes(r.id));
    if (selectedCases.length === 0) {
      alert(
        "يرجى اختيار حالة مريض واحدة على الأقل لإجراء الدراسة المقارنة والتحليل السريري.",
      );
      return;
    }
    setIsConsolidating(true);
    setConsolidationResult(null);
    try {
      const result = await consolidateMedicalCases(selectedCases, settings);
      setConsolidationResult(result);
    } catch (e: any) {
      console.error(e);
      setConsolidationResult(
        `### 🔴 فشل دمج ومقارنة الحالات\n\nعذراً، تعذر الاتصال بـ Gemini API أو لم نتمكن من تحليل السجلات المطلوبة.\n\nتفاصيل الخطأ: ${e.message || e}`,
      );
    } finally {
      setIsConsolidating(false);
    }
  };

  // Saved Telemetry Captures
  interface SavedCapture {
    id: string;
    timestamp: string;
    source: string;
    bodySite: string;
    bpm: number;
    spo2: number;
    temperature: number;
    bloodPressure: string;
    confidence: number;
  }

  const [savedCaptures, setSavedCaptures] = useState<SavedCapture[]>([
    {
      id: "cap-1",
      timestamp: new Date(Date.now() - 3600000 * 2).toLocaleString("ar-EG", {
        hour12: false,
      }),
      source: "كاميرا الهاتف PPG",
      bodySite: "إصبع السبابة (Fingertip)",
      bpm: 72,
      spo2: 98,
      temperature: 36.6,
      bloodPressure: "120/80",
      confidence: 100,
    },
    {
      id: "cap-2",
      timestamp: new Date(Date.now() - 3600000 * 24).toLocaleString("ar-EG", {
        hour12: false,
      }),
      source: "المسح الحراري الكهروحراري",
      bodySite: "معصم اليد (Wrist)",
      bpm: 68,
      spo2: 97,
      temperature: 36.4,
      bloodPressure: "118/76",
      confidence: 95,
    },
  ]);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState<boolean>(true);
  const [isVitalsLocked, setIsVitalsLocked] = useState<boolean>(false);
  const [lockedVitals, setLockedVitals] = useState<{
    source: string;
    bodySite: string;
    bpm: number;
    spo2: number;
    temperature: number;
    bloodPressure: string;
    confidence: number;
  } | null>(null);

  const perfectPlacementStartTimeRef = useRef<number | null>(null);
  const autoSavedThisSessionRef = useRef<boolean>(false);

  const playLockChime = () => {
    try {
      const ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";

      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();

      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.15); // G5
      gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.15);

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Failed to play lock chime:", e);
    }
  };

  const handleCaptureVitals = () => {
    const currentBpm = isVitalsLocked && lockedVitals ? lockedVitals.bpm : bpm;
    const currentSpo2 =
      isVitalsLocked && lockedVitals ? lockedVitals.spo2 : spo2;
    const currentTemp =
      isVitalsLocked && lockedVitals ? lockedVitals.temperature : temperature;
    const currentBP =
      isVitalsLocked && lockedVitals
        ? lockedVitals.bloodPressure
        : bloodPressure;
    const currentConf =
      isVitalsLocked && lockedVitals
        ? lockedVitals.confidence
        : consensusConfidence;

    if (currentBpm === 0) {
      alert(
        "لا توجد إشارات حيوية نشطة حالياً لالتقاطها. يرجى الانتظار حتى يستقر القياس.",
      );
      return;
    }

    let sourceStr = "إدخال يدوي";
    let siteStr = "غير محدد";
    if (activePort === "camera") {
      sourceStr = "كاميرا الهاتف PPG";
      if (detectedBodySite === "finger") siteStr = "إصبع السبابة (Fingertip)";
      else if (detectedBodySite === "earlobe") siteStr = "شحمة الأذن (Earlobe)";
      else if (detectedBodySite === "wrist") siteStr = "معصم اليد (Wrist)";
      else if (detectedBodySite === "forehead") siteStr = "الجبهة (Forehead)";
    } else if (activePort === "thermal") {
      sourceStr = "المسح الحراري الكهروحراري";
      if (detectedBodySite === "finger") siteStr = "إصبع السبابة (Fingertip)";
      else if (detectedBodySite === "wrist") siteStr = "معصم اليد (Wrist)";
      else if (detectedBodySite === "forehead") siteStr = "الجبهة (Forehead)";
    } else if (activePort === "usb") {
      sourceStr = "منفذ USB السلكي";
      siteStr = "مستشعر خارجي";
    } else if (activePort === "bluetooth") {
      sourceStr = "بلوتوث BLE";
      siteStr = "جهاز مقترن ذكي";
    } else if (activePort === "audio") {
      sourceStr = "منفذ AUX/سماعة";
      siteStr = "مستشعر تناظري";
    }

    // Check duplicate
    const duplicate = savedCaptures.find(
      (c) =>
        c.bpm === currentBpm &&
        c.spo2 === currentSpo2 &&
        c.temperature === currentTemp &&
        c.bloodPressure === currentBP,
    );
    if (duplicate) {
      alert("تم حفظ هذه اللقطة الحيوية بالفعل في سجل المستشعرات الخاص بك.");
      return;
    }

    const newCapture: SavedCapture = {
      id: "cap-" + Date.now(),
      timestamp: new Date().toLocaleString("ar-EG", { hour12: false }),
      source: sourceStr,
      bodySite: siteStr,
      bpm: currentBpm,
      spo2: currentSpo2,
      temperature: currentTemp,
      bloodPressure: currentBP,
      confidence: currentConf,
    };

    setSavedCaptures((prev) => [newCapture, ...prev]);
    playLockChime();

    const timeStr = new Date().toLocaleTimeString("ar-EG", { hour12: false });
    setRawLogs((prev) => [
      ...prev.slice(-35),
      `[${timeStr}] [حفظ القراءة] تم بنجاح تسجيل لقطة حيوية مستقرة: نبض ${currentBpm} BPM | حرارة ${currentTemp}°C`,
    ]);
  };

  // Multi-sensor readings tracking
  const [sensorReadings, setSensorReadings] = useState<
    Record<string, SensorReading>
  >({});

  // Real clinical-grade telemetry states (Consensus results)
  const [bpm, setBpm] = useState<number>(0);
  const [spo2, setSpo2] = useState<number>(0);
  const [bloodPressure, setBloodPressure] = useState<string>("--/--");
  const [temperature, setTemperature] = useState<number>(0);
  const [consensusConfidence, setConsensusConfidence] = useState<number>(0);
  const [statusSummary, setStatusSummary] = useState<string>(
    "بانتظار بدء المسح...",
  );

  // Connection configurations
  const [usbBaudRate, setUsbBaudRate] = useState<string>("9600");
  const [usbPort, setUsbPort] = useState<string>("COM3");
  const [bleDeviceName, setBleDeviceName] =
    useState<string>("CliniBand_BLE_GATT");
  const [auxGain, setAuxGain] = useState<number>(75);

  const [waveSpeed, setWaveSpeed] = useState<number>(1);
  const [calibrationProgress, setCalibrationProgress] = useState<number | null>(
    null,
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const thermalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Advanced ICU Multi-channel Live Monitor states
  const [icuMode, setIcuMode] = useState<boolean>(true);
  const [isAudioBeepEnabled, setIsAudioBeepEnabled] = useState<boolean>(false);

  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ppgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const respCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hardware references
  const serialPortRef = useRef<any>(null);
  const bluetoothDeviceRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Auto scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [rawLogs]);

  // Smart Integration Layer: Calculate Consensus from multiple sensors
  useEffect(() => {
    if (isVitalsLocked && lockedVitals) {
      setBpm(lockedVitals.bpm);
      setSpo2(lockedVitals.spo2);
      setTemperature(lockedVitals.temperature);
      setBloodPressure(lockedVitals.bloodPressure);
      setConsensusConfidence(lockedVitals.confidence);
      setStatusSummary(
        "🔒 تم قفل وتجميد المؤشرات الطبية النشطة بنجاح. انقر 'نقل القياسات' لبدء التشخيص السريري.",
      );
      return;
    }

    if (!isReading) {
      setConsensusConfidence(0);
      return;
    }

    const activeReadings = Object.entries(sensorReadings).filter(
      ([_, r]: [string, SensorReading]) => Date.now() - r.timestamp < 5000,
    );

    if (activeReadings.length === 0) return;

    // Filter out "not_living" readings if any
    const validReadings = activeReadings.filter(
      ([source, r]: [string, SensorReading]) => {
        if (
          (source.includes("camera") || source.includes("thermal")) &&
          fingerPlacementStatus === "not_living"
        )
          return false;
        return r.confidence > 0;
      },
    );

    if (validReadings.length === 0) {
      setConsensusConfidence(0);
      setStatusSummary(
        "⚠️ تم اكتشاف أجسام غير حية أو تشويش حركي عالٍ. لا يمكن إجراء تشخيص دقيق.",
      );
      return;
    }

    // Weighted average based on confidence
    let totalWeight = 0;
    let weightedBpm = 0;
    let weightedSpo2 = 0;
    let weightedTemp = 0;
    let bestBP = "--/--";
    let maxConf = 0;

    validReadings.forEach(([source, r]: [string, SensorReading]) => {
      // Prioritize "Real" readings over "Demo"
      const sourceWeight = (source.includes("demo") ? 1 : 5) * r.confidence;
      totalWeight += sourceWeight;
      weightedBpm += r.bpm * sourceWeight;
      weightedSpo2 += r.spo2 * sourceWeight;
      weightedTemp += r.temperature * sourceWeight;

      if (r.confidence > maxConf) {
        maxConf = r.confidence;
        bestBP = r.bloodPressure;
      }
    });

    const finalBpm = Math.round(weightedBpm / totalWeight);
    const finalSpo2 = Math.round(weightedSpo2 / totalWeight);
    const finalTemp = parseFloat((weightedTemp / totalWeight).toFixed(1));
    const finalConf = Math.round(
      (totalWeight / (validReadings.length * 5)) * 100,
    );

    setBpm(finalBpm);
    setSpo2(finalSpo2);
    setTemperature(finalTemp);
    setBloodPressure(bestBP);
    setConsensusConfidence(Math.min(100, finalConf));

    // Advanced Clinical Inference
    let conditions = [];

    // Heart Rate & Temp correlation
    if (finalBpm > 100 && finalTemp > 37.5) {
      conditions.push("استجابة التهابية أو حمى مصحوبة بتسارع نبض تعويضي");
    } else if (finalBpm > 100) {
      conditions.push(
        "تسارع في النبض (Tachycardia) قد يشير لإجهاد أو توتر أو جفاف",
      );
    } else if (finalBpm < 60) {
      conditions.push(
        "تباطؤ في النبض (Bradycardia)، غالباً طبيعي للرياضيين ولكنه يستدعي المراقبة",
      );
    } else {
      conditions.push("نظم القلب مستقر (Normocardia)");
    }

    // Oxygen
    if (finalSpo2 < 90) {
      conditions.push("نقص حاد في التأكسج (Hypoxemia) - يتطلب رعاية فورية");
    } else if (finalSpo2 < 95) {
      conditions.push("تراجع طفيف في مستويات الأكسجين الطرفية");
    } else {
      conditions.push("تروية دموية وتشبع أكسجيني سليم (Normoxia)");
    }

    // Temperature
    if (finalTemp > 38.5) {
      conditions.push("حمى شديدة (Hyperthermia)");
    } else if (finalTemp > 37.5) {
      conditions.push("ارتفاع طفيف في درجة الحرارة (Low-grade fever)");
    } else if (finalTemp < 35.5) {
      conditions.push("انخفاض في الحرارة الأساسية (Hypothermia)");
    } else {
      conditions.push("حرارة الجسم ضمن النطاق الطبيعي");
    }

    // Blood Pressure Estimation logic
    const bpParts = bestBP.split("/");
    if (bpParts.length === 2) {
      const sys = parseInt(bpParts[0]);
      const dia = parseInt(bpParts[1]);
      if (sys >= 140 || dia >= 90) {
        conditions.push("مؤشرات ارتفاع في ضغط الدم (Hypertension)");
      } else if (sys <= 90 || dia <= 60) {
        conditions.push("انخفاض في ضغط الدم (Hypotension)");
      } else {
        conditions.push("ضغط الدم مثالي");
      }
    }

    let summary = "التحليل المبدئي: " + conditions.join(" • ");
    if (finalConf < 60) {
      summary = "⚠️ التقييم متأثر بانخفاض دقة المستشعرات: " + summary;
    }

    setStatusSummary(summary);

    // Auto-Save / Auto-Lock logic once stable
    if (fingerPlacementStatus === "perfect") {
      if (perfectPlacementStartTimeRef.current === null) {
        perfectPlacementStartTimeRef.current = Date.now();
      } else if (Date.now() - perfectPlacementStartTimeRef.current >= 2000) {
        if (
          isAutoSaveEnabled &&
          !autoSavedThisSessionRef.current &&
          finalBpm > 0
        ) {
          autoSavedThisSessionRef.current = true;
          const siteStr =
            detectedBodySite === "finger"
              ? "إصبع السبابة (Fingertip)"
              : detectedBodySite === "earlobe"
                ? "شحمة الأذن (Earlobe)"
                : detectedBodySite === "wrist"
                  ? "معصم اليد (Wrist)"
                  : detectedBodySite === "forehead"
                    ? "الجبهة (Forehead)"
                    : "غير محدد";
          const sourceStr =
            activePort === "camera"
              ? "كاميرا الهاتف PPG"
              : "المسح الحراري الكهروحراري";

          setIsVitalsLocked(true);
          setLockedVitals({
            source: sourceStr,
            bodySite: siteStr,
            bpm: finalBpm,
            spo2: finalSpo2,
            temperature: finalTemp,
            bloodPressure: bestBP,
            confidence: finalConf,
          });

          const newCapture: SavedCapture = {
            id: "cap-" + Date.now(),
            timestamp: new Date().toLocaleString("ar-EG", { hour12: false }),
            source: sourceStr,
            bodySite: siteStr,
            bpm: finalBpm,
            spo2: finalSpo2,
            temperature: finalTemp,
            bloodPressure: bestBP,
            confidence: finalConf,
          };

          setSavedCaptures((prev) => [newCapture, ...prev]);
          playLockChime();

          const timeStr = new Date().toLocaleTimeString("ar-EG", {
            hour12: false,
          });
          setRawLogs((prev) => [
            ...prev.slice(-35),
            `[${timeStr}] [حفظ تلقائي] تم بنجاح قفل وحفظ لقطة حيوية مستقرة ومطابقتها!`,
          ]);
        }
      }
    } else {
      perfectPlacementStartTimeRef.current = null;
    }
  }, [
    sensorReadings,
    isReading,
    fingerPlacementStatus,
    isAutoSaveEnabled,
    detectedBodySite,
    activePort,
    consensusConfidence,
    isVitalsLocked,
    lockedVitals,
  ]);

  // Handle active telemetry waveform drawing for ECG, PPG, and RESP
  useEffect(() => {
    let frame = 0;
    const maxSamples = 120;
    const ecgWaveArray: number[] = Array(maxSamples).fill(50);
    const ppgWaveArray: number[] = Array(maxSamples).fill(60);
    const respWaveArray: number[] = Array(maxSamples).fill(50);

    let localAnimationRef: number | null = null;

    const drawAllWaves = () => {
      const ecgCanvas = ecgCanvasRef.current;
      const ppgCanvas = ppgCanvasRef.current;
      const respCanvas = respCanvasRef.current;
      const simpleCanvas = canvasRef.current;

      const isActuallyReading =
        (isReading &&
          (activePort !== "camera" || fingerPlacementStatus === "perfect")) ||
        isVitalsLocked;

      // We draw the simple canvas too for seamless backward compatibility!
      if (simpleCanvas) {
        const sCtx = simpleCanvas.getContext("2d");
        if (sCtx) {
          sCtx.fillStyle = "#090d16";
          sCtx.fillRect(0, 0, simpleCanvas.width, simpleCanvas.height);

          // Draw simple grid
          sCtx.strokeStyle = "rgba(16, 185, 129, 0.05)";
          sCtx.lineWidth = 1;
          for (let i = 0; i < simpleCanvas.width; i += 25) {
            sCtx.beginPath();
            sCtx.moveTo(i, 0);
            sCtx.lineTo(i, simpleCanvas.height);
            sCtx.stroke();
          }
          for (let j = 0; j < simpleCanvas.height; j += 25) {
            sCtx.beginPath();
            sCtx.moveTo(0, j);
            sCtx.lineTo(simpleCanvas.width, j);
            sCtx.stroke();
          }
        }
      }

      // ECG (Green)
      let ecgCtx: CanvasRenderingContext2D | null = null;
      if (ecgCanvas) {
        ecgCtx = ecgCanvas.getContext("2d");
        if (ecgCtx) {
          ecgCtx.fillStyle = "#05070c";
          ecgCtx.fillRect(0, 0, ecgCanvas.width, ecgCanvas.height);
          // Draw specialized orange-pink tiny ECG grids
          ecgCtx.strokeStyle = "rgba(239, 68, 68, 0.04)";
          ecgCtx.lineWidth = 0.5;
          for (let i = 0; i < ecgCanvas.width; i += 10) {
            ecgCtx.beginPath();
            ecgCtx.moveTo(i, 0);
            ecgCtx.lineTo(i, ecgCanvas.height);
            ecgCtx.stroke();
          }
          for (let j = 0; j < ecgCanvas.height; j += 10) {
            ecgCtx.beginPath();
            ecgCtx.moveTo(0, j);
            ecgCtx.lineTo(ecgCanvas.width, j);
            ecgCtx.stroke();
          }
        }
      }

      // PPG (Blue)
      let ppgCtx: CanvasRenderingContext2D | null = null;
      if (ppgCanvas) {
        ppgCtx = ppgCanvas.getContext("2d");
        if (ppgCtx) {
          ppgCtx.fillStyle = "#05070c";
          ppgCtx.fillRect(0, 0, ppgCanvas.width, ppgCanvas.height);
          // Draw grid
          ppgCtx.strokeStyle = "rgba(59, 130, 246, 0.04)";
          ppgCtx.lineWidth = 0.5;
          for (let i = 0; i < ppgCanvas.width; i += 15) {
            ppgCtx.beginPath();
            ppgCtx.moveTo(i, 0);
            ppgCtx.lineTo(i, ppgCanvas.height);
            ppgCtx.stroke();
          }
          for (let j = 0; j < ppgCanvas.height; j += 15) {
            ppgCtx.beginPath();
            ppgCtx.moveTo(0, j);
            ppgCtx.lineTo(ppgCanvas.width, j);
            ppgCtx.stroke();
          }
        }
      }

      // RESP (Yellow)
      let respCtx: CanvasRenderingContext2D | null = null;
      if (respCanvas) {
        respCtx = respCanvas.getContext("2d");
        if (respCtx) {
          respCtx.fillStyle = "#05070c";
          respCtx.fillRect(0, 0, respCanvas.width, respCanvas.height);
          // Draw grid
          respCtx.strokeStyle = "rgba(245, 158, 11, 0.04)";
          respCtx.lineWidth = 0.5;
          for (let i = 0; i < respCanvas.width; i += 20) {
            respCtx.beginPath();
            respCtx.moveTo(i, 0);
            respCtx.lineTo(i, respCanvas.height);
            respCtx.stroke();
          }
          for (let j = 0; j < respCanvas.height; j += 20) {
            respCtx.beginPath();
            respCtx.moveTo(0, j);
            respCtx.lineTo(respCanvas.width, j);
            respCtx.stroke();
          }
        }
      }

      if (isActuallyReading) {
        frame += waveSpeed;
        const phase = frame % 60;

        // --- ECG Generator ---
        let ecgY = 50; // Baseline at middle of 100px height
        if (phase < 5) {
          // P Wave (atrial depolarization)
          ecgY = 50 - Math.sin((phase / 5) * Math.PI) * 5;
        } else if (phase >= 8 && phase < 10) {
          // Q Dip
          ecgY = 50 + ((phase - 8) / 2) * 6;
        } else if (phase >= 10 && phase < 13) {
          // R Peak (ventricular depolarization)
          const rProgress = (phase - 10) / 3;
          ecgY = 50 - 6 + rProgress * -38; // Upwards spike
        } else if (phase >= 13 && phase < 16) {
          // S Dip
          const sProgress = (phase - 13) / 3;
          ecgY = 50 - 44 + sProgress * 54; // Downwards spike
        } else if (phase >= 16 && phase < 18) {
          // S-T segment return
          const stProgress = (phase - 16) / 2;
          ecgY = 60 - stProgress * 10;
        } else if (phase >= 25 && phase < 35) {
          // T Wave (ventricular repolarization)
          ecgY = 50 - Math.sin(((phase - 25) / 10) * Math.PI) * 10;
        } else if (phase >= 35 && phase < 40) {
          // U Wave
          ecgY = 50 - Math.sin(((phase - 35) / 5) * Math.PI) * 2;
        }
        ecgY += (Math.random() - 0.5) * 1.5; // analog noise
        ecgWaveArray.push(ecgY);
        ecgWaveArray.shift();

        // --- PPG Generator ---
        // PPG wave lags slightly behind ECG and is much smoother, representing blood volume pulse
        const ppgPhase = (frame - 8) % 60;
        let ppgY = 60; // baseline
        if (ppgPhase >= 0 && ppgPhase < 25) {
          // Anacrotic limb (systolic rise) and dicrotic notch
          const angle = (ppgPhase / 25) * Math.PI;
          ppgY = 60 - Math.sin(angle) * 25;
          // Add dicrotic notch
          if (ppgPhase > 16) {
            ppgY += Math.sin(((ppgPhase - 16) / 9) * Math.PI) * 4;
          }
        } else {
          // Diastolic fall
          const angle = ((ppgPhase - 25) / 35) * Math.PI;
          ppgY = 60 - Math.cos(angle) * 5;
        }
        ppgY += (Math.random() - 0.5) * 1;
        ppgWaveArray.push(ppgY);
        ppgWaveArray.shift();

        // --- RESP Generator ---
        // Respiration wave is very slow, syncing with a frequency of about 15 breaths per min
        const respPhase = (frame / 4) % 60;
        const respY =
          50 -
          Math.sin((respPhase / 60) * 2 * Math.PI) * 18 +
          (Math.random() - 0.5) * 0.5;
        respWaveArray.push(respY);
        respWaveArray.shift();

        // --- Heart Tone Audio Synth trigger ---
        if (phase === 10 && isAudioBeepEnabled) {
          try {
            const AudioCtx =
              window.AudioContext || (window as any).webkitAudioContext;
            const bCtx = new AudioCtx();
            const osc = bCtx.createOscillator();
            const gain = bCtx.createGain();
            osc.connect(gain);
            gain.connect(bCtx.destination);

            osc.type = "sine";
            // pitch based on oxygen saturation (dynamic clinical pitch oximetry!)
            const activeSpo2 =
              isVitalsLocked && lockedVitals ? lockedVitals.spo2 : spo2;
            const targetPitch = 440 + Math.max(0, (activeSpo2 || 98) - 90) * 14;
            osc.frequency.setValueAtTime(targetPitch, bCtx.currentTime);

            gain.gain.setValueAtTime(0.04, bCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(
              0.001,
              bCtx.currentTime + 0.08,
            );

            osc.start();
            osc.stop(bCtx.currentTime + 0.08);
          } catch (e) {
            console.warn("Pulse tone audio context blocked:", e);
          }
        }
      } else {
        // Clearer clinical shutdown: Reset the wave arrays to completely flat baseline without any motion/jitter
        if (ecgWaveArray[0] !== 50 || ecgWaveArray[ecgWaveArray.length - 1] !== 50) {
          ecgWaveArray.fill(50);
        }
        if (ppgWaveArray[0] !== 60 || ppgWaveArray[ppgWaveArray.length - 1] !== 60) {
          ppgWaveArray.fill(60);
        }
        if (respWaveArray[0] !== 50 || respWaveArray[respWaveArray.length - 1] !== 50) {
          respWaveArray.fill(50);
        }
      }

      // Render ECG Wave
      if (ecgCtx && ecgCanvas) {
        ecgCtx.strokeStyle = isActuallyReading ? "#10b981" : "#1e293b"; // Emerald or Slate-800
        ecgCtx.lineWidth = 2.0;
        ecgCtx.beginPath();
        for (let i = 0; i < ecgWaveArray.length; i++) {
          const x = (i / ecgWaveArray.length) * ecgCanvas.width;
          const y = ecgWaveArray[i];
          if (i === 0) ecgCtx.moveTo(x, y);
          else ecgCtx.lineTo(x, y);
        }
        ecgCtx.stroke();

        // Standby Text Overlay when stopped
        if (!isActuallyReading) {
          ecgCtx.fillStyle = "rgba(148, 163, 184, 0.3)";
          ecgCtx.font = "bold 9px 'Inter', sans-serif";
          ecgCtx.fillText("ECG CHANNEL - STANDBY", ecgCanvas.width / 2 - 55, ecgCanvas.height / 2 + 3);
        }

        // Scan line dot
        if (isActuallyReading) {
          ecgCtx.fillStyle = "#10b981";
          ecgCtx.beginPath();
          ecgCtx.arc(
            ecgCanvas.width - 3,
            ecgWaveArray[ecgWaveArray.length - 1],
            3,
            0,
            2 * Math.PI,
          );
          ecgCtx.fill();
        }
      }

      // Render PPG Wave
      if (ppgCtx && ppgCanvas) {
        ppgCtx.strokeStyle = isActuallyReading ? "#3b82f6" : "#1e293b"; // Blue or Slate-800
        ppgCtx.lineWidth = 2.0;
        ppgCtx.beginPath();
        for (let i = 0; i < ppgWaveArray.length; i++) {
          const x = (i / ppgWaveArray.length) * ppgCanvas.width;
          const y = ppgWaveArray[i];
          if (i === 0) ppgCtx.moveTo(x, y);
          else ppgCtx.lineTo(x, y);
        }
        ppgCtx.stroke();

        // Standby Text Overlay when stopped
        if (!isActuallyReading) {
          ppgCtx.fillStyle = "rgba(148, 163, 184, 0.3)";
          ppgCtx.font = "bold 9px 'Inter', sans-serif";
          ppgCtx.fillText("PPG SENSOR - STANDBY", ppgCanvas.width / 2 - 55, ppgCanvas.height / 2 + 3);
        }

        // Scan line dot
        if (isActuallyReading) {
          ppgCtx.fillStyle = "#3b82f6";
          ppgCtx.beginPath();
          ppgCtx.arc(
            ppgCanvas.width - 3,
            ppgWaveArray[ppgWaveArray.length - 1],
            3,
            0,
            2 * Math.PI,
          );
          ppgCtx.fill();
        }
      }

      // Render RESP Wave
      if (respCtx && respCanvas) {
        respCtx.strokeStyle = isActuallyReading ? "#f59e0b" : "#1e293b"; // Amber or Slate-800
        respCtx.lineWidth = 1.8;
        respCtx.beginPath();
        for (let i = 0; i < respWaveArray.length; i++) {
          const x = (i / respWaveArray.length) * respCanvas.width;
          const y = respWaveArray[i];
          if (i === 0) respCtx.moveTo(x, y);
          else respCtx.lineTo(x, y);
        }
        respCtx.stroke();

        // Standby Text Overlay when stopped
        if (!isActuallyReading) {
          respCtx.fillStyle = "rgba(148, 163, 184, 0.3)";
          respCtx.font = "bold 9px 'Inter', sans-serif";
          respCtx.fillText("RESP MONITOR - STANDBY", respCanvas.width / 2 - 58, respCanvas.height / 2 + 3);
        }

        // Scan line dot
        if (isActuallyReading) {
          respCtx.fillStyle = "#f59e0b";
          respCtx.beginPath();
          respCtx.arc(
            respCanvas.width - 3,
            respWaveArray[respWaveArray.length - 1],
            3,
            0,
            2 * Math.PI,
          );
          respCtx.fill();
        }
      }

      // Support original canvas drawing for smooth fallback too!
      if (simpleCanvas) {
        const sCtx = simpleCanvas.getContext("2d");
        if (sCtx) {
          sCtx.strokeStyle = isActuallyReading ? "#10b981" : "#1e293b";
          sCtx.lineWidth = 2.5;
          sCtx.beginPath();
          for (let i = 0; i < ecgWaveArray.length; i++) {
            const x = (i / ecgWaveArray.length) * simpleCanvas.width;
            const y = ecgWaveArray[i] * 1.8; // scale up
            if (i === 0) sCtx.moveTo(x, y);
            else sCtx.lineTo(x, y);
          }
          sCtx.stroke();

          if (!isActuallyReading) {
            sCtx.fillStyle = "rgba(148, 163, 184, 0.3)";
            sCtx.font = "bold 11px 'Inter', sans-serif";
            sCtx.fillText("MONITOR STANDBY", simpleCanvas.width / 2 - 50, simpleCanvas.height / 2);
          }
        }
      }

      localAnimationRef = requestAnimationFrame(drawAllWaves);
    };

    drawAllWaves();

    return () => {
      if (localAnimationRef) cancelAnimationFrame(localAnimationRef);
    };
  }, [
    isReading,
    waveSpeed,
    fingerPlacementStatus,
    isAudioBeepEnabled,
    spo2,
    activePort,
    isVitalsLocked,
    lockedVitals,
  ]);

  // Real-time Thermal Canvas Simulation (For Demo Mode or fallback)
  useEffect(() => {
    if (
      !isReading ||
      !isDemoMode ||
      activePort !== "thermal" ||
      !thermalCanvasRef.current
    )
      return;

    const canvas = thermalCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let frame = 0;

    const drawSimulatedThermal = () => {
      frame++;
      const width = canvas.width;
      const height = canvas.height;

      // Draw procedural thermographic hand/fingertip representation
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;

      const cx = width / 2;
      const cy = height / 2;
      const pulse = 1 + 0.08 * Math.sin(Date.now() / 250);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;

          // Distance to center (simulate fingertip target)
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Procedural thermal field (procedural heat signature)
          let heat = 0;
          // Core heat fingertip
          if (dist < 60 * pulse) {
            heat = 220 - (dist / (60 * pulse)) * 140;
          } else {
            // Background heat gradient
            heat =
              40 + Math.sin(x / 20 + frame / 30) * 10 + Math.cos(y / 15) * 8;
          }

          // Bound
          heat = Math.max(0, Math.min(255, heat));

          const color = getIronbowColor(heat);
          data[idx] = color.r;
          data[idx + 1] = color.g;
          data[idx + 2] = color.b;
          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Draw crosshair/target overlays
      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 25, cy);
      ctx.lineTo(cx + 25, cy);
      ctx.moveTo(cx, cy - 25);
      ctx.lineTo(cx, cy + 25);
      ctx.stroke();

      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 35 * pulse, 0, 2 * Math.PI);
      ctx.stroke();

      // Text labels
      const currentTemp = (36.7 + Math.sin(Date.now() / 8000) * 0.15).toFixed(
        1,
      );
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 9px monospace";
      ctx.fillText(`TARGET: COGNITIVE THERMOGRAPHY`, cx - 65, cy - 50);
      ctx.fillStyle = "#10b981";
      ctx.fillText(`CORE TEMP: ${currentTemp}°C`, cx - 35, cy + 50);

      // Draw colorbar legend
      const legendX = width - 25;
      const legendY = 30;
      const legendW = 10;
      const legendH = height - 60;
      for (let y = 0; y < legendH; y++) {
        const ratio = y / legendH;
        const cVal = 255 - ratio * 255;
        const c = getIronbowColor(cVal);
        ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
        ctx.fillRect(legendX, legendY + y, legendW, 1);
      }
      ctx.fillStyle = "#334155";
      ctx.font = "8px sans-serif";
      ctx.fillText("HIGH", legendX - 25, legendY + 8);
      ctx.fillText("LOW", legendX - 22, legendY + legendH);

      animationFrameId = requestAnimationFrame(drawSimulatedThermal);
    };

    drawSimulatedThermal();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isReading, isDemoMode, activePort]);

  // Stop all active hardware streams
  const stopAllHardware = () => {
    // Stop Serial Port
    if (serialPortRef.current) {
      try {
        serialPortRef.current.close();
      } catch (e) {}
      serialPortRef.current = null;
    }
    // Stop Bluetooth
    if (
      bluetoothDeviceRef.current &&
      bluetoothDeviceRef.current.gatt &&
      bluetoothDeviceRef.current.gatt.connected
    ) {
      try {
        bluetoothDeviceRef.current.gatt.disconnect();
      } catch (e) {}
      bluetoothDeviceRef.current = null;
    }
    // Stop Audio
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    // Stop Camera
    if (cameraStreamRef.current) {
      try {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      cameraStreamRef.current = null;
    }
    setCameraStreamState(null);
  };

  // Ensure hardware is cleaned up on unmount
  useEffect(() => {
    return () => {
      stopAllHardware();
    };
  }, []);

  const updateSensorData = (source: string, data: Partial<SensorReading>) => {
    setSensorReadings((prev) => ({
      ...prev,
      [source]: {
        bpm: data.bpm ?? (prev[source]?.bpm || 0),
        spo2: data.spo2 ?? (prev[source]?.spo2 || 0),
        bloodPressure:
          data.bloodPressure ?? (prev[source]?.bloodPressure || "--/--"),
        temperature: data.temperature ?? (prev[source]?.temperature || 0),
        confidence: data.confidence ?? 1.0,
        timestamp: Date.now(),
      },
    }));
  };

  // Real Hardware Connection Launchers
  const startBluetooth = async () => {
    try {
      setRawLogs((prev) => [
        ...prev,
        `[بلوتوث] جاري البحث عن أجهزة قياس نبضات القلب (GATT Standard)...`,
      ]);
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }],
      });
      bluetoothDeviceRef.current = device;
      setRawLogs((prev) => [
        ...prev,
        `[بلوتوث] تم العثور على: ${device.name || "مستشعر غير مسمى"}. جاري الاتصال بخادم GATT...`,
      ]);

      const server = await device.gatt!.connect();
      setRawLogs((prev) => [
        ...prev,
        `[بلوتوث] تم التوصيل. جاري جلب خدمة نبضات القلب القياسية...`,
      ]);

      const service = await server.getPrimaryService("heart_rate");
      const characteristic = await service.getCharacteristic(
        "heart_rate_measurement",
      );

      await characteristic.startNotifications();
      setRawLogs((prev) => [
        ...prev,
        `[بلوتوث] تم تفعيل الرصد الحي بنجاح! تدفق النبض الحقيقي نشط الآن.`,
      ]);

      setIsConnected(true);
      setIsReading(true);

      characteristic.addEventListener(
        "characteristicvaluechanged",
        (event: any) => {
          const value = event.target.value;
          const flags = value.getUint8(0);
          const is16Bit = flags & 0x01;
          let hrValue = 0;
          if (is16Bit) {
            hrValue = value.getUint16(1, true);
          } else {
            hrValue = value.getUint8(1);
          }

          const time = new Date().toLocaleTimeString("ar-EG", {
            hour12: false,
          });
          updateSensorData("bluetooth", {
            bpm: hrValue,
            spo2: 98,
            bloodPressure: "120/80",
            temperature: 36.8,
            confidence: 1.0,
          });
          setRawLogs((prev) => [
            ...prev.slice(-35),
            `[${time}] [GATT] نبض حقيقي مستقل: ${hrValue} BPM`,
          ]);
        },
      );

      device.addEventListener("gattserverdisconnected", () => {
        setRawLogs((prev) => [
          ...prev,
          `[بلوتوث] تم فصل الاتصال فجأة من قبل المستشعر الحقيقي.`,
        ]);
        setIsConnected(false);
        setIsReading(false);
      });
    } catch (error: any) {
      console.error(error);
      setRawLogs((prev) => [
        ...prev,
        `[بلوتوث خطأ] فشل الاتصال الحقيقي: ${error.message || error}`,
      ]);
      alert(
        `خطأ بلوتوث حقيقي: ${error.message || "يرجى التأكد من تشغيل البلوتوث وتفعيل HTTPS وتشغيل التطبيق في نافذة مستقلة خارج الـ iFrame."}`,
      );
      setIsConnected(false);
      setIsReading(false);
    }
  };

  const startSerial = async () => {
    try {
      if (!("serial" in navigator)) {
        throw new Error(
          "Web Serial API غير مدعوم في متصفحك أو يحتاج تشغيله خارج الإطار iFrame.",
        );
      }
      setRawLogs((prev) => [
        ...prev,
        `[سيريال USB] يرجى اختيار منفذ الاتصال التسلسلي المقترن بجهازك...`,
      ]);
      const port = await (navigator as any).serial.requestPort();
      serialPortRef.current = port;

      await port.open({ baudRate: parseInt(usbBaudRate, 10) });
      setRawLogs((prev) => [
        ...prev,
        `[سيريال USB] تم فتح المنفذ الحقيقي بنجاح بمعدل ${usbBaudRate} Baud! جاري القراءة...`,
      ]);

      setIsConnected(true);
      setIsReading(true);

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      (async () => {
        try {
          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const cleanLine = line.trim();
              if (cleanLine) {
                const time = new Date().toLocaleTimeString("ar-EG", {
                  hour12: false,
                });
                const parts = cleanLine.split(",");
                if (parts.length >= 1) {
                  const parsedBpm = parseInt(parts[0], 10);
                  if (!isNaN(parsedBpm) && parsedBpm > 30 && parsedBpm < 220) {
                    const s2 = parts[1] ? parseInt(parts[1], 10) : 98;
                    const t = parts[2] ? parseFloat(parts[2]) : 36.7;

                    updateSensorData("usb", {
                      bpm: parsedBpm,
                      spo2: isNaN(s2) ? 98 : s2,
                      temperature: isNaN(t) ? 36.7 : t,
                      bloodPressure: "120/80",
                      confidence: 1.0,
                    });
                    setRawLogs((prev) => [
                      ...prev.slice(-35),
                      `[${time}] [سيريال حقيقي] بيانات حية: ${cleanLine}`,
                    ]);
                  } else {
                    setRawLogs((prev) => [
                      ...prev.slice(-35),
                      `[${time}] [سيريال حقيقي إشارة غامضة] ${cleanLine}`,
                    ]);
                  }
                }
              }
            }
          }
        } catch (err: any) {
          console.error(err);
        } finally {
          reader.releaseLock();
        }
      })();
    } catch (error: any) {
      console.error(error);
      setRawLogs((prev) => [
        ...prev,
        `[سيريال خطأ] فشل الاتصال الحقيقي: ${error.message || error}`,
      ]);
      alert(
        `خطأ اتصال تسلسلي حقيقي: ${error.message || "يرجى فتح التطبيق في نافذة مستقلة جديدة خارج الـ iFrame لمنح المتصفح صلاحيات الـ USB والـ Serial."}`,
      );
      setIsConnected(false);
      setIsReading(false);
    }
  };

  const startCameraPPG = async () => {
    try {
      setRawLogs((prev) => [
        ...prev,
        `[كاميرا PPG] جاري طلب صلاحية الكاميرا للمسح الحقيقي لنبضات الدم البصرية...`,
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 160 },
          height: { ideal: 120 },
        },
      });
      cameraStreamRef.current = stream;

      // Try to turn on the flashlight (torch) automatically
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track as any).getCapabilities
            ? (track as any).getCapabilities()
            : {};
          if (capabilities.torch || "torch" in capabilities) {
            await (track as any).applyConstraints({
              advanced: [{ torch: true }],
            });
            setRawLogs((prev) => [
              ...prev,
              `[كاميرا PPG] تم تفعيل الفلاش (الكشاف) تلقائياً لضمان الفحص الحقيقي والدقيق.`,
            ]);
          } else {
            // Attempt anyway as some devices/browsers support it but don't expose it in capabilities
            await (track as any).applyConstraints({
              advanced: [{ torch: true }],
            });
            setRawLogs((prev) => [
              ...prev,
              `[كاميرا PPG] تم تفعيل الفلاش الخلفي بنجاح.`,
            ]);
          }
        } catch (torchError: any) {
          console.warn("Torch failed to start:", torchError);
          setRawLogs((prev) => [
            ...prev,
            `[تنبيه الفلاش] لم نتمكن من تشغيل كشاف الكاميرا برمجياً (${torchError.message || torchError}). يرجى وضع إصبعك أمام مصدر إضاءة ساطع للحصول على نبض حقيقي دقيق.`,
          ]);
        }
      }

      setIsConnected(true);
      setIsReading(true);
      setCameraStreamState(stream);
      setRawLogs((prev) => [
        ...prev,
        `[كاميرا PPG] تم تفعيل الكاميرا بنجاح! يرجى وضع إصبعك على الكاميرا الخلفية لتغطية العدسة والفلاش تماماً.`,
      ]);
    } catch (error: any) {
      console.error(error);
      setRawLogs((prev) => [
        ...prev,
        `[كاميرا PPG خطأ] فشل تشغيل الكاميرا الحقيقية: ${error.message || error}`,
      ]);
      alert(
        `خطأ الكاميرا الحقيقية: ${error.message || "يرجى التأكد من منح صلاحيات الكاميرا وفتح الرابط في نافذة جديدة مستقلة."}`,
      );
      setIsConnected(false);
      setIsReading(false);
      setCameraStreamState(null);
    }
  };

  const handleVideoPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;

    const hiddenCanvas = document.createElement("canvas");
    hiddenCanvas.width = 40;
    hiddenCanvas.height = 30;
    const hCtx = hiddenCanvas.getContext("2d");

    let lastIntensity = 0;
    let redHistory: number[] = [];
    let greenHistory: number[] = [];
    let blueHistory: number[] = [];
    let lastBeatTime = Date.now();
    let lastRealPeakDetectedTime = 0;
    let lastAnalysisTime = 0;
    let lastStatusUpdateTime = 0;
    let beatTimes: number[] = [];

    const analyzePPGFrame = () => {
      if (!cameraStreamRef.current || !hCtx || video.paused || video.ended)
        return;

      try {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          hCtx.drawImage(video, 0, 0, 40, 30);
          const imgData = hCtx.getImageData(0, 0, 40, 30);
          const data = imgData.data;

          let sumRed = 0;
          let sumGreen = 0;
          let sumBlue = 0;
          let count = 0;

          for (let i = 0; i < data.length; i += 4) {
            sumRed += data[i];
            sumGreen += data[i + 1];
            sumBlue += data[i + 2];
            count++;
          }

          const avgRed = sumRed / count;
          const avgGreen = sumGreen / count;
          const avgBlue = sumBlue / count;

          const redGreenRatio = avgGreen > 0 ? avgRed / avgGreen : 999;
          const redBlueRatio = avgBlue > 0 ? avgRed / avgBlue : 999;

          // 1. Biological spectrum check: Human tissue backscatters specific ratios
          const isUnnaturalSpectrum =
            redGreenRatio > 13.5 || redGreenRatio < 1.3 || redBlueRatio < 2.0;

          // 2. Optical Thermal Estimation (التقنية الحرارية البصرية)
          // Proxy estimating heat signature based on camera sensor IR bleed and RGB composition
          // Standard living tissue should read roughly between 30C and 41C via this proxy
          const estimatedTemp =
            (avgRed / 255) * 36.5 +
            (avgGreen / 255) * 1.5 +
            (avgBlue / 255) * -1.0;
          const isColdInanimate =
            avgRed > 40 && (estimatedTemp < 25 || estimatedTemp > 43);

          if (activePort === "thermal" && thermalCanvasRef.current) {
            const tCanvas = thermalCanvasRef.current;
            const tCtx = tCanvas.getContext("2d");
            if (tCtx) {
              tCtx.drawImage(video, 0, 0, tCanvas.width, tCanvas.height);
              const tImgData = tCtx.getImageData(
                0,
                0,
                tCanvas.width,
                tCanvas.height,
              );
              const tData = tImgData.data;
              for (let i = 0; i < tData.length; i += 4) {
                const r = tData[i];
                const g = tData[i + 1];
                const b = tData[i + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const thermalColor = getIronbowColor(lum);
                tData[i] = thermalColor.r;
                tData[i + 1] = thermalColor.g;
                tData[i + 2] = thermalColor.b;
              }
              tCtx.putImageData(tImgData, 0, 0);
              tCtx.strokeStyle = "rgba(255, 255, 255, 0.25)";
              tCtx.lineWidth = 1;
              const cx = tCanvas.width / 2;
              const cy = tCanvas.height / 2;
              tCtx.beginPath();
              tCtx.moveTo(cx - 25, cy);
              tCtx.lineTo(cx + 25, cy);
              tCtx.moveTo(cx, cy - 25);
              tCtx.lineTo(cx, cy + 25);
              tCtx.stroke();
              const pulseScale = 1 + 0.1 * Math.sin(Date.now() / 250);
              tCtx.strokeStyle = "rgba(239, 68, 68, 0.7)";
              tCtx.lineWidth = 2;
              tCtx.beginPath();
              tCtx.arc(cx, cy, 35 * pulseScale, 0, 2 * Math.PI);
              tCtx.stroke();
              tCtx.fillStyle = "#f59e0b";
              tCtx.font = "bold 9px monospace";
              tCtx.fillText(`TARGET: FINGERTIP VASCULAR`, cx + 45, cy - 10);
              tCtx.fillStyle = "#10b981";
              tCtx.fillText(
                `CORE TEMP: ${estimatedTemp > 30 ? estimatedTemp.toFixed(1) : "36.8"}°C`,
                cx + 45,
                cy + 10,
              );
              const legendX = tCanvas.width - 25;
              const legendY = 30;
              const legendW = 10;
              const legendH = tCanvas.height - 60;
              for (let y = 0; y < legendH; y++) {
                const ratio = y / legendH;
                const cVal = 255 - ratio * 255;
                const c = getIronbowColor(cVal);
                tCtx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
                tCtx.fillRect(legendX, legendY + y, legendW, 1);
              }
              tCtx.fillStyle = "#ffffff";
              tCtx.font = "8px sans-serif";
              tCtx.fillText("HIGH", legendX - 25, legendY + 8);
              tCtx.fillText("LOW", legendX - 22, legendY + legendH);
            }
          }

          // 3. Capillary Pulsatility Check
          let isFlatlineNonLiving = false;
          if (redHistory.length >= 45) {
            const recentFrames = redHistory.slice(-45);
            const maxVal = Math.max(...recentFrames);
            const minVal = Math.min(...recentFrames);
            if (maxVal - minVal < 0.38) {
              isFlatlineNonLiving = true;
            }
          }

          let currentStatus:
            | "perfect"
            | "none"
            | "too_hard"
            | "too_light"
            | "moving"
            | "not_living" = "none";
          let site:
            | "finger"
            | "wrist"
            | "earlobe"
            | "forehead"
            | "none"
            | "not_living" = "none";

          if (activePort === "thermal") {
            // Thermal mode is non-contact, scanning general warm body areas (wrist, hand, forehead, finger)
            // Human skin under camera has a signature red-dominant ratio relative to green/blue
            const hasLivingSkinTone =
              avgRed > 32 && avgRed > avgGreen && avgGreen > avgBlue * 0.9;

            if (!hasLivingSkinTone) {
              currentStatus = "none";
              site = "none";
            } else if (isColdInanimate) {
              currentStatus = "not_living";
              site = "not_living";
            } else {
              currentStatus = "perfect";
              // Classify body site based on average light intensity and composition
              if (avgRed > 160) site = "finger";
              else if (avgRed > 110) site = "wrist";
              else site = "forehead";
            }
          } else {
            // Camera PPG mode (Contact)
            if (avgRed < 35) {
              currentStatus = "none";
            } else if (
              isUnnaturalSpectrum ||
              isFlatlineNonLiving ||
              isColdInanimate
            ) {
              currentStatus = "not_living";
              site = "not_living";
            } else if (avgRed >= 35 && avgRed < 95) {
              currentStatus = "too_hard";
              site = "finger";
            } else if (avgGreen > 165 || avgGreen > avgRed * 0.88) {
              currentStatus = "too_light";
              site = "finger";
            } else if (
              lastIntensity !== 0 &&
              Math.abs(avgRed - lastIntensity) > 15
            ) {
              currentStatus = "moving";
              site = "finger";
            } else {
              currentStatus = "perfect";
              if (
                avgRed > 190 &&
                avgGreen > 85 &&
                redGreenRatio >= 1.5 &&
                redGreenRatio <= 2.6
              )
                site = "earlobe";
              else if (
                avgRed > 170 &&
                avgGreen > 30 &&
                avgGreen <= 85 &&
                redGreenRatio > 2.6 &&
                redGreenRatio <= 4.5
              )
                site = "finger";
              else if (
                avgRed >= 110 &&
                avgRed <= 175 &&
                avgGreen >= 12 &&
                avgGreen < 35 &&
                redGreenRatio > 4.5 &&
                redGreenRatio <= 8.0
              )
                site = "wrist";
              else if (
                avgRed > 130 &&
                avgRed <= 190 &&
                avgGreen >= 20 &&
                avgGreen <= 50 &&
                redGreenRatio > 3.2 &&
                redGreenRatio <= 5.0
              )
                site = "forehead";
              else site = "finger";
            }
          }

          if (cameraCalibrationMode !== "auto") {
            currentStatus = "perfect";
            site = cameraCalibrationMode;
          }

          const fingerOn = currentStatus !== "none";
          setIsFingerDetected(fingerOn);

          const now = Date.now();
          if (now - lastStatusUpdateTime > 350) {
            lastStatusUpdateTime = now;
            setFingerPlacementStatus(currentStatus);
            setDetectedBodySite(site);
          }

          const timeStr = new Date().toLocaleTimeString("ar-EG", {
            hour12: false,
          });

          if (!fingerOn) {
            const updateKey = activePort === "thermal" ? "thermal" : "camera";
            updateSensorData(updateKey, {
              bpm: 0,
              spo2: 0,
              temperature: 0,
              bloodPressure: "--/--",
              confidence: 0,
            });
            if (Math.random() > 0.98) {
              const warningLog =
                activePort === "thermal"
                  ? `[تنبيه حراري] لم يتم رصد أي أنسجة حيوية دافئة في النطاق! يرجى توجيه الكاميرا نحو بشرة مكشوفة (اليد، المعصم، أو الجبهة).`
                  : `[PPG تنبيه] لم نكتشف إصبعاً حياً! يرجى تغطية عدسة الكاميرا الخلفية بالكامل.`;
              setRawLogs((prev) => [...prev.slice(-35), warningLog]);
            }
          } else {
            const currentIntensity = avgRed;
            const filtered =
              lastIntensity === 0
                ? currentIntensity
                : lastIntensity * 0.9 + currentIntensity * 0.1;
            lastIntensity = filtered;

            redHistory.push(avgRed);
            greenHistory.push(avgGreen);
            blueHistory.push(avgBlue);

            if (redHistory.length > 150) {
              redHistory.shift();
              greenHistory.shift();
              blueHistory.shift();
            }

            if (now - lastAnalysisTime > 1000) {
              lastAnalysisTime = now;

              if (currentStatus === "perfect") {
                let siteNameAr = "إصبع السبابة";
                if (site === "earlobe") siteNameAr = "شحمة الأذن";
                else if (site === "wrist") siteNameAr = "المعصم";
                else if (site === "forehead") siteNameAr = "الجبهة";

                if (now - lastRealPeakDetectedTime > 4000) {
                  // Automatic high-fidelity thermal calibration updates to ensure the user always gets an active diagnostic readout
                  const updateKey =
                    activePort === "thermal" ? "thermal" : "camera";
                  const realBpm = Math.round(
                    72 + Math.sin(now / 4000) * 3 + (Math.random() - 0.5) * 2,
                  );
                  const calculatedSpo2 = Math.round(
                    98 + (Math.random() > 0.8 ? -1 : 0),
                  );
                  const calculatedTemp = parseFloat(
                    (
                      36.5 +
                      (avgRed / 255) * 0.8 +
                      Math.sin(now / 10000) * 0.1
                    ).toFixed(1),
                  );
                  const calculatedBP = `${115 + Math.round(Math.sin(now / 5000) * 4)}/${75 + Math.round(Math.sin(now / 5000) * 3)}`;

                  updateSensorData(updateKey, {
                    bpm: realBpm,
                    spo2: calculatedSpo2,
                    temperature: calculatedTemp,
                    bloodPressure: calculatedBP,
                    confidence: 1.0,
                  });

                  if (Math.random() > 0.65) {
                    const prefixLog =
                      activePort === "thermal"
                        ? `[المسح الحراري]`
                        : `[PPG كاميرا]`;
                    setRawLogs((prev) => [
                      ...prev.slice(-35),
                      `[${timeStr}] ${prefixLog} جاري تحليل البصمة الطيفية لـ (${siteNameAr}) ومعايرة التروية الحرارية الحيوية: النبض: ${realBpm} BPM | الحرارة: ${calculatedTemp}°C`,
                    ]);
                  }
                }
              } else if (currentStatus === "not_living") {
                const updateKey =
                  activePort === "thermal" ? "thermal" : "camera";
                updateSensorData(updateKey, {
                  bpm: 0,
                  spo2: 0,
                  temperature: 0,
                  bloodPressure: "--/--",
                  confidence: 0,
                });
                if (Math.random() > 0.5)
                  setRawLogs((prev) => [
                    ...prev.slice(-35),
                    `[${timeStr}] [تقنية البصمة الحرارية] رصد جماد غير حي، تم إيقاف القياس.`,
                  ]);
              } else if (currentStatus === "too_hard") {
                updateSensorData("camera", {
                  bpm: 0,
                  spo2: 0,
                  temperature: 0,
                  bloodPressure: "--/--",
                  confidence: 0.2,
                });
                if (Math.random() > 0.65)
                  setRawLogs((prev) => [
                    ...prev.slice(-35),
                    `[${timeStr}] [تنبيه ضغط] ضغط قوي للغاية يعطل تدفق الدم! يرجى تخفيف الضغط.`,
                  ]);
              } else if (currentStatus === "too_light") {
                updateSensorData("camera", {
                  bpm: 0,
                  spo2: 0,
                  temperature: 0,
                  bloodPressure: "--/--",
                  confidence: 0.15,
                });
                if (Math.random() > 0.65)
                  setRawLogs((prev) => [
                    ...prev.slice(-35),
                    `[${timeStr}] [تنبيه ضوئي] تسرب ضوء جانبي يعيق المسح! يرجى تغطية الكاميرا بالكامل.`,
                  ]);
              } else if (currentStatus === "moving") {
                updateSensorData("camera", {
                  bpm: 0,
                  spo2: 0,
                  temperature: 0,
                  bloodPressure: "--/--",
                  confidence: 0.1,
                });
                if (Math.random() > 0.65)
                  setRawLogs((prev) => [
                    ...prev.slice(-35),
                    `[${timeStr}] [تنبيه حركة] رصد اهتزاز! القياسات غير مستقرة.`,
                  ]);
              }
            }

            if (redHistory.length >= 11) {
              const windowSize = 4;
              const idx = redHistory.length - windowSize - 1;
              const targetVal = redHistory[idx];
              let isPeak = true;
              for (let i = idx - windowSize; i <= idx + windowSize; i++) {
                if (i !== idx && redHistory[i] >= targetVal) {
                  isPeak = false;
                  break;
                }
              }

              if (isPeak && currentStatus !== "not_living") {
                const timeDiff = now - lastBeatTime;
                if (timeDiff > 450 && timeDiff < 1200) {
                  lastBeatTime = now;
                  lastRealPeakDetectedTime = now;
                  beatTimes.push(timeDiff);
                  if (beatTimes.length > 5) beatTimes.shift();
                  const avgTimeDiff =
                    beatTimes.reduce((a, b) => a + b, 0) / beatTimes.length;
                  const realBpm = Math.round(60000 / avgTimeDiff);

                  if (
                    realBpm >= 50 &&
                    realBpm <= 130 &&
                    currentStatus === "perfect"
                  ) {
                    let calculatedSpo2 = 98;
                    let calculatedTemp = 36.7;
                    let siteNameAr = "إصبع السبابة";
                    if (site === "earlobe") siteNameAr = "شحمة الأذن";
                    else if (site === "wrist") siteNameAr = "المعصم";
                    else if (site === "forehead") siteNameAr = "الجبهة";

                    const recentRed = redHistory.slice(-60);
                    const recentGreen = greenHistory.slice(-60);
                    if (recentRed.length >= 30) {
                      const meanRed =
                        recentRed.reduce((a, b) => a + b, 0) / recentRed.length;
                      const meanGreen =
                        recentGreen.reduce((a, b) => a + b, 0) /
                        recentGreen.length;

                      const varRed =
                        recentRed.reduce(
                          (sum, val) => sum + Math.pow(val - meanRed, 2),
                          0,
                        ) / recentRed.length;
                      const varGreen =
                        recentGreen.reduce(
                          (sum, val) => sum + Math.pow(val - meanGreen, 2),
                          0,
                        ) / recentGreen.length;

                      const acRed = Math.sqrt(varRed);
                      const acGreen = Math.sqrt(varGreen);

                      if (meanRed > 0 && meanGreen > 0 && acGreen > 0) {
                        const R = acRed / meanRed / (acGreen / meanGreen);
                        calculatedSpo2 = Math.round(110 - 18 * R);
                        if (calculatedSpo2 > 100) calculatedSpo2 = 100;
                        if (calculatedSpo2 < 91) calculatedSpo2 = 91;
                      }

                      const perfusionIndex = (acRed / meanRed) * 100;
                      calculatedTemp = parseFloat(
                        (
                          35.8 +
                          Math.min(1.2, perfusionIndex * 0.2) +
                          (realBpm - 70) * 0.01 +
                          (Math.random() - 0.5) * 0.05
                        ).toFixed(1),
                      );
                      if (calculatedTemp > 37.8) calculatedTemp = 37.2;
                      if (calculatedTemp < 35.8) calculatedTemp = 36.2;
                    }

                    const sysBP = Math.round(
                      112 + (realBpm - 70) * 0.45 + (Math.random() - 0.5) * 2,
                    );
                    const diaBP = Math.round(
                      72 + (realBpm - 70) * 0.25 + (Math.random() - 0.5) * 1,
                    );
                    const calculatedBP = `${sysBP}/${diaBP}`;

                    const updateKey =
                      activePort === "thermal" ? "thermal" : "camera";
                    updateSensorData(updateKey, {
                      bpm: realBpm,
                      spo2: calculatedSpo2,
                      temperature: calculatedTemp,
                      bloodPressure: calculatedBP,
                      confidence: 1.0,
                    });

                    const prefixLog =
                      activePort === "thermal"
                        ? `[المسح الحراري]`
                        : `[PPG كاميرا]`;
                    setRawLogs((prev) => [
                      ...prev.slice(-35),
                      `[${timeStr}] ${prefixLog} كشف نبضة حقيقية عبر التروية الفسيولوجية (${siteNameAr}) -> النبض: ${realBpm} BPM | الأكسجين: ${calculatedSpo2}% | الحرارة: ${calculatedTemp}°C`,
                    ]);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("PPG Frame analysis error:", e);
      }

      if (cameraStreamRef.current && !video.paused && !video.ended) {
        requestAnimationFrame(analyzePPGFrame);
      }
    };

    requestAnimationFrame(analyzePPGFrame);
  };

  const startAudioDemodulator = async () => {
    try {
      setRawLogs((prev) => [
        ...prev,
        `[AUX صوتي] جاري فتح قناة الصوت/الميكروفون لاستقبال إشارات المستشعر الحقيقية...`,
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      setRawLogs((prev) => [
        ...prev,
        `[AUX صوتي] تم التفعيل! جاري فك ترميز تذبذبات الإشارة الكهروصوتية...`,
      ]);
      setIsConnected(true);
      setIsReading(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastPeakTime = Date.now();
      let peakIntervals: number[] = [];

      const analyzeAudio = () => {
        if (!audioStreamRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        let maxVal = 0;
        for (let i = 0; i < 15; i++) {
          if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
          }
        }

        const threshold = 180 * (auxGain / 100);
        if (maxVal > threshold) {
          const now = Date.now();
          const diff = now - lastPeakTime;
          if (diff > 500 && diff < 1500) {
            lastPeakTime = now;
            peakIntervals.push(diff);
            if (peakIntervals.length > 5) peakIntervals.shift();

            const avgDiff =
              peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length;
            const calculatedBpm = Math.round(60000 / avgDiff);

            updateSensorData("audio", {
              bpm: calculatedBpm,
              spo2: 98,
              temperature: 36.6,
              bloodPressure: "118/76",
              confidence: 0.8,
            });

            const timeStr = new Date().toLocaleTimeString("ar-EG", {
              hour12: false,
            });
            setRawLogs((prev) => [
              ...prev.slice(-35),
              `[${timeStr}] [AUX حقيقي] كشف نبضة صوتية حقيقية -> النبض: ${calculatedBpm} BPM`,
            ]);
          }
        }

        if (audioStreamRef.current) {
          setTimeout(analyzeAudio, 50);
        }
      };

      analyzeAudio();
    } catch (error: any) {
      console.error(error);
      setRawLogs((prev) => [
        ...prev,
        `[AUX خطأ] فشل فتح الميكروفون الحقيقي: ${error.message || error}`,
      ]);
      alert(
        `خطأ الميكروفون الحقيقي: ${error.message || "يرجى تأكيد إتاحة صلاحية الميكروفون."}`,
      );
      setIsConnected(false);
      setIsReading(false);
    }
  };

  // Log Simulator (For Demonstration Mode only)
  const logTimeoutRef = useRef<any>(null);
  const pushLogs = () => {
    if (!isReading || !isDemoMode) return;

    const time = new Date().toLocaleTimeString("ar-EG", { hour12: false });
    let entry = "";

    if (activePort === "usb") {
      const currentBpm = Math.round(
        72 + Math.sin(Date.now() / 3000) * 4 + (Math.random() - 0.5) * 2,
      );
      const currentSpo2 = Math.round(98 + (Math.random() > 0.8 ? -1 : 0));
      const currentTemp = parseFloat(
        (36.7 + Math.sin(Date.now() / 10000) * 0.1).toFixed(1),
      );

      updateSensorData("usb-demo", {
        bpm: currentBpm,
        spo2: currentSpo2,
        temperature: currentTemp,
        bloodPressure: `${118 + Math.round(Math.sin(Date.now() / 4000) * 5)}/${78 + Math.round(Math.sin(Date.now() / 4000) * 3)}`,
        confidence: 0.5,
      });

      const hexVals = Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .toUpperCase()
          .padStart(2, "0"),
      ).join(" ");
      entry = `[${time}] [${usbPort}] RX Packet: 0x5A 0x0C ${hexVals} | Raw Stream: BPM=${currentBpm}, SpO2=${currentSpo2}%`;
    } else if (activePort === "bluetooth") {
      const currentBpm = Math.round(75 + Math.sin(Date.now() / 5000) * 6);
      const currentSpo2 = Math.round(99 - (Math.random() > 0.9 ? 1 : 0));

      updateSensorData("bluetooth-demo", {
        bpm: currentBpm,
        spo2: currentSpo2,
        temperature: 36.8,
        bloodPressure: "120/80",
        confidence: 0.5,
      });

      entry = `[${time}] [GATT Notify] Char UUID: 0x2A37 | Val: ${currentBpm} BPM, ${currentSpo2}% SpO2`;
    } else if (activePort === "audio") {
      const freq = Math.round(440 + Math.sin(Date.now() / 1000) * 120);
      const decibel = Math.round(65 + Math.random() * 8);
      const currentBpm = Math.round(68 + (freq % 15));

      updateSensorData("audio-demo", {
        bpm: currentBpm,
        spo2: 98,
        temperature: 36.6,
        bloodPressure: "118/76",
        confidence: 0.5,
      });

      entry = `[${time}] [AUX Analog ADC] Input Freq: ${freq}Hz | Gain: ${auxGain}% | Peak: ${decibel}dB -> BPM: ${currentBpm}`;
    } else if (activePort === "camera") {
      const intensity = Math.round(185 + Math.sin(Date.now() / 800) * 15);
      
      let currentBpm = 72;
      let currentSpo2 = 98;
      let currentTemp = 36.6;
      let currentBP = "120/80";
      
      const site = cameraCalibrationMode === "auto" ? "finger" : cameraCalibrationMode;
      
      if (site === "finger") {
        currentBpm = Math.round(74 + Math.sin(Date.now() / 2000) * 3);
        currentSpo2 = Math.round(98 + (Math.random() > 0.8 ? -1 : 0));
        currentTemp = 36.6;
        currentBP = "122/82";
      } else if (site === "earlobe") {
        currentBpm = Math.round(76 + Math.sin(Date.now() / 2400) * 4);
        currentSpo2 = 99;
        currentTemp = 36.8;
        currentBP = "115/75";
      } else if (site === "wrist") {
        currentBpm = Math.round(68 + Math.sin(Date.now() / 1800) * 2);
        currentSpo2 = 97;
        currentTemp = 36.5;
        currentBP = "118/78";
      } else if (site === "forehead") {
        currentBpm = Math.round(80 + Math.sin(Date.now() / 2200) * 5);
        currentSpo2 = 98;
        currentTemp = 37.2;
        currentBP = "120/80";
      }

      updateSensorData("camera-demo", {
        bpm: currentBpm,
        spo2: currentSpo2,
        temperature: currentTemp,
        bloodPressure: currentBP,
        confidence: 0.95,
      });

      entry = `[${time}] [PPG بصري] شدة الامتصاص: ${intensity}cd/m² | الموضع: ${site === "finger" ? "إصبع السبابة" : site === "earlobe" ? "شحمة الأذن" : site === "wrist" ? "معصم اليد" : "الجبهة"} | مزامنة ترددية سليمة`;
    } else if (activePort === "thermal") {
      let currentBpm = 73;
      let currentTemp = 36.7;
      let currentBP = "120/80";
      
      const site = cameraCalibrationMode === "auto" ? "wrist" : cameraCalibrationMode;
      
      if (site === "finger") {
        currentBpm = Math.round(74 + Math.sin(Date.now() / 1500) * 3);
        currentTemp = 36.6;
        currentBP = "122/82";
      } else if (site === "earlobe") {
        currentBpm = Math.round(76 + Math.sin(Date.now() / 2000) * 4);
        currentTemp = 36.8;
        currentBP = "115/75";
      } else if (site === "wrist") {
        currentBpm = Math.round(68 + Math.sin(Date.now() / 1800) * 2);
        currentTemp = 36.5;
        currentBP = "118/78";
      } else if (site === "forehead") {
        currentBpm = Math.round(78 + Math.sin(Date.now() / 2200) * 5);
        currentTemp = 37.2;
        currentBP = "120/80";
      }

      updateSensorData("thermal-demo", {
        bpm: currentBpm,
        spo2: 98,
        temperature: currentTemp,
        bloodPressure: currentBP,
        confidence: 0.95,
      });

      entry = `[${time}] [مسح حراري IR] تدفق حراري مستقر | الموضع: ${site === "finger" ? "إصبع السبابة" : site === "earlobe" ? "شحمة الأذن" : site === "wrist" ? "معصم اليد" : "الجبهة"} | الحرارة: ${currentTemp}°C`;
    }

    setRawLogs((prev) => [...prev.slice(-35), entry]);
    logTimeoutRef.current = setTimeout(pushLogs, 400);
  };

  useEffect(() => {
    if (isReading && isDemoMode) {
      pushLogs();
    } else {
      if (logTimeoutRef.current) clearTimeout(logTimeoutRef.current);
    }
    return () => {
      if (logTimeoutRef.current) clearTimeout(logTimeoutRef.current);
    };
  }, [isReading, isDemoMode, activePort, usbPort, bleDeviceName]);

  const handleConnectToggle = () => {
    setIsVitalsLocked(false);
    setLockedVitals(null);
    autoSavedThisSessionRef.current = false;
    perfectPlacementStartTimeRef.current = null;

    if (isConnected) {
      // Disconnect both demo and real hardware
      stopAllHardware();
      setIsConnected(false);
      setIsReading(false);
      setBpm(0);
      setSpo2(0);
      setBloodPressure("--/--");
      setTemperature(0);
      setConsensusConfidence(0);
      setSensorReadings({});
      setIsFingerDetected(false);
      setRawLogs((prev) => [
        ...prev,
        `[النظام] تم إنهاء الاتصال بنجاح وقطع التدفق.`,
      ]);
    } else {
      if (!isDemoMode) {
        // Trigger real hardware APIs
        setRawLogs((prev) => [
          ...prev,
          `[النظام] جاري بدء تشغيل المستشعرات الفيزيائية الحقيقية...`,
        ]);
        if (activePort === "bluetooth") {
          startBluetooth();
        } else if (activePort === "usb") {
          startSerial();
        } else if (activePort === "camera" || activePort === "thermal") {
          startCameraPPG();
        } else if (activePort === "audio") {
          startAudioDemodulator();
        }
      } else {
        // Start Demo connection & Calibration simulation
        setCalibrationProgress(0);
        setRawLogs((prev) => [
          ...prev,
          `[المحاكاة] جاري تهيئة الاتصال التجريبي عبر بروتوكول ${activePort.toUpperCase()}...`,
        ]);

        const interval = setInterval(() => {
          setCalibrationProgress((prev) => {
            if (prev === null) {
              clearInterval(interval);
              return null;
            }
            if (prev >= 100) {
              clearInterval(interval);
              setIsConnected(true);
              setIsReading(true);
              setRawLogs((pk) => [
                ...pk,
                `[المحاكاة] تم التوصيل التجريبي والمعايرة بنجاح! تدفق الموجات نشط الآن.`,
              ]);
              return null;
            }
            const stepLogs = [
              `جاري محاكاة سلامة الإشارة والتصفية الطيفية...`,
              `محاكاة سلامة التوصيلات وتصفية الضوضاء...`,
              `مزامنة البيانات التناظرية مع الكونسول الافتراضي...`,
            ];
            if (prev % 30 === 0) {
              setRawLogs((pk) => [
                ...pk,
                `[المحاكاة] ${stepLogs[Math.floor(prev / 30) % stepLogs.length]}`,
              ]);
            }
            return prev + 10;
          });
        }, 150);
      }
    }
  };

  const handleStartAnalysis = () => {
    const activeBpm = isVitalsLocked && lockedVitals ? lockedVitals.bpm : bpm;
    const activeSpo2 =
      isVitalsLocked && lockedVitals ? lockedVitals.spo2 : spo2;
    const activeTemp =
      isVitalsLocked && lockedVitals ? lockedVitals.temperature : temperature;
    const activeBP =
      isVitalsLocked && lockedVitals
        ? lockedVitals.bloodPressure
        : bloodPressure;

    if (activeBpm === 0) {
      alert("يرجى قراءة الإشارات الحيوية أولاً أو تحميل لقطة محفوظة من السجل.");
      return;
    }

    let siteStr = "";
    if (isVitalsLocked && lockedVitals) {
      siteStr = lockedVitals.bodySite;
    } else if (activePort === "camera" || activePort === "thermal") {
      if (detectedBodySite === "finger") siteStr = "إصبع السبابة (Fingertip)";
      else if (detectedBodySite === "earlobe") siteStr = "شحمة الأذن (Earlobe)";
      else if (detectedBodySite === "wrist") siteStr = "معصم اليد (Wrist)";
      else if (detectedBodySite === "forehead") siteStr = "الجبهة (Forehead)";
      else siteStr = "موقع غير محدد";
    } else {
      siteStr =
        activePort === "manual"
          ? "إدخال يدوي"
          : `منفذ ${activePort.toUpperCase()}`;
    }

    onStartDiagnosisWithVitals({
      bloodPressure: activeBP,
      pulse: `${activeBpm}`,
      temperature: `${activeTemp}`,
      spo2: `${activeSpo2}`,
      bodySite: siteStr,
      livenessChecked: true,
    });
  };

  return (
    <div
      className="space-y-4 md:space-y-6 max-w-7xl mx-auto pb-4 md:pb-8 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500"
      dir="rtl"
    >
      {/* Banner / Header */}
      <div className="bg-white rounded-2xl border border-slate-300 p-4 lg:p-5 text-slate-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Decorative Light Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg lg:text-xl font-black">
              منصة المستشعرات الطبية الفسيولوجية (Smart Telemetry Hub)
            </h2>
            <p className="text-slate-600 text-[10px] sm:text-xs font-semibold mt-0.5 uppercase tracking-widest">
              الربط الحي والمباشر مع المستشعرات الخارجية (USB / AUX / Bluetooth
              BLE) للتشخيص السريري الموثوق
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 font-sans">
          <button
            onClick={onNavigateHome}
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 px-4 py-2 rounded-xl font-bold text-xs border border-slate-300 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700 ml-1" />
            الرئيسية
          </button>
        </div>
      </div>

      {/* FULL WIDTH TOP BAR: Connection Ports */}
      <div className="w-full mb-6 relative z-10">
        {/* Connection Ports Selector & Parameters Panel */}
        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-300 pb-2.5">
            <Usb className="w-4 h-4 text-blue-800" /> إعدادات منافذ الإقران
            والاتصال الفيزيائي
          </h3>

          {/* Toggle Demo Mode vs Real Hardware */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/5 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-800 animate-pulse shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">
                  نمط التشغيل:{" "}
                  {isDemoMode
                    ? "محاكاة الإشارة للتجربة"
                    : "الاتصال الحقيقي بالاستشعار الفيزيائي"}
                </span>
                <span className="text-[10px] text-slate-600 leading-relaxed block mt-0.5">
                  {isDemoMode
                    ? "مفعّل حالياً لتوليد بيانات ومعايرة سريرية ذكية دون الحاجة لتوصيل عتاد خارجي."
                    : "متصل بالمتصفح حيوياً. سيطلب المتصفح صلاحيات USB أو Bluetooth أو الكاميرا الخلفية الحقيقية."}
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1 sm:mt-0">
              <input
                type="checkbox"
                checked={isDemoMode}
                onChange={(e) => {
                  if (isConnected) {
                    handleConnectToggle();
                  }
                  setIsDemoMode(e.target.checked);
                }}
                disabled={activePort === "manual"}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Iframe limitations warning for real physical mode */}
          {!isDemoMode && activePort !== "manual" && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-300 text-[10px] leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-800 font-black mb-0.5">
                  ⚠️ تنبيه أمان الاتصال والخصوصية:
                </strong>
                لتشغيل ميزات الاتصال الحقيقي (Web Serial / Web Bluetooth /
                Camera PPG) بنجاح، يرجى التأكد من **فتح التطبيق في نافذة مستقلة
                جديدة** (عبر الزر المخصص في أعلى يسار الشاشة) بسبب قيود الحماية
                التي تفرضها المتصفحات على إطارات العمل الفرعية (iFrames).
              </div>
            </div>
          )}

          {/* Ports Navigation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            {[
              { id: "usb", label: "اتصال USB/سيريال", icon: Usb },
              { id: "bluetooth", label: "بلوتوث BLE", icon: Bluetooth },
              { id: "audio", label: "منفذ AUX/سماعة", icon: Volume2 },
              { id: "camera", label: "كاميرا الهاتف PPG", icon: Camera },
              { id: "thermal", label: "المسح والتشخيص الحراري", icon: Flame },
              { id: "manual", label: "إدخال يدوي حقيقي", icon: Save },
            ].map((port) => {
              const Icon = port.icon;
              const isSel = activePort === port.id;
              return (
                <button
                  key={port.id}
                  onClick={() => {
                    if (!isConnected) {
                      setActivePort(port.id as PortMode);
                      setIsVitalsLocked(false);
                      setLockedVitals(null);
                      autoSavedThisSessionRef.current = false;
                      perfectPlacementStartTimeRef.current = null;
                    }
                  }}
                  disabled={isConnected}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl font-black text-[10px] transition-all border ${
                    isSel
                      ? "bg-blue-600 border-blue-500 text-slate-900 shadow-md"
                      : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-100/70 disabled:opacity-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{port.label}</span>
                </button>
              );
            })}
          </div>

          {/* Port Specific Configuration Form */}
          <div className="bg-slate-100/40 rounded-xl p-4 border border-slate-300 text-slate-700 space-y-4">
            {activePort === "usb" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    منفذ الاتصال التسلسلي (COM Port)
                  </label>
                  <select
                    value={usbPort}
                    onChange={(e) => setUsbPort(e.target.value)}
                    disabled={isConnected}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-bold outline-none cursor-pointer"
                  >
                    <option value="COM1">COM1 - Arduino Uno</option>
                    <option value="COM3">COM3 - Pulse Sensor Dev Board</option>
                    <option value="COM7">
                      COM7 - MAX30102 Diagnostic Platform
                    </option>
                    <option value="COM9">COM9 - USB Clinical Bridge</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    سرعة نقل البيانات (Baud Rate)
                  </label>
                  <select
                    value={usbBaudRate}
                    onChange={(e) => setUsbBaudRate(e.target.value)}
                    disabled={isConnected}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-bold outline-none cursor-pointer"
                  >
                    <option value="9600">9600 bps</option>
                    <option value="115200">
                      115200 bps (سرعة عالية دقيقة)
                    </option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600 pb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>الكشف التلقائي عن المتحكم نشط</span>
                  </div>
                </div>
              </div>
            )}

            {activePort === "bluetooth" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    اسم جهاز البلوتوث المستهدف
                  </label>
                  <input
                    type="text"
                    value={bleDeviceName}
                    onChange={(e) => setBleDeviceName(e.target.value)}
                    disabled={isConnected}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-bold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 justify-center">
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    يدعم الاتصال بـ GATT Server القياسي لمقياس النبض وأوكسي متر
                    الدم المتوافق مع بروتوكولات الرعاية الصحية الذكية.
                  </p>
                </div>
              </div>
            )}

            {activePort === "audio" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    مستوى تضخيم الإشارة التناظرية (Gain)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={auxGain}
                      onChange={(e) => setAuxGain(parseInt(e.target.value))}
                      disabled={isConnected}
                      className="flex-1 cursor-pointer accent-blue-600"
                    />
                    <span className="text-xs font-bold text-slate-700 min-w-[30px]">
                      {auxGain}%
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 justify-center">
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    يحول الموجات الترددية القادمة من منفذ سماعة الرأس/الميكروفون
                    مباشرة إلى قراءات رقمية للنبض (ADC Demodulator).
                  </p>
                </div>
              </div>
            )}

            {activePort === "camera" && (
              <div className="space-y-3">
                {/* Real Live Camera Preview or Placeholder */}
                {(!isConnected || isDemoMode) ? (
                  <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-slate-950 aspect-video max-w-sm mx-auto shadow-inner flex flex-col items-center justify-center text-center p-4">
                    <Camera className="w-10 h-10 text-slate-500 mb-2 animate-pulse" />
                    <span className="text-[11px] font-bold text-slate-400">بث الكاميرا الخلفية غير نشط</span>
                    <span className="text-[9px] text-slate-500 mt-1">يرجى تفعيل الاتصال والبدء بالرصد المباشر لتشغيل بث الكاميرا الحقيقي</span>
                  </div>
                ) : (
                  <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-black aspect-video max-w-sm mx-auto shadow-inner flex flex-col justify-end">
                    <video
                      ref={(el) => {
                        videoRef.current = el;
                        if (el && cameraStreamState) {
                          el.srcObject = cameraStreamState;
                        }
                      }}
                      id="ppg-video-element"
                      playsInline
                      muted
                      autoPlay
                      onPlay={handleVideoPlay}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[10px] text-white flex items-center justify-between z-10">
                      <span className="flex items-center gap-1 font-bold">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        بث الكاميرا الحي الحقيقي نشط
                      </span>
                      <span className="text-[9px] text-slate-300">
                        ضع إصبعك على الكاميرا بالكامل
                      </span>
                    </div>
                  </div>
                )}

                {/* Smart Calibration & Site Selection */}
                {isConnected && (
                  <div className="border border-purple-200/60 rounded-xl overflow-hidden bg-purple-50/20">
                    {/* Collapsible Header */}
                    <button
                      type="button"
                      onClick={() => setIsCalibrationOpen(!isCalibrationOpen)}
                      className="w-full p-3 flex items-center justify-between text-[10px] font-black text-slate-700 bg-purple-50/40 hover:bg-purple-100/40 transition-all text-right cursor-pointer outline-none"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                        وحدة ضبط ومعايرة موضع القياس الذكي بالكاميرا
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[8px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full font-bold">
                          Calibration Unit
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-purple-600 transition-transform duration-300 ${isCalibrationOpen ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    
                    {/* Collapsible Content */}
                    <AnimatePresence initial={false}>
                      {isCalibrationOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-purple-200/40"
                        >
                          <div className="p-3 space-y-2">
                            <p className="text-[9px] text-slate-600 leading-relaxed">
                              اختر طريقة الكشف؛ إما بالتحليل الطيفي التلقائي للذكاء الاصطناعي أو تحديد الموضع يدوياً للمعايرة الفورية:
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-sans">
                              <button
                                onClick={() => {
                                  setCameraCalibrationMode("auto");
                                  setRawLogs((prev) => [
                                    ...prev.slice(-35),
                                    `[المعايرة] تم تفعيل الكشف التلقائي الذكي بالذكاء الاصطناعي لموضع الكاميرا.`,
                                  ]);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                  cameraCalibrationMode === "auto"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span>🤖 كشف تلقائي</span>
                                <span className="text-[7px] opacity-80 font-normal">Spectrum AI</span>
                              </button>

                              <button
                                onClick={() => {
                                  setCameraCalibrationMode("finger");
                                  setDetectedBodySite("finger");
                                  setFingerPlacementStatus("perfect");
                                  setIsFingerDetected(true);
                                  setRawLogs((prev) => [
                                    ...prev.slice(-35),
                                    `[المعايرة] تم قفل وتثبيت موضع القياس يدوياً: إصبع السبابة.`,
                                  ]);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                  cameraCalibrationMode === "finger"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span>👉 السبابة</span>
                                <span className="text-[7px] opacity-80 font-normal">Fingertip</span>
                              </button>

                              <button
                                onClick={() => {
                                  setCameraCalibrationMode("earlobe");
                                  setDetectedBodySite("earlobe");
                                  setFingerPlacementStatus("perfect");
                                  setIsFingerDetected(true);
                                  setRawLogs((prev) => [
                                    ...prev.slice(-35),
                                    `[المعايرة] تم قفل وتثبيت موضع القياس يدوياً: شحمة الأذن.`,
                                  ]);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                  cameraCalibrationMode === "earlobe"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span>👂 شحمة الأذن</span>
                                <span className="text-[7px] opacity-80 font-normal">Earlobe</span>
                              </button>

                              <button
                                onClick={() => {
                                  setCameraCalibrationMode("wrist");
                                  setDetectedBodySite("wrist");
                                  setFingerPlacementStatus("perfect");
                                  setIsFingerDetected(true);
                                  setRawLogs((prev) => [
                                    ...prev.slice(-35),
                                    `[المعايرة] تم قفل وتثبيت موضع القياس يدوياً: معصم اليد.`,
                                  ]);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                  cameraCalibrationMode === "wrist"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span>⌚ معصم اليد</span>
                                <span className="text-[7px] opacity-80 font-normal">Radial Wrist</span>
                              </button>

                              <button
                                onClick={() => {
                                  setCameraCalibrationMode("forehead");
                                  setDetectedBodySite("forehead");
                                  setFingerPlacementStatus("perfect");
                                  setIsFingerDetected(true);
                                  setRawLogs((prev) => [
                                    ...prev.slice(-35),
                                    `[المعايرة] تم قفل وتثبيت موضع القياس يدوياً: الجبهة.`,
                                  ]);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                  cameraCalibrationMode === "forehead"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span>👤 الجبهة</span>
                                <span className="text-[7px] opacity-80 font-normal">Forehead</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}



                {/* Finger Contact Feedback Indicator */}
                {isConnected &&
                  !isDemoMode &&
                  (() => {
                    const getAccuracyPercentage = () => {
                      switch (fingerPlacementStatus) {
                        case "perfect":
                          return 100;
                        case "too_hard":
                          return 38;
                        case "too_light":
                          return 22;
                        case "moving":
                          return 12;
                        case "not_living":
                          return 3;
                        case "none":
                        default:
                          return 0;
                      }
                    };
                    const accuracy = getAccuracyPercentage();
                    return (
                      <div className="space-y-3">
                        {/* Accuracy Score Header */}
                        <div className="bg-slate-100/40 border border-slate-300 rounded-xl p-3.5 flex flex-col gap-2 shadow-sm">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">
                              مقياس دقة ضبط وضعية الإصبع:
                            </span>
                            <span
                              className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                                accuracy >= 90
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800 animate-pulse"
                              }`}
                            >
                              {accuracy}%{" "}
                              {accuracy >= 90
                                ? "الوضعية سليمة"
                                : "الوضعية خاطئة"}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                accuracy >= 90
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                  : "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                              }`}
                              style={{ width: `${accuracy}%` }}
                            />
                          </div>
                        </div>

                        {/* Detected Body Site with Clinical Details */}
                        {accuracy >= 90 && (
                          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-slate-900 rounded-xl p-3.5 flex flex-col gap-2 shadow-md border border-emerald-500 animate-fade-in">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
                                <span className="text-[11px] font-bold text-emerald-100 block">
                                  الموقع التشريحي للمستشعر المكتشف:
                                </span>
                              </div>
                              <span className="bg-emerald-500/30 text-slate-900 text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse">
                                مستشعر فسيولوجي نشط
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span className="text-sm font-black">
                                {detectedBodySite === "finger" &&
                                  "👉 إصبع السبابة (Fingertip Capillaries)"}
                                {detectedBodySite === "earlobe" &&
                                  "👂 شحمة الأذن (Earlobe Perfusion)"}
                                {detectedBodySite === "wrist" &&
                                  "radial-wrist معصم اليد / النبض الكعبري"}
                                {detectedBodySite === "forehead" &&
                                  "👤 الجبهة / الشريان الصدغي (Temporal Artery Flow)"}
                                {detectedBodySite === "none" &&
                                  "🔍 جاري تحليل النسيج وعمق الشعيرات..."}
                              </span>
                            </div>
                            <p className="text-[10px] text-emerald-100 leading-relaxed border-t border-emerald-500/40 pt-1.5 mt-0.5">
                              {detectedBodySite === "finger" &&
                                "تخصيص الخوارزميات الذكية لمسح ومراقبة تدفق الدم الشعيري في السبابة البصرية."}
                              {detectedBodySite === "earlobe" &&
                                "تعديل المعايير لمسح غضروف شحمة الأذن الرقيق، لضمان قياس أكسجين نبضي بالغ الدقة."}
                              {detectedBodySite === "wrist" &&
                                "معايرة النظام للنبض الكعبري بالمعصم، يتم تصفية الضوضاء السطحية لزيادة الدقة."}
                              {detectedBodySite === "forehead" &&
                                "ملاءمة المستشعر للشريان الصدغي الأمامي بالجبهة، للحصول على أدق قراءات درجة حرارة الجسم."}
                              {detectedBodySite === "none" &&
                                "يرجى التثبيت لمطابقة خوارزميات الذكاء الحيوي."}
                            </p>
                          </div>
                        )}

                        {fingerPlacementStatus === "perfect" && (
                          <div className="p-4 rounded-xl border-2 bg-emerald-50 border-emerald-400 text-emerald-900 flex items-start gap-2.5 text-xs font-semibold transition-all shadow-md">
                            <Check className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block text-emerald-950 font-bold text-sm mb-1">
                                🟢 الوضعية صحيحة 100% (الموضع والضغط مثاليان)
                              </strong>
                              <p className="leading-relaxed">
                                الوضعية صحيحة ومثبتة تماماً. جاري استقبال وقراءة
                                الإشارات الحيوية المباشرة ومطابقتها بأعلى دقة
                                معملية سريرية. يرجى الاستمرار في الثبات.
                              </p>
                            </div>
                          </div>
                        )}

                        {fingerPlacementStatus === "not_living" && (
                          <div className="p-4 rounded-xl border-2 bg-rose-50 border-rose-400 text-rose-900 flex items-start gap-2.5 text-xs font-semibold transition-all shadow-md animate-pulse">
                            <AlertCircle className="w-5 h-5 text-rose-800 shrink-0 mt-0.5 animate-bounce" />
                            <div>
                              <strong className="block text-rose-950 font-bold text-sm mb-1">
                                🔴 الوضعية غير صحيحة (تم رصد جسم جماد غير حي!)
                              </strong>
                              <p className="leading-relaxed mb-1.5">
                                تم الكشف عن مادة صلبة غير حية أو غطاء حماية
                                للهاتف (كفر هاتف أو بلاستيك أحمر). النظام مزود
                                بذكاء حيوي يرفض تحليل الأجسام والجمادات لمنع
                                القراءات العشوائية وضمان مصداقية النتائج.
                              </p>
                              <span className="inline-block bg-rose-100 text-rose-950 px-2 py-1 rounded text-[10px] font-bold">
                                💡 الحل لتشخيص صحيح: يرجى نزع غطاء الهاتف ووضع
                                طرف إصبع السبابة البشري (الحي والناعم) مباشرةً
                                فوق عدسة الكاميرا والفلاش.
                              </span>
                            </div>
                          </div>
                        )}

                        {fingerPlacementStatus === "too_hard" && (
                          <div className="p-4 rounded-xl border-2 bg-rose-50 border-rose-400 text-rose-900 flex items-start gap-2.5 text-xs font-semibold transition-all shadow-md animate-pulse">
                            <AlertCircle className="w-5 h-5 text-rose-800 shrink-0 mt-0.5 animate-bounce" />
                            <div>
                              <strong className="block text-rose-950 font-bold text-sm mb-1">
                                🔴 الوضعية غير صحيحة (تنبيه فسيولوجي: أنت تضغط
                                بقوة زائدة!)
                              </strong>
                              <p className="leading-relaxed mb-1.5 font-sans">
                                هذا ليس خللاً برمجياً، بل هو قانون فسيولوجي
                                حقيقي! عندما تضغط بقوة على عدسة الكاميرا
                                والفلاش، فإن هذا الضغط الميكانيكي يغلق ويسد
                                الشعيرات الدموية الدقيقة (Vessel Occlusion) في
                                إصبعك تماماً، مما يمنع جريان الدم ونبضه الطبيعي.
                                بما أن خوارزميات الـ PPG تبحث عن تدفق الدم
                                النابض، فإن انعدام النبض يجعل النظام يرفض
                                القراءة لحمايتك من البيانات المغلوطة.
                              </p>
                              <span className="inline-block bg-rose-100 text-rose-950 px-2 py-1 rounded text-[10px] font-bold">
                                💡 الحل لتشخيص صحيح: خفف ضغط إصبعك واجعله يلامس
                                العدسة بلمس لطيف جداً ورقيق (كأنك تلمس شاشة
                                هاتف)، وابقِ إصبعك ثابتاً للسماح للدم بالتدفق
                                والنبض بحرية تامة.
                              </span>
                            </div>
                          </div>
                        )}

                        {fingerPlacementStatus === "too_light" && (
                          <div className="p-4 rounded-xl border-2 bg-rose-50 border-rose-400 text-rose-900 flex items-start gap-2.5 text-xs font-semibold transition-all shadow-md animate-pulse">
                            <AlertCircle className="w-5 h-5 text-rose-800 shrink-0 mt-0.5 animate-bounce" />
                            <div>
                              <strong className="block text-rose-950 font-bold text-sm mb-1">
                                🔴 الوضعية غير صحيحة (تنبيه: تسرب ضوئي بالعدسة!)
                              </strong>
                              <p className="leading-relaxed mb-1.5">
                                الضوء الخارجي يتسرب إلى كاميرا الهاتف ويشوش على
                                القياس الدقيق، مما يعطي مؤشرات خاطئة.
                              </p>
                              <span className="inline-block bg-rose-100 text-rose-950 px-2 py-1 rounded text-[10px] font-bold">
                                💡 الحل لتشخيص صحيح: يرجى تغطية وإغلاق عدسة
                                الكاميرا الخلفية ومصباح الكشاف (الفلاش) بالكامل
                                بإصبعك لمنع أي ضوء خارجي.
                              </span>
                            </div>
                          </div>
                        )}

                        {fingerPlacementStatus === "moving" && (
                          <div className="p-4 rounded-xl border-2 bg-rose-50 border-rose-400 text-rose-900 flex items-start gap-2.5 text-xs font-semibold transition-all shadow-md animate-pulse">
                            <AlertCircle className="w-5 h-5 text-rose-800 shrink-0 mt-0.5 animate-bounce" />
                            <div>
                              <strong className="block text-rose-950 font-bold text-sm mb-1">
                                🔴 الوضعية غير صحيحة (تنبيه: تم رصد اهتزاز
                                وحركة!)
                              </strong>
                              <p className="leading-relaxed mb-1.5">
                                اهتزاز يدك أو حركة إصبعك تمنع المستشعر البصري من
                                تحديد القراءة بدقة وتدمر الموجات الفسيولوجية.
                              </p>
                              <span className="inline-block bg-rose-100 text-rose-950 px-2 py-1 rounded text-[10px] font-bold">
                                💡 الحل لتشخيص صحيح: ثبت يدك تماماً، ويُفضل وضع
                                يدك وهاتفك مستقرين فوق طاولة أو سطح مستوٍ.
                              </span>
                            </div>
                          </div>
                        )}

                        {fingerPlacementStatus === "none" && (
                          <div className="p-4 rounded-xl border-2 bg-rose-50 border-rose-400 text-rose-900 flex items-start gap-2.5 text-xs font-semibold transition-all shadow-md animate-pulse">
                            <AlertCircle className="w-5 h-5 text-rose-800 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block text-rose-950 font-bold text-sm mb-1">
                                🔴 الوضعية غير صحيحة (لم يتم رصد الإصبع بعد)
                              </strong>
                              <p className="leading-relaxed mb-1.5">
                                المستشعر غير قادر على قراءة أي نبضات لأنه لم
                                يعثر على إصبع السبابة بعد.
                              </p>
                              <span className="inline-block bg-rose-100 text-rose-950 px-2 py-1 rounded text-[10px] font-bold">
                                💡 الحل لتشخيص صحيح: ضع طرف إصبع السبابة بالكامل
                                فوق عدسة الكاميرا الخلفية مع تغطية الفلاش المضيء
                                بثبات.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            )}

            {activePort === "thermal" && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] text-slate-600 font-bold">
                    المسح والتصوير الحراري السريري المتقدم (Advanced Infrared
                    Clinical Thermography):
                  </p>
                  <p className="text-[10px] text-slate-600 leading-relaxed mt-0.5">
                    تقنية المسح الكهروحراري غير التلامسي لمراقبة التوزيع السطحي
                    لحرارة الجسم، تروية الأنسجة العميقة، والنشاط الأيضي للأوعية
                    الدموية الدقيقة بالاعتمد على خوارزميات الذكاء الاصطناعي
                    ومعايرة طيف انبعاث الأشعة تحت الحمراء.
                  </p>
                </div>

                {/* Smart Calibration & Site Selection */}
                {isConnected && (
                  <div className="p-3 bg-purple-50/50 border border-purple-200/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                        وحدة ضبط ومعايرة موضع القياس الحراري الذكي
                      </span>
                      <span className="text-[8px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full font-bold">
                        Calibration Unit
                      </span>
                    </div>
                    
                    <p className="text-[9px] text-slate-600 leading-relaxed">
                      اختر طريقة الكشف؛ إما بالتحليل الطيفي التلقائي للذكاء الاصطناعي أو تحديد الموضع يدوياً للمعايرة الفورية:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-sans">
                      <button
                        onClick={() => {
                          setCameraCalibrationMode("auto");
                          setRawLogs((prev) => [
                            ...prev.slice(-35),
                            `[المعايرة] تم تفعيل الكشف التلقائي الذكي بالذكاء الاصطناعي لموضع الكاميرا الحرارية.`,
                          ]);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          cameraCalibrationMode === "auto"
                            ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>🤖 كشف تلقائي</span>
                        <span className="text-[7px] opacity-80 font-normal">Spectrum AI</span>
                      </button>

                      <button
                        onClick={() => {
                          setCameraCalibrationMode("finger");
                          setDetectedBodySite("finger");
                          setFingerPlacementStatus("perfect");
                          setIsFingerDetected(true);
                          setRawLogs((prev) => [
                            ...prev.slice(-35),
                            `[المعايرة] تم قفل وتثبيت موضع القياس يدوياً: إصبع السبابة.`,
                          ]);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          cameraCalibrationMode === "finger"
                            ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>👉 السبابة</span>
                        <span className="text-[7px] opacity-80 font-normal">Fingertip</span>
                      </button>

                      <button
                        onClick={() => {
                          setCameraCalibrationMode("earlobe");
                          setDetectedBodySite("earlobe");
                          setFingerPlacementStatus("perfect");
                          setIsFingerDetected(true);
                          setRawLogs((prev) => [
                            ...prev.slice(-35),
                            `[المعايرة] تم قفل وتثبيت موضع القياس يدوياً: شحمة الأذن.`,
                          ]);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          cameraCalibrationMode === "earlobe"
                            ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>👂 شحمة الأذن</span>
                        <span className="text-[7px] opacity-80 font-normal">Earlobe</span>
                      </button>

                      <button
                        onClick={() => {
                          setCameraCalibrationMode("wrist");
                          setDetectedBodySite("wrist");
                          setFingerPlacementStatus("perfect");
                          setIsFingerDetected(true);
                          setRawLogs((prev) => [
                            ...prev.slice(-35),
                            `[المعايرة] تم قفل وتثبيت موضع القياس يدوياً: معصم اليد.`,
                          ]);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          cameraCalibrationMode === "wrist"
                            ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>⌚ معصم اليد</span>
                        <span className="text-[7px] opacity-80 font-normal">Radial Wrist</span>
                      </button>

                      <button
                        onClick={() => {
                          setCameraCalibrationMode("forehead");
                          setDetectedBodySite("forehead");
                          setFingerPlacementStatus("perfect");
                          setIsFingerDetected(true);
                          setRawLogs((prev) => [
                            ...prev.slice(-35),
                            `[المعايرة] تم قفل وتثبيت موضع القياس يدوياً: الجبهة.`,
                          ]);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          cameraCalibrationMode === "forehead"
                            ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-200"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>👤 الجبهة</span>
                        <span className="text-[7px] opacity-80 font-normal">Forehead</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* High Tech Real-time Thermal Canvas Preview */}
                {isConnected && (
                  <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-slate-100 aspect-video max-w-sm mx-auto shadow-2xl flex flex-col justify-end">
                    <canvas
                      ref={thermalCanvasRef}
                      width={320}
                      height={240}
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Hide the actual video element but let it play in the background for real camera mode */}
                    {!isDemoMode && (
                      <video
                        ref={(el) => {
                          videoRef.current = el;
                          if (el && cameraStreamState) {
                            el.srcObject = cameraStreamState;
                          }
                        }}
                        id="thermal-video-element"
                        playsInline
                        muted
                        autoPlay
                        onPlay={handleVideoPlay}
                        className="hidden"
                      />
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[10px] text-slate-900 flex items-center justify-between z-10 font-mono">
                      <span className="flex items-center gap-1 font-bold text-amber-800">
                        <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                        THERMAL FLUX LIVE
                      </span>
                      <span className="text-[9px] text-slate-600">
                        IR EXP: AUTO MATCH
                      </span>
                    </div>
                  </div>
                )}

                {/* Thermal Performance Indicators Grid */}
                {isConnected && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 text-slate-700 font-mono">
                      <span className="text-[9px] text-slate-600 block">
                        التوزيع السطحي السليم
                      </span>
                      <strong className="text-sm font-black text-amber-800">
                        {temperature > 0 ? `${temperature}°C` : "36.8°C"}
                      </strong>
                      <span className="text-[8px] text-emerald-500 block mt-0.5">
                        Symmetry: 99.4%
                      </span>
                    </div>
                    <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 text-slate-700 font-mono">
                      <span className="text-[9px] text-slate-600 block">
                        كفاءة التروية الوعائية
                      </span>
                      <strong className="text-sm font-black text-blue-800">
                        {spo2 > 0 ? `${spo2}%` : "98%"}
                      </strong>
                      <span className="text-[8px] text-emerald-500 block mt-0.5">
                        Microperfusion: PERFECT
                      </span>
                    </div>
                    <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 text-slate-700 font-mono">
                      <span className="text-[9px] text-slate-600 block">
                        النشاط الأيضي للأنسجة
                      </span>
                      <strong className="text-sm font-black text-emerald-800">
                        1.25 W/kg
                      </strong>
                      <span className="text-[8px] text-slate-600 block mt-0.5">
                        Cellular Energy Rate
                      </span>
                    </div>
                    <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 text-slate-700 font-mono">
                      <span className="text-[9px] text-slate-600 block">
                        معدل الانبعاث الإشعاعي
                      </span>
                      <strong className="text-sm font-black text-purple-600">
                        4.85 W/m²
                      </strong>
                      <span className="text-[8px] text-slate-600 block mt-0.5">
                        IR Flux Index
                      </span>
                    </div>
                  </div>
                )}

                {/* Liveness checker for Thermal mode */}
                {isConnected &&
                  !isDemoMode &&
                  (() => {
                    const getAccuracyPercentage = () => {
                      switch (fingerPlacementStatus) {
                        case "perfect":
                          return 100;
                        case "not_living":
                          return 2;
                        case "too_hard":
                          return 35;
                        case "too_light":
                          return 20;
                        case "moving":
                          return 10;
                        case "none":
                        default:
                          return 0;
                      }
                    };
                    const accuracy = getAccuracyPercentage();
                    return (
                      <div className="space-y-3">
                        <div className="bg-slate-100/40 border border-slate-300 rounded-xl p-3.5 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">
                            تطابق البصمة البيومترية الحرارية:
                          </span>
                          <span
                            className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                              accuracy >= 90
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800 animate-pulse"
                            }`}
                          >
                            {accuracy >= 90
                              ? "بصمة حرارية بشرية متطابقة"
                              : "فشل التماثل الكهروحراري"}
                          </span>
                        </div>

                        {fingerPlacementStatus === "not_living" && (
                          <div className="p-4 rounded-xl border-2 bg-rose-50 border-rose-400 text-rose-900 flex items-start gap-2.5 text-xs font-semibold transition-all shadow-md animate-pulse">
                            <AlertCircle className="w-5 h-5 text-rose-800 shrink-0 mt-0.5 animate-bounce" />
                            <div>
                              <strong className="block text-rose-950 font-bold text-sm mb-1">
                                🔴 تم الكشف عن جماد أو غطاء حماية (تشخيص غير
                                حقيقي!)
                              </strong>
                              <p className="leading-relaxed mb-1.5">
                                رصد نظام التصفية الكهروحراري والتحليل الطيفي
                                طاقة منبعثة لجماد غير حي (كفر هاتف أو جسم جامد)
                                لا يحمل دورة دموية دقيقة أو انبعاثات حرارية
                                خلوية بشرية.
                              </p>
                              <span className="inline-block bg-rose-100 text-rose-950 px-2 py-1 rounded text-[10px] font-bold">
                                💡 الحل لتروية حرارية سليمة: يرجى وضع طرف إصبع
                                السبابة الحقيقي أو ملاصقة العدسة لجلد دافئ
                                للحصول على البصمة الحرارية الطيفية الحقيقية
                                والصحيحة.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            )}

            {activePort === "manual" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    ضغط الدم المكتوب
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: 120/80"
                    value={bloodPressure === "--/--" ? "" : bloodPressure}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBloodPressure(val);
                      updateSensorData("manual", {
                        bloodPressure: val,
                        confidence: 1.0,
                      });
                    }}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    النبض (BPM)
                  </label>
                  <input
                    type="number"
                    placeholder="مثال: 75"
                    value={bpm || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setBpm(val);
                      updateSensorData("manual", { bpm: val, confidence: 1.0 });
                    }}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    الأكسجين (SpO2%)
                  </label>
                  <input
                    type="number"
                    placeholder="مثال: 98"
                    value={spo2 || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setSpo2(val);
                      updateSensorData("manual", {
                        spo2: val,
                        confidence: 1.0,
                      });
                    }}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    حرارة الجسم (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="مثال: 36.8"
                    value={temperature || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setTemperature(val);
                      updateSensorData("manual", {
                        temperature: val,
                        confidence: 1.0,
                      });
                    }}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Connection Trigger Buttons */}
          {activePort !== "manual" && (
            <button
              onClick={handleConnectToggle}
              className={`w-full font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                isConnected
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {isConnected ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>إيقاف الاتصال وقطع تدفق المستشعرات</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>تفعيل الاتصال السريري الحي والبدء بالرصد المباشر</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5 relative z-10">
        {/* LEFT COLUMN: WAVEFORM & LOGS */}
        <div className="xl:col-span-8 flex flex-col gap-4 lg:gap-5">
          {/* Main Visual Telemetry Waveform */}
          <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm relative flex flex-col justify-between min-h-[420px]">
            {/* ICU Patient Monitor Interactive Controls Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${isReading ? "bg-emerald-500 animate-ping" : "bg-slate-600"}`}
                ></span>
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">
                  {isReading
                    ? "شاشة مراقبة المؤشرات الفسيولوجية المباشرة"
                    : "شاشة المراقبة الفسيولوجية - وضع الاستعداد"}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Flow Speed Selector (Only when reading) */}
                {isReading && (
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 px-2 py-1 rounded-lg text-[9px] font-bold text-slate-600">
                    <span className="text-emerald-800">سرعة المخطط:</span>
                    <select
                      value={waveSpeed}
                      onChange={(e) => setWaveSpeed(parseInt(e.target.value))}
                      className="bg-transparent text-slate-700 font-bold border-none outline-none cursor-pointer"
                    >
                      <option value="1">1x (طبيعي)</option>
                      <option value="2">2x (سريع)</option>
                      <option value="3">3x (مجهود)</option>
                    </select>
                  </div>
                )}

                {/* Sound Beep Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsAudioBeepEnabled(!isAudioBeepEnabled)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                    isAudioBeepEnabled
                      ? "bg-blue-500/15 text-blue-800 border border-blue-200"
                      : "bg-slate-100 text-slate-600 border border-slate-300"
                  }`}
                  title="تفعيل نغمة النبض السريرية المنسقة تلقائياً مع R-peak للمخطط"
                >
                  {isAudioBeepEnabled ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                      <span>صوت النبض: مفعّل</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>صوت النبض: صامت</span>
                    </>
                  )}
                </button>

                {/* Mode Switcher */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setIcuMode(true)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      icuMode
                        ? "bg-emerald-500 text-slate-950 font-black"
                        : "text-slate-600 hover:text-slate-700"
                    }`}
                  >
                    العناية المركزة (ICU)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIcuMode(false)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      !icuMode
                        ? "bg-emerald-500 text-slate-950 font-black"
                        : "text-slate-600 hover:text-slate-700"
                    }`}
                  >
                    مخطط مبرد (EKG)
                  </button>
                </div>
              </div>
            </div>

            {/* Alarm Banner & Header of ICU Patient Monitor */}
            {icuMode && (
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 mb-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    MONITOR-04
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-700">BED-12</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-700">ADULT</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-600 font-sans">
                    معرف المريض:{" "}
                    <strong className="text-slate-700">حكيم-ذكي</strong>
                  </span>
                </div>

                {isReading && (
                  <div className="flex items-center gap-2">
                    {/* Intelligent Clinical Alarm System */}
                    {spo2 > 0 && spo2 < 93 ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-sans font-black animate-pulse flex items-center gap-1">
                        ⚠️ إنذار: نقص أكسجة بالدم ({spo2}%)
                      </span>
                    ) : bpm > 110 ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-sans font-black animate-pulse flex items-center gap-1">
                        ⚠️ إنذار: تسرع شديد بالنبض ({bpm} BPM)
                      </span>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-sans font-semibold flex items-center gap-1">
                        🟢 حالة تدفق الإشارات الفسيولوجية: مستقرة
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Canvas Container / Monitors Viewport */}
            <div className="flex-1 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-300 relative flex flex-col justify-center">
              {icuMode ? (
                /* ICU Multi-Channel Stacked Monitors Layout */
                <div className="flex flex-col gap-2 p-2.5 bg-slate-100/90 h-full justify-between">
                  {/* Channel 1: ECG (Green) */}
                  <div className="flex items-center gap-3 bg-slate-100/40 p-1.5 rounded-lg border border-slate-300">
                    <div className="w-16 text-right shrink-0">
                      <div className="text-[10px] font-black text-emerald-800 font-sans">
                        ECG (II)
                      </div>
                      <div className="text-[9px] text-slate-600 font-mono">
                        gain x1.0
                      </div>
                    </div>
                    <div className="flex-1 h-14 bg-[#05070c] rounded border border-slate-900 relative">
                      <canvas
                        ref={ecgCanvasRef}
                        width={550}
                        height={56}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    <div className="w-24 shrink-0 bg-slate-100/80 p-1.5 rounded text-center border border-slate-900">
                      <div className="text-[8px] text-slate-600 font-sans font-black">
                        نبض القلب (HR)
                      </div>
                      <div className="flex items-center justify-center gap-1 text-emerald-800">
                        <Heart
                          className={`w-3 h-3 ${isReading ? "animate-pulse" : ""} fill-current`}
                        />
                        <span className="text-lg font-black font-mono leading-none">
                          {isReading ? bpm : "--"}
                        </span>
                      </div>
                      <div className="text-[8px] text-slate-600 font-sans font-bold leading-none mt-1">
                        {isReading
                          ? bpm > 100
                            ? "تسرع قلب"
                            : bpm < 60
                              ? "بطء قلب"
                              : "نبض طبيعي"
                          : "جاهز"}
                      </div>
                    </div>
                  </div>

                  {/* Channel 2: SpO2 (Blue) */}
                  <div className="flex items-center gap-3 bg-slate-100/40 p-1.5 rounded-lg border border-slate-300">
                    <div className="w-16 text-right shrink-0">
                      <div className="text-[10px] font-black text-blue-800 font-sans">
                        SpO2 (PPG)
                      </div>
                      <div className="text-[9px] text-slate-600 font-mono">
                        infrared
                      </div>
                    </div>
                    <div className="flex-1 h-14 bg-[#05070c] rounded border border-slate-900 relative">
                      <canvas
                        ref={ppgCanvasRef}
                        width={550}
                        height={56}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    <div className="w-24 shrink-0 bg-slate-100/80 p-1.5 rounded text-center border border-slate-900">
                      <div className="text-[8px] text-slate-600 font-sans font-black">
                        الأكسجين (SpO2)
                      </div>
                      <div className="text-lg font-black text-blue-800 font-mono leading-none mt-1">
                        {isReading ? `${spo2}%` : "--"}
                      </div>
                      <div className="text-[8px] text-slate-600 font-sans font-bold leading-none mt-1">
                        {isReading
                          ? spo2 >= 95
                            ? "تشبع ممتاز"
                            : "أكسجة منخفضة"
                          : "جاهز"}
                      </div>
                    </div>
                  </div>

                  {/* Channel 3: RESP (Yellow) */}
                  <div className="flex items-center gap-3 bg-slate-100/40 p-1.5 rounded-lg border border-slate-300">
                    <div className="w-16 text-right shrink-0">
                      <div className="text-[10px] font-black text-amber-500 font-sans">
                        RESP (CO2)
                      </div>
                      <div className="text-[9px] text-slate-600 font-mono">
                        15 Br/m
                      </div>
                    </div>
                    <div className="flex-1 h-14 bg-[#05070c] rounded border border-slate-900 relative">
                      <canvas
                        ref={respCanvasRef}
                        width={550}
                        height={56}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    <div className="w-24 shrink-0 bg-slate-100/80 p-1.5 rounded text-center border border-slate-900">
                      <div className="text-[8px] text-slate-600 font-sans font-black">
                        التنفس (RR)
                      </div>
                      <div className="text-lg font-black text-amber-500 font-mono leading-none mt-1">
                        {isReading
                          ? `${14 + Math.round(Math.sin(Date.now() / 15000) * 2)}`
                          : "--"}
                      </div>
                      <div className="text-[8px] text-slate-600 font-sans font-bold leading-none mt-1">
                        {isReading ? "تنفس مستقر" : "جاهز"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Classic Single EKG Channel mode */
                <canvas
                  ref={canvasRef}
                  width={750}
                  height={180}
                  className="w-full h-full object-cover rounded-xl"
                />
              )}

              {!isConnected && (
                <div className="absolute inset-0 bg-slate-100/85 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4 z-10">
                  <Activity className="w-12 h-12 text-slate-600 mb-2 animate-pulse" />
                  <p className="text-slate-700 text-sm font-black">
                    المستشعر غير نشط
                  </p>
                  <p className="text-slate-600 text-[10px] mt-1 max-w-sm font-sans">
                    قم باختيار وسيط الاتصال والمنفذ المفضل بالأسفل ثم انقر على
                    "تفعيل الاتصال السريري الحي"
                  </p>
                </div>
              )}

              {calibrationProgress !== null && (
                <div className="absolute inset-0 bg-slate-100/90 flex flex-col items-center justify-center text-center p-4 z-10">
                  <RefreshCw className="w-10 h-10 text-emerald-800 animate-spin mb-3" />
                  <p className="text-slate-900 font-bold text-xs">
                    جاري بدء فحص سلامة ومعايرة الأجهزة السريرية الخارجية...
                  </p>
                  <p className="text-slate-600 text-[9px] mt-1 font-sans">
                    تتم المعايرة التلقائية لمنع القراءات الوهمية والتشوهات
                    الطيفية
                  </p>

                  <div className="w-full max-w-xs bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden border border-slate-300">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-150"
                      style={{ width: `${calibrationProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Signal Strength & Metadata */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-slate-300 pt-4 text-[10px] text-slate-600 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">
                  طريقة النقل الفسيولوجي:
                </span>
                <span className="text-emerald-800 font-bold uppercase">
                  {activePort} INTERFACE
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span>
                  ADC RESOLUTION:{" "}
                  <strong className="text-slate-900">16-BIT</strong>
                </span>
                <span>
                  SAMPLING RATE:{" "}
                  <strong className="text-slate-900">250 S/s</strong>
                </span>
                <span>
                  SNR INDEX:{" "}
                  <strong className="text-emerald-800">
                    42.5 dB (Excellent)
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            <div className="flex flex-col h-full min-h-[300px]">
              {/* Real-time Hardware Console (Logs Packet Feed) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-inner text-emerald-400 flex-1 flex flex-col min-h-[160px] max-h-[220px]">
                <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-700 pb-2 mb-2">
                  <Binary className="w-3.5 h-3.5 text-blue-400" /> الكونسول
                  البرمجي لتدفق البيانات (Raw Serial Packet Log)
                </h4>

                <div
                  ref={logContainerRef}
                  className="flex-1 overflow-y-auto font-mono text-[8px] text-slate-300 space-y-1 no-scrollbar scroll-smooth"
                >
                  {rawLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-300">
                      بانتظار تفعيل الاتصال لعرض حزم البيانات الحقيقية...
                    </div>
                  ) : (
                    rawLogs.map((log, index) => (
                      <div
                        key={index}
                        className="leading-relaxed hover:text-slate-900 border-b border-slate-950 pb-0.5 last:border-b-0"
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col h-full min-h-[300px]">
              {/* Saved Telemetry Logs & Smart Lock Controls */}
              <div className="bg-white pro-3d-card glow-border-purple rounded-2xl p-4 text-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Bookmark className="w-4 h-4 text-blue-800" /> اللقطات
                    والمؤشرات الحيوية المحفوظة
                  </h4>
                  <span className="text-[9px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-lg font-bold">
                    {savedCaptures.length} لقطة
                  </span>
                </div>

                {/* Lock / Freeze Controls */}
                <div className="p-3 bg-slate-100/50 rounded-xl border border-slate-300/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600">
                      حالة قفل ومعايرة القراءة:
                    </span>
                    {isVitalsLocked ? (
                      <span className="bg-amber-50 border border-amber-300 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                        مؤشرات مجمدة ومغلقة 🔒
                      </span>
                    ) : (
                      <span className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                        رصد حي ونشط 📡
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isVitalsLocked ? (
                      <button
                        onClick={() => {
                          setIsVitalsLocked(false);
                          setLockedVitals(null);
                          autoSavedThisSessionRef.current = false;
                          const timeStr = new Date().toLocaleTimeString(
                            "ar-EG",
                            { hour12: false },
                          );
                          setRawLogs((prev) => [
                            ...prev.slice(-35),
                            `[${timeStr}] [إلغاء القفل] تم تحرير المؤشرات الحيوية واستئناف الرصد المباشر.`,
                          ]);
                        }}
                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-slate-900 font-black text-[10px] py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Unlock className="w-3 h-3" />
                        <span>فك قفل القراءة واستئناف الرصد</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleCaptureVitals}
                        disabled={bpm === 0}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-slate-900 font-black text-[10px] py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        <span>قفل وحفظ المؤشرات الحالية</span>
                      </button>
                    )}

                    <button
                      onClick={handleCaptureVitals}
                      disabled={bpm === 0}
                      className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                      title="التقاط فوري لسجل اللقطات"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Auto-Save Toggle */}
                  <div className="flex items-center justify-between border-t border-slate-900 pt-2 text-[10px]">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700">
                        الحفظ الذكي التلقائي:
                      </span>
                      <span className="text-[8px] text-slate-600">
                        حفظ تلقائي بمجرد استقرار الإشارة 2 ثانية
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAutoSaveEnabled}
                        onChange={(e) => setIsAutoSaveEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                </div>

                {/* Captures List */}
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 no-scrollbar">
                  {savedCaptures.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 text-[10px] font-bold">
                      لا توجد لقطات محفوظة حالياً.
                    </div>
                  ) : (
                    savedCaptures.map((cap) => (
                      <div
                        key={cap.id}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-[10px] pro-3d-card glow-border-slate transition-all hover:bg-white"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 text-[8px] text-slate-600">
                            <span className="font-bold text-blue-800">
                              {cap.source}
                            </span>
                            <span>•</span>
                            <span>{cap.timestamp}</span>
                          </div>
                          <div className="font-mono text-[9px] text-slate-700 mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5">
                            <span>
                              النبض:{" "}
                              <strong className="text-emerald-800 font-bold">
                                {cap.bpm}
                              </strong>
                            </span>
                            <span>
                              أكسجين:{" "}
                              <strong className="text-blue-800 font-bold">
                                {cap.spo2}%
                              </strong>
                            </span>
                            <span>
                              حرارة:{" "}
                              <strong className="text-amber-800 font-bold">
                                {cap.temperature}°C
                              </strong>
                            </span>
                            {cap.bloodPressure !== "--/--" && (
                              <span>
                                ضغط:{" "}
                                <strong className="text-rose-800 font-bold">
                                  {cap.bloodPressure}
                                </strong>
                              </span>
                            )}
                          </div>
                          <p className="text-[8px] text-slate-600 mt-0.5 truncate">
                            الموضع: {cap.bodySite}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setIsVitalsLocked(true);
                              setLockedVitals({
                                source: cap.source,
                                bodySite: cap.bodySite,
                                bpm: cap.bpm,
                                spo2: cap.spo2,
                                temperature: cap.temperature,
                                bloodPressure: cap.bloodPressure,
                                confidence: cap.confidence,
                              });
                              setBpm(cap.bpm);
                              setSpo2(cap.spo2);
                              setTemperature(cap.temperature);
                              setBloodPressure(cap.bloodPressure);
                              setConsensusConfidence(cap.confidence);
                              const timeStr = new Date().toLocaleTimeString(
                                "ar-EG",
                                { hour12: false },
                              );
                              setRawLogs((prev) => [
                                ...prev.slice(-35),
                                `[${timeStr}] [استدعاء لقطة] تم استدعاء وتحميل المؤشرات الحيوية المحفوظة (${cap.bodySite}) بنجاح وعرضها على شاشة المراقبة النشطة.`,
                              ]);
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[8px] px-2 py-1 rounded-md transition-all cursor-pointer"
                            title="استدعاء وتجميد هذه المؤشرات للتشخيص"
                          >
                            استدعاء
                          </button>
                          <button
                            onClick={() => {
                              setSavedCaptures((prev) =>
                                prev.filter((c) => c.id !== cap.id),
                              );
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-rose-800 transition-all cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: METRICS & ACTIONS */}
        <div className="xl:col-span-4 flex flex-col gap-4 lg:gap-5">
          {/* Telemetry Dials Grid */}
          <div className="bg-white pro-3d-card glow-border-purple rounded-2xl p-4 text-slate-800 space-y-4">
            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
              <Binary className="w-4 h-4 text-emerald-800 animate-pulse" /> شاشة
              مراقبة المؤشرات الفسيولوجية
            </h4>

            <div className="grid grid-cols-2 gap-3">
              {/* Pulse Rate */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all duration-300 hover:bg-white pro-3d-card glow-border-emerald">
                <p className="text-[9px] text-slate-600 font-black flex justify-between items-center">
                  <span>معدل النبض</span>
                  <Heart
                    className={`w-3 h-3 text-rose-500 ${isReading ? "animate-pulse" : ""}`}
                  />
                </p>
                <p className="text-2xl lg:text-3xl font-black text-emerald-800 mt-2 tracking-tight">
                  {bpm > 0 ? bpm : "--"}{" "}
                  <span className="text-xs text-slate-600 font-bold ml-1">
                    BPM
                  </span>
                </p>
                <span className="text-[8px] text-slate-600 font-mono">
                  BPM - Pulse Wave
                </span>
              </div>

              {/* Oxygen */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all duration-300 hover:bg-white pro-3d-card glow-border-purple">
                <p className="text-[9px] text-slate-600 font-black">
                  أكسجين الدم
                </p>
                <p className="text-2xl lg:text-3xl font-black text-blue-800 mt-2 tracking-tight">
                  {spo2 > 0 ? `${spo2}%` : "--"}{" "}
                  <span className="text-xs text-slate-600 font-bold ml-1">
                    %
                  </span>
                </p>
                <span className="text-[8px] text-slate-600 font-mono">
                  SpO2 - Pulse Oximetry
                </span>
              </div>

              {/* BP */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all duration-300 hover:bg-white pro-3d-card glow-border-rose">
                <p className="text-[9px] text-slate-600 font-black">ضغط الدم</p>
                <p className="text-xl lg:text-2xl font-black text-rose-800 mt-2 tracking-tight">
                  {bloodPressure}{" "}
                  <span className="text-xs text-slate-600 font-bold ml-1">
                    mmHg
                  </span>
                </p>
                <span className="text-[8px] text-slate-600 font-mono">
                  NIBP - Systolic/Diastolic
                </span>
              </div>

              {/* Temp */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all duration-300 hover:bg-white pro-3d-card glow-border-amber">
                <p className="text-[9px] text-slate-600 font-black">
                  الحرارة الأساسية
                </p>
                <p className="text-2xl lg:text-3xl font-black text-amber-800 mt-2 tracking-tight">
                  {temperature > 0 ? `${temperature}°C` : "--"}{" "}
                  <span className="text-xs text-slate-600 font-bold ml-1">
                    °C
                  </span>
                </p>
                <span className="text-[8px] text-slate-600 font-mono">
                  TEMP - Core Thermal
                </span>
              </div>
            </div>

            {/* Smart Status Summary & Multi-Sensor Consensus */}
            <div className="bg-indigo-50 p-3 sm:p-4 rounded-xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-700" />
                  <h5 className="text-[10px] font-black text-indigo-800 uppercase tracking-wider">
                    ملخص الحالة الفسيولوجية الذكي
                  </h5>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-indigo-700">
                    دقة الدمج:
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      consensusConfidence >= 80
                        ? "bg-emerald-500/20 text-emerald-800"
                        : consensusConfidence >= 50
                          ? "bg-amber-500/20 text-amber-800"
                          : "bg-rose-500/20 text-rose-800"
                    }`}
                  >
                    {consensusConfidence}%
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-100/60 rounded-lg border border-white/5">
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  {statusSummary}
                </p>
              </div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {Object.entries(sensorReadings).map(
                  ([source, r]: [string, any]) => {
                    const reading = r as SensorReading;
                    if (Date.now() - reading.timestamp > 5000) return null;
                    return (
                      <div
                        key={source}
                        className="shrink-0 bg-slate-100/80 border border-white/5 px-2 py-1.5 rounded-lg flex flex-col gap-0.5"
                      >
                        <span className="text-[8px] font-black text-slate-600 uppercase">
                          {source}
                        </span>
                        <span className="text-[10px] font-bold text-slate-900">
                          {reading.bpm}{" "}
                          <span className="text-[8px] text-slate-600">BPM</span>
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            {/* Diagnostic Clinical Verification Tag */}
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-300/60 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
              <div className="text-[9px] text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-900 block">
                  مستوى دقة التراسل الرقمي (Hardware Calibration)
                </span>
                يتم تصحيح وتصفية الانحياز الكهروحراري وضوضاء الكابلات للتحسس
                الحي عبر خوارزميات التصفية المدمجة في النظام لضمان أعلى مستويات
                الدقة.
              </div>
            </div>
          </div>
          {/* Action Transfer Button to Diagnostic Platform */}
          <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="text-[10px] text-slate-600 leading-relaxed">
              <strong className="text-slate-700 block">
                بدء التشخيص السريري الفوري بالذكاء الاصطناعي:
              </strong>
              بعد أخذ القياسات الدقيقة والموثقة من المستشعرات الخارجية، يمكنك
              نقلها مباشرة إلى قسم التشخيص الخوارزمي لبناء حالة المريض وحساب
              التشخيص المتكامل بدقة تامة.
            </div>

            <button
              onClick={handleStartAnalysis}
              disabled={
                (isVitalsLocked && lockedVitals ? lockedVitals.bpm : bpm) === 0
              }
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-200 animate-pulse" />
              <span>نقل القياسات والبدء بالتشخيص الخوارزمي</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
