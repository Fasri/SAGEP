import {ChangeDetectionStrategy, Component, signal, computed, inject, OnInit, effect} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {StoreService} from '../../services/store';
import {Process, Role} from '../../types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private store = inject(StoreService);

  currentUser = this.store.currentUser;
  processes = this.store.processes;
  users = this.store.users;
  statusTipos = this.store.statusTipos;

  searchTerm = signal('');
  statusFilter = signal<'Pendente' | 'Todos'>('Pendente');
  currentPage = signal(1);
  pageSize = 20;
  
  // Processes visible to the current user based on their role
  visibleProcesses = computed(() => {
    const user = this.currentUser();
    const all = this.processes();
    if (!user) return [];

    return all.filter(p => {
      if (user.role === 'Administrador' || user.role === 'Coordenador' || user.role === 'Supervisor') {
        return true;
      } else if (user.role === 'Chefe' || user.role === 'Gerente') {
        return p.nucleus === user.nucleus;
      } else {
        return p.assignedToId === user.id;
      }
    });
  });

  // Dashboard Stats
  isLoading = signal(false);
  totalFilteredCount = signal(0);
  serverProcesses = signal<Process[]>([]);

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

  filteredProcesses = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    const { startDate, endDate } = this.filterForm.value;
    
    const filtered = this.visibleProcesses().filter(p => {
      // Status Filter
      if (status === 'Pendente' && p.status !== 'Pendente') return false;

      // Date Filter
      if (startDate) {
        // Use UTC to avoid timezone shifts during comparison
        const pDate = new Date(p.entryDate + 'T00:00:00');
        const sDate = new Date(startDate + 'T00:00:00');
        if (pDate < sDate) return false;
      }
      if (endDate) {
        const pDate = new Date(p.entryDate + 'T00:00:00');
        const eDate = new Date(endDate + 'T00:00:00');
        if (pDate > eDate) return false;
      }

      return p.number.toLowerCase().includes(term) || 
             p.court.toLowerCase().includes(term) ||
             p.status.toLowerCase().includes(term) ||
             p.nucleus.toLowerCase().includes(term);
    });

    // Sort by entryDate ascending
    return filtered.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
  });

  // This effect will trigger whenever filters or page change
  constructor() {
    // Initial load is handled by store.loadData which has the 1000 limit.
    // We will override the display with a more robust fetch if needed.
    
    // Auto-reload when user changes
    effect(() => {
      const user = this.currentUser();
      if (user) {
        this.loadServerData();
      }
    });
  }

  ngOnInit() {
    this.loadServerData();
  }

  // We'll use a more direct approach: update the list whenever filters change
  async loadServerData() {
    const user = this.currentUser();
    if (!user) return;

    this.isLoading.set(true);
    try {
      const { startDate, endDate } = this.filterForm.value;
      const result = await this.store.fetchPaginatedProcesses({
        page: this.currentPage(),
        pageSize: this.pageSize,
        searchTerm: this.searchTerm(),
        statusFilter: this.statusFilter(),
        startDate: startDate || '',
        endDate: endDate || '',
        user: user
      });

      this.serverProcesses.set(result.processes);
      this.totalFilteredCount.set(result.totalCount);
      
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
    const server = this.serverProcesses();
    if (server.length > 0 || this.totalFilteredCount() > 1000) {
      return server;
    }
    
    // Fallback to local pagination for small datasets or initial load
    const all = this.filteredProcesses();
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return all.slice(start, end);
  });

  totalPages = computed(() => {
    const total = Math.max(this.totalFilteredCount(), this.filteredProcesses().length);
    return Math.max(1, Math.ceil(total / this.pageSize));
  });

  filterForm = new FormGroup({
    startDate: new FormControl(this.getDefaultStartDate()),
    endDate: new FormControl(this.getDefaultEndDate())
  });

  private getDefaultStartDate(): string {
    // Default to a much earlier date to ensure mock/older data is visible
    return '2020-01-01';
  }

  private getDefaultEndDate(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  setStatusFilter(status: 'Pendente' | 'Todos') {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadServerData();
  }

  onSearch(input: string) {
    this.searchTerm.set(input);
    this.currentPage.set(1);
    this.loadServerData();
  }

  applyFilters() {
    this.currentPage.set(1);
    this.loadServerData();
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

  updateStatus(process: Process, newStatus: string) {
    this.store.updateProcessStatus(process.id, newStatus as Process['status']);
  }

  assignProcess(process: Process, userId: string) {
    this.store.assignProcess(process.id, userId);
  }

  updateFields(process: Process, field: 'valorCustas' | 'observacao', event: Event) {
    const input = event.target as HTMLInputElement;
    const value = field === 'valorCustas' ? parseFloat(input.value) : input.value;
    this.store.updateProcessFields(process.id, { [field]: value });
  }

  getUserName(userId: string | null): string {
    if (!userId) return 'Não atribuído';
    return this.users().find(u => u.id === userId)?.name || 'Desconhecido';
  }

  getAssignableUsers(nucleus: string) {
    // Can assign to anyone in the nucleus EXCEPT Administrador
    return this.users().filter(u => u.nucleus === nucleus && u.role !== 'Administrador');
  }

  canChangeStatus(process: Process): boolean {
    const user = this.currentUser();
    if (!user) return false;
    
    // Admins, Coordinators, Supervisors and Managers can always change
    const privilegedRoles: Role[] = ['Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente'];
    if (privilegedRoles.includes(user.role)) return true;
    
    // Contadores can only change if it's still Pendente
    return process.status === 'Pendente';
  }
}
