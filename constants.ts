
import { SystemSettings, AIPersonality, ModelType, ThemeMode } from './types.ts';

export const INITIAL_SETTINGS: SystemSettings = {
  centerName: 'الحكيم الذكي Pro',
  doctorName: 'أحمد محمد',
  personality: AIPersonality.SIMPLE,
  model: ModelType.AUTO,
  autoModelRouting: true,
  deepThinking: true,
  thinkingBudget: 16384, // يتم ضبطه وتخصيصه تلقائياً وذكياً بحسب تعقيد الحالة
  googleSearch: true,
  theme: ThemeMode.LIGHT,
  autoSave: true,
  voiceEnabled: true,
  voiceOutputEnabled: true
};

export const STORAGE_KEYS = {
  SETTINGS: 'smart_sage_settings',
  RECORDS: 'smart_sage_records'
};

export const APP_VERSION = '4.5.0'; // تم الترقية إلى الإصدار المتقدم 4.5.0
