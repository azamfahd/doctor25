
import { SystemSettings, AIPersonality, ModelType, ThemeMode } from './types.ts';

export const INITIAL_SETTINGS: SystemSettings = {
  centerName: 'الحكيم الذكي Pro',
  doctorName: 'أحمد محمد',
  personality: AIPersonality.SIMPLE,
  model: ModelType.FLASH,
  deepThinking: true,
  thinkingBudget: 16384, // القيمة الافتراضية
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
