import { ChangeDetectionStrategy, Component, signal, computed, inject, HostListener, afterNextRender } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { StoreService } from '../../services/store';
import { Process, Role, PaginationOptions } from '../../types';
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
  statusTipos = computed(() => {
    const list = [...this.store.statusTipos()];
    const uniqueStatus: typeof list = [];
    const seen = new Set<string>();
    for (const s of list) {
      const key = String(s.nome || '').trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueStatus.push(s);
      }
    }
    return uniqueStatus.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });
  autoAssignProgress = this.store.autoAssignProgress;
  lastEtlUpdate = this.store.lastEtlUpdate;

  searchTerm = signal('');
  statusFilter = signal<'Pendente' | 'Todos' | 'Devolvidos'>('Pendente');
  
  // Sinais de múltipla escolha e visibilidade de dropdowns
  selectedNuclei = signal<string[]>([]);
  selectedPriorities = signal<string[]>([]);
  selectedStatusDetails = signal<string[]>([]);

  isNucleusDropdownOpen = signal(false);
  isPriorityDropdownOpen = signal(false);
  isStatusDropdownOpen = signal(false);

  nucleusFilter = signal('Todos');
  onlyAssignedToMe = signal(false);
  unassignedOnly = signal(false);
  externalAccountantsOnly = signal(false);
  isFilterVisible = signal(false);
  currentPage = signal(1);
  pageSize = 20;

  nucleos = computed(() => {
    const user = this.currentUser();
    const excludedNuclei = ['8ª CC', '8 CC', '8ªCC', '8CC', 'CCJ', 'CONTADORIA REMOTA', 'GERAL'];
    let list = this.store.nucleos().filter(n => !excludedNuclei.includes(n.nome.trim().toUpperCase()));
    if (user) {
      if (user.role === 'Gestor CC') {
        list = list.filter(n => n.nome.trim().toUpperCase().endsWith('CC'));
      } else if (user.role === 'Gestor CCJ') {
        list = list.filter(n => n.nome.trim().toUpperCase().endsWith('CCJ'));
      }
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  });
  prioridades = this.store.prioridades;

  filterForm = new FormGroup({
    searchTerm: new FormControl(''),
    priorityFilter: new FormControl('Todos'),
    statusDetailFilter: new FormControl('Todos'),
    startDate: new FormControl(this.getDefaultStartDate()),
    endDate: new FormControl(this.getDefaultEndDate())
  });

  formValue = toSignal(this.filterForm.valueChanges, {
    initialValue: this.filterForm.value
  });

  // Processes visible to the current user based on their role
  visibleProcesses = computed(() => {
    const user = this.currentUser();
    const all = this.processes();
    if (!user) return [];

    const res = all.filter(p => {
      if (user.role === 'Administrador' || user.role === 'Coordenador' || user.role === 'Supervisor') {
        return true;
      } else if (user.role === 'Gestor CC') {
        return p.nucleus?.trim().toUpperCase().endsWith('CC');
      } else if (user.role === 'Gestor CCJ') {
        return p.nucleus?.trim().toUpperCase().endsWith('CCJ');
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

  onlyDuplicates = signal(false);

  canSeeDuplicateAlert = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    const allowedRoles = ['Administrador', 'Coordenador', 'Supervisor', 'Gestor CC', 'Gestor CCJ', 'Chefe', 'Gerente'];
    return allowedRoles.includes(user.role);
  });

  duplicatePendingInfo = computed(() => {
    if (!this.canSeeDuplicateAlert()) return { count: 0, numbers: [] as string[], numberKeys: new Set<string>() };

    // Combine processes from store and server to ensure we check all available processes
    const storeProcs = this.store.processes();
    const serverProcs = this.serverProcesses();
    const allProcsMap = new Map<string, Process>();

    [...storeProcs, ...serverProcs].forEach(p => {
      if (p && p.id) allProcsMap.set(p.id, p);
    });

    const all = Array.from(allProcsMap.values());
    const user = this.currentUser();
    if (!user) return { count: 0, numbers: [] as string[], numberKeys: new Set<string>() };

    // Group ALL system processes by normalized number (stripping formatting punctuation)
    const numberGroups = new Map<string, Process[]>();
    all.forEach(p => {
      const rawNum = p.number?.trim();
      if (!rawNum) return;
      const key = rawNum.replace(/[^\w]/g, '').toLowerCase();
      if (!numberGroups.has(key)) {
        numberGroups.set(key, []);
      }
      numberGroups.get(key)!.push(p);
    });

    const duplicateNumbers: string[] = [];
    const duplicateKeys = new Set<string>();

    numberGroups.forEach((procs, key) => {
      // Filtrar processos que estão com status Pendente E pertencem ao escopo do gestor/usuário atual
      const pendingInUserScope = procs.filter(p => {
        const isPending = p.status?.trim().toLowerCase().startsWith('pendente');
        if (!isPending) return false;

        if (['Administrador', 'Coordenador', 'Supervisor'].includes(user.role)) {
          return true;
        } else if (user.role === 'Gestor CC') {
          return p.nucleus?.trim().toUpperCase().endsWith('CC');
        } else if (user.role === 'Gestor CCJ') {
          return p.nucleus?.trim().toUpperCase().endsWith('CCJ');
        } else {
          const uNucleus = user.nucleus?.trim().toUpperCase() || '';
          return (p.nucleus?.trim().toUpperCase() || '') === uNucleus;
        }
      });

      // Só é considerado duplicado para o gestor se houver 2 ou mais processos pendentes no seu próprio escopo
      if (pendingInUserScope.length > 1) {
        duplicateNumbers.push(pendingInUserScope[0].number);
        duplicateKeys.add(key);
      }
    });

    return {
      count: duplicateNumbers.length,
      numbers: duplicateNumbers,
      numberKeys: duplicateKeys
    };
  });

  isDuplicatePending(number: string): boolean {
    if (!number) return false;
    const clean = number.replace(/[^\w]/g, '').toLowerCase();
    return this.duplicatePendingInfo().numberKeys.has(clean);
  }

  filterDuplicateProcesses() {
    const info = this.duplicatePendingInfo();
    if (info.numbers.length === 0 && !this.onlyDuplicates()) return;
    
    const newOnlyDuplicates = !this.onlyDuplicates();
    this.onlyDuplicates.set(newOnlyDuplicates);

    if (newOnlyDuplicates) {
      this.isFilterVisible.set(true);
      this.statusFilter.set('Todos');
      this.filterForm.patchValue({
        searchTerm: '',
        startDate: '',
        endDate: ''
      });
    }
    this.applyFilters();
  }

  // Dashboard Stats
  isLoading = signal(false);
  isAutoAssigning = signal(false);
  autoAssignMessage = signal<string | null>(null);
  isConfirmingAutoAssign = signal(false);
  selectedAutoAssignUserIds = signal<string[]>([]);
  totalFilteredCount = signal(0);
  serverProcesses = signal<Process[]>([]);
  hasLoadedServerData = signal(false);
  unassignedCount = signal<number>(0);
  isAutoinspecao = signal<boolean>(false);
  assignLimit = signal<number | null>(null);

  isUnassigning = signal(false);
  isConfirmingUnassign = signal(false);
  selectedUnassignUserIds = signal<string[]>([]);
  unassignMessage = signal<string | null>(null);
  assignedCounts = signal<Record<string, number>>({});

  appliedFilters = signal({
    searchTerm: '',
    startDate: this.getDefaultStartDate(),
    endDate: this.getDefaultEndDate(),
    status: 'Pendente' as 'Pendente' | 'Todos' | 'Devolvidos',
    nucleus: 'Todos' as string | string[],
    priority: 'Todos' as string | string[],
    statusDetail: 'Todos' as string | string[],
    onlyAssignedToMe: false,
    unassignedOnly: false,
    externalAccountantsOnly: false,
    onlyReturns: false,
    over30DaysOnly: false,
    onlyDuplicates: false
  });

  stats = computed(() => {
    const { pendentes, concluidos, devolvidos } = this.store.globalStats();
    const total = pendentes + concluidos + devolvidos;
    const metaRealizada = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    return [
      { label: 'Processos Pendentes', value: pendentes.toLocaleString('pt-BR'), icon: 'pending_actions', color: 'amber' },
      { label: 'Processos Concluídos', value: concluidos.toLocaleString('pt-BR'), icon: 'task_alt', color: 'green' },
      { label: 'Devolvidos', value: devolvidos.toLocaleString('pt-BR'), icon: 'flag', color: 'slate' },
      { label: 'Meta Realizada', value: `${metaRealizada}%`, icon: 'analytics', color: 'blue' },
    ];
  });

  usersInNucleusForAutoAssign = computed(() => {
    const user = this.currentUser();
    if (!user) return [];
    let nucleus = this.nucleusFilter();
    if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      nucleus = user.nucleus;
    } else if (nucleus === 'Todos') {
      nucleus = user.nucleus;
    }
    return this.users()
      .filter(u => u.nucleus === nucleus && u.active)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });

  onlineUsers = computed(() => {
    const all = this.users();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    return all.filter(u => u.lastSeen && new Date(u.lastSeen) > fifteenMinutesAgo);
  });

  private getPriorityLevel(priority: string): number {
    if (!priority) return 3;
    const p = priority.toUpperCase().trim();
    if (p.includes('SUPER')) return 1;

    const isPriorityTerm = p.includes('LEGAL') || p.includes('ORDEM') || p.startsWith('1-') || p.startsWith('2-');
    const isSemPrioridade = p.includes('SEM');

    if (isPriorityTerm && !isSemPrioridade) return 2;
    return 3;
  }

  private isPriorityProcess(priority: string): boolean {
    return this.getPriorityLevel(priority) < 3;
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
    const onlyReturns = filters.onlyReturns;
    const over30DaysOnly = filters.over30DaysOnly;
    const onlyDuplicates = this.onlyDuplicates();
    const dupKeys = this.duplicatePendingInfo().numberKeys;

    // Se estiver filtrando duplicados, buscar dos processos visíveis ao usuário no seu escopo
    const sourceProcesses = this.visibleProcesses();

    const filtered = sourceProcesses.filter(p => {
      if (onlyDuplicates) {
        const pKey = p.number?.trim().replace(/[^\w]/g, '').toLowerCase() || '';
        if (!dupKeys.has(pKey)) return false;
      } else {
        // 30+ Days Filter
        if (over30DaysOnly && (p.tempoNaContadoria === null || (p.tempoNaContadoria || 0) < 30)) return false;

        // Returns Filter
        if (onlyReturns && !p.isReturn) return false;

        // Status Filter
        if (status === 'Pendente' && p.status !== 'Pendente') return false;

        // Date Filter - Use entryDate for Pending/All, completionDate for Devolvidos
        if (startDate || endDate) {
          const processDate = status === 'Devolvidos' ? p.completionDate : p.entryDate;
          const pDate = this.normalizeDateForComparison(processDate || '');
          const sDate = startDate ? this.normalizeDateForComparison(startDate) : null;
          const eDate = endDate ? this.normalizeDateForComparison(endDate) : null;

          if (sDate && pDate < sDate) return false;
          if (eDate && pDate > eDate) return false;
        }
      }

      // Nucleus Filter
      if (Array.isArray(nucleusFilter)) {
        if (nucleusFilter.length > 0) {
          const pNucleus = p.nucleus?.trim().toUpperCase() || '';
          const hasMatch = nucleusFilter.some(nf => nf.trim().toUpperCase() === pNucleus);
          if (!hasMatch) return false;
        }
      } else if (nucleusFilter !== 'Todos') {
        const pNucleus = p.nucleus?.trim().toUpperCase() || '';
        const fNucleus = nucleusFilter.trim().toUpperCase();
        if (pNucleus !== fNucleus) return false;
      }

      // Priority Filter
      const priorityFilter = filters.priority;
      if (Array.isArray(priorityFilter)) {
        if (priorityFilter.length > 0) {
          const pPriority = p.priority?.trim().toUpperCase() || '';
          const hasMatch = priorityFilter.some(pf => pf.trim().toUpperCase() === pPriority);
          if (!hasMatch) return false;
        }
      } else if (priorityFilter !== 'Todos') {
        const pPriority = p.priority?.trim().toUpperCase() || '';
        const fPriority = priorityFilter.trim().toUpperCase();
        if (pPriority !== fPriority) return false;
      }

      // Status Detail Filter
      const statusDetailFilter = filters.statusDetail;
      if (Array.isArray(statusDetailFilter)) {
        if (statusDetailFilter.length > 0) {
          const pStatusDetail = p.status?.trim().toUpperCase() || '';
          const hasMatch = statusDetailFilter.some(sdf => sdf.trim().toUpperCase() === pStatusDetail);
          if (!hasMatch) return false;
        }
      } else if (statusDetailFilter !== 'Todos') {
        const pStatusDetail = p.status?.trim().toUpperCase() || '';
        const fStatusDetail = statusDetailFilter.trim().toUpperCase();
        if (pStatusDetail !== fStatusDetail) return false;
      }

      // Assigned To Me Filter
      if (onlyAssignedToMe && user && p.assignedToId !== user.id) return false;

      // Unassigned Only Filter
      if (unassignedOnly && p.assignedToId) return false;

      // External Accountants Filter
      if (externalAccountantsOnly && user) {
        const assignedUser = allUsers.find(u => u.id === p.assignedToId);
        const targetNuclei = Array.isArray(nucleusFilter)
          ? (nucleusFilter.length > 0 ? nucleusFilter : [user.nucleus || ''])
          : [nucleusFilter !== 'Todos' ? nucleusFilter : user.nucleus || ''];
        const normalizedTargets = targetNuclei.map(t => t.trim().toUpperCase());
        const assignedUserNuc = assignedUser?.nucleus?.trim().toUpperCase() || '';
        if (!assignedUser || normalizedTargets.includes(assignedUserNuc)) return false;
      }

      if (term) {
        const assignedUserName = p.assignedToId ? allUsers.find(u => u.id === p.assignedToId)?.name || '' : '';
        return p.number.toLowerCase().includes(term) ||
          p.court.toLowerCase().includes(term) ||
          p.status.toLowerCase().includes(term) ||
          p.nucleus.toLowerCase().includes(term) ||
          assignedUserName.toLowerCase().includes(term);
      }

      return true;
    });

    return filtered.sort((a, b) => {
      // Ao exibir duplicados, agrupa os processos de mesmo número juntos
      if (onlyDuplicates) {
        const cleanA = a.number.replace(/[^\w]/g, '').toLowerCase();
        const cleanB = b.number.replace(/[^\w]/g, '').toLowerCase();
        if (cleanA !== cleanB) return cleanA.localeCompare(cleanB);
      }

      if (status === 'Devolvidos') {
        const cA = a.completionDate ? new Date(a.completionDate).getTime() : 0;
        const cB = b.completionDate ? new Date(b.completionDate).getTime() : 0;
        if (cA !== cB) return cB - cA;
        return a.position - b.position;
      }

      const levelA = this.getPriorityLevel(a.priority);
      const levelB = this.getPriorityLevel(b.priority);
      if (levelA !== levelB) return levelA - levelB;

      const entryA = new Date(a.entryDate).getTime();
      const entryB = new Date(b.entryDate).getTime();
      return entryA - entryB;
    });
  });

  // Notification/error state for replacing native alert/confirm
  errorNotification = signal<string | null>(null);
  successNotification = signal<string | null>(null);
  confirmDeleteProcess = signal<Process | null>(null);
  showUnassignedWarning = signal<boolean>(false);

  private showError(msg: string) {
    this.errorNotification.set(msg);
    setTimeout(() => this.errorNotification.set(null), 6000);
  }

  private showSuccess(msg: string) {
    this.successNotification.set(msg);
    setTimeout(() => this.successNotification.set(null), 4000);
  }

  triggerUnassignedWarning() {
    this.showUnassignedWarning.set(true);
    setTimeout(() => this.showUnassignedWarning.set(false), 3000);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    this.isNucleusDropdownOpen.set(false);
    this.isPriorityDropdownOpen.set(false);
    this.isStatusDropdownOpen.set(false);
  }

  toggleNucleus(name: string) {
    const current = this.selectedNuclei();
    if (current.includes(name)) {
      this.selectedNuclei.set(current.filter(n => n !== name));
    } else {
      this.selectedNuclei.set([...current, name]);
    }
    this.currentPage.set(1);
  }

  isNucleusSelected(name: string): boolean {
    return this.selectedNuclei().includes(name);
  }

  getNucleiLabel(): string {
    const selected = this.selectedNuclei();
    if (selected.length === 0) return 'Todos os Núcleos';
    if (selected.length === 1) return selected[0];
    return `${selected.length} selecionados`;
  }

  togglePriority(name: string) {
    const current = this.selectedPriorities();
    if (current.includes(name)) {
      this.selectedPriorities.set(current.filter(p => p !== name));
    } else {
      this.selectedPriorities.set([...current, name]);
    }
    this.currentPage.set(1);
  }

  isPrioritySelected(name: string): boolean {
    return this.selectedPriorities().includes(name);
  }

  getPrioritiesLabel(): string {
    const selected = this.selectedPriorities();
    if (selected.length === 0) return 'Todas as Prioridades';
    if (selected.length === 1) return selected[0];
    return `${selected.length} selecionadas`;
  }

  toggleStatusDetail(name: string) {
    const current = this.selectedStatusDetails();
    if (current.includes(name)) {
      this.selectedStatusDetails.set(current.filter(s => s !== name));
    } else {
      this.selectedStatusDetails.set([...current, name]);
    }
    this.currentPage.set(1);
  }

  isStatusDetailSelected(name: string): boolean {
    return this.selectedStatusDetails().includes(name);
  }

  getStatusDetailsLabel(): string {
    const selected = this.selectedStatusDetails();
    if (selected.length === 0) return 'Todos os Status';
    if (selected.length === 1) return selected[0];
    return `${selected.length} selecionados`;
  }

  constructor() {
    afterNextRender(() => {
      const user = this.currentUser();
      if (user) this.applyFilters();
    });
  }

  private currentRequestId = 0;

  // We'll use a more direct approach: update the list whenever filters change
  async loadServerData() {
    const user = this.currentUser();
    if (!user) return;

    const requestId = ++this.currentRequestId;
    this.isLoading.set(true);
    try {
      const filters = this.appliedFilters();
      console.log('Dashboard: loadServerData with appliedFilters:', filters);

      const validRoles: Role[] = ['Contador Judicial', 'Chefe', 'Gerente', 'Coordenador', 'Supervisor'];
      const targetNuclei = Array.isArray(filters.nucleus)
        ? (filters.nucleus.length > 0 ? filters.nucleus : [user.nucleus || ''])
        : [filters.nucleus !== 'Todos' ? filters.nucleus : user.nucleus || ''];
      const normalizedTargets = targetNuclei.map(t => t.trim().toUpperCase());
      const externalIds = this.users()
        .filter(u => {
          const uNuc = u.nucleus?.trim().toUpperCase() || '';
          return !normalizedTargets.includes(uNuc) && validRoles.includes(u.role);
        })
        .map(u => u.id);

      const result = await this.store.fetchPaginatedProcesses({
        page: this.currentPage(),
        pageSize: this.pageSize,
        searchTerm: filters.searchTerm,
        statusFilter: filters.status,
        priorityFilter: filters.priority,
        statusDetailFilter: filters.statusDetail,
        startDate: filters.startDate,
        endDate: filters.endDate,
        user: user,
        nucleusFilter: filters.nucleus,
        onlyAssignedToMe: filters.onlyAssignedToMe,
        unassignedOnly: filters.unassignedOnly,
        onlyReturns: filters.onlyReturns,
        over30DaysOnly: filters.over30DaysOnly,
        externalAccountantIds: filters.externalAccountantsOnly ? externalIds : undefined
      });

      if (this.currentRequestId !== requestId) {
        // A newer request has been made, ignore this one
        return;
      }

      this.serverProcesses.set(result.processes);
      this.totalFilteredCount.set(result.totalCount);
      this.hasLoadedServerData.set(true);
      console.log('Dashboard: loadServerData success. Count:', result.totalCount, 'Processes:', result.processes.length);

      // Also refresh the stats cards
      this.store.updateGlobalStats();
    } catch (e) {
      console.error('Dashboard: Error loading server data:', e);
      const msg = e instanceof Error ? e.message : String(e);
      this.showError(`Ocorreu um erro ao buscar os processos: ${msg}. Por favor, tente novamente.`);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Override the computed to use server data if available, otherwise fallback to local
  paginatedProcesses = computed(() => {
    if (this.onlyDuplicates()) {
      const all = this.filteredProcesses();
      const start = (this.currentPage() - 1) * this.pageSize;
      const end = start + this.pageSize;
      return all.slice(start, end);
    }

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
    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);
    const y = ninetyDaysAgo.getFullYear();
    const m = String(ninetyDaysAgo.getMonth() + 1).padStart(2, '0');
    const d = String(ninetyDaysAgo.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getDefaultEndDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  setStatusFilter(status: 'Pendente' | 'Todos' | 'Devolvidos') {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.applyFilters();
  }

  clearFilters() {
    this.onlyDuplicates.set(false);
    this.filterForm.patchValue({
      searchTerm: '',
      priorityFilter: 'Todos',
      statusDetailFilter: 'Todos',
      startDate: this.getDefaultStartDate(),
      endDate: this.getDefaultEndDate()
    });
    this.nucleusFilter.set('Todos');
    this.selectedNuclei.set([]);
    this.selectedPriorities.set([]);
    this.selectedStatusDetails.set([]);
    this.onlyAssignedToMe.set(false);
    this.unassignedOnly.set(false);
    this.externalAccountantsOnly.set(false);
    this.onlyReturns.set(false);
    this.over30DaysOnly.set(false);
    this.applyFilters();
  }

  applyFilters() {
    const { searchTerm, startDate, endDate } = this.filterForm.value;

    console.log('Dashboard: applyFilters called with:', { searchTerm, startDate, endDate });

    this.appliedFilters.set({
      searchTerm: searchTerm || '',
      startDate: this.onlyDuplicates() ? '' : (startDate || this.getDefaultStartDate()),
      endDate: this.onlyDuplicates() ? '' : (endDate || this.getDefaultEndDate()),
      status: this.statusFilter(),
      nucleus: this.selectedNuclei().length > 0 ? this.selectedNuclei() : 'Todos',
      priority: this.selectedPriorities().length > 0 ? this.selectedPriorities() : 'Todos',
      statusDetail: this.selectedStatusDetails().length > 0 ? this.selectedStatusDetails() : 'Todos',
      onlyAssignedToMe: this.onlyAssignedToMe(),
      unassignedOnly: this.unassignedOnly(),
      externalAccountantsOnly: this.externalAccountantsOnly(),
      onlyReturns: this.onlyReturns(),
      over30DaysOnly: this.over30DaysOnly(),
      onlyDuplicates: this.onlyDuplicates()
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

  onlyReturns = signal<boolean>(false);
  toggleOnlyReturns() {
    const newValue = !this.onlyReturns();
    this.onlyReturns.set(newValue);
    this.applyFilters();
  }

  over30DaysOnly = signal<boolean>(false);
  toggleOver30DaysOnly() {
    const newValue = !this.over30DaysOnly();
    this.over30DaysOnly.set(newValue);
    if (newValue) {
      this.statusFilter.set('Pendente'); // Forçar pendentes para este filtro
    }
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
    if (process.status === 'Pendente' && newStatus !== 'Pendente' && !process.assignedToId) {
      this.triggerUnassignedWarning();
      this.openStatusDropdownId.set(null);
      return;
    }

    // Update local state first (Optimistic)
    this.serverProcesses.update(prev => prev.map(p => p.id === process.id ? { ...p, status: newStatus } : p));
    this.openStatusDropdownId.set(null); // Fecha o dropdown imediatamente

    try {
      await this.store.updateProcessStatus(process.id, newStatus as Process['status']);
      // Pequeno delay para garantir que o trigger do banco terminou o recalculo
      setTimeout(() => this.loadServerData(), 500);
    } catch (e) {
      console.error('Dashboard: Erro ao atualizar status:', e);
      this.loadServerData(); // Força recarga em caso de erro
    }
  }

  async updatePriority(process: Process, newPriority: string) {
    // Update local state first (Optimistic)
    this.serverProcesses.update(prev => prev.map(p => p.id === process.id ? { ...p, priority: newPriority } : p));
    this.openPriorityDropdownId.set(null); // Fecha o dropdown

    try {
      await this.store.updateProcessFields(process.id, { priority: newPriority });
      setTimeout(() => this.loadServerData(), 500);
    } catch (e) {
      console.error('Dashboard: Erro ao atualizar prioridade:', e);
      this.loadServerData();
    }
  }

  async assignProcess(process: Process, userId: string) {
    // Update local state first (Optimistic)
    this.serverProcesses.update(prev => prev.map(p => p.id === process.id ? { ...p, assignedToId: userId } : p));

    try {
      await this.store.assignProcess(process.id, userId);
      setTimeout(() => this.loadServerData(), 500);
    } catch (e) {
      console.error('Dashboard: Erro ao atribuir processo:', e);
      this.loadServerData();
    }
  }

  canEditPriority(): boolean {
    const user = this.currentUser();
    if (!user) return false;
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente', 'Gestor CC', 'Gestor CCJ'];
    return privilegedRoles.includes(user.role);
  }

  canDeleteProcess(): boolean {
    const user = this.currentUser();
    if (!user) return false;
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente', 'Gestor CC', 'Gestor CCJ'];
    return privilegedRoles.includes(user.role);
  }

  canEditCompletionDate(): boolean {
    const user = this.currentUser();
    if (!user) return false;
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente', 'Gestor CC', 'Gestor CCJ'];
    return privilegedRoles.includes(user.role);
  }

  async deleteProcess(process: Process) {
    this.confirmDeleteProcess.set(process);
  }

  async confirmDelete() {
    const process = this.confirmDeleteProcess();
    if (!process) return;
    this.confirmDeleteProcess.set(null);
    try {
      await this.store.deleteProcess(process.id);
      this.loadServerData();
    } catch (error: unknown) {
      this.showError(error instanceof Error ? error.message : 'Erro ao excluir processo.');
    }
  }

  cancelDelete() {
    this.confirmDeleteProcess.set(null);
  }

  async updateFields(process: Process, field: 'valorCustas' | 'observacao' | 'priority' | 'completionDate' | 'assignmentDate', event: Event) {
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
    const statusClean = (status || '').trim().toLowerCase();
    const greenStatuses = [
      'cálculo atualizado',
      'cálculo realizado',
      'devolvido: ausência de parâmetros',
      'devolvido: ausência de documentos para os cálculos',
      'devolvido: beneficiário da justiça gratuita',
      'devolvido: custas satisfeitas',
      'devolvido: esclarecimento realizado',
      'partilha realizada'
    ];

    if (statusClean === 'pendente') {
      return 'bg-red-700 text-white';
    }
    if (statusClean === 'triagem do gestor') {
      return 'bg-amber-100 text-amber-800';
    }
    if (greenStatuses.includes(statusClean)) {
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
    const requestId = ++this.currentRequestId;
    try {
      const filters = this.appliedFilters();
      const validRoles: Role[] = ['Contador Judicial', 'Chefe', 'Gerente', 'Coordenador', 'Supervisor'];
      const targetNuclei = Array.isArray(filters.nucleus)
        ? (filters.nucleus.length > 0 ? filters.nucleus : [user.nucleus || ''])
        : [filters.nucleus !== 'Todos' ? filters.nucleus : user.nucleus || ''];
      const normalizedTargets = targetNuclei.map(t => t.trim().toUpperCase());
      const externalIds = this.users()
        .filter(u => {
          const uNuc = u.nucleus?.trim().toUpperCase() || '';
          return !normalizedTargets.includes(uNuc) && validRoles.includes(u.role);
        })
        .map(u => u.id);

      const processes = await this.store.fetchAllFilteredProcesses({
        searchTerm: filters.searchTerm,
        statusFilter: filters.status,
        priorityFilter: filters.priority,
        statusDetailFilter: filters.statusDetail,
        startDate: filters.startDate,
        endDate: filters.endDate,
        user: user,
        nucleusFilter: filters.nucleus,
        onlyAssignedToMe: filters.onlyAssignedToMe,
        unassignedOnly: filters.unassignedOnly,
        onlyReturns: filters.onlyReturns,
        over30DaysOnly: filters.over30DaysOnly,
        externalAccountantIds: filters.externalAccountantsOnly ? externalIds : undefined
      } as PaginationOptions);

      const data = (processes || []).map((p: Process) => ({
        'Posição Geral': p.position,
        'Posição Prioridade': p.priorityPosition || '-',
        'Número do Processo': p.number,
        'Data de Remessa': p.entryDate,
        'Vara': p.court,
        'Tempo (dias)': p.tempoNaContadoria,
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
      this.showError('Ocorreu um erro ao exportar os dados. Tente novamente.');
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

    let assignable = [];
    // Supervisor, Coordenador, Chefe, Gerente and Admin can assign to anyone (except Admins)
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente', 'Gestor CC', 'Gestor CCJ'];
    if (privilegedRoles.includes(user.role)) {
      if (user.role === 'Gestor CC') {
        assignable = this.users().filter(u => u.role !== 'Administrador' && u.nucleus?.trim().toUpperCase().endsWith('CC'));
      } else if (user.role === 'Gestor CCJ') {
        assignable = this.users().filter(u => u.role !== 'Administrador' && u.nucleus?.trim().toUpperCase().endsWith('CCJ'));
      } else {
        assignable = this.users().filter(u => u.role !== 'Administrador');
      }
    } else {
      // Default fallback (though they shouldn't see the select if they can't assign)
      assignable = this.users().filter(u => u.nucleus === nucleus && u.role !== 'Administrador');
    }

    return assignable.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  canAssign(): boolean {
    const user = this.currentUser();
    if (!user) return false;

    // Supervisor, Coordenador, Chefe, Gerente and Admin can assign any process
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente', 'Gestor CC', 'Gestor CCJ'];
    if (privilegedRoles.includes(user.role)) return true;

    return false;
  }

  canChangeStatus(process: Process): boolean {
    const user = this.currentUser();
    if (!user) return false;

    // Admins, Coordinators, Supervisors and Managers can always change
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente', 'Gestor CC', 'Gestor CCJ'];
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

    if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      nucleus = user.nucleus;
    } else if (nucleus === 'Todos') {
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

    // Reset flags
    this.isAutoinspecao.set(false);
    this.assignLimit.set(null);

    // Fetch unassigned count
    this.unassignedCount.set(await this.store.getUnassignedCount(nucleus, false));

    this.isConfirmingAutoAssign.set(true);
  }

  async updateAutoAssignCount() {
    let nucleus = this.nucleusFilter();
    const user = this.currentUser();
    if (user?.role === 'Gestor CC' || user?.role === 'Gestor CCJ') {
      nucleus = user.nucleus;
    } else if (nucleus === 'Todos') {
      if (user?.nucleus && user.nucleus !== 'Administração') nucleus = user.nucleus;
    }
    if (nucleus !== 'Todos') {
      this.unassignedCount.set(await this.store.getUnassignedCount(nucleus, this.isAutoinspecao()));
    }
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
    if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      nucleus = user.nucleus;
    } else if (nucleus === 'Todos') {
      nucleus = user.nucleus;
    }

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
      const limit = this.assignLimit() || undefined;
      const count = await this.store.autoAssignProcesses(nucleus, selectedIds, this.isAutoinspecao(), limit);
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

  async unassign() {
    const user = this.currentUser();
    if (!user) return;

    let nucleus = this.nucleusFilter();

    if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      nucleus = user.nucleus;
    } else if (nucleus === 'Todos') {
      if (user.nucleus && user.nucleus !== 'Administração') {
        nucleus = user.nucleus;
      } else {
        this.unassignMessage.set('Por favor, selecione um núcleo específico no filtro antes de realizar a desatribuição.');
        setTimeout(() => this.unassignMessage.set(null), 5000);
        return;
      }
    }

    const usersInNuc = this.usersInNucleusForAutoAssign();
    const userIds = usersInNuc.map(u => u.id);

    this.isLoading.set(true);
    try {
      const counts = await this.store.getAssignedCountsByUsers(nucleus, userIds);
      this.assignedCounts.set(counts);
      this.selectedUnassignUserIds.set([]);
      this.isConfirmingUnassign.set(true);
    } catch (e) {
      console.error('Dashboard: Erro ao carregar contagem de processos dos contadores:', e);
      this.showError('Não foi possível carregar a contagem de processos dos contadores.');
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleUnassignUserSelection(userId: string) {
    this.selectedUnassignUserIds.update(ids => {
      if (ids.includes(userId)) {
        return ids.filter(id => id !== userId);
      } else {
        return [...ids, userId];
      }
    });
  }

  async confirmUnassign() {
    const user = this.currentUser();
    if (!user) return;

    let nucleus = this.nucleusFilter();
    if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      nucleus = user.nucleus;
    } else if (nucleus === 'Todos') {
      nucleus = user.nucleus;
    }

    const selectedIds = this.selectedUnassignUserIds();
    if (selectedIds.length === 0) {
      this.unassignMessage.set('Selecione pelo menos um contador para a desatribuição.');
      setTimeout(() => this.unassignMessage.set(null), 3000);
      return;
    }

    this.isConfirmingUnassign.set(false);
    this.isUnassigning.set(true);
    this.unassignMessage.set('Retirando atribuições...');

    try {
      const count = await this.store.unassignProcessesFromUsers(nucleus, selectedIds);
      this.unassignMessage.set(`Atribuição de ${count} processos pendentes (não retorno) retirada com sucesso no núcleo ${nucleus}.`);
      this.loadServerData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.unassignMessage.set(`Erro ao retirar atribuição: ${message}`);
    } finally {
      this.isUnassigning.set(false);
      setTimeout(() => this.unassignMessage.set(null), 5000);
    }
  }

  cancelUnassign() {
    this.isConfirmingUnassign.set(false);
    this.selectedUnassignUserIds.set([]);
  }

  async copyProcessNumber(processNumber: string) {
    try {
      await navigator.clipboard.writeText(processNumber);
    } catch (err) {
      console.error('Falha ao copiar número do processo', err);
    }
  }
}
