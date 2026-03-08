import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  let supabaseUrl = '';
  let supabaseAnonKey = '';

  try {
    // 1. Try Global Variables (defined via --define in package.json)
    const getGlobal = (val: unknown) => {
      if (typeof val === 'undefined') return '';
      if (val === 'undefined') return ''; // Handle literal string from build script
      return val as string;
    };

    supabaseUrl = getGlobal(typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : undefined);
    supabaseAnonKey = getGlobal(typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : undefined);
    
    // 2. Try process.env (Node-style)
    const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
    if (!supabaseUrl) supabaseUrl = env['SUPABASE_URL'] || env['VITE_SUPABASE_URL'] || env['NG_SUPABASE_URL'] || '';
    if (!supabaseAnonKey) supabaseAnonKey = env['SUPABASE_ANON_KEY'] || env['VITE_SUPABASE_ANON_KEY'] || env['NG_SUPABASE_ANON_KEY'] || '';

    // 3. Try import.meta.env (Vite-style)
    const meta = import.meta as unknown as { env: Record<string, string> };
    if (!supabaseUrl && meta.env) {
      supabaseUrl = meta.env['SUPABASE_URL'] || meta.env['VITE_SUPABASE_URL'] || meta.env['NG_SUPABASE_URL'] || '';
    }
    if (!supabaseAnonKey && meta.env) {
      supabaseAnonKey = meta.env['SUPABASE_ANON_KEY'] || meta.env['VITE_SUPABASE_ANON_KEY'] || meta.env['NG_SUPABASE_ANON_KEY'] || '';
    }

    // 4. Try window globals (last resort - browser only)
    if (typeof window !== 'undefined') {
      const win = window as unknown as Record<string, string>;
      if (!supabaseUrl) supabaseUrl = win['SUPABASE_URL'] || win['VITE_SUPABASE_URL'] || '';
      if (!supabaseAnonKey) supabaseAnonKey = win['SUPABASE_ANON_KEY'] || win['VITE_SUPABASE_ANON_KEY'] || '';
    }

    // Debug: Log what was found (without values)
    console.log('Supabase Discovery Details:', {
      urlLength: supabaseUrl.length,
      keyLength: supabaseAnonKey.length,
      urlPrefix: supabaseUrl.substring(0, 10) + '...',
      keyPrefix: supabaseAnonKey.substring(0, 10) + '...',
      method: supabaseUrl ? 'Detected' : 'Failed'
    });
  } catch (e) {
    console.error('Supabase Config: Error accessing environment variables', e);
  }

  if (supabaseUrl && supabaseAnonKey) {
    console.log('Supabase Config: URL and Key found. Initializing client...');
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  }

  console.warn('Supabase Config: Missing URL or Anon Key.', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseAnonKey 
  });
  return null;
};

// For backward compatibility if needed, but prefer getSupabase()
// export const supabase = getSupabase();
