import {ChangeDetectionStrategy, Component, signal, computed, inject, effect, HostListener, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {StoreService} from '../../services/store';
import {Process, Role} from '../../types';
import * as XLSX from 'xlsx';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private store = inject(StoreService);

  currentUser = this.store.currentUser;
  processes = this.store.processes;
  users = this.store.users;
  statusTipos = this.store.statusTipos;
  autoAssignProgress = this.store.autoAssignProgress;
  lastEtlUpdate = this.store.lastEtlUpdate;

  searchTerm = signal('');
  statusFilter = signal<'Pendente' | 'Todos' | 'Devolvidos'>('Pendente');
  nucleusFilter = signal('Todos');
  onlyAssignedToMe = signal(false);
  unassignedOnly = signal(false);
  externalAccountantsOnly = signal(false);
  isFilterVisible = signal(true);
  currentPage = signal(1);
  pageSize = 20;
  
  nucleos = this.store.nucleos;
  prioridades = this.store.prioridades;
  
  filterForm = new FormGroup({
    searchTerm: new FormControl(''),
    startDate: new FormControl(this.getDefaultStartDate()),
    endDate: new FormControl(this.getDefaultEndDate())
  });

  formValue = toSignal(this.filterForm.valueChanges, {
    initialValue: this.filterForm.value
  });

  // Identify processes with same number and nucleus but different dates
  // We only mark them as duplicates if they are both visible in the current view (paginated)
  // to avoid confusion when a duplicate exists on another page.
  duplicateProcessIds = computed(() => {
    const all = this.paginatedProcesses();
    const groups = new Map<string, Process[]>();
    
    all.forEach(p => {
      const num = p.number.trim();
      const nuc = p.nucleus.trim();
      if (!num) return;
      
      const key = `${num}|${nuc}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(p);
    });

    const duplicateIds = new Set<string>();
    
    groups.forEach((groupProcesses) => {
      // Check if we have at least two DIFFERENT processes (different IDs)
      const distinctIds = new Set(groupProcesses.map(p => p.id));
      
      if (distinctIds.size > 1) {
        // Check if they have different entry dates (re-entry criteria)
        const dates = new Set(groupProcesses.map(p => p.entryDate.trim()));
        if (dates.size > 1) {
          groupProcesses.forEach(p => duplicateIds.add(p.id));
        }
      }
    });

    return duplicateIds;
  });

  // Processes visible to the current user based on their role
  visibleProcesses = computed(() => {
    const user = this.currentUser();
    const all = this.processes();
    if (!user) return [];

    const res = all.filter(p => {
      if (user.role === 'Administrador' || user.role === 'Coordenador' || user.role === 'Supervisor') {
        return true;
      } else if (user.role === 'Contador Judicial') {
        return p.assignedToId === user.id;
      } else {
        // Use normalized comparison for nucleus to handle encoding issues
        const pNucleus = p.nucleus?.trim().toUpperCase() || '';
        const uNucleus = user.nucleus?.trim().toUpperCase() || '';
        return pNucleus === uNucleus || p.assignedToId === user.id;
      }
    });
    console.log('Dashboard: visibleProcesses count:', res.length, 'Total processes:', all.length);
    return res;
  });

  // Dashboard Stats
  isLoading = signal(false);
  isAutoAssigning = signal(false);
  autoAssignMessage = signal<string | null>(null);
  isConfirmingAutoAssign = signal(false);
  selectedAutoAssignUserIds = signal<string[]>([]);
  totalFilteredCount = signal(0);
  serverProcesses = signal<Process[]>([]);
  hasLoadedServerData = signal(false);

  appliedFilters = signal({
    searchTerm: '',
    startDate: '2020-01-01',
    endDate: this.getDefaultEndDate(),
    status: 'Pendente' as 'Pendente' | 'Todos' | 'Devolvidos',
    nucleus: 'Todos',
    onlyAssignedToMe: false,
    unassignedOnly: false,
    externalAccountantsOnly: false
  });

  stats = computed(() => {
    const serverStats = this.store.globalStats();
    console.log('Dashboard: Stats computed with:', serverStats);
    
    const pendentes = serverStats.pendentes;
    const concluidos = serverStats.concluidos;
    const devolvidos = serverStats.devolvidos;
    
    const avgTime = concluidos > 0 ? '3.8 dias' : '0 dias';
    const metaRealizada = 0;

    return [
      { label: 'Processos Pendentes', value: pendentes.toLocaleString('pt-BR'), icon: 'pending_actions', trend: '', trendUp: true, color: 'amber' },
      { label: 'Processos Concluídos', value: concluidos.toLocaleString('pt-BR'), icon: 'task_alt', trend: '', trendUp: true, color: 'green' },
      { label: 'Tempo Médio', value: avgTime, icon: 'schedule', subtext: 'Média de processamento atual', color: 'primary' },
      { label: 'Devolvidos', value: devolvidos.toLocaleString('pt-BR'), icon: 'flag', subtext: 'Sem possibilidade de cálculo', color: 'slate' },
      { label: 'Meta Realizada', value: `${metaRealizada}%`, icon: 'analytics', subtext: 'Progresso global de metas', color: 'blue' },
    ];
  });

  usersInNucleusForAutoAssign = computed(() => {
    const user = this.currentUser();
    if (!user) return [];
    let nucleus = this.nucleusFilter();
    if (nucleus === 'Todos') nucleus = user.nucleus;
    return this.users().filter(u => u.nucleus === nucleus && u.active);
  });

  private getPriorityLevel(priority: string): number {
    if (!priority) return 2;
    const p = priority.toUpperCase();
    if (p.includes('SUPER')) return 1;
    return 2;
  }

  filteredProcesses = computed(() => {
    const filters = this.appliedFilters();
    const term = filters.searchTerm.toLowerCase();
    const status = filters.status;
    const nucleusFilter = filters.nucleus;
    const onlyAssignedToMe = filters.onlyAssignedToMe;
    const unassignedOnly = filters.unassignedOnly;
    const externalAccountantsOnly = filters.externalAccountantsOnly;
    const user = this.currentUser();
    const allUsers = this.users();
    const startDate = filters.startDate;
    const endDate = filters.endDate;
    
    const filtered = this.visibleProcesses().filter(p => {
      // Status Filter
      if (status === 'Pendente' && p.status !== 'Pendente') return false;

      // Nucleus Filter
      if (nucleusFilter !== 'Todos') {
        const pNucleus = p.nucleus?.trim().toUpperCase() || '';
        const fNucleus = nucleusFilter.trim().toUpperCase();
        if (pNucleus !== fNucleus) return false;
      }

      // Assigned To Me Filter
      if (onlyAssignedToMe && user && p.assignedToId !== user.id) return false;

      // Unassigned Only Filter
      if (unassignedOnly && p.assignedToId) return false;

      // External Accountants Filter
      if (externalAccountantsOnly && user) {
        const assignedUser = allUsers.find(u => u.id === p.assignedToId);
        if (!assignedUser || assignedUser.nucleus === user.nucleus) return false;
      }

      // Date Filter - Use normalized comparison to handle different formats (DD/MM/YYYY vs YYYY-MM-DD)
      if (startDate || endDate) {
        const pDate = this.normalizeDateForComparison(p.entryDate);
        const sDate = startDate ? this.normalizeDateForComparison(startDate) : null;
        const eDate = endDate ? this.normalizeDateForComparison(endDate) : null;

        if (sDate && pDate < sDate) return false;
        if (eDate && pDate > eDate) return false;
      }

      const assignedUserName = p.assignedToId ? allUsers.find(u => u.id === p.assignedToId)?.name || '' : '';

      return p.number.toLowerCase().includes(term) || 
             p.court.toLowerCase().includes(term) ||
             p.status.toLowerCase().includes(term) ||
             p.nucleus.toLowerCase().includes(term) ||
             assignedUserName.toLowerCase().includes(term);
    });

    // Robust sorting:
    // 1. Priority Level (Super first)
    // 2. Position (within nucleus)
    // 3. Entry Date
    return filtered.sort((a, b) => {
      const levelA = this.getPriorityLevel(a.priority);
      const levelB = this.getPriorityLevel(b.priority);
      
      if (levelA !== levelB) return levelA - levelB;
      
      if (a.position !== b.position) return a.position - b.position;
      
      return new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
    });
  });

  // This effect will trigger whenever filters or page change
    constructor() {
      // Initial load - use untracked to prevent this effect from 
      // becoming a dependency of the filter signals themselves.
      // We only want it to run when the user is first loaded.
      effect(() => {
        const user = this.currentUser();
        if (user) {
          untracked(() => {
            this.applyFilters();
          });
        }
      }, { allowSignalWrites: true });
    }

    // We'll use a more direct approach: update the list whenever filters change
    async loadServerData() {
      const user = this.currentUser();
      if (!user) return;

      this.isLoading.set(true);
      try {
        const filters = this.appliedFilters();
        console.log('Dashboard: loadServerData with appliedFilters:', filters);
        
        const validRoles: Role[] = ['Contador Judicial', 'Chefe', 'Gerente', 'Coordenador', 'Supervisor'];
        const externalIds = this.users()
          .filter(u => u.nucleus !== user.nucleus && validRoles.includes(u.role))
          .map(u => u.id);

        const result = await this.store.fetchPaginatedProcesses({
          page: this.currentPage(),
          pageSize: this.pageSize,
          searchTerm: filters.searchTerm,
          statusFilter: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
          user: user,
          nucleusFilter: filters.nucleus,
          onlyAssignedToMe: filters.onlyAssignedToMe,
          unassignedOnly: filters.unassignedOnly,
          externalAccountantIds: filters.externalAccountantsOnly ? externalIds : undefined
        });

        this.serverProcesses.set(result.processes);
        this.totalFilteredCount.set(result.totalCount);
        this.hasLoadedServerData.set(true);
        console.log('Dashboard: loadServerData success. Count:', result.totalCount, 'Processes:', result.processes.length);
        
        // Also refresh the stats cards
        this.store.updateGlobalStats();
      } catch (e) {
        console.error('Dashboard: Error loading server data:', e);
      } finally {
        this.isLoading.set(false);
      }
    }

    // Override the computed to use server data if available, otherwise fallback to local
    paginatedProcesses = computed(() => {
      if (this.hasLoadedServerData()) {
        return this.serverProcesses();
      }
      
      // Fallback to local pagination for initial load only
      const all = this.filteredProcesses();
      const start = (this.currentPage() - 1) * this.pageSize;
      const end = start + this.pageSize;
      return all.slice(start, end);
    });

  totalPages = computed(() => {
    const total = Math.max(this.totalFilteredCount(), this.filteredProcesses().length);
    return Math.max(1, Math.ceil(total / this.pageSize));
  });

  private normalizeDateForComparison(dateStr: string): string {
    if (!dateStr) return '';
    // If it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.split('T')[0];
    }
    // If it's DD/MM/YYYY
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return dateStr;
  }

  private getDefaultStartDate(): string {
    // Default to a much earlier date to ensure mock/older data is visible
    return '2020-01-01';
  }

  private getDefaultEndDate(): string {
    const now = new Date();
    // Use local date string to avoid timezone shifts from toISOString()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toLocaleDateString('en-CA');
  }

  setStatusFilter(status: 'Pendente' | 'Todos' | 'Devolvidos') {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.applyFilters();
  }

  clearFilters() {
    this.filterForm.patchValue({
      searchTerm: '',
      startDate: this.getDefaultStartDate(),
      endDate: this.getDefaultEndDate()
    });
    this.nucleusFilter.set('Todos');
    this.statusFilter.set('Pendente');
    this.onlyAssignedToMe.set(false);
    this.unassignedOnly.set(false);
    this.externalAccountantsOnly.set(false);
    this.applyFilters();
  }

  applyFilters() {
    const { searchTerm, startDate, endDate } = this.filterForm.value;
    
    console.log('Dashboard: applyFilters called with:', { searchTerm, startDate, endDate });
    
    this.appliedFilters.set({
      searchTerm: searchTerm || '',
      startDate: startDate || '2020-01-01',
      endDate: endDate || this.getDefaultEndDate(),
      status: this.statusFilter(),
      nucleus: this.nucleusFilter(),
      onlyAssignedToMe: this.onlyAssignedToMe(),
      unassignedOnly: this.unassignedOnly(),
      externalAccountantsOnly: this.externalAccountantsOnly()
    });

    this.currentPage.set(1);
    this.loadServerData();
  }

  setNucleusFilter(nucleus: string) {
    this.nucleusFilter.set(nucleus);
    this.currentPage.set(1);
    this.applyFilters();
  }

  toggleExternalAccountants() {
    const newValue = !this.externalAccountantsOnly();
    if (newValue) {
      this.unassignedOnly.set(false);
      this.onlyAssignedToMe.set(false);
    }
    this.externalAccountantsOnly.set(newValue);
    this.applyFilters();
  }

  toggleUnassignedOnly() {
    const newValue = !this.unassignedOnly();
    if (newValue) {
      this.onlyAssignedToMe.set(false);
      this.externalAccountantsOnly.set(false);
    }
    this.unassignedOnly.set(newValue);
    this.applyFilters();
  }

  toggleOnlyAssignedToMe() {
    const newValue = !this.onlyAssignedToMe();
    if (newValue) {
      this.unassignedOnly.set(false);
      this.externalAccountantsOnly.set(false);
    }
    this.onlyAssignedToMe.set(newValue);
    this.applyFilters();
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadServerData();
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadServerData();
    }
  }

  goToPage(page: number) {
    this.currentPage.set(page);
    this.loadServerData();
  }

  async updateStatus(process: Process, newStatus: string) {
    await this.store.updateProcessStatus(process.id, newStatus as Process['status']);
    this.loadServerData();
  }

  async updatePriority(process: Process, newPriority: string) {
    await this.store.updateProcessFields(process.id, { priority: newPriority });
    this.loadServerData();
  }

  async assignProcess(process: Process, userId: string) {
    await this.store.assignProcess(process.id, userId);
    this.loadServerData();
  }

  canEditPriority(): boolean {
    const user = this.currentUser();
    if (!user) return false;
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente'];
    return privilegedRoles.includes(user.role);
  }

  async updateFields(process: Process, field: 'valorCustas' | 'observacao' | 'priority', event: Event) {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    
    if (field === 'valorCustas') {
      const value = this.parseCurrency(input.value);
      await this.store.updateProcessFields(process.id, { valorCustas: value });
    } else {
      await this.store.updateProcessFields(process.id, { [field]: input.value });
    }
    
    this.loadServerData();
  }

  formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '0,00';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  parseCurrency(value: string): number {
    if (!value) return 0;
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  }

  maskCurrency(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    if (value === '') {
      input.value = '';
      return;
    }
    const numberValue = parseInt(value, 10) / 100;
    input.value = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numberValue);
  }

  openStatusDropdownId = signal<string | null>(null);
  openPriorityDropdownId = signal<string | null>(null);

  toggleStatusDropdown(id: string, event: Event) {
    event.stopPropagation();
    this.openPriorityDropdownId.set(null); // Close other dropdown
    if (this.openStatusDropdownId() === id) {
      this.openStatusDropdownId.set(null);
    } else {
      this.openStatusDropdownId.set(id);
    }
  }

  togglePriorityDropdown(id: string, event: Event) {
    event.stopPropagation();
    this.openStatusDropdownId.set(null); // Close other dropdown
    if (this.openPriorityDropdownId() === id) {
      this.openPriorityDropdownId.set(null);
    } else {
      this.openPriorityDropdownId.set(id);
    }
  }

  @HostListener('window:click')
  closeDropdowns() {
    this.openStatusDropdownId.set(null);
    this.openPriorityDropdownId.set(null);
  }

  getStatusClass(status: string): string {
    const greenStatuses = [
      'Cálculo atualizado',
      'Cálculo realizado',
      'Devolvido: ausência de parâmetros',
      'Devolvido: ausência de documentos para os cálculos',
      'Devolvido: Beneficiário da Justiça Gratuita',
      'Devolvido: Custas Satisfeitas',
      'Devolvido: esclarecimento realizado',
      'Partilha Realizada'
    ];

    if (status === 'Pendente') {
      return 'bg-red-700 text-white';
    }
    if (status === 'Triagem do Gestor') {
      return 'bg-amber-100 text-amber-800';
    }
    if (greenStatuses.includes(status)) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-slate-100 text-slate-700';
  }

  getPriorityClass(priority: string): string {
    const p = priority.toUpperCase();
    if (p.includes('SUPER')) {
      return 'bg-purple-600 text-white';
    }
    if (p.includes('LEGAL')) {
      return 'bg-amber-100 text-amber-800';
    }
    if (p.includes('SEM PRIORIDADE')) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-orange-100 text-orange-800';
  }

  async exportToExcel() {
    const user = this.currentUser();
    if (!user) return;

    this.isLoading.set(true);
    try {
      const filters = this.appliedFilters();
      const validRoles: Role[] = ['Contador Judicial', 'Chefe', 'Gerente', 'Coordenador', 'Supervisor'];
      const externalIds = this.users()
        .filter(u => u.nucleus !== user.nucleus && validRoles.includes(u.role))
        .map(u => u.id);

      const allProcesses = await this.store.fetchAllFilteredProcesses({
        searchTerm: filters.searchTerm,
        statusFilter: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate,
        user: user,
        nucleusFilter: filters.nucleus,
        onlyAssignedToMe: filters.onlyAssignedToMe,
        unassignedOnly: filters.unassignedOnly,
        externalAccountantIds: filters.externalAccountantsOnly ? externalIds : undefined
      });

      if (allProcesses.length === 0) {
        alert('Nenhum processo encontrado para exportar com os filtros atuais.');
        return;
      }

      const data = allProcesses.map(p => ({
        'Posição Geral': p.position,
        'Posição Prioridade': p.priorityPosition || '-',
        'Número do Processo': p.number,
        'Data de Remessa': p.entryDate,
        'Vara': p.court,
        'Núcleo': p.nucleus,
        'Prioridade': p.priority,
        'Cumprimento': p.status,
        'Valor Custas': p.valorCustas,
        'Observação': p.observacao,
        'Atribuição': p.assignmentDate,
        'Data de Cumprimento': p.completionDate,
        'Atribuído a': this.getUserName(p.assignedToId)
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Processos');
      
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `processos_contadoria_${date}.xlsx`);
    } catch (error) {
      console.error('Dashboard: Error exporting to Excel:', error);
      alert('Ocorreu um erro ao exportar os dados. Tente novamente.');
    } finally {
      this.isLoading.set(false);
    }
  }

  getUserName(userId: string | null): string {
    if (!userId) return 'Não atribuído';
    return this.users().find(u => u.id === userId)?.name || 'Desconhecido';
  }

  handleAssignInput(process: Process, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value) {
      this.assignProcess(process, '');
      return;
    }
    const user = this.getAssignableUsers(process.nucleus).find(u => u.name.toLowerCase() === value.toLowerCase());
    if (user) {
      this.assignProcess(process, user.id);
    } else {
      input.value = this.getUserName(process.assignedToId) === 'Não atribuído' ? '' : this.getUserName(process.assignedToId);
    }
  }

  stripPriorityPrefix(priority: string): string {
    if (!priority) return '';
    return priority.replace(/^\d+-/, '');
  }

  getAssignableUsers(nucleus: string) {
    const user = this.currentUser();
    if (!user) return [];

    // Supervisor, Coordenador, Chefe, Gerente and Admin can assign to anyone (except Admins)
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente'];
    if (privilegedRoles.includes(user.role)) {
      return this.users().filter(u => u.role !== 'Administrador');
    }

    // Default fallback (though they shouldn't see the select if they can't assign)
    return this.users().filter(u => u.nucleus === nucleus && u.role !== 'Administrador');
  }

  canAssign(): boolean {
    const user = this.currentUser();
    if (!user) return false;

    // Supervisor, Coordenador, Chefe, Gerente and Admin can assign any process
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente'];
    if (privilegedRoles.includes(user.role)) return true;

    return false;
  }

  canChangeStatus(process: Process): boolean {
    const user = this.currentUser();
    if (!user) return false;
    
    // Admins, Coordinators, Supervisors and Managers can always change
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente'];
    if (privilegedRoles.includes(user.role)) return true;
    
    // Contadores can change if the process is assigned to them
    if (user.role === 'Contador Judicial' && process.assignedToId === user.id) {
      return true;
    }
    
    // Contadores can only change if it's still Pendente
    return process.status === 'Pendente';
  }

  async autoAssign() {
    const user = this.currentUser();
    if (!user) return;

    let nucleus = this.nucleusFilter();
    
    if (nucleus === 'Todos') {
      if (user.nucleus && user.nucleus !== 'Administração') {
        nucleus = user.nucleus;
      } else {
        this.autoAssignMessage.set('Por favor, selecione um núcleo específico no filtro antes de realizar a atribuição automática.');
        setTimeout(() => this.autoAssignMessage.set(null), 5000);
        return;
      }
    }
    
    // Initialize selected users with all active users in the nucleus
    const activeUsers = this.users().filter(u => u.nucleus === nucleus && u.active);
    this.selectedAutoAssignUserIds.set(activeUsers.map(u => u.id));
    
    this.isConfirmingAutoAssign.set(true);
  }

  toggleUserSelection(userId: string) {
    this.selectedAutoAssignUserIds.update(ids => {
      if (ids.includes(userId)) {
        return ids.filter(id => id !== userId);
      } else {
        return [...ids, userId];
      }
    });
  }

  async confirmAutoAssign() {
    const user = this.currentUser();
    if (!user) return;

    let nucleus = this.nucleusFilter();
    if (nucleus === 'Todos') nucleus = user.nucleus;

    const selectedIds = this.selectedAutoAssignUserIds();
    if (selectedIds.length === 0) {
      this.autoAssignMessage.set('Selecione pelo menos um contador para a atribuição.');
      setTimeout(() => this.autoAssignMessage.set(null), 3000);
      return;
    }

    this.isConfirmingAutoAssign.set(false);
    this.isAutoAssigning.set(true);
    this.autoAssignMessage.set('Iniciando atribuição automática...');

    try {
      const count = await this.store.autoAssignProcesses(nucleus, selectedIds);
      this.autoAssignMessage.set(`${count} processos foram atribuídos com sucesso no núcleo ${nucleus}.`);
      this.loadServerData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.autoAssignMessage.set(`Erro na atribuição automática: ${message}`);
    } finally {
      this.isAutoAssigning.set(false);
      setTimeout(() => this.autoAssignMessage.set(null), 5000);
    }
  }

  cancelAutoAssign() {
    this.isConfirmingAutoAssign.set(false);
  }
}
