import { Injectable, signal, effect } from '@angular/core';
import { Process, PaginationOptions, ReportFilters } from '../types';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { MetadataService } from './metadata.service';
import { AuditService } from './audit.service';

declare const SUPABASE_URL: string | undefined;
declare const SUPABASE_ANON_KEY: string | undefined;
declare const SUPABASE_STORAGE_BUCKET: string | undefined;
declare const SUPABASE_STORAGE_FILE_PATH: string | undefined;

@Injectable({
  providedIn: 'root'
})
export class ProcessService {
  processes = signal<Process[]>([]);
  lastEtlUpdate = signal<Date | null>(null);
  recalculationProgress = signal<number>(0);
  autoAssignProgress = signal<{ current: number, total: number } | null>(null);

  globalStats = signal<{ pendentes: number, concluidos: number, devolvidos: number }>({
    pendentes: 0,
    concluidos: 0,
    devolvidos: 0
  });

  private statsTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private metadataService: MetadataService,
    private auditService: AuditService
  ) {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.updateGlobalStats();
        this.fetchLastEtlUpdate();
      }
    });
  }

  private mapProcess(p: Record<string, unknown>): Process {
    return {
      id: String(p['id'] || ''),
      position: Number(p['position'] || 0),
      priorityPosition: p['priority_position'] ? Number(p['priority_position']) : null,
      number: String(p['number'] || ''),
      entryDate: String(p['entry_date'] || '').split('T')[0],
      court: String(p['court'] || ''),
      nucleus: String(p['nucleus'] || 'GERAL'),
      priority: this.metadataService.normalizePriority(String(p['priority'] || '2-Sem prioridade')),
      status: this.metadataService.normalizeStatus(String(p['status'] || 'Pendente')),
      assignedToId: p['assigned_to_id'] ? String(p['assigned_to_id']) : null,
      assignmentDate: p['assignment_date'] ? String(p['assignment_date']) : null,
      completionDate: p['completion_date'] ? String(p['completion_date']) : null,
      valorCustas: p['valor_custas'] ? Number(p['valor_custas']) : 0,
      observacao: p['observacao'] ? String(p['observacao']) : ''
    };
  }

  async loadInitialProcesses() {
    const client = this.supabaseService.getClient();
    if (!client) return;

    try {
      const { data: processes, error: processesError } = await client.from('vw_processes')
        .select('*')
        .order('priority', { ascending: true })
        .order('position', { ascending: true })
        .limit(5000);

      if (processesError) {
        console.error('ProcessService: Error fetching processes:', processesError);
      } else if (processes && processes.length > 0) {
        this.processes.set(processes.map((p: Record<string, unknown>) => this.mapProcess(p)));
      }
    } catch (e) {
      console.error('ProcessService: Unexpected error loading processes:', e);
    }
  }

  async updateProcessFields(processId: string, fields: Partial<Pick<Process, 'valorCustas' | 'observacao' | 'priority'>>) {
    let oldProcess = this.processes().find(p => p.id === processId);
    const client = this.supabaseService.getClient();
    
    if (!oldProcess && client) {
      const { data } = await client.from('processes').select('*').eq('id', processId).maybeSingle();
      if (data) {
        oldProcess = {
          id: data.id,
          position: data.position,
          priorityPosition: data.priority_position,
          number: data.number,
          entryDate: data.entry_date,
          court: data.court,
          nucleus: data.nucleus,
          priority: data.priority,
          status: data.status,
          assignedToId: data.assigned_to_id,
          assignmentDate: data.assignment_date,
          completionDate: data.completion_date,
          valorCustas: data.valor_custas,
          observacao: data.observacao,
          createdAt: data.created_at
        };
      }
    }

    this.processes.update(prev => prev.map(p => p.id === processId ? { ...p, ...fields } : p));

    if (client) {
      const updateData: Record<string, string | number | null> = {};
      if (fields.valorCustas !== undefined) updateData['valor_custas'] = fields.valorCustas;
      if (fields.observacao !== undefined) updateData['observacao'] = fields.observacao;
      if (fields.priority !== undefined) updateData['priority'] = fields.priority;

      const { error } = await client.from('processes').update(updateData).eq('id', processId);
      if (error) {
        this.supabaseService.handleError(error, 'updateProcessFields');
      } else {
        if (fields.priority !== undefined) {
          await client.rpc('update_process_positions');
        }
        this.auditService.addAuditLog(`Atualizou campos do processo ${oldProcess?.number || processId}`, { 
          fields, 
          oldValues: oldProcess,
          processNumber: oldProcess?.number 
        });
        this.updateGlobalStats();
      }
    } else {
      this.auditService.addAuditLog(`Atualizou campos do processo ${oldProcess?.number || processId} (Local)`, { fields, processNumber: oldProcess?.number });
    }
  }

  async updateProcessStatus(processId: string, newStatus: string) {
    const today = new Date().toLocaleDateString('en-CA');
    const completionDate = newStatus !== 'Pendente' ? today : null;
    
    let processToUpdate = this.processes().find(p => p.id === processId);
    const client = this.supabaseService.getClient();

    if (!processToUpdate && client) {
      const { data } = await client.from('processes').select('*').eq('id', processId).maybeSingle();
      if (data) {
        processToUpdate = {
           id: data.id, position: data.position, priorityPosition: data.priority_position, number: data.number,
           entryDate: data.entry_date, court: data.court, nucleus: data.nucleus, priority: data.priority,
           status: data.status, assignedToId: data.assigned_to_id, assignmentDate: data.assignment_date,
           completionDate: data.completion_date, valorCustas: data.valor_custas, observacao: data.observacao
        };
      }
    }

    let assignmentDate = processToUpdate?.assignmentDate;
    if (newStatus !== 'Pendente' && !assignmentDate) assignmentDate = today;

    this.processes.update(prev => prev.map(p => p.id === processId ? { ...p, status: newStatus, completionDate, assignmentDate } : p));

    if (client) {
      await this.metadataService.ensureStatusExists(newStatus);
      const { error } = await client.from('processes').update({ status: newStatus, completion_date: completionDate, assignment_date: assignmentDate }).eq('id', processId);
      if (!error) {
        await client.rpc('update_process_positions');
        this.auditService.addAuditLog(`Alterou status do processo ${processToUpdate?.number || processId} para ${newStatus}`, { oldStatus: processToUpdate?.status, newStatus, processNumber: processToUpdate?.number });
        this.updateGlobalStats();
      }
    }
  }

  async assignProcess(processId: string, userId: string | null) {
    const today = new Date().toLocaleDateString('en-CA');
    const assignmentDate = userId ? today : null;
    let processToAssign = this.processes().find(p => p.id === processId);
    const client = this.supabaseService.getClient();

    this.processes.update(prev => prev.map(p => p.id === processId ? { ...p, assignedToId: userId, assignmentDate } : p));

    if (client) {
      const { error } = await client.from('processes').update({ assigned_to_id: userId || null, assignment_date: assignmentDate }).eq('id', processId);
      if (!error) {
        const userName = userId ? this.authService.users().find(u => u.id === userId)?.name : 'Ninguém';
        this.auditService.addAuditLog(`Atribuiu processo ${processToAssign?.number || processId} para ${userName}`, { userId, processNumber: processToAssign?.number });
        this.updateGlobalStats();
      }
    }
  }

  async deleteProcess(processId: string) {
    const client = this.supabaseService.getClient();
    if (!client) throw new Error('Sistema offline.');

    const processToDelete = this.processes().find(p => p.id === processId);

    const { error } = await client.from('processes').delete().eq('id', processId);
    if (error) {
      this.supabaseService.handleError(error, 'deleteProcess');
      throw new Error(`Erro ao excluir processo: ${error.message}`);
    }

    this.processes.update(prev => prev.filter(p => p.id !== processId));
    this.updateGlobalStats();
    await client.rpc('update_process_positions'); // Re-rank other processes
    
    if (processToDelete) {
      this.auditService.addAuditLog(`Excluiu processo ${processToDelete.number}`, { processNumber: processToDelete.number, processId });
    }
  }

  private applyFiltersToQuery(query: any, options: PaginationOptions): any {
    if (options.user.role === 'Contador Judicial') {
      query = (query as any).eq('assigned_to_id', options.user.id);
    } else if (!['Administrador', 'Coordenador', 'Supervisor'].includes(options.user.role)) {
      query = (query as any).or(`nucleus.eq."${options.user.nucleus}",assigned_to_id.eq.${options.user.id}`);
    }

    if (options.nucleusFilter && options.nucleusFilter !== 'Todos') query = (query as any).eq('nucleus', options.nucleusFilter);
    if (options.onlyAssignedToMe) query = (query as any).eq('assigned_to_id', options.user.id);
    if (options.unassignedOnly) query = (query as any).is('assigned_to_id', null);
    if (options.accountantFilter && options.accountantFilter !== 'Todos') query = (query as any).eq('assigned_to_id', options.accountantFilter);

    if (options.externalAccountantIds) {
      if (options.externalAccountantIds.length > 0) {
        query = (query as any).in('assigned_to_id', options.externalAccountantIds);
      } else {
        query = (query as any).eq('assigned_to_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    if (options.statusFilter && options.statusFilter !== 'Todos') {
      if (options.statusFilter === 'Devolvidos') query = (query as any).not('status', 'ilike', 'Pendente%');
      else query = (query as any).ilike('status', options.statusFilter === 'Pendente' ? 'Pendente%' : `%${options.statusFilter}%`);
    }

    if (options.searchTerm) {
      const term = `%${options.searchTerm}%`;
      const matchingUserIds = this.authService.users()
        .filter(u => u.name.toLowerCase().includes(options.searchTerm!.toLowerCase()))
        .map(u => u.id);
      let orClause = `number.ilike."${term}",court.ilike."${term}",nucleus.ilike."${term}"`;
      if (matchingUserIds.length > 0) orClause += `,assigned_to_id.in.(${matchingUserIds.join(',')})`;
      query = (query as any).or(orClause);
    }

    const dateField = options.statusFilter === 'Devolvidos' ? 'completion_date' : 'entry_date';
    if (options.startDate) query = (query as any).gte(dateField, options.startDate.includes(' ') ? options.startDate : `${options.startDate} 00:00:00`);
    if (options.endDate) query = (query as any).lte(dateField, options.endDate.includes(' ') ? options.endDate : `${options.endDate} 23:59:59`);

    if (options.statusFilter === 'Devolvidos') {
      query = (query as any).order('completion_date', { ascending: false, nullsFirst: false });
    } else {
      // Ordem: Super primeiro (priority_level=1), depois demais prioridades (level=2), depois regulares (level=3)
      // Dentro de cada grupo: entrada mais antiga primeiro (position = chegada cronológica por núcleo)
      query = (query as any)
        .order('priority_level', { ascending: true, nullsFirst: false })
        .order('entry_date', { ascending: true, nullsFirst: false });
    }

    return query;
  }

  async fetchPaginatedProcesses(options: PaginationOptions) {
    const client = this.supabaseService.getClient();
    if (!client) return { processes: [], totalCount: 0 };

    let query = client.from('processes').select('*', { count: 'estimated' }) as any;
    query = this.applyFiltersToQuery(query, options);

    const from = (options.page - 1) * options.pageSize;
    const to = from + options.pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) {
      console.error('ProcessService: Error in fetchPaginatedProcesses:', error);
      throw new Error(`Erro ao buscar processos: ${error.message}`);
    }

    return { processes: (data || []).map((p: Record<string, unknown>) => this.mapProcess(p)), totalCount: count || 0 };
  }
  async fetchAllFilteredProcesses(options: PaginationOptions): Promise<Process[]> {
    const client = this.supabaseService.getClient();
    if (!client) return [];

    let allData: Record<string, unknown>[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      let batchQuery = this.applyFiltersToQuery(client.from('processes').select('*') as any, options);
      batchQuery = batchQuery.range(from, to);

      const { data, error } = await batchQuery;

      if (error) {
        console.error('ProcessService: Error fetching batch of processes:', error);
        hasMore = false;
        if (allData.length === 0) return [];
      } else if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) hasMore = false;
        else {
          page++;
          if (page > 200) hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return allData.map(p => this.mapProcess(p));
  }

  async addProcess(process: Omit<Process, 'id' | 'position' | 'priorityPosition'>) {
    const client = this.supabaseService.getClient();
    if (!client || !this.supabaseService.isSupabaseConnected()) {
      throw new Error('O sistema está offline ou sem conexão com o banco de dados. Tente novamente em instantes.');
    }
    
    const normalizedNucleus = this.metadataService.normalizeNucleus(process.nucleus);
    const normalizedPriority = this.metadataService.normalizePriority(process.priority);
    const normalizedStatus = this.metadataService.normalizeStatus(process.status);

    await this.metadataService.ensureNucleusExists(normalizedNucleus);
    await this.metadataService.ensurePriorityExists(normalizedPriority);
    await this.metadataService.ensureStatusExists(normalizedStatus);
    
    const today = new Date().toLocaleDateString('en-CA');
    const assignmentDate = process.assignedToId ? today : null;
    const completionDate = normalizedStatus !== 'Pendente' ? today : null;
    const createdAt = process.createdAt || today;
    
    try {
      const { data: maxPosData } = await client.from('processes').select('position').order('position', { ascending: false }).limit(1).maybeSingle();
      const nextPosition = (maxPosData?.position || 0) + 1;

      const { data: existing, error: checkError } = await client.from('processes').select('id')
        .eq('number', process.number).eq('entry_date', process.entryDate).eq('nucleus', normalizedNucleus).maybeSingle();

      if (checkError) console.warn('ProcessService: Error checking for existing process:', checkError.message);
      if (existing) throw new Error(`Já existe um processo cadastrado com o número ${process.number}, data ${process.entryDate} e núcleo ${normalizedNucleus}.`);

      const { data, error } = await client.from('processes').insert([{
        position: nextPosition, number: this.metadataService.fixEncoding(process.number),
        entry_date: process.entryDate, court: this.metadataService.fixEncoding(process.court),
        nucleus: normalizedNucleus, priority: normalizedPriority, status: normalizedStatus,
        assigned_to_id: process.assignedToId, assignment_date: assignmentDate,
        completion_date: completionDate, valor_custas: process.valorCustas || 0,
        observacao: this.metadataService.fixEncoding(process.observacao || ''), created_at: createdAt
      }]).select();

      if (error) {
        console.error('ProcessService: Error adding process in Supabase:', error.message);
        if (error.code === '23505') throw new Error(`Erro de duplicidade: O banco de dados não permite dois processos com o mesmo número (${process.number}), mesmo com datas diferentes. Remova a restrição unique da coluna 'number' no Supabase.`);
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
        const logDetails: Record<string, unknown> = {
          processNumber: process.number, entryDate: process.entryDate, nucleus: normalizedNucleus,
          priority: normalizedPriority, status: normalizedStatus, assignedToId: process.assignedToId
        };
        this.auditService.addAuditLog(`Inseriu novo processo ${process.number}`, logDetails);
        this.updateGlobalStats();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('Já existe um processo cadastrado')) {
        this.supabaseService.handleError(e, 'addProcess');
      }
      throw e;
    }
  }

  async importFromStorage() {
    const client = this.supabaseService.getClient();
    if (!client) throw new Error('Supabase não configurado.');

    const env = typeof process !== 'undefined' ? process.env : {};
    const win = typeof window !== 'undefined' ? (window as any) : {};
    const bucket = typeof SUPABASE_STORAGE_BUCKET !== 'undefined' ? SUPABASE_STORAGE_BUCKET : (env['SUPABASE_STORAGE_BUCKET'] || win['SUPABASE_STORAGE_BUCKET'] || '');
    const filePath = typeof SUPABASE_STORAGE_FILE_PATH !== 'undefined' ? SUPABASE_STORAGE_FILE_PATH : (env['SUPABASE_STORAGE_FILE_PATH'] || win['SUPABASE_STORAGE_FILE_PATH'] || '');

    if (!bucket || bucket === 'YOUR_SUPABASE_STORAGE_BUCKET') throw new Error('A variável SUPABASE_STORAGE_BUCKET não foi configurada nas Settings do AI Studio.');
    if (!filePath || filePath === 'YOUR_SUPABASE_STORAGE_FILE_PATH') throw new Error('A variável SUPABASE_STORAGE_FILE_PATH não foi configurada nas Settings do AI Studio.');

    const { data: fileData, error: downloadError } = await client.storage.from(bucket).download(filePath);
    if (downloadError) throw new Error(`Erro ao baixar arquivo do Storage. Verifique se o bucket "${bucket}" existe e se o arquivo "${filePath}" está lá.`);
    if (!fileData) throw new Error('Arquivo baixado com sucesso, mas o conteúdo está vazio (0 bytes).');

    const buffer = await fileData.arrayBuffer();
    const { read, utils } = await import('xlsx');
    const workbook = read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    if (json.length === 0) throw new Error('O arquivo no Storage está vazio ou não contém dados válidos.');

    const { data: existingData } = await client.from('processes').select('number, entry_date, nucleus, status, position');
    const existingSet = new Set((existingData || []).map(p => `${p.number}|${p.entry_date}|${this.metadataService.normalizeNucleus(p.nucleus)}`));
    
    const pendingInDb = this.processes().filter(p => p.status === 'Pendente');

    const importedCount = { success: 0, skipped: 0 };
    const inconsistencies: string[] = [];
    const fileProcessIdentifiers = new Set<string>();
    
    const parseDate = (val: unknown) => {
      if (!val) return null;
      if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return date.toLocaleDateString('en-CA');
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) return trimmed.split('T')[0];
        if (trimmed.match(/^\d{2}\/\d{2}\/\d{4}/)) {
          const [d, m, y] = trimmed.split('/');
          return `${y}-${m}-${d}`;
        }
      }
      try {
        const d = new Date(String(val));
        if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA');
      } catch { /* ignore */ }
      return null;
    };

    const today = new Date().toLocaleDateString('en-CA');
    const { data: maxPosData } = await client.from('processes').select('position').order('position', { ascending: false }).limit(1).maybeSingle();
    let nextPosition = (maxPosData?.position || 0) + 1;
    const processesToInsert: Record<string, unknown>[] = [];
    
    const userMap: Record<string, string> = {};
    this.authService.users().forEach(u => userMap[u.name.toLowerCase()] = u.id);

    for (const row of json) {
      const getVal = (keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined) return row[k];
          if (row[k.toLowerCase()] !== undefined) return row[k.toLowerCase()];
          if (row[k.toUpperCase()] !== undefined) return row[k.toUpperCase()];
          const normalized = k.replace(/\s/g, '').toLowerCase();
          for (const rowKey of Object.keys(row)) {
            if (rowKey.replace(/\s/g, '').toLowerCase() === normalized) return row[rowKey];
          }
        }
        return undefined;
      };

      const number = this.metadataService.fixEncoding(String(getVal(['numero', 'Número do Processo', 'Processo', 'Número', 'numero_processo', 'number', 'NPU', 'Processo NPU', 'Num. Processo']) || '').trim());
      const entryDate = parseDate(getVal(['Data de Remessa', 'data_remessa', 'entrada', 'Entrada', 'Data de Entrada', 'Data Entrada', 'remessa', 'entryDate', 'entry_date', 'data', 'Dt. Entrada']));
      const nucleusRaw = String(getVal(['nucleo', 'Núcleo', 'Nucleo', 'nucleus']) || '1ª CC').trim();
      const normalizedNucleus = this.metadataService.normalizeNucleus(nucleusRaw);
      
      if (!number || !entryDate) continue;

      const identifier = `${number}|${entryDate}|${normalizedNucleus}`;
      fileProcessIdentifiers.add(identifier);

      if (existingSet.has(identifier)) {
        importedCount.skipped++;
        continue;
      }

      const court = this.metadataService.fixEncoding(String(getVal(['vara', 'Vara', 'Juízo', 'Vara / Juízo', 'court', 'juizo', 'court_name', 'Órgão Julgador', 'Orgao Julgador']) || '').trim());
      const priorityRaw = String(getVal(['prioridades', 'prioridade', 'Prioridade', 'priority']) || 'Sem prioridade').trim();
      const statusRaw = String(getVal(['Cumprimento', 'status', 'Status', 'situacao', 'situacao_processo', 'situação', 'Situação']) || 'Pendente').trim();
      const valorCustas = Number(getVal(['Valor Custas', 'Valor das Custas', 'custas', 'valor_custas', 'valorCustas', 'Custas']) || 0);
      const assignmentDate = parseDate(getVal(['Atribuição', 'Data de Atribuição', 'Atribuicao', 'assignmentDate', 'assignment_date', 'Dt. Atribuição']));
      const completionDate = parseDate(getVal(['Data de Cumprimento', 'Cumprimento', 'Data Cumprimento', 'completionDate', 'completion_date', 'Dt. Cumprimento']));
      const observacao = this.metadataService.fixEncoding(String(getVal(['Observação', 'Observacao', 'observacao', 'obs', 'Nota', 'Notas']) || '').trim());
      const accountantName = String(getVal(['Atribuído a', 'Contador', 'Calculista', 'Responsável', 'assigned_to', 'user_name']) || '').trim();

      const normalizedPriority = this.metadataService.normalizePriority(priorityRaw);
      const normalizedStatus = this.metadataService.normalizeStatus(statusRaw);

      let assignedToId = null;
      if (accountantName) assignedToId = userMap[accountantName.toLowerCase()] || null;

      processesToInsert.push({
        position: nextPosition++, number, entry_date: entryDate, court, nucleus: normalizedNucleus,
        priority: normalizedPriority, status: normalizedStatus, assigned_to_id: assignedToId,
        assignment_date: assignmentDate || (normalizedStatus !== 'Pendente' ? today : null),
        completion_date: completionDate || (normalizedStatus !== 'Pendente' ? today : null),
        valor_custas: valorCustas, observacao, created_at: today
      });

      existingSet.add(identifier);
    }

    const chunkSize = 500;
    for (let i = 0; i < processesToInsert.length; i += chunkSize) {
      const chunk = processesToInsert.slice(i, i + chunkSize);
      const { error: insertError } = await client.from('processes').insert(chunk);
      if (!insertError) importedCount.success += chunk.length;
    }

    if (importedCount.success > 0 && client) {
      await client.rpc('update_process_positions');
    }

    for (const p of pendingInDb) {
      const identifier = `${p.number}|${p.entryDate}|${this.metadataService.normalizeNucleus(p.nucleus)}`;
      if (!fileProcessIdentifiers.has(identifier)) {
        inconsistencies.push(`${p.number} (${p.entryDate}) [${p.nucleus}] - Pendente no sistema, mas ausente no arquivo.`);
      }
    }

    this.auditService.addAuditLog(`Importou processos do storage`, { success: importedCount.success, skipped: importedCount.skipped, inconsistencies: inconsistencies.length });
    return { success: importedCount.success, skipped: importedCount.skipped, inconsistencies };
  }

  async getUnassignedCount(nucleusName: string, isAutoinspecao: boolean = false): Promise<number> {
    const client = this.supabaseService.getClient();
    if (!client) return 0;

    let query = client.from('processes').select('*', { count: 'exact', head: true })
      .eq('nucleus', nucleusName)
      .eq('status', 'Pendente')
      .is('assigned_to_id', null)
      .not('priority', 'ilike', '%SUPER%');

    if (isAutoinspecao) {
      query = query.ilike('priority', '%Autoinspeção%');
    }

    const { count, error } = await query;
    if (error) {
      console.error('Error fetching unassigned count:', error);
      return 0;
    }
    return count || 0;
  }

  async autoAssignProcesses(nucleusName: string, selectedUserIds?: string[], isAutoinspecao: boolean = false, limit?: number) {
    const client = this.supabaseService.getClient();
    if (!client) return;

    let usersInNucleus = this.authService.users()
      .filter(u => u.nucleus === nucleusName && u.active)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (selectedUserIds && selectedUserIds.length > 0) {
      usersInNucleus = usersInNucleus.filter(u => selectedUserIds.includes(u.id));
    }

    if (usersInNucleus.length === 0) throw new Error(`Nenhum usuário ativo selecionado encontrado no núcleo "${nucleusName}".`);

    let query = client
      .from('processes').select('id, number, position, priority')
      .eq('nucleus', nucleusName).eq('status', 'Pendente').is('assigned_to_id', null)
      .not('priority', 'ilike', '%SUPER%');

    if (isAutoinspecao) {
      query = query.ilike('priority', '%Autoinspeção%');
    }

    query = query.order('position', { ascending: true });

    if (limit && limit > 0) {
      query = query.limit(limit);
    }

    const { data: unassignedProcessesData, error: procError } = await query;

    if (procError) throw new Error(`Erro ao buscar processos: ${procError.message}`);

    const total = unassignedProcessesData?.length || 0;
    if (!unassignedProcessesData || total === 0) throw new Error(`Nenhum processo pendente não atribuído encontrado no núcleo "${nucleusName}".`);

    const nucleus = this.metadataService.nucleos().find(n => n.nome === nucleusName);
    const lastUserId = nucleus?.lastAssignedUserId;

    let startIndex = 0;
    if (lastUserId) {
      const lastIndex = usersInNucleus.findIndex(u => u.id === lastUserId);
      if (lastIndex !== -1) startIndex = (lastIndex + 1) % usersInNucleus.length;
    }

    const today = new Date().toLocaleDateString('en-CA');
    let currentIdx = startIndex;
    let finalUserId = lastUserId;
    let assignedCount = 0;

    this.autoAssignProgress.set({ current: 0, total });

    const batchSize = 50;
    for (let i = 0; i < unassignedProcessesData.length; i += batchSize) {
      const batch = unassignedProcessesData.slice(i, i + batchSize);
      for (const item of batch) {
        const user = usersInNucleus[currentIdx];
        const { error } = await client.from('processes').update({ assigned_to_id: user.id, assignment_date: today }).eq('id', item.id);
        if (!error) {
          finalUserId = user.id;
          assignedCount++;
        }
        currentIdx = (currentIdx + 1) % usersInNucleus.length;
        this.autoAssignProgress.set({ current: assignedCount, total });
      }
    }

    if (nucleus && finalUserId) {
      await client.from('nucleos').update({ last_assigned_user_id: finalUserId }).eq('id', nucleus.id);
    }

    this.autoAssignProgress.set(null);
    
    const { data: nucleosData } = await client.from('nucleos').select('*');
    if (nucleosData) {
      this.metadataService.nucleos.set(nucleosData.map(n => ({ id: n.id, nome: n.nome, descricao: n.descricao, lastAssignedUserId: n.last_assigned_user_id })));
    }

    this.auditService.addAuditLog(`Atribuição automática de ${assignedCount} processos no núcleo ${nucleusName}`);
    return assignedCount;
  }

  async getOldestProcessDate(): Promise<string | null> {
    const client = this.supabaseService.getClient();
    if (!client) return null;
    const { data } = await client.from('processes').select('entry_date').order('entry_date', { ascending: true }).limit(1).single();
    return data?.entry_date || null;
  }

  async fetchReportData(filters: ReportFilters) {
    const client = this.supabaseService.getClient();
    if (!client) return { userStats: [], pendingCount: 0, unassignedCount: 0 };

    let query = client.from('processes').select('assigned_to_id, status, entry_date') as any;
    if (filters.user.role === 'Chefe' || filters.user.role === 'Gerente') query = query.eq('nucleus', filters.user.nucleus);
    else if (filters.nucleus && filters.nucleus !== 'Todos') query = query.eq('nucleus', filters.nucleus);

    if (filters.startDate) query = query.gte('entry_date', filters.startDate);
    if (filters.endDate) query = query.lte('entry_date', filters.endDate);

    const { data } = await query;
    const statsMap = new Map<string, number>();
    let pendingCount = 0, unassignedCount = 0;

    (data || []).forEach((p: Record<string, unknown>) => {
      if (p['status'] === 'Pendente') pendingCount++;
      if (!p['assigned_to_id']) unassignedCount++;
      if (p['assigned_to_id']) {
        const userId = String(p['assigned_to_id']);
        statsMap.set(userId, (statsMap.get(userId) || 0) + 1);
      }
    });

    const userStats = Array.from(statsMap.entries()).map(([userId, count]) => ({
      userId, userName: this.authService.users().find(u => u.id === userId)?.name || 'Desconhecido', count
    })).sort((a, b) => b.count - a.count);

    return { userStats, pendingCount, unassignedCount };
  }

  async updateGlobalStats() {
    if (this.statsTimeout) clearTimeout(this.statsTimeout);
    this.statsTimeout = setTimeout(async () => {
      const client = this.supabaseService.getClient();
      const user = this.authService.currentUser();
      if (!client || !user) return;

      const getCount = async (status: string | null) => {
        let q = client.from('processes').select('*', { count: 'estimated', head: true });
        if (status) q = q.eq('status', status);
        if (user.role === 'Chefe' || user.role === 'Gerente') q = q.eq('nucleus', user.nucleus);
        else if (user.role === 'Contador Judicial') q = q.eq('assigned_to_id', user.id);
        const { count } = await q;
        return count || 0;
      };

      const pendentes = await getCount('Pendente');
      const concluidos = await getCount('Cálculo Realizado');
      const devolvidos = await getCount('Devolvido sem Cálculo');
      this.globalStats.set({ pendentes, concluidos, devolvidos });
    }, 500);
  }

  async fetchLastEtlUpdate() {
    const client = this.supabaseService.getClient();
    if (!client) return;
    // Identifica o último registro de carga automática do ETL pela action
    const { data } = await client
      .from('audit_logs')
      .select('created_at')
      .or('action.ilike.%ETL%,action.ilike.%Importou%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) this.lastEtlUpdate.set(new Date(data.created_at));
  }
}
