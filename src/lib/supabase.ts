
import { createClient } from '@supabase/supabase-js';

// استخدام القيم كقيم افتراضية في حال عدم وجود متغيرات البيئة
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cjnxmiiymcwhxvkdhqwp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__Qx8BMqta8ubjA24OlfzXg_ev_y6fAt';

// التأكد من وجود رابط صالح وصيغة صحيحة لتجنب انهيار التطبيق
const isValidHttpUrl = (string: string) => {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;  
  }
  return url.protocol === "http:" || url.protocol === "https:";
};

const finalUrl = isValidHttpUrl(supabaseUrl) ? supabaseUrl : 'https://cjnxmiiymcwhxvkdhqwp.supabase.co';

// إنشاء كائن محاكاة آمن لـ Supabase لمنع تعطل التطبيق في حال فشل الاتصال أو التهيئة
let supabaseInstance;
try {
  supabaseInstance = createClient(finalUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
} catch (error) {
  console.error("Critical: Failed to generate Supabase client:", error);
  // كائن بديل يعمل كدرع أمان للتطبيق
  supabaseInstance = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: async () => ({ data: { user: null, session: null }, error: new Error("Supabase is uninitialized") }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error("Supabase is uninitialized") }),
      signInWithOAuth: async () => ({ data: null, error: new Error("Supabase is uninitialized") }),
      signOut: async () => ({ error: null })
    },
    from: () => {
      const chain: any = {};
      chain.select = () => chain;
      chain.insert = () => chain;
      chain.update = () => chain;
      chain.delete = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.then = (onfulfilled: any) => Promise.resolve({ data: [], error: null }).then(onfulfilled);
      return chain;
    }
  } as any;
}

export const supabase = supabaseInstance;

