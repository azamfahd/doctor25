
export enum AIPersonality {
  SIMPLE = 'مبسط للمريض',
  TECHNICAL = 'تقني للمتخصصين',
  EMPATHETIC = 'متعاطف وداعم'
}

export enum ModelType {
  PRO = 'gemini-3.1-pro-preview',
  FLASH = 'gemini-3.5-flash',
  FLASH_3_6 = 'gemini-3.6-flash',
  PRO_3_5 = 'gemini-3.5-pro',
  FLASH_3_5 = 'gemini-3.5-flash',
  PRO_2_5 = 'gemini-2.5-pro',
  FLASH_2_5 = 'gemini-2.5-flash',
  PRO_1_5 = 'gemini-1.5-pro',
  LITE = 'gemini-3.1-flash-lite-preview',
  IMAGE_PRO = 'gemini-3-pro-image-preview',
  AUDIO_NATIVE = 'gemini-3.1-flash-live-preview'
}

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

export interface VitalSigns {
  bloodPressure: string;
  pulse: string;
  temperature: string;
  spo2: string;
  bodySite?: string;
  livenessChecked?: boolean;
  livenessReport?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  images?: string[];
  audioData?: string;
}

export interface DifferentialDiagnosis {
  condition: string;
  probability: number;
  reasoning: string;
  symptoms?: string[];
  causes?: string[];
}

export interface StructuredDiagnosis {
  summary: string;
  conditionName: string;
  conditionSymptoms?: string[];
  conditionCauses?: string[];
  severity: 'منخفضة' | 'متوسطة' | 'مرتفعة' | 'حرجة';
  severityReasoning: string;
  confidenceScore: number;
  detailedAnalysis: string;
  imageFindings?: string;
  specialistReferral?: string;
  differentialDiagnosis: DifferentialDiagnosis[];
  recommendations: string[];
  suggestedTests: string[];
  urgentWarnings: string[];
  treatmentPlan: string[];
  dietaryAdvice: string[];
  herbalMedicine?: string[];
  physicalTherapy: string[];
  lifestyleChanges: string[];
  preventionTips: string[];
  generalInfo: string;
  labResultsAnalysis?: string;
}

export interface PatientCase {
  id: string;
  name: string;
  age: string;
  gender: 'ذكر' | 'أنثى';
  symptoms: string;
  vitals: VitalSigns;
  images?: string[];
  diagnosis?: StructuredDiagnosis;
  chatHistory?: ChatMessage[];
  date: string;
  status: 'مستقرة' | 'متابعة' | 'تدخل طبي' | 'حرجة';
}

export interface SystemSettings {
  centerName: string;
  doctorName: string;
  personality: AIPersonality;
  model: ModelType;
  deepThinking: boolean;
  thinkingBudget: number; // قيمة رقمية لميزانية التفكير
  googleSearch: boolean; // تفعيل البحث في جوجل
  theme: ThemeMode;
  autoSave: boolean;
  voiceEnabled: boolean;
  voiceOutputEnabled: boolean;
  apiKey?: string;
}
