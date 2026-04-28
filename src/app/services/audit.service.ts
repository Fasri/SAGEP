import { Injectable, signal } from '@angular/core';
import { AuditLog } from '../types';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  auditLogs = signal<AuditLog[]>([]);

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {}

  async addAuditLog(action: string, details?: Record<string, unknown>, processNumber?: string) {
    const user = this.authService.currentUser();
    if (!user) return;

    let extractedProcessNumber = processNumber;
    if (!extractedProcessNumber && details) {
      extractedProcessNumber = (details['processNumber'] as string) || (details['number'] as string);
    }

    const log: Omit<AuditLog, 'id'> = {
      userId: user.id,
      userName: user.name,
      action,
      createdAt: new Date().toISOString(),
      processNumber: extractedProcessNumber,
      details
    };

    const client = this.supabaseService.getClient();
    if (client && !user.id.startsWith('u')) {
      const { data, error } = await client
        .from('audit_logs')
        .insert([{
          user_id: log.userId,
          user_name: log.userName,
          action: log.action,
          created_at: log.createdAt,
          process_number: log.processNumber,
          details: log.details
        }])
        .select();

      if (error) {
        console.error('AuditService: Error adding audit log to Supabase:', error);
      } else if (data) {
        const newLog = {
          ...log,
          id: data[0].id,
          createdAt: data[0].created_at,
          processNumber: data[0].process_number
        };
        this.auditLogs.update(logs => [newLog, ...logs]);
      }
    } else {
      const mockLog: AuditLog = {
        id: Math.random().toString(36).substr(2, 9),
        ...log
      };
      this.auditLogs.update(logs => [mockLog, ...logs]);
    }
  }

  async fetchAuditLogs() {
    const client = this.supabaseService.getClient();
    if (client) {
      const { data, error } = await client
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('AuditService: Error fetching audit logs from Supabase:', error);
      } else if (data) {
        const logs: AuditLog[] = data.map(d => ({
          id: d.id,
          userId: d.user_id,
          userName: d.user_name,
          action: d.action,
          createdAt: d.created_at,
          processNumber: d.process_number,
          details: d.details
        }));
        this.auditLogs.set(logs);
      }
    }
  }
}
