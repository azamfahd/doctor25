
export enum AIPersonality {
  SIMPLE = 'مبسط للمريض',
  TECHNICAL = 'تقني للمتخصصين',
  EMPATHETIC = 'متعاطف وداعم'
}

export enum ModelType {
  AUTO = 'auto',
  PRO = 'gemini-3.1-pro-preview',
  FLASH = 'gemini-3.8-flash',
  FLASH_3_6 = 'gemini-3.8-flash',
  PRO_3_5 = 'gemini-3.1-pro-preview',
  FLASH_3_5 = 'gemini-3.8-flash',
  PRO_2_5 = 'gemini-3.1-pro-preview',
  FLASH_2_5 = 'gemini-3.8-flash',
  PRO_1_5 = 'gemini-3.1-pro-preview',
  LITE = 'gemini-3.1-flash-lite',
  IMAGE_PRO = 'gemini-3.1-pro-preview',
  AUDIO_NATIVE = 'gemini-3.8-live'
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
  medicalHistory?: string;
  notes?: string;
  status: 'مستقرة' | 'متابعة' | 'تدخل طبي' | 'حرجة';
  syncedWithCloud?: boolean;
  localUpdatedAt?: string;
}

export interface SystemSettings {
  centerName: string;
  doctorName: string;
  personality: AIPersonality;
  model: ModelType;
  autoModelRouting?: boolean; // التوجيه الذكي التلقائي للنموذج وميزانية التفكير
  deepThinking: boolean;
  thinkingBudget: number; // قيمة رقمية لميزانية التفكير
  googleSearch: boolean; // تفعيل البحث في جوجل
  theme: ThemeMode;
  autoSave: boolean;
  voiceEnabled: boolean;
  voiceOutputEnabled: boolean;
  apiKey?: string;
}

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization?: string;
  centerName?: string;
  avatar?: string;
  password?: string;
  createdAt: string;
  lastLoginAt: string;
}
