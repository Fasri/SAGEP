import {Injectable, signal, effect} from '@angular/core';
import {User, Process, Nucleo, Prioridade, StatusTipo} from '../types';
import {getSupabase} from '../supabase';
import {SupabaseClient} from '@supabase/supabase-js';

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
      // Fetch counts for stats first (global, but respecting role)
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

      console.log('StoreService: Fetching processes from Supabase...');
      const { data: processes, error: processesError } = await client.from('processes').select('*');
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
          priority: this.normalizePriority(String(p['priority'] || 'Sem prioridade')),
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

      // Fetch dynamic tables
      const { data: nucleos } = await client.from('nucleos').select('*');
      if (nucleos && nucleos.length > 0) {
        this.nucleos.set(nucleos);
      } else {
        await this.seedDatabase(client);
      }

      const { data: prioridades } = await client.from('prioridades').select('*');
      if (prioridades) this.prioridades.set(prioridades);

      const { data: statusTipos } = await client.from('status_tipos').select('*');
      if (statusTipos) this.statusTipos.set(statusTipos);

    } catch (e) {
      console.error('StoreService: Unexpected error in loadData:', e);
    }
  }

  private normalizeNucleus(name: string): string {
    if (!name) return '1ª CC';
    let n = name.toUpperCase().trim();
    
    // Remove common special characters that might cause mismatch
    n = n.replace(/ª/g, '').replace(/º/g, '').replace(/A/g, 'A').replace(/O/g, 'O');
    n = n.replace(/\s+/g, ' ');

    // Map common variations
    if (n.includes('1') && (n.includes('CC') || n.includes('CAMARA'))) return '1ª CC';
    if (n.includes('2') && (n.includes('CC') || n.includes('CAMARA'))) return '2ª CC';
    if (n.includes('3') && (n.includes('CC') || n.includes('CAMARA'))) return '3ª CC';
    if (n.includes('4') && (n.includes('CC') || n.includes('CAMARA'))) return '4ª CC';
    if (n.includes('5') && (n.includes('CC') || n.includes('CAMARA'))) return '5ª CC';
    if (n.includes('6') && (n.includes('CC') || n.includes('CAMARA'))) return '6ª CC';
    if (n.includes('7') && (n.includes('CC') || n.includes('CAMARA'))) return '7ª CC';
    if (n.includes('8') && (n.includes('CC') || n.includes('CAMARA'))) return '8ª CC';
    
    // Check if it exists in the loaded nucleos
    const originalUpper = name.toUpperCase().trim();
    const found = this.nucleos().find(item => item.nome.toUpperCase() === originalUpper);
    if (found) return found.nome;
    
    return 'GERAL'; // Safe fallback to prevent FK violation
  }

  private normalizePriority(name: string): string {
    if (!name) return 'Sem prioridade';
    const n = name.toUpperCase().trim();
    if (n.includes('SEM')) return 'Sem prioridade';
    if (n.includes('LEGAL')) return 'Prioridade legal';
    if (n.includes('SUPER')) return 'Super prioridade';
    
    const found = this.prioridades().find(item => item.nome.toUpperCase() === n);
    if (found) return found.nome;
    return 'Sem prioridade'; // Safe fallback
  }

  private normalizeStatus(name: string): string {
    if (!name) return 'Pendente';
    const n = name.toUpperCase().trim();
    if (n.includes('PENDENTE')) return 'Pendente';
    if (n.includes('REALIZADO') || n.includes('SUCESSO')) return 'Cálculo Realizado';
    if (n.includes('DEVOLVIDO') || n.includes('SEM CALCULO')) return 'Devolvido sem Cálculo';
    
    const found = this.statusTipos().find(item => item.nome.toUpperCase() === n);
    if (found) return found.nome;
    return 'Pendente'; // Safe fallback
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
        priority: 'Super prioridade',
        status: 'Pendente'
      },
      {
        position: 2,
        number: '0012894-12.2023.8.17.2001',
        entry_date: '2023-10-14',
        court: '3ª Vara de Família',
        nucleus: '1ª CC',
        priority: 'Prioridade legal',
        status: 'Pendente'
      },
      {
        position: 3,
        number: '0005542-88.2023.8.17.2001',
        entry_date: '2023-10-15',
        court: '2ª Vara da Fazenda',
        nucleus: '6ª CC',
        priority: 'Sem prioridade',
        status: 'Pendente'
      }
    ];

    try {
      const { error } = await client.from('processes').upsert(initialProcesses, { onConflict: 'number' });
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
      { nome: 'GERAL', descricao: 'Núcleo Geral' }
    ];

    const defaultPrioridades = [
      { nome: 'Sem prioridade', descricao: 'Processo comum' },
      { nome: 'Prioridade legal', descricao: 'Idoso, doença grave, etc' },
      { nome: 'Super prioridade', descricao: 'Acima de 80 anos' }
    ];

    const defaultStatus = [
      { nome: 'Pendente', descricao: 'Aguardando início' },
      { nome: 'Cálculo Realizado', descricao: 'Finalizado com sucesso' },
      { nome: 'Devolvido sem Cálculo', descricao: 'Impossibilidade técnica' }
    ];

    try {
      await client.from('nucleos').upsert(defaultNucleos, { onConflict: 'nome' });
      await client.from('prioridades').upsert(defaultPrioridades, { onConflict: 'nome' });
      await client.from('status_tipos').upsert(defaultStatus, { onConflict: 'nome' });
      
      // Reload data after seeding
      const { data: n } = await client.from('nucleos').select('*');
      if (n) this.nucleos.set(n);
      
      const { data: p } = await client.from('prioridades').select('*');
      if (p) this.prioridades.set(p);
      
      const { data: s } = await client.from('status_tipos').select('*');
      if (s) this.statusTipos.set(s);
      
      console.log('StoreService: Database seeded successfully.');
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

  async updateProcessFields(processId: string, fields: Partial<Pick<Process, 'valorCustas' | 'observacao'>>) {
    console.log('StoreService: Updating process fields...', { processId, fields });
    
    this.processes.update(prev => prev.map(p => 
      p.id === processId ? { ...p, ...fields } : p
    ));

    const client = getSupabase();
    if (client) {
      const updateData: Record<string, number | string> = {};
      if (fields.valorCustas !== undefined) updateData['valor_custas'] = fields.valorCustas;
      if (fields.observacao !== undefined) updateData['observacao'] = fields.observacao;

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
    
    this.processes.update(prev => prev.map(p => 
      p.id === processId ? { ...p, status: newStatus, completionDate } : p
    ));

    const client = getSupabase();
    if (client) {
      const { error } = await client.from('processes').update({ 
        status: newStatus,
        completion_date: completionDate
      }).eq('id', processId);
      if (error) {
        console.error('StoreService: Error updating process status in Supabase:', error);
      } else {
        console.log('StoreService: Process status updated successfully in Supabase.');
        this.updateGlobalStats();
      }
    }
  }

  async assignProcess(processId: string, userId: string) {
    console.log('StoreService: Assigning process...', { processId, userId });
    const assignmentDate = userId ? new Date().toISOString().split('T')[0] : null;

    this.processes.update(prev => prev.map(p => 
      p.id === processId ? { ...p, assignedToId: userId, assignmentDate } : p
    ));

    const client = getSupabase();
    if (client) {
      const { error } = await client.from('processes').update({ 
        assigned_to_id: userId,
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
    user: User
  }) {
    const client = getSupabase();
    if (!client) return { processes: [], totalCount: 0 };

    let query = client.from('processes').select('*', { count: 'exact' });

    // Role-based visibility
    if (options.user.role === 'Chefe' || options.user.role === 'Gerente') {
      query = query.ilike('nucleus', options.user.nucleus);
    } else if (options.user.role === 'Contador Judicial') {
      query = query.eq('assigned_to_id', options.user.id);
    }

    // Status Filter
    if (options.statusFilter === 'Pendente') {
      query = query.ilike('status', 'Pendente');
    }

    // Search Term
    if (options.searchTerm) {
      const term = `%${options.searchTerm}%`;
      query = query.or(`number.ilike.${term},court.ilike.${term},nucleus.ilike.${term}`);
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
    query = query.range(from, to).order('entry_date', { ascending: true });

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

  async updateGlobalStats() {
    const client = getSupabase();
    const user = this.currentUser();
    if (!client || !user) {
      console.log('StoreService: Cannot update stats, client or user missing');
      return;
    }

    console.log(`StoreService: Updating stats for user ${user.name} (${user.role}) in nucleus ${user.nucleus}`);

    try {
      const getCount = async (status: string | null) => {
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
        console.log(`StoreService: Count for ${status}: ${count}`);
        return count || 0;
      };

      const [pendentes, concluidos, devolvidos] = await Promise.all([
        getCount('Pendente'),
        getCount('Cálculo Realizado'),
        getCount('Devolvido sem Cálculo')
      ]);

      console.log(`StoreService: Stats results - Pendentes: ${pendentes}, Concluídos: ${concluidos}, Devolvidos: ${devolvidos}`);
      this.globalStats.set({ pendentes, concluidos, devolvidos });
    } catch (e) {
      console.error('StoreService: Error updating global stats:', e);
    }
  }

  // CRUD for Processes
  async addProcess(process: Omit<Process, 'id' | 'position' | 'priorityPosition'>) {
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
    
    // Calculate position (simple increment for now)
    const nextPos = this.processes().length + 1;
    
    // Use provided dates or calculate them
    const assignmentDate = process.assignmentDate !== undefined 
      ? process.assignmentDate 
      : (process.assignedToId ? new Date().toISOString().split('T')[0] : null);
      
    const completionDate = process.completionDate !== undefined 
      ? process.completionDate 
      : (process.status !== 'Pendente' ? new Date().toISOString().split('T')[0] : null);
    
    const createdAt = process.createdAt || new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await client.from('processes').upsert([{
        number: process.number,
        entry_date: process.entryDate,
        court: process.court,
        nucleus: normalizedNucleus,
        priority: normalizedPriority,
        status: normalizedStatus,
        assigned_to_id: process.assignedToId,
        position: nextPos,
        assignment_date: assignmentDate,
        completion_date: completionDate,
        valor_custas: process.valorCustas || 0,
        observacao: process.observacao || '',
        created_at: createdAt
      }], { onConflict: 'number' }).select();

      if (error) {
        console.error('StoreService: Error adding/updating process in Supabase:', error.message);
        if (error.code === '23505') {
          throw new Error('Este número de processo já está cadastrado no sistema.');
        }
        if (error.code === '23503') {
          throw new Error('Erro de integridade: O núcleo, prioridade ou status informado não é válido.');
        }
        throw new Error(`Erro no banco de dados: ${error.message}`);
      } else if (data && data[0]) {
        const newProcess: Process = {
          id: data[0].id,
          number: data[0].number,
          entryDate: data[0].entry_date,
          court: data[0].court,
          nucleus: data[0].nucleus,
          priority: data[0].priority,
          status: data[0].status,
          assignedToId: data[0].assigned_to_id,
          position: data[0].position,
          priorityPosition: data[0].priority_position,
          assignmentDate: data[0].assignment_date,
          completionDate: data[0].completion_date,
          valorCustas: data[0].valor_custas,
          observacao: data[0].observacao,
          createdAt: data[0].created_at
        };
        
        this.processes.update(prev => {
          const index = prev.findIndex(p => p.number === newProcess.number);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = newProcess;
            return updated;
          }
          return [...prev, newProcess];
        });
        this.updateGlobalStats();
      }
    } catch (e: unknown) {
      this.handleSupabaseError(e, 'addProcess');
      throw e;
    }
  }
}
