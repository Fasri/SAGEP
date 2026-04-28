import { Injectable, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../supabase';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  isSupabaseConnected = signal<boolean>(false);
  private client: SupabaseClient | null = null;

  constructor() {
    this.client = getSupabase();
    console.log('SupabaseService: Supabase Client Status:', this.client ? 'Initialized' : 'Not Initialized');
    this.isSupabaseConnected.set(!!this.client);

    if (this.client) {
      this.testConnection();
    }
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }

  async testConnection() {
    if (!this.client) return;
    try {
      const { error } = await this.client.from('users').select('count', { count: 'exact', head: true });
      if (error) {
        console.error('SupabaseService: Supabase connection test failed:', error.message);
        this.isSupabaseConnected.set(false);
      } else {
        console.log('SupabaseService: Supabase connection test successful. Connection is active.');
        this.isSupabaseConnected.set(true);
      }
    } catch (e) {
      console.error('SupabaseService: Unexpected error during Supabase connection test:', e);
      this.isSupabaseConnected.set(false);
    }
  }

  handleError(error: unknown, context: string) {
    console.error(`SupabaseService: Error in ${context}:`, error);
    
    let message = '';
    let name = '';
    
    if (error instanceof Error) {
      message = error.message;
      name = error.name;
    } else if (typeof error === 'object' && error !== null) {
      const errObj = error as Record<string, unknown>;
      message = String(errObj['message'] || '');
      name = String(errObj['name'] || '');
    }

    if (message.includes('Failed to fetch') || name === 'TypeError') {
      this.isSupabaseConnected.set(false);
      throw new Error('Falha de conexão com o servidor. Verifique sua internet ou tente novamente mais tarde.');
    }
    return error;
  }
}
