import { GoogleGenAI } from "@google/genai";
import { SystemSettings, PatientCase, StructuredDiagnosis, ModelType } from '../types.ts';
import { getApiBaseUrl } from '../utils/urlHelper';

const cleanJsonResponse = (text: string): string => {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
};

export const getAI = (settings?: SystemSettings) => {
  const envKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined;
  const apiKey = settings?.apiKey || envKey;
  
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

// NOTE: System instructions and prompt construction logic have been moved to server.ts 
// to ensure secure and consistent execution across all client instances.

/* =========================================================================
   AUTONOMOUS CLINICAL MODEL & REASONING ORCHESTRATOR
   ========================================================================= */

export const resolveSmartClinicalModelAndBudget = (
  patientData: Partial<PatientCase>,
  settings?: SystemSettings
): {
  modelName: string;
  thinkingBudget: number;
  reasoningMode: string;
  capabilities: string[];
} => {
  const hasImages = patientData?.images && Array.isArray(patientData.images) && patientData.images.length > 0;
  const symptomsText = ((patientData?.symptoms || '') + ' ' + (patientData?.notes || '') + ' ' + (patientData?.medicalHistory || '')).toLowerCase();
  const hasLabKeywords = /(تحليل|مختبر|فحص|cbc|creatinine|blood sugar|glucose|ecg|troponin|alt|ast|inr|wbc|crp|esr|رنين|أشعة|x-ray|ct scan|mri|sonar|ultrasound)/i.test(symptomsText);
  
  const vitals: any = patientData?.vitals || {};
  const isHighRiskVitals = 
    (vitals.spo2 && parseInt(vitals.spo2) < 92) ||
    (vitals.pulse && (parseInt(vitals.pulse) > 120 || parseInt(vitals.pulse) < 50)) ||
    (vitals.temperature && parseFloat(vitals.temperature) >= 39);

  const isAuto = !settings?.model || settings.model === ModelType.AUTO || settings.autoModelRouting !== false;

  if (isAuto) {
    if (hasImages) {
      return {
        modelName: 'gemini-3.1-pro-preview',
        thinkingBudget: 24576,
        reasoningMode: 'فحص إشعاعي وبصري متعدد الوسائط واستدلال سريري عالي الدقة',
        capabilities: ['فحص بصري شعاعي عميق', 'مقارنة فسيولوجية للمورفولوجيا', 'استدلال تفريقي متقدم']
      };
    } else if (hasLabKeywords || isHighRiskVitals || symptomsText.length > 200) {
      return {
        modelName: 'gemini-3.1-pro-preview',
        thinkingBudget: 20480,
        reasoningMode: 'استدلال سريري عميق، تحليل تقارير مخبرية وتفريق مرضي دقيق',
        capabilities: ['تحليل فسيولوجي للتحاليل', 'استبعاد الأمراض المشابهة', 'تخصيص البروتوكول العلاجي']
      };
    } else {
      return {
        modelName: 'gemini-3.1-pro-preview',
        thinkingBudget: 16384,
        reasoningMode: 'تقييم سريري استشاري شامل وطب قائم على الدليل',
        capabilities: ['تحليل توازني متقدم', 'صياغة توصيات مبسطة للمريض', 'تقييم درجة الخطورة']
      };
    }
  }

  // Manual fallback if auto routing is explicitly turned off
  let modelName = 'gemini-3.1-pro-preview';
  if (settings.model.includes('pro')) {
    modelName = 'gemini-3.1-pro-preview';
  } else if (settings.model.includes('lite')) {
    modelName = 'gemini-3.1-flash-lite';
  } else {
    modelName = 'gemini-3.8-flash';
  }

  return {
    modelName,
    thinkingBudget: settings.thinkingBudget || 16384,
    reasoningMode: 'الوضع اليدوي المحدد',
    capabilities: ['تطبيق الإعدادات المحددة يدوياً']
  };
};

/* =========================================================================
   SERVER-SIDE API EXECUTION (REQUIRES INTERNET CONNECTION)
   ========================================================================= */

export const analyzeMedicalCase = async (
  patientData: Partial<PatientCase>,
  settings: SystemSettings
): Promise<{ diagnosis: StructuredDiagnosis, sources: any[] }> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/analyze-case`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientData, settings })
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "CONNECTION_FAILED");
  } catch (e: any) {
    console.error("Clinical analysis failed:", e);
    throw new Error(e.message === "CONNECTION_FAILED" ? "CONNECTION_FAILED" : "CONNECTION_FAILED");
  }
};

export const consolidateMedicalCases = async (
  cases: PatientCase[],
  settings: SystemSettings
): Promise<{ synthesis: string }> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/consolidate-cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cases, settings })
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "CONNECTION_FAILED");
  } catch (e: any) {
    console.error("Cases consolidation failed:", e);
    throw new Error("CONNECTION_FAILED");
  }
};

export const startFollowUpChat = (patient: PatientCase, settings: SystemSettings, fallbackModelOverride?: string): any => {
  let history = patient.chatHistory || [];

  return {
    async sendMessageStream({ message }: { message: any }) {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/chat-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient,
            settings,
            history,
            messageContent: message,
            fallbackModelOverride
          })
        });

        if (response.ok) {
          const data = await response.json();
          const fullText = data.text || "";

          const userText = typeof message === "string" ? message : (Array.isArray(message) ? message.find(p => p.text)?.text || "مرفق" : "مرفق");
          history.push({
            role: "user",
            text: userText,
            timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
          });
          history.push({
            role: "model",
            text: fullText,
            timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
          });

          return {
            async *[Symbol.asyncIterator]() {
              const chunks: string[] = [];
              let i = 0;
              while (i < fullText.length) {
                const len = Math.min(Math.floor(Math.random() * 8) + 4, fullText.length - i);
                chunks.push(fullText.slice(i, i + len));
                i += len;
              }
              for (const chunk of chunks) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 12 + 4));
                yield { text: chunk };
              }
            }
          };
        }
        
        throw new Error("CONNECTION_FAILED");
      } catch (err) {
        console.error("Chat message failed:", err);
        throw new Error("CONNECTION_FAILED");
      }
    }
  };
};

export const generateSpeech = async (text: string, settings?: SystemSettings, voiceName?: string): Promise<string> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/generate-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, settings, voiceName })
    });

    if (response.ok) {
      const data = await response.json();
      return data.audioData || "";
    }
    
    throw new Error("Speech API call failed");
  } catch (err) {
    console.warn("Backend API call for speech generation failed.", err);
    return "";
  }
};
