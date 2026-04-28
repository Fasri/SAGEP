import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { MetadataService } from './metadata.service';
import { ProcessService } from './process.service';
import { AuditService } from './audit.service';
import { User, Process } from '../types';

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private metadataService: MetadataService,
    private processService: ProcessService,
    private auditService: AuditService
  ) {
    this.loadData();
  }

  // State mapped from Sub-services
  get isSupabaseConnected() { return this.supabaseService.isSupabaseConnected; }
  
  get users() { return this.authService.users; }
  get currentUser() { return this.authService.currentUser; }
  
  get nucleos() { return this.metadataService.nucleos; }
  get prioridades() { return this.metadataService.prioridades; }
  get statusTipos() { return this.metadataService.statusTipos; }

  get processes() { return this.processService.processes; }
  get globalStats() { return this.processService.globalStats; }
  get lastEtlUpdate() { return this.processService.lastEtlUpdate; }
  get recalculationProgress() { return this.processService.recalculationProgress; }
  get autoAssignProgress() { return this.processService.autoAssignProgress; }

  get auditLogs() { return this.auditService.auditLogs; }

  async loadData() {
    await this.metadataService.loadMetadata();
    await this.authService.loadUsers((n: string) => this.metadataService.normalizeNucleus(n));
    await this.processService.loadInitialProcesses();
    this.processService.updateGlobalStats();
    this.processService.fetchLastEtlUpdate();
  }

  // Auth
  login(identifier: string, password?: string): boolean {
    return this.authService.login(identifier, password);
  }

  logout() {
    this.authService.logout();
  }

  async addUser(user: Omit<User, 'id'>) {
    await this.authService.addUser(user, (a, d) => this.auditService.addAuditLog(a, d));
  }

  async updateUser(user: User) {
    await this.authService.updateUser(user, (a, d) => this.auditService.addAuditLog(a, d));
  }

  async deleteUser(userId: string) {
    await this.authService.deleteUser(userId, (a, d) => this.auditService.addAuditLog(a, d));
  }

  // Processes
  async updateProcessFields(processId: string, fields: Partial<Pick<Process, 'valorCustas' | 'observacao' | 'priority'>>) {
    await this.processService.updateProcessFields(processId, fields);
  }

  async updateProcessStatus(processId: string, newStatus: string) {
    await this.processService.updateProcessStatus(processId, newStatus);
  }

  async assignProcess(processId: string, userId: string | null) {
    await this.processService.assignProcess(processId, userId);
  }

  async deleteProcess(processId: string) {
    await this.processService.deleteProcess(processId);
  }

  async fetchPaginatedProcesses(options: any) {
    return await this.processService.fetchPaginatedProcesses(options);
  }

  async fetchAllFilteredProcesses(options: any) {
    return await this.processService.fetchAllFilteredProcesses(options);
  }

  async getOldestProcessDate() {
    return await this.processService.getOldestProcessDate();
  }

  async fetchReportData(filters: any) {
    return await this.processService.fetchReportData(filters);
  }

  updateGlobalStats() {
    this.processService.updateGlobalStats();
  }

  async autoAssignProcesses(nucleusName: string, selectedUserIds?: string[]) {
    return await this.processService.autoAssignProcesses(nucleusName, selectedUserIds);
  }

  async addProcess(process: Omit<Process, 'id' | 'position' | 'priorityPosition'>) {
    return await this.processService.addProcess(process);
  }

  async importFromStorage() {
    return await this.processService.importFromStorage();
  }

  // Audit
  async fetchAuditLogs() {
    await this.auditService.fetchAuditLogs();
  }
}
