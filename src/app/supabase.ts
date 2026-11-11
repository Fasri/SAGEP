
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
      if (val === 'undefined') return '';
      return val as string;
    };

    const hasTemplatePlaceholder = (value: string) =>
      value.includes('${') ||
      value.includes('%') ||
      value.includes('YOUR_SUPABASE_');

    // 2. Read global variables
    supabaseUrl = getGlobal(
      typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : undefined
    );

    supabaseAnonKey = getGlobal(
      typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : undefined
    );

    // Validate URL
    const isInvalid = (url: string) =>
      !url ||
      hasTemplatePlaceholder(url) ||
      url.includes('ais-dev-') ||
      url.includes('ais-pre-') ||
      !/^https?:\/\//i.test(url);

    if (isInvalid(supabaseUrl)) supabaseUrl = '';

    if (!supabaseAnonKey || hasTemplatePlaceholder(supabaseAnonKey)) {
      supabaseAnonKey = '';
    }

    // 3. Read process.env
    const env =
      typeof process !== 'undefined' && process.env
        ? process.env
        : {};

    if (!supabaseUrl) {
      supabaseUrl =
        env['SUPABASE_URL'] ||
        env['VITE_SUPABASE_URL'] ||
        env['NG_SUPABASE_URL'] ||
        '';
    }

    if (!supabaseAnonKey) {
      supabaseAnonKey =
        env['SUPABASE_ANON_KEY'] ||
        env['VITE_SUPABASE_ANON_KEY'] ||
        env['NG_SUPABASE_ANON_KEY'] ||
        '';
    }

    // 4. Read import.meta.env (Vite)
    const meta = import.meta as unknown as {
      env: Record<string, string>;
    };

    if (!supabaseUrl && meta.env) {
      supabaseUrl =
        meta.env['SUPABASE_URL'] ||
        meta.env['VITE_SUPABASE_URL'] ||
        meta.env['NG_SUPABASE_URL'] ||
        '';
    }

    if (!supabaseAnonKey && meta.env) {
      supabaseAnonKey =
        meta.env['SUPABASE_ANON_KEY'] ||
        meta.env['VITE_SUPABASE_ANON_KEY'] ||
        meta.env['NG_SUPABASE_ANON_KEY'] ||
        '';
    }

    // 5. Read window globals (browser)
    if (typeof window !== 'undefined') {
      const win = window as unknown as Record<string, string>;

      if (!supabaseUrl) {
        supabaseUrl =
          win['SUPABASE_URL'] ||
          win['VITE_SUPABASE_URL'] ||
          '';
      }

      if (!supabaseAnonKey) {
        supabaseAnonKey =
          win['SUPABASE_ANON_KEY'] ||
          win['VITE_SUPABASE_ANON_KEY'] ||
          '';
      }
    }

    // 6. Debug information (without exposing credentials)
    console.log('Supabase Discovery Details:', {
      urlLength: supabaseUrl.length,
      keyLength: supabaseAnonKey.length,
      method: supabaseUrl ? 'Detected' : 'Failed'
    });

  } catch (e) {
    console.error(
      'Supabase Config: Error accessing environment variables',
      e
    );
  }

  // 7. Initialize Supabase client
  if (supabaseUrl && supabaseAnonKey) {
    console.log(
      'Supabase Config: URL and Key found. Initializing client...'
    );

    supabaseInstance = createClient(
      supabaseUrl,
      supabaseAnonKey
    );

    return supabaseInstance;
  }

  // 8. Configuration missing
  console.warn('Supabase Config: Missing URL or Anon Key.', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });

  return null;
};
