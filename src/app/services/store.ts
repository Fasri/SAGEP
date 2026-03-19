import {Injectable, signal, effect} from '@angular/core';
import {User, Process, Nucleo, Prioridade, StatusTipo} from '../types';
import {getSupabase} from '../supabase';
import {SupabaseClient} from '@supabase/supabase-js';
import { read, utils } from 'xlsx';

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  // Mock Users (Contadores) - Fallback
  private mockUsers: User[] = [
    { 
      id: 'u1', 
      matricula: '10001', 
      name: 'Admin Master', 
      role: 'Administrador', 
      nucleus: 'GERAL', 
      functionalEmail: 'admin@tjpe.jus.br', 
      gmail: 'admin@gmail.com', 
      metaPercentage: 100, 
      birthDate: '1970-01-01',
      active: true,
      password: '123456'
    },
    { 
      id: 'u2', 
      matricula: '10002', 
      name: 'Coord Geral', 
      role: 'Coordenador', 
      nucleus: 'GERAL', 
      functionalEmail: 'coord@tjpe.jus.br', 
      gmail: 'coord@gmail.com', 
      metaPercentage: 100, 
      birthDate: '1975-06-15',
      active: true,
      password: '123456'
    },
    { 
      id: 'u3', 
      matricula: '10003', 
      name: 'Super Visor', 
      role: 'Supervisor', 
      nucleus: 'GERAL', 
      functionalEmail: 'super@tjpe.jus.br', 
      gmail: 'super@gmail.com', 
      metaPercentage: 100, 
      birthDate: '1982-12-10',
      active: true,
      password: '123456'
    },
    { 
      id: 'u4', 
      matricula: '12345', 
      name: 'João Silva', 
      role: 'Chefe', 
      nucleus: '1ª CC', 
      functionalEmail: 'joao.silva@tjpe.jus.br', 
      gmail: 'joaosilva@gmail.com', 
      metaPercentage: 100, 
      birthDate: '1980-05-15',
      active: true,
      password: '123456'
    },
    { 
      id: 'u5', 
      matricula: '23456', 
      name: 'Maria Oliveira', 
      role: 'Gerente', 
      nucleus: '1ª CC', 
      functionalEmail: 'maria.oliveira@tjpe.jus.br', 
      gmail: 'mariaol@gmail.com', 
      metaPercentage: 100, 
      birthDate: '1985-08-20',
      active: true,
      password: '123456'
    },
    { 
      id: 'u6', 
      matricula: '34567', 
      name: 'Carlos Santos', 
      role: 'Contador Judicial', 
      nucleus: '1ª CC', 
      functionalEmail: 'carlos.santos@tjpe.jus.br', 
      gmail: 'carloss@gmail.com', 
      metaPercentage: 100, 
      birthDate: '1990-01-10',
      active: true,
      password: '123456'
    },
    { 
      id: 'u7', 
      matricula: '45678', 
      name: 'Ana Costa', 
      role: 'Contador Judicial', 
      nucleus: '1ª CC', 
      functionalEmail: 'ana.costa@tjpe.jus.br', 
      gmail: 'anacosta@gmail.com', 
      metaPercentage: 100, 
      birthDate: '1992-11-25',
      active: true,
      password: '123456'
    },
    { 
      id: 'u8', 
      matricula: '56789', 
      name: 'Ricardo Pereira', 
      role: 'Chefe', 
      nucleus: '6ª CC', 
      functionalEmail: 'ricardo.p@tjpe.jus.br', 
      gmail: 'ricardop@gmail.com', 
      metaPercentage: 100, 
      birthDate: '1975-03-30',
      active: true,
      password: '123456'
    },
  ];

  users = signal<User[]>(this.mockUsers);

  // Auth State
  currentUser = signal<User | null>(null);
  isSupabaseConnected = signal<boolean>(false);
  recalculationProgress = signal<number>(0);

  // Dynamic Tables
  nucleos = signal<Nucleo[]>([]);
  prioridades = signal<Prioridade[]>([]);
  statusTipos = signal<StatusTipo[]>([]);
  globalStats = signal<{ pendentes: number, concluidos: number, devolvidos: number }>({
    pendentes: 0,
    concluidos: 0,
    devolvidos: 0
  });

  // Process List
  processes = signal<Process[]>([
    {
      id: '1',
      position: 1,
      priorityPosition: 1,
      number: '0000123-45.2023.8.17.2001',
      entryDate: '2023-10-12',
      court: '1ª Vara Cível - Recife',
      nucleus: '1ª CC',
      priority: 'Super prioridade',
      status: 'Pendente',
      assignedToId: null,
      assignmentDate: null,
      completionDate: null
    },
    {
      id: '2',
      position: 5,
      priorityPosition: 2,
      number: '0012894-12.2023.8.17.2001',
      entryDate: '2023-10-14',
      court: '3ª Vara de Família',
      nucleus: '1ª CC',
      priority: 'Prioridade legal',
      status: 'Pendente',
      assignedToId: 'u3',
      assignmentDate: '2023-10-15',
      completionDate: null
    },
    {
      id: '3',
      position: 12,
      priorityPosition: null,
      number: '0005542-88.2023.8.17.2001',
      entryDate: '2023-10-15',
      court: '2ª Vara da Fazenda',
      nucleus: '6ª CC',
      priority: 'Sem prioridade',
      status: 'Pendente',
      assignedToId: null,
      assignmentDate: null,
      completionDate: null
    },
    {
      id: '4',
      position: 18,
      priorityPosition: 5,
      number: '0019923-33.2023.8.17.2001',
      entryDate: '2023-10-18',
      court: '5ª Vara Cível - Recife',
      nucleus: '1ª CC',
      priority: 'Prioridade legal',
      status: 'Cálculo Realizado',
      assignedToId: 'u4',
      assignmentDate: '2023-10-19',
      completionDate: '2023-10-25'
    },
    {
      id: '5',
      position: 22,
      priorityPosition: null,
      number: '0023456-77.2023.8.17.2001',
      entryDate: '2023-10-20',
      court: '4ª Vara Cível',
      nucleus: '1ª CC',
      priority: 'Sem prioridade',
      status: 'Pendente',
      assignedToId: 'u1',
      assignmentDate: '2023-10-21',
      completionDate: null
    }
  ]);

  constructor() {
    const client = getSupabase();
    console.log('StoreService: Supabase Client Status:', client ? 'Initialized' : 'Not Initialized');
    this.isSupabaseConnected.set(!!client);
    
    if (client) {
      this.testConnection(client);
    }
    
    this.loadData();

    // Refresh stats when user changes
    effect(() => {
      const user = this.currentUser();
      if (user) {
        this.updateGlobalStats();
      }
    });
  }

  private async testConnection(client: SupabaseClient) {
    try {
      const { error } = await client.from('users').select('count', { count: 'exact', head: true });
      if (error) {
        console.error('StoreService: Supabase connection test failed:', error.message);
        this.isSupabaseConnected.set(false);
      } else {
        console.log('StoreService: Supabase connection test successful. Connection is active.');
        this.isSupabaseConnected.set(true);
      }
    } catch (e) {
      console.error('StoreService: Unexpected error during Supabase connection test:', e);
      this.isSupabaseConnected.set(false);
    }
  }

  async loadData() {
    console.log('StoreService: Starting loadData...');
    const client = getSupabase();
    if (!client) {
      console.warn('StoreService: Supabase not configured. Using mock data only.');
      return;
    }

    try {
      // Fetch dynamic tables first to ensure normalization works
      const { data: nucleos } = await client.from('nucleos').select('*');
      if (nucleos && nucleos.length > 0) {
        this.nucleos.set(nucleos);
      } else {
        await this.seedDatabase(client);
        // Re-fetch after seed
        const { data: n } = await client.from('nucleos').select('*');
        if (n) this.nucleos.set(n);
      }

      const { data: prioridades } = await client.from('prioridades').select('*');
      if (prioridades && prioridades.length > 0) {
        this.prioridades.set(prioridades);
      } else {
        // If nucleos existed but prioridades didn't, we might need to seed just prioridades
        // But seedDatabase handles all. Let's just ensure we have them.
        await this.seedDatabase(client);
        const { data: p } = await client.from('prioridades').select('*');
        if (p) this.prioridades.set(p);
      }

      const { data: statusTipos } = await client.from('status').select('*');
      if (statusTipos && statusTipos.length > 0) {
        this.statusTipos.set(statusTipos);
      } else {
        await this.seedDatabase(client);
        const { data: s } = await client.from('status').select('*');
        if (s) this.statusTipos.set(s);
      }

      // Fetch counts for stats
      this.updateGlobalStats();
      
      console.log('StoreService: Fetching users from Supabase...');
      const { data: users, error: usersError } = await client.from('users').select('*');
      if (usersError) {
        console.error('StoreService: Error fetching users:', usersError);
        this.isSupabaseConnected.set(false);
      } else if (users) {
        this.isSupabaseConnected.set(true);
        console.log(`StoreService: Loaded ${users.length} users from Supabase.`);
        this.users.set(users.map((u: Record<string, unknown>) => ({
          id: String(u['id']),
          matricula: String(u['matricula']),
          name: String(u['name']),
          role: u['role'] as User['role'],
          nucleus: this.normalizeNucleus(String(u['nucleus'])),
          functionalEmail: String(u['functional_email']),
          gmail: String(u['gmail']),
          metaPercentage: Number(u['meta_percentage']),
          birthDate: String(u['birth_date']),
          active: Boolean(u['active']),
          password: String(u['password'] || '123456')
        })));
      }

      console.log('StoreService: Fetching processes from Supabase (limited to 100)...');
      const { data: processes, error: processesError } = await client.from('vw_processes')
        .select('*')
        .order('priority_level', { ascending: true })
        .order('position', { ascending: true })
        .limit(100);
      
      if (processesError) {
        console.error('StoreService: Error fetching processes:', processesError);
      } else if (processes && processes.length > 0) {
        console.log(`StoreService: Loaded ${processes.length} processes from Supabase.`);
        this.processes.set(processes.map((p: Record<string, unknown>) => ({
          id: String(p['id'] || ''),
          position: Number(p['position'] || 0),
          priorityPosition: p['priority_position'] ? Number(p['priority_position']) : null,
          number: String(p['number'] || ''),
          entryDate: String(p['entry_date'] || new Date().toISOString().split('T')[0]),
          court: String(p['court'] || ''),
          nucleus: String(p['nucleus'] || 'GERAL'),
          priority: this.normalizePriority(String(p['priority'] || '2-Sem prioridade')),
          status: this.normalizeStatus(String(p['status'] || 'Pendente')),
          assignedToId: p['assigned_to_id'] ? String(p['assigned_to_id']) : null,
          assignmentDate: p['assignment_date'] ? String(p['assignment_date']) : null,
          completionDate: p['completion_date'] ? String(p['completion_date']) : null,
          valorCustas: p['valor_custas'] ? Number(p['valor_custas']) : 0,
          observacao: p['observacao'] ? String(p['observacao']) : ''
        })));
      } else if (processes && processes.length === 0) {
        console.log('StoreService: Processes table is empty. Seeding initial processes...');
        await this.seedProcesses(client);
      }

    } catch (e) {
      console.error('StoreService: Unexpected error in loadData:', e);
    }
  }

  private fixEncoding(text: string): string {
    if (!text) return '';
    
    // Common UTF-8 mangled characters in Latin-1 environments using Unicode escapes
    return text
      .replace(/\u00C3\u00A1/g, 'á')
      .replace(/\u00C3\u00A0/g, 'à')
      .replace(/\u00C3\u00A2/g, 'â')
      .replace(/\u00C3\u00A3/g, 'ã')
      .replace(/\u00C3\u00A9/g, 'é')
      .replace(/\u00C3\u00AA/g, 'ê')
      .replace(/\u00C3\u00AD/g, 'í')
      .replace(/\u00C3\u00B3/g, 'ó')
      .replace(/\u00C3\u00B4/g, 'ô')
      .replace(/\u00C3\u00B5/g, 'õ')
      .replace(/\u00C3\u00BA/g, 'ú')
      .replace(/\u00C3\u0081/g, 'Á')
      .replace(/\u00C3\u0089/g, 'É')
      .replace(/\u00C3\u008D/g, 'Í')
      .replace(/\u00C3\u0093/g, 'Ó')
      .replace(/\u00C3\u009A/g, 'Ú')
      .replace(/\u00C3\u00A7/g, 'ç')
      .replace(/\u00C3\u0087/g, 'Ç')
      .replace(/\u00C3\u0080/g, 'À')
      .replace(/\u00C3\u0082/g, 'Â')
      .replace(/\u00C3\u0083/g, 'Ã')
      .replace(/\u00C3\u008A/g, 'Ê')
      .replace(/\u00C3\u0094/g, 'Ô')
      .replace(/\u00C3\u0095/g, 'Õ')
      .replace(/\u00C2\u00BA/g, 'º')
      .replace(/\u00C2\u00AA/g, 'ª')
      .replace(/[\uFFFD]/g, 'ª'); // Replacement character
  }

  private normalizeNucleus(name: string): string {
    if (!name) return '1ª CC';
    const fixed = this.fixEncoding(name).trim();
    const n = fixed.toUpperCase();
    
    // 1. Try exact match (case-insensitive)
    const found = this.nucleos().find(item => item.nome.toUpperCase() === n);
    if (found) return found.nome;

    // 2. Try match ignoring accents (fuzzy)
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const fixedNormalized = normalize(fixed);
    const fuzzyFound = this.nucleos().find(item => normalize(item.nome) === fixedNormalized);
    if (fuzzyFound) return fuzzyFound.nome;

    // 3. Fuzzy matching: remove ALL non-alphanumeric characters to be safe
    const fuzzy = n.replace(/[^A-Z0-9]/g, '');
    
    if (fuzzy === '1CC' || fuzzy === '1CAMARACIVEL') return '1ª CC';
    if (fuzzy === '2CC' || fuzzy === '2CAMARACIVEL') return '2ª CC';
    if (fuzzy === '3CC' || fuzzy === '3CAMARACIVEL') return '3ª CC';
    if (fuzzy === '4CC' || fuzzy === '4CAMARACIVEL') return '4ª CC';
    if (fuzzy === '5CC' || fuzzy === '5CAMARACIVEL') return '5ª CC';
    if (fuzzy === '6CC' || fuzzy === '6CAMARACIVEL') return '6ª CC';
    if (fuzzy === '7CC' || fuzzy === '7CAMARACIVEL') return '7ª CC';
    if (fuzzy === '8CC' || fuzzy === '8CAMARACIVEL') return '8ª CC';
    
    // Specific check for CCJ variations
    if (fuzzy.includes('1CCJ')) return '1ª CCJ';
    if (fuzzy.includes('2CCJ')) return '2ª CCJ';
    if (fuzzy === 'CCJ') return 'CCJ';

    return fixed; // Return fixed name if no match found
  }

  private getPriorityLevel(priority: string): number {
    if (!priority) return 2;
    const p = priority.toUpperCase();
    if (p.includes('SUPER')) return 1;
    // Both 'LEGAL' and 'SEM' are level 2 as requested
    return 2;
  }

  private isPriority(priority: string): boolean {
    if (!priority) return false;
    const p = priority.toUpperCase();
    // Both Super and Legal should have a priority position
    // Check for prefixes as well (1- or 2- for legal)
    return p.includes('SUPER') || p.includes('LEGAL') || p.startsWith('1-') || p.startsWith('2-PRIORIDADE');
  }

  private normalizePriority(name: string): string {
    if (!name) return '2-Sem prioridade';
    const fixed = this.fixEncoding(name).trim();
    const n = fixed.toUpperCase();
    
    // 1. Try exact match (case-insensitive)
    const foundExact = this.prioridades().find(item => item.nome.toUpperCase() === n);
    if (foundExact) return foundExact.nome;

    // 2. Try match ignoring accents (fuzzy)
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const fixedNormalized = normalize(fixed);
    const fuzzyFound = this.prioridades().find(item => normalize(item.nome) === fixedNormalized);
    if (fuzzyFound) return fuzzyFound.nome;

    // Fuzzy matching for common terms
    if (n.includes('SUPER')) {
      const found = this.prioridades().find(item => item.nome.toUpperCase().includes('SUPER'));
      return found ? found.nome : '1-Super prioridade';
    }
    if (n.includes('LEGAL')) {
      const found = this.prioridades().find(item => item.nome.toUpperCase().includes('LEGAL'));
      return found ? found.nome : '2-Prioridade legal';
    }
    if (n.includes('SEM')) {
      const found = this.prioridades().find(item => item.nome.toUpperCase().includes('SEM'));
      return found ? found.nome : '2-Sem prioridade';
    }
    
    return fixed; // Return fixed name if no match found
  }

  private normalizeStatus(name: string): string {
    if (!name) return 'Pendente';
    const fixed = this.fixEncoding(name).trim();
    
    // 1. Try exact match (case-insensitive)
    const found = this.statusTipos().find(s => s.nome.toLowerCase() === fixed.toLowerCase());
    if (found) return found.nome;
    
    // 2. Try match ignoring accents (fuzzy)
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const fixedNormalized = normalize(fixed);
    const fuzzyFound = this.statusTipos().find(s => normalize(s.nome) === fixedNormalized);
    if (fuzzyFound) return fuzzyFound.nome;
    
    return fixed;
  }

  private parseDateSafely(dateStr: string): number {
    if (!dateStr) return 0;
    
    // Try standard YYYY-MM-DD
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length >= 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2].substring(0, 2), 10);
        const d = new Date(year, month, day, 12, 0, 0); // Use noon to avoid timezone shifts
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
    
    // Try DD/MM/YYYY
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
    
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? 0 : fallback.getTime();
  }

  private handleSupabaseError(error: unknown, context: string) {
    console.error(`StoreService: Error in ${context}:`, error);
    
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

  private async seedProcesses(client: SupabaseClient) {
    const initialProcesses = [
      {
        position: 1,
        number: '0000123-45.2023.8.17.2001',
        entry_date: '2023-10-12',
        court: '1ª Vara Cível - Recife',
        nucleus: '1ª CC',
        priority: '1-Super prioridade',
        status: 'Pendente'
      },
      {
        position: 2,
        number: '0012894-12.2023.8.17.2001',
        entry_date: '2023-10-14',
        court: '3ª Vara de Família',
        nucleus: '1ª CC',
        priority: '2-Prioridade legal',
        status: 'Pendente'
      },
      {
        position: 3,
        number: '0005542-88.2023.8.17.2001',
        entry_date: '2023-10-15',
        court: '2ª Vara da Fazenda',
        nucleus: '6ª CC',
        priority: '2-Sem prioridade',
        status: 'Pendente'
      }
    ];

    try {
      const { count } = await client.from('processes').select('*', { count: 'exact', head: true });
      if (count && count > 0) {
        const { data } = await client.from('processes').select('*');
        if (data) {
          this.processes.set(data.map((p: Record<string, unknown>) => ({
            id: String(p['id']),
            position: Number(p['position']),
            priorityPosition: p['priority_position'] ? Number(p['priority_position']) : null,
            number: String(p['number']),
            entryDate: String(p['entry_date']),
            court: String(p['court']),
            nucleus: String(p['nucleus']),
            priority: this.normalizePriority(String(p['priority'])),
            status: this.normalizeStatus(String(p['status'])),
            assignedToId: p['assigned_to_id'] ? String(p['assigned_to_id']) : null,
            valorCustas: p['valor_custas'] ? Number(p['valor_custas']) : 0,
            observacao: p['observacao'] ? String(p['observacao']) : ''
          })));
        }
        return;
      }

      const { error } = await client.from('processes').insert(initialProcesses);
      if (error) console.error('StoreService: Error seeding processes:', error);
      else {
        // Reload to get the seeded data with their real IDs
        const { data } = await client.from('processes').select('*');
        if (data) {
          this.processes.set(data.map((p: Record<string, unknown>) => ({
            id: String(p['id']),
            position: Number(p['position']),
            priorityPosition: p['priority_position'] ? Number(p['priority_position']) : null,
            number: String(p['number']),
            entryDate: String(p['entry_date']),
            court: String(p['court']),
            nucleus: String(p['nucleus']),
            priority: this.normalizePriority(String(p['priority'])),
            status: this.normalizeStatus(String(p['status'])),
            assignedToId: p['assigned_to_id'] ? String(p['assigned_to_id']) : null,
            valorCustas: p['valor_custas'] ? Number(p['valor_custas']) : 0,
            observacao: p['observacao'] ? String(p['observacao']) : ''
          })));
        }
      }
    } catch (e) {
      console.error('StoreService: Exception seeding processes:', e);
    }
  }

  private async seedDatabase(client: SupabaseClient) {
    console.log('StoreService: Seeding database with default values...');
    
    const defaultNucleos = [
      { nome: '1ª CC', descricao: '1ª Câmara Cível' },
      { nome: '2ª CC', descricao: '2ª Câmara Cível' },
      { nome: '3ª CC', descricao: '3ª Câmara Cível' },
      { nome: '4ª CC', descricao: '4ª Câmara Cível' },
      { nome: '5ª CC', descricao: '5ª Câmara Cível' },
      { nome: '6ª CC', descricao: '6ª Câmara Cível' },
      { nome: '7ª CC', descricao: '7ª Câmara Cível' },
      { nome: '8ª CC', descricao: '8ª Câmara Cível' },
      { nome: '1ª CCJ', descricao: '1ª Câmara Regional' },
      { nome: '2ª CCJ', descricao: '2ª Câmara Regional' },
      { nome: 'CCJ', descricao: 'Câmara Regional' },
      { nome: 'GERAL', descricao: 'Núcleo Geral' }
    ];

    const defaultPrioridades = [
      { nome: '2-Sem prioridade', descricao: 'Processo comum' },
      { nome: '2-Prioridade legal', descricao: 'Idoso, doença grave, etc' },
      { nome: '1-Super prioridade', descricao: 'Acima de 80 anos' }
    ];

    const defaultStatus = [
      { nome: 'Pendente', descricao: 'Aguardando início' },
      { nome: 'Cálculo Realizado', descricao: 'Finalizado com sucesso' },
      { nome: 'Devolvido sem Cálculo', descricao: 'Impossibilidade técnica' },
      { nome: 'Devolvido: atualizar o valor da causa', descricao: '' },
      { nome: 'Devolvido: Custas Satisfeitas', descricao: '' },
      { nome: 'Devolvido: Beneficiário da Justiça Gratuita', descricao: '' },
      { nome: 'Devolvido: ausência de certidão de trânsito em julgado', descricao: '' },
      { nome: 'Devolvido: ausência de parâmetros', descricao: '' },
      { nome: 'Cálculo realizado', descricao: '' },
      { nome: 'Cálculo atualizado do calculista', descricao: '' },
      { nome: 'Devolvido: ausência de documentos para os cálculos', descricao: '' },
      { nome: 'Devolvido: perícia', descricao: '' },
      { nome: 'Devolvido: incompetência', descricao: '' },
      { nome: 'Devolvido: não há cálculos a serem realizados', descricao: '' },
      { nome: 'Triagem do Gestor', descricao: '' },
      { nome: 'Devolvido: remetido para contadoria de custas/liquidação', descricao: '' },
      { nome: 'Cálculo atualizado', descricao: '' },
      { nome: 'Devolvido: solicitação de esclarecimentos', descricao: '' },
      { nome: 'Devolvido: ausência de determinação do magistrado', descricao: '' },
      { nome: 'Devolvido: a pedido da vara/diretoria', descricao: '' },
      { nome: 'Devolvido: erro de remessa', descricao: '' },
      { nome: 'Partilha Realizada', descricao: '' },
      { nome: 'Devolvido: esclarecimento realizado', descricao: '' }
    ];

    try {
      // For each table, we check and insert missing items one by one to avoid unique constraint violations
      // while ensuring all default values are present.
      
      for (const item of defaultNucleos) {
        const { data } = await client.from('nucleos').select('id').eq('nome', item.nome).maybeSingle();
        if (!data) {
          await client.from('nucleos').insert([item]);
        }
      }
      
      for (const item of defaultPrioridades) {
        const { data } = await client.from('prioridades').select('id').eq('nome', item.nome).maybeSingle();
        if (!data) {
          await client.from('prioridades').insert([item]);
        }
      }
      
      for (const item of defaultStatus) {
        const { data } = await client.from('status').select('id').eq('nome', item.nome).maybeSingle();
        if (!data) {
          await client.from('status').insert([item]);
        }
      }
      
      // Reload data after seeding
      const { data: n } = await client.from('nucleos').select('*');
      if (n) this.nucleos.set(n);
      
      const { data: p } = await client.from('prioridades').select('*');
      if (p) this.prioridades.set(p);
      
      const { data: s } = await client.from('status').select('*');
      if (s) this.statusTipos.set(s);
      
      console.log('StoreService: Database seeded/verified successfully.');
    } catch (error) {
      console.error('StoreService: Error seeding database:', error);
    }
  }

  login(userId: string, password?: string) {
    const user = this.users().find(u => u.id === userId);
    if (user && user.password === password) {
      this.currentUser.set(user);
      this.updateGlobalStats();
    }
  }

  logout() {
    this.currentUser.set(null);
  }

  async updateProcessFields(processId: string, fields: Partial<Pick<Process, 'valorCustas' | 'observacao' | 'assignmentDate' | 'completionDate'>>) {
    console.log('StoreService: Updating process fields...', { processId, fields });
    
    this.processes.update(prev => prev.map(p => 
      p.id === processId ? { ...p, ...fields } : p
    ));

    const client = getSupabase();
    if (client) {
      const updateData: Record<string, string | number | null> = {};
      if (fields.valorCustas !== undefined) updateData['valor_custas'] = fields.valorCustas;
      if (fields.observacao !== undefined) updateData['observacao'] = fields.observacao;
      if (fields.assignmentDate !== undefined) updateData['assignment_date'] = fields.assignmentDate;
      if (fields.completionDate !== undefined) updateData['completion_date'] = fields.completionDate;

      const { error } = await client.from('processes').update(updateData).eq('id', processId);
      if (error) {
        this.handleSupabaseError(error, 'updateProcessFields');
      } else {
        console.log('StoreService: Process fields updated successfully in Supabase.');
        this.updateGlobalStats();
      }
    }
  }

  async updateProcessStatus(processId: string, newStatus: string) {
    console.log('StoreService: Updating process status...', { processId, newStatus });
    const completionDate = newStatus !== 'Pendente' ? new Date().toISOString().split('T')[0] : null;
    
    // Find the process to know its nucleus before updating
    const processToUpdate = this.processes().find(p => p.id === processId);
    const nucleus = processToUpdate?.nucleus;

    this.processes.update(prev => prev.map(p => 
      p.id === processId ? { ...p, status: newStatus, completionDate } : p
    ));

    const client = getSupabase();
    if (client) {
      await this.ensureStatusExists(client, newStatus);
      const { error } = await client.from('processes').update({ 
        status: newStatus,
        completion_date: completionDate
      }).eq('id', processId);
      if (error) {
        console.error('StoreService: Error updating process status in Supabase:', error);
      } else {
        console.log('StoreService: Process status updated successfully in Supabase.');
        // Recalculate positions for the nucleus
        if (nucleus) {
          await this.recalculatePositions(nucleus);
        }
        this.updateGlobalStats();
      }
    }
  }

  async assignProcess(processId: string, userId: string | null) {
    console.log('StoreService: Assigning process...', { processId, userId });
    const assignmentDate = userId ? new Date().toISOString().split('T')[0] : null;

    this.processes.update(prev => prev.map(p => 
      p.id === processId ? { ...p, assignedToId: userId, assignmentDate } : p
    ));

    const client = getSupabase();
    if (client) {
      const { error } = await client.from('processes').update({ 
        assigned_to_id: userId || null,
        assignment_date: assignmentDate
      }).eq('id', processId);
      if (error) {
        this.handleSupabaseError(error, 'assignProcess');
      } else {
        console.log('StoreService: Process assigned successfully in Supabase.');
        this.updateGlobalStats();
      }
    }
  }

  // CRUD for Users (Contadores)
  async addUser(user: Omit<User, 'id'>) {
    console.log('StoreService: Adding user...', user);
    const client = getSupabase();
    if (client) {
      const { data, error } = await client.from('users').insert([{
        matricula: user.matricula,
        name: user.name,
        role: user.role,
        nucleus: user.nucleus,
        functional_email: user.functionalEmail,
        gmail: user.gmail,
        meta_percentage: user.metaPercentage,
        birth_date: user.birthDate,
        active: user.active,
        password: user.password || '123456'
      }]).select();

      if (error) {
        this.handleSupabaseError(error, 'addUser');
        // Fallback to local if error
        const newId = 'u' + (this.users().length + 1);
        this.users.update(prev => [...prev, { ...user, id: newId }]);
      } else if (data && data[0]) {
        console.log('StoreService: User added successfully to Supabase:', data[0]);
        const newUser = {
          ...user,
          id: data[0].id,
          functionalEmail: data[0].functional_email,
          metaPercentage: data[0].meta_percentage,
          birthDate: data[0].birth_date
        };
        this.users.update(prev => [...prev, newUser]);
      }
    } else {
      console.warn('StoreService: Supabase not configured. Adding user locally only.');
      const newId = 'u' + (this.users().length + 1);
      this.users.update(prev => [...prev, { ...user, id: newId }]);
    }
  }

  async updateUser(updatedUser: User) {
    console.log('StoreService: Updating user...', updatedUser);
    this.users.update(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));

    const client = getSupabase();
    if (client) {
      // Don't try to update Supabase if it's a mock ID (doesn't look like a UUID)
      if (updatedUser.id.startsWith('u')) {
        console.warn('StoreService: Cannot update mock user in Supabase. ID:', updatedUser.id);
        return;
      }

      const { error } = await client.from('users').update({
        matricula: updatedUser.matricula,
        name: updatedUser.name,
        role: updatedUser.role,
        nucleus: updatedUser.nucleus,
        functional_email: updatedUser.functionalEmail,
        gmail: updatedUser.gmail,
        meta_percentage: updatedUser.metaPercentage,
        birth_date: updatedUser.birthDate,
        active: updatedUser.active,
        password: updatedUser.password
      }).eq('id', updatedUser.id);

      if (error) {
        this.handleSupabaseError(error, 'updateUser');
      } else {
        console.log('StoreService: User updated successfully in Supabase.');
      }
    }
  }

  async deleteUser(userId: string) {
    console.log('StoreService: Deleting user...', userId);
    this.users.update(prev => prev.filter(u => u.id !== userId));

    const client = getSupabase();
    if (client) {
      // Don't try to delete from Supabase if it's a mock ID
      if (userId.startsWith('u')) {
        console.warn('StoreService: Cannot delete mock user from Supabase. ID:', userId);
        return;
      }

      const { error } = await client.from('users').delete().eq('id', userId);
      if (error) {
        this.handleSupabaseError(error, 'deleteUser');
      } else {
        console.log('StoreService: User deleted successfully from Supabase.');
      }
    }
  }

  async fetchPaginatedProcesses(options: {
    page: number,
    pageSize: number,
    searchTerm: string,
    statusFilter: string,
    startDate: string,
    endDate: string,
    user: User,
    nucleusFilter?: string,
    onlyAssignedToMe?: boolean,
    unassignedOnly?: boolean,
    accountantFilter?: string,
    externalAccountantIds?: string[]
  }) {
    const client = getSupabase();
    if (!client) return { processes: [], totalCount: 0 };

    let query = client.from('vw_processes').select('*', { count: 'exact' });

    // Role-based visibility (Base restriction)
    if (options.user.role === 'Chefe' || options.user.role === 'Gerente') {
      query = query.or(`nucleus.ilike."${options.user.nucleus}",assigned_to_id.eq."${options.user.id}"`);
    } else if (options.user.role === 'Contador Judicial') {
      query = query.eq('assigned_to_id', options.user.id);
    }

    // Nucleus Filter (for Coordenador/Supervisor/Admin who see all by default)
    if (options.nucleusFilter && options.nucleusFilter !== 'Todos') {
      query = query.ilike('nucleus', options.nucleusFilter);
    }

    // Only Assigned To Me Filter (for roles that can see more than just their own)
    if (options.onlyAssignedToMe) {
      query = query.eq('assigned_to_id', options.user.id);
    }

    // Unassigned Only Filter
    if (options.unassignedOnly) {
      query = query.is('assigned_to_id', null);
    }

    // Accountant Filter
    if (options.accountantFilter && options.accountantFilter !== 'Todos') {
      query = query.eq('assigned_to_id', options.accountantFilter);
    }

    // External Accountants Filter
    if (options.externalAccountantIds && options.externalAccountantIds.length > 0) {
      query = query.in('assigned_to_id', options.externalAccountantIds);
    } else if (options.externalAccountantIds && options.externalAccountantIds.length === 0) {
      // If the array is empty but the filter is active, it means there are no external accountants.
      // We should return no results.
      query = query.eq('assigned_to_id', '00000000-0000-0000-0000-000000000000');
    }

    // Status Filter
    if (options.statusFilter === 'Pendente') {
      query = query.ilike('status', 'Pendente');
    }

    // Search Term
    if (options.searchTerm) {
      const term = `%${options.searchTerm}%`;
      query = query.or(`number.ilike."${term}",court.ilike."${term}",nucleus.ilike."${term}"`);
    }

    // Date Filters
    if (options.startDate) {
      query = query.gte('entry_date', options.startDate);
    }
    if (options.endDate) {
      query = query.lte('entry_date', options.endDate);
    }

    // Pagination
    const from = (options.page - 1) * options.pageSize;
    const to = from + options.pageSize - 1;
    
    // CRITICAL: Sort by priority_level (1 for Super, 2 for others) then by position
    query = query.range(from, to)
      .order('priority_level', { ascending: true })
      .order('position', { ascending: true, nullsFirst: false });

    const { data, count, error } = await query;
    
    if (error) {
      console.error('StoreService: Error fetching paginated processes:', error);
      return { processes: [], totalCount: 0 };
    }

    const mapped = (data || []).map((p: Record<string, unknown>) => ({
      id: String(p['id']),
      position: Number(p['position']),
      priorityPosition: p['priority_position'] ? Number(p['priority_position']) : null,
      number: String(p['number']),
      entryDate: String(p['entry_date']),
      court: String(p['court']),
      nucleus: String(p['nucleus']),
      priority: this.normalizePriority(String(p['priority'])),
      status: this.normalizeStatus(String(p['status'])),
      assignedToId: p['assigned_to_id'] ? String(p['assigned_to_id']) : null,
      assignmentDate: p['assignment_date'] ? String(p['assignment_date']) : null,
      completionDate: p['completion_date'] ? String(p['completion_date']) : null,
      valorCustas: p['valor_custas'] ? Number(p['valor_custas']) : 0,
      observacao: p['observacao'] ? String(p['observacao']) : ''
    }));

    return { processes: mapped, totalCount: count || 0 };
  }

  private statsTimeout: ReturnType<typeof setTimeout> | null = null;
  private async recalculatePositions(nucleus: string) {
    console.log(`StoreService: Recalculating positions for nucleus ${nucleus}...`);
    const client = getSupabase();
    if (!client) return;

    try {
      // 1. Fetch all "Pendente" processes for this nucleus
      // We sort by priority level (Super first) then by entry date
      const { data: pendentes, error: fetchError } = await client
        .from('processes')
        .select('id, priority, entry_date')
        .eq('nucleus', nucleus)
        .eq('status', 'Pendente');

      if (fetchError) {
        console.error('StoreService: Error fetching processes for recalculation:', fetchError);
        return;
      }

      if (pendentes) {
        // Sort in memory to apply the same logic as the dashboard
        const sorted = pendentes.sort((a, b) => {
          const levelA = a.priority.toUpperCase().includes('SUPER') ? 1 : 2;
          const levelB = b.priority.toUpperCase().includes('SUPER') ? 1 : 2;
          if (levelA !== levelB) return levelA - levelB;
          return new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
        });

        // Update positions sequentially
        for (let i = 0; i < sorted.length; i++) {
          await client
            .from('processes')
            .update({ position: i + 1 })
            .eq('id', sorted[i].id);
        }
        
        // 2. Clear positions for non-pendente processes in this nucleus
        await client
          .from('processes')
          .update({ position: 0 })
          .eq('nucleus', nucleus)
          .neq('status', 'Pendente');
        
        console.log(`StoreService: Positions recalculated for ${nucleus}.`);
        
        // Reload data to reflect changes in UI
        this.loadData();
      }
    } catch (err) {
      console.error('StoreService: Unexpected error in recalculatePositions:', err);
    }
  }

  async updateGlobalStats() {
    if (this.statsTimeout) clearTimeout(this.statsTimeout);
    
    this.statsTimeout = setTimeout(async () => {
      const client = getSupabase();
      const user = this.currentUser();
      if (!client || !user) {
        console.log('StoreService: Cannot update stats, client or user missing');
        return;
      }

      console.log(`StoreService: Updating stats for user ${user.name} (${user.role}) in nucleus ${user.nucleus}`);

      try {
        const getCount = async (status: string | null) => {
          try {
            let q = client.from('processes').select('*', { count: 'exact', head: true });
            if (status) q = q.ilike('status', status);
            
            if (user.role === 'Chefe' || user.role === 'Gerente') {
              q = q.ilike('nucleus', user.nucleus);
            } else if (user.role === 'Contador Judicial') {
              q = q.eq('assigned_to_id', user.id);
            }
            
            const { count, error } = await q;
            if (error) {
              console.error(`StoreService: Error getting count for ${status}:`, error.message);
              return 0;
            }
            return count || 0;
          } catch (fetchErr) {
            console.warn(`StoreService: Network error getting count for ${status}:`, fetchErr);
            return 0;
          }
        };

        // Run sequentially to avoid overwhelming the connection with 140k records
        const pendentes = await getCount('Pendente');
        const concluidos = await getCount('Cálculo Realizado');
        const devolvidos = await getCount('Devolvido sem Cálculo');

        console.log(`StoreService: Stats results - Pendentes: ${pendentes}, Concluídos: ${concluidos}, Devolvidos: ${devolvidos}`);
        this.globalStats.set({ pendentes, concluidos, devolvidos });
      } catch (e) {
        console.error('StoreService: Error updating global stats:', e);
      }
    }, 500); // 500ms debounce
  }

  private async ensureStatusExists(client: SupabaseClient, statusName: string) {
    if (!statusName) return;
    try {
      const { data, error } = await client.from('status').select('id').eq('nome', statusName).maybeSingle();
      if (error) {
        if (error.message.includes('Could not find the table')) {
          console.error(`StoreService: Table "status" is missing in Supabase. Please run the migrations in migrations.sql.`);
        } else {
          console.error(`StoreService: Error checking status "${statusName}":`, error.message);
        }
        return;
      }
      if (!data) {
        console.log(`StoreService: Status "${statusName}" not found in DB. Adding it...`);
        const { error: insertError } = await client.from('status').insert([{ nome: statusName, descricao: 'Adicionado automaticamente' }]);
        if (insertError) {
          console.error(`StoreService: Error adding status "${statusName}":`, insertError.message);
        } else {
          const { data: allStatus } = await client.from('status').select('*');
          if (allStatus) this.statusTipos.set(allStatus);
        }
      }
    } catch (e) {
      console.error(`StoreService: Exception in ensureStatusExists for "${statusName}":`, e);
    }
  }

  private async ensureNucleusExists(client: SupabaseClient, nucleusName: string) {
    if (!nucleusName) return;
    try {
      const { data, error } = await client.from('nucleos').select('id').eq('nome', nucleusName).maybeSingle();
      if (error) {
        if (error.message.includes('Could not find the table')) {
          console.error(`StoreService: Table "nucleos" is missing in Supabase. Please run the migrations in migrations.sql.`);
        } else {
          console.error(`StoreService: Error checking nucleus "${nucleusName}":`, error.message);
        }
        return;
      }
      if (!data) {
        console.log(`StoreService: Nucleus "${nucleusName}" not found in DB. Adding it...`);
        const { error: insertError } = await client.from('nucleos').insert([{ nome: nucleusName, descricao: 'Adicionado automaticamente' }]);
        if (insertError) {
          console.error(`StoreService: Error adding nucleus "${nucleusName}":`, insertError.message);
        } else {
          const { data: allNucleos } = await client.from('nucleos').select('*');
          if (allNucleos) this.nucleos.set(allNucleos);
        }
      }
    } catch (e) {
      console.error(`StoreService: Exception in ensureNucleusExists for "${nucleusName}":`, e);
    }
  }

  private async ensurePriorityExists(client: SupabaseClient, priorityName: string) {
    if (!priorityName) return;
    try {
      const { data, error } = await client.from('prioridades').select('id').eq('nome', priorityName).maybeSingle();
      if (error) {
        if (error.message.includes('Could not find the table')) {
          console.error(`StoreService: Table "prioridades" is missing in Supabase. Please run the migrations in migrations.sql.`);
        } else {
          console.error(`StoreService: Error checking priority "${priorityName}":`, error.message);
        }
        return;
      }
      if (!data) {
        console.log(`StoreService: Priority "${priorityName}" not found in DB. Adding it...`);
        const { error: insertError } = await client.from('prioridades').insert([{ nome: priorityName, descricao: 'Adicionado automaticamente' }]);
        if (insertError) {
          console.error(`StoreService: Error adding priority "${priorityName}":`, insertError.message);
        } else {
          const { data: allPriorities } = await client.from('prioridades').select('*');
          if (allPriorities) this.prioridades.set(allPriorities);
        }
      }
    } catch (e) {
      console.error(`StoreService: Exception in ensurePriorityExists for "${priorityName}":`, e);
    }
  }

  // CRUD for Processes
  async addProcess(process: Omit<Process, 'id' | 'position' | 'priorityPosition'>, skipRecalculate = false) {
    console.log('StoreService: Adding process...', process);
    const client = getSupabase();
    
    if (!client || !this.isSupabaseConnected()) {
      console.error('StoreService: Supabase not connected. Cannot add process.');
      throw new Error('O sistema está offline ou sem conexão com o banco de dados. Tente novamente em instantes.');
    }
    
    // Normalize values to match seeded values
    const normalizedNucleus = this.normalizeNucleus(process.nucleus);
    const normalizedPriority = this.normalizePriority(process.priority);
    const normalizedStatus = this.normalizeStatus(process.status);

    // Ensure they exist in DB to avoid FK violations
    await this.ensureNucleusExists(client, normalizedNucleus);
    await this.ensurePriorityExists(client, normalizedPriority);
    await this.ensureStatusExists(client, normalizedStatus);
    
    // Calculate position (scoped by nucleus, only for Pendente)
    let nextPos = 0;
    if (normalizedStatus === 'Pendente') {
      const { data: lastProc, error: posError } = await client
        .from('processes')
        .select('position')
        .eq('nucleus', normalizedNucleus)
        .eq('status', 'Pendente')
        .order('position', { ascending: false })
        .limit(1);
      
      if (!posError && lastProc && lastProc.length > 0) {
        nextPos = (lastProc[0].position || 0) + 1;
      } else {
        nextPos = 1;
      }
    }
    
    // Use provided dates or calculate them
    const assignmentDate = (process.assignmentDate && process.assignmentDate !== '')
      ? process.assignmentDate 
      : (process.assignedToId ? new Date().toISOString().split('T')[0] : null);
      
    const completionDate = (process.completionDate && process.completionDate !== '')
      ? process.completionDate 
      : (process.status !== 'Pendente' ? new Date().toISOString().split('T')[0] : null);
    
    const createdAt = process.createdAt || new Date().toISOString().split('T')[0];
    
    try {
      // Manual check for (number, entry_date) to respect the rule:
      // "se o numero do processo for igual mas data diferente copiar, se tiver data igual não copiar"
      const { data: existing, error: checkError } = await client
        .from('processes')
        .select('id')
        .eq('number', process.number)
        .eq('entry_date', process.entryDate)
        .maybeSingle();

      if (checkError) {
        console.warn('StoreService: Error checking for existing process:', checkError.message);
      }

      if (existing) {
        throw new Error(`Já existe um processo cadastrado com o número ${process.number} e data ${process.entryDate}.`);
      }

      const { data, error } = await client.from('processes').insert([{
        number: this.fixEncoding(process.number),
        entry_date: process.entryDate,
        court: this.fixEncoding(process.court),
        nucleus: normalizedNucleus,
        priority: normalizedPriority,
        status: normalizedStatus,
        assigned_to_id: process.assignedToId,
        position: nextPos,
        assignment_date: assignmentDate,
        completion_date: completionDate,
        valor_custas: process.valorCustas || 0,
        observacao: this.fixEncoding(process.observacao || ''),
        created_at: createdAt
      }]).select();

      if (error) {
        console.error('StoreService: Error adding process in Supabase:', error.message);
        if (error.code === '23505') {
          // If it still fails with 23505, it means there's a unique constraint on 'number' only
          throw new Error(`Erro de duplicidade: O banco de dados não permite dois processos com o mesmo número (${process.number}), mesmo com datas diferentes. Remova a restrição unique da coluna 'number' no Supabase.`);
        }
        if (error.code === '23503') {
          const detail = error.details || '';
          let field = 'núcleo, prioridade ou status';
          if (detail.includes('status')) field = 'status';
          else if (detail.includes('nucleus')) field = 'núcleo';
          else if (detail.includes('priority')) field = 'prioridade';
          
          throw new Error(`Erro de integridade: O ${field} informado ("${field === 'status' ? normalizedStatus : (field === 'núcleo' ? normalizedNucleus : normalizedPriority)}") não existe no banco de dados e não pôde ser adicionado automaticamente. Verifique as permissões (RLS) das tabelas auxiliares.`);
        }
        throw new Error(`Erro no banco de dados: ${error.message}`);
      } else if (data && data[0]) {
        console.log('StoreService: Process added successfully in Supabase.');
        
        // If it's a pending process, we might need to recalculate positions to ensure correct ordering
        if (!skipRecalculate && normalizedStatus === 'Pendente') {
          await this.recalculatePositions(normalizedNucleus);
        } else {
          this.updateGlobalStats();
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('Já existe um processo cadastrado')) {
        this.handleSupabaseError(e, 'addProcess');
      }
      throw e;
    }
  }

  async importFromStorage() {
    console.log('StoreService: Importing from storage...');
    const client = getSupabase();
    if (!client) throw new Error('Supabase não configurado.');

    const bucket = SUPABASE_STORAGE_BUCKET;
    const filePath = SUPABASE_STORAGE_FILE_PATH;

    console.log(`StoreService: Storage Config - Bucket: "${bucket}", FilePath: "${filePath}"`);

    if (!bucket || bucket === 'YOUR_SUPABASE_STORAGE_BUCKET') {
      throw new Error('A variável SUPABASE_STORAGE_BUCKET não foi configurada nas Settings do AI Studio.');
    }
    if (!filePath || filePath === 'YOUR_SUPABASE_STORAGE_FILE_PATH') {
      throw new Error('A variável SUPABASE_STORAGE_FILE_PATH não foi configurada nas Settings do AI Studio.');
    }

    // 1. Download file
    console.log(`StoreService: Attempting to download ${filePath} from bucket ${bucket}...`);
    const { data: fileData, error: downloadError } = await client.storage.from(bucket).download(filePath);
    
    if (downloadError) {
      console.error('StoreService: Supabase Storage download error:', downloadError);
      
      // Try to list files to help debug if it's a 404 or similar
      try {
        const { data: listData, error: listError } = await client.storage.from(bucket).list();
        if (listError) {
          console.warn('StoreService: Could not list bucket contents:', listError);
        } else if (listData) {
          console.log(`StoreService: Files found in root of bucket "${bucket}":`, listData.map(f => f.name));
        }
      } catch {
        console.warn('StoreService: Failed to list bucket contents for debugging.');
      }
      
      // Better error message construction
      let errorMsg = 'Erro desconhecido ao baixar arquivo.';
      if (typeof downloadError === 'string') {
        errorMsg = downloadError;
      } else if (downloadError && typeof downloadError === 'object') {
        const errObj = downloadError as unknown as Record<string, unknown>;
        errorMsg = (errObj['message'] as string) || (errObj['error'] as string) || JSON.stringify(downloadError);
      }
      
      throw new Error(`Erro ao baixar arquivo do Storage: ${errorMsg}. Verifique se o bucket "${bucket}" existe e se o arquivo "${filePath}" está lá.`);
    }

    if (!fileData) {
      throw new Error('Arquivo baixado com sucesso, mas o conteúdo está vazio (0 bytes).');
    }

    console.log(`StoreService: Downloaded file size: ${fileData.size} bytes. MIME type: ${fileData.type}`);

    // 2. Parse XLSX
    const buffer = await fileData.arrayBuffer();
    const workbook = read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    console.log(`StoreService: Parsed XLSX. Found ${json.length} rows in sheet "${sheetName}".`);
    if (json.length > 0) {
      console.log('StoreService: Column headers found:', Object.keys(json[0]));
      console.log('StoreService: First row data:', json[0]);
    }

    if (json.length === 0) {
      throw new Error('O arquivo no Storage está vazio ou não contém dados válidos.');
    }

    // 3. Get current processes
    const currentProcesses = this.processes();
    const pendingInDb = currentProcesses.filter(p => p.status === 'Pendente');
    console.log(`StoreService: Current processes in memory: ${currentProcesses.length} (${pendingInDb.length} pending).`);

    const importedCount = { success: 0, skipped: 0 };
    const inconsistencies: string[] = [];
    const fileProcessIdentifiers = new Set<string>();
    const affectedNuclei = new Set<string>();

    // Helper to parse date
    const parseDate = (val: unknown) => {
      if (!val) return null;
      if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
      }
      if (typeof val === 'string') {
        if (val.match(/^\d{4}-\d{2}-\d{2}/)) return val.split('T')[0];
        if (val.match(/^\d{2}\/\d{2}\/\d{4}/)) {
          const [d, m, y] = val.split('/');
          return `${y}-${m}-${d}`;
        }
      }
      return String(val).split('T')[0];
    };

    // 4. Process file rows
    console.log(`StoreService: Processing ${json.length} rows from file...`);
    for (const row of json) {
      const getVal = (keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined) return row[k];
          // Try variations
          const lower = k.toLowerCase();
          if (row[lower] !== undefined) return row[lower];
          const upper = k.toUpperCase();
          if (row[upper] !== undefined) return row[upper];
          const snake = k.replace(/([A-Z])/g, "_$1").toLowerCase();
          if (row[snake] !== undefined) return row[snake];
          // Try common header names
          const normalized = k.replace(/\s/g, '').toLowerCase();
          for (const rowKey of Object.keys(row)) {
            if (rowKey.replace(/\s/g, '').toLowerCase() === normalized) return row[rowKey];
          }
        }
        return undefined;
      };

      const number = this.fixEncoding(String(getVal(['numero', 'Número do Processo', 'Processo', 'Número', 'numero_processo', 'number', 'NPU', 'Processo NPU', 'Num. Processo']) || '').trim());
      const entryDate = parseDate(getVal(['entrada', 'Entrada', 'Data de Entrada', 'Data Entrada', 'data_remessa', 'remessa', 'entryDate', 'entry_date', 'data', 'Data de Remessa', 'Dt. Entrada']));
      const court = String(getVal(['vara', 'Vara', 'Juízo', 'Vara / Juízo', 'court', 'juizo', 'court_name', 'Órgão Julgador', 'Orgao Julgador']) || '').trim();
      const nucleus = String(getVal(['nucleo', 'Núcleo', 'Nucleo', 'nucleus']) || '1ª CC').trim();
      const priority = String(getVal(['prioridades', 'prioridade', 'Prioridade', 'priority']) || 'Sem prioridade').trim();
      const status = String(getVal(['status', 'Status', 'situacao', 'situacao_processo', 'situação', 'Situação']) || 'Pendente').trim();
      const valorCustas = Number(getVal(['Valor Custas', 'Valor das Custas', 'custas', 'valor_custas', 'valorCustas', 'Custas']) || 0);
      const assignmentDate = parseDate(getVal(['Atribuição', 'Data de Atribuição', 'Data Atribuição', 'atribuicao', 'data_atribuicao', 'assignmentDate', 'assignment_date', 'data_atrib', 'dt_atrib', 'Dt. Atribuição']));
      const completionDate = parseDate(getVal(['Cumprimento', 'Data de Cumprimento', 'Data Cumprimento', 'cumprimento', 'data_cumprimento', 'completionDate', 'completion_date', 'Dt. Cumprimento']));
      const observacao = String(getVal(['Observação', 'Observacao', 'observacao', 'obs', 'Nota', 'Notas']) || '').trim();

      if (!number || !entryDate) {
        console.warn(`StoreService: Linha ignorada - Número: "${number}", Data: "${entryDate}". Colunas disponíveis na linha:`, Object.keys(row));
        continue;
      }

      const assignedToId = null;

      const identifier = `${number}|${entryDate}`;
      fileProcessIdentifiers.add(identifier);

      // Rule: If exists with same number and date, skip
      const exists = currentProcesses.find(p => p.number === number && p.entryDate === entryDate);
      if (exists) {
        console.log(`StoreService: Skipping process ${number} (${entryDate}) because it already exists.`);
        importedCount.skipped++;
        continue;
      }

      // Add new process
      try {
        console.log(`StoreService: Attempting to add new process ${number} (${entryDate})...`);
        await this.addProcess({
          number,
          entryDate,
          court,
          nucleus,
          priority,
          status,
          assignedToId,
          valorCustas,
          assignmentDate,
          completionDate,
          observacao
        }, true); // Skip recalculate during loop
        
        affectedNuclei.add(this.normalizeNucleus(nucleus));
        importedCount.success++;
        console.log(`StoreService: Successfully added process ${number}.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Já existe um processo cadastrado')) {
          console.log(`StoreService: Process ${number} (${entryDate}) already in DB (caught in addProcess).`);
          importedCount.skipped++;
        } else {
          console.error(`StoreService: Error adding process ${number} from storage:`, msg);
        }
      }
    }

    // 5. Recalculate positions for all affected nuclei
    for (const nucleus of affectedNuclei) {
      await this.recalculatePositions(nucleus);
    }

    // 6. Check inconsistencies
    // "Se o processo estiver pendente no banco de dados, mas ele não estiver no arquivo do storage"
    for (const p of pendingInDb) {
      const identifier = `${p.number}|${p.entryDate}`;
      if (!fileProcessIdentifiers.has(identifier)) {
        inconsistencies.push(`${p.number} (${p.entryDate}) - Pendente no sistema, mas ausente no arquivo.`);
      }
    }

    console.log(`StoreService: Import completed. Success: ${importedCount.success}, Skipped: ${importedCount.skipped}, Inconsistencies: ${inconsistencies.length}`);

    return {
      success: importedCount.success,
      skipped: importedCount.skipped,
      inconsistencies
    };
  }
}
