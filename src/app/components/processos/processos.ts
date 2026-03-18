import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {StoreService} from '../../services/store';
import {read, utils, writeFile} from 'xlsx';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-processos',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <main class="max-w-4xl mx-auto px-4 py-8">
      <div class="mb-8 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-extrabold text-slate-900">Adicionar Processos</h2>
          <p class="text-slate-600 mt-2">Cadastre novos processos no sistema ou realize importação por arquivo.</p>
        </div>
        
        @if (currentUser()?.role === 'Coordenador' || currentUser()?.role === 'Supervisor' || currentUser()?.role === 'Administrador') {
          <div class="flex flex-col items-end gap-2">
            <div class="flex gap-2">
              <button (click)="onImportRealTime()" 
                      [disabled]="isImporting()"
                      class="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md disabled:opacity-50">
                <span class="material-symbols-outlined">{{ isImporting() ? 'sync' : 'cloud_download' }}</span>
                Importar Tempo Real
              </button>
              <label class="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md cursor-pointer">
                <span class="material-symbols-outlined">upload_file</span>
                Importar CSV / XLSX
                <input type="file" (change)="onFileSelected($event)" accept=".csv, .xlsx, .xls" class="hidden" />
              </label>
            </div>
            <span class="text-[10px] text-slate-400 uppercase font-bold">Colunas aceitas: numero, processo, data_entrada, data, vara, nucleo, prioridade, prioridades, status, valor_custas, observacao</span>
          </div>
        }
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div class="p-8">
          <form [formGroup]="processForm" (ngSubmit)="onSubmit()" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="flex flex-col gap-2">
                <label for="number" class="text-sm font-bold text-slate-700">Número do Processo</label>
                <input id="number" formControlName="number" 
                       placeholder="0000000-00.0000.8.17.0001"
                       class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all" />
              </div>
              
              <div class="flex flex-col gap-2">
                <label for="entryDate" class="text-sm font-bold text-slate-700">Data de Entrada</label>
                <input id="entryDate" formControlName="entryDate" type="date"
                       class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all" />
              </div>

              <div class="flex flex-col gap-2">
                <label for="court" class="text-sm font-bold text-slate-700">Vara / Juízo</label>
                <input id="court" formControlName="court" placeholder="Ex: 1ª Vara Cível"
                       class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all" />
              </div>

              <div class="flex flex-col gap-2">
                <label for="nucleus" class="text-sm font-bold text-slate-700">Núcleo</label>
                <select id="nucleus" formControlName="nucleus" 
                        class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer">
                  <option value="">Selecione um núcleo...</option>
                  @for (n of nucleos(); track n.id) {
                    <option [value]="n.nome">{{ n.nome }}</option>
                  }
                </select>
              </div>

              <div class="flex flex-col gap-2">
                <label for="priority" class="text-sm font-bold text-slate-700">Prioridade</label>
                <select id="priority" formControlName="priority" 
                        class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer">
                  <option value="2-Sem prioridade">Sem prioridade</option>
                  <option value="2-Prioridade legal">Prioridade legal</option>
                  <option value="1-Super prioridade">Super prioridade</option>
                  @for (p of prioridades(); track p.id) {
                    @if (!['2-Sem prioridade', '2-Prioridade legal', '1-Super prioridade'].includes(p.nome)) {
                      <option [value]="p.nome">{{ stripPriorityPrefix(p.nome) }}</option>
                    }
                  }
                </select>
              </div>

              <div class="flex flex-col gap-2">
                <label for="status" class="text-sm font-bold text-slate-700">Status Inicial</label>
                <select id="status" formControlName="status" 
                        class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer">
                  <option value="Pendente">Pendente</option>
                  <option value="Cálculo Realizado">Cálculo Realizado</option>
                  <option value="Devolvido sem Cálculo">Devolvido sem Cálculo</option>
                  @for (st of statusTipos(); track st.id) {
                    @if (!['Pendente', 'Cálculo Realizado', 'Devolvido sem Cálculo'].includes(st.nome)) {
                      <option [value]="st.nome">{{ st.nome }}</option>
                    }
                  }
                </select>
              </div>

              <div class="flex flex-col gap-2">
                <label for="assignedToId" class="text-sm font-bold text-slate-700">Atribuir a</label>
                <input id="assignedToId" type="text" list="assign-list-new"
                       placeholder="Não atribuído"
                       [value]="getAssignedName()"
                       (change)="handleAssignInput($event)"
                       class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer" />
                <datalist id="assign-list-new">
                  <option value=""></option>
                  @for (user of users(); track user.id) {
                    @if (user.role !== 'Administrador') {
                      <option [value]="user.name">{{ user.role }}</option>
                    }
                  }
                </datalist>
              </div>

              <div class="flex flex-col gap-2">
                <label for="valorCustas" class="text-sm font-bold text-slate-700">Valor das Custas (R$)</label>
                <input id="valorCustas" formControlName="valorCustas" type="number" step="0.01"
                       placeholder="0.00"
                       class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all" />
              </div>

              <div class="flex flex-col gap-2">
                <label for="assignmentDate" class="text-sm font-bold text-slate-700">Data de Atribuição</label>
                <input id="assignmentDate" formControlName="assignmentDate" type="date"
                       class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all" />
              </div>

              <div class="flex flex-col gap-2">
                <label for="completionDate" class="text-sm font-bold text-slate-700">Data de Conclusão</label>
                <input id="completionDate" formControlName="completionDate" type="date"
                       class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all" />
              </div>

              <div class="flex flex-col gap-2 md:col-span-2">
                <label for="observacao" class="text-sm font-bold text-slate-700">Observação</label>
                <textarea id="observacao" formControlName="observacao" rows="3"
                          placeholder="Adicione observações relevantes sobre o processo..."
                          class="border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all resize-none"></textarea>
              </div>
            </div>

            <div class="pt-4">
              <button type="submit" 
                      [disabled]="processForm.invalid || isSubmitting()"
                      class="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50">
                <span class="material-symbols-outlined">{{ isSubmitting() ? 'sync' : 'add_circle' }}</span>
                {{ isSubmitting() ? 'Salvando...' : 'Cadastrar Processo' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      @if (successMessage()) {
        <div class="mt-6 p-4 bg-green-100 text-green-700 rounded-xl border border-green-200 flex items-center gap-3 animate-bounce">
          <span class="material-symbols-outlined">check_circle</span>
          {{ successMessage() }}
        </div>
      }

      @if (isImporting()) {
        <div class="mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-bold text-slate-700">Importando Processos...</span>
            <span class="text-sm font-mono text-primary">{{ importProgress() }}%</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div class="bg-primary h-full transition-all duration-300" [style.width.%]="importProgress()"></div>
          </div>
        </div>
      }

      @if (errorMessage()) {
        <div class="mt-6 p-4 bg-red-100 text-red-700 rounded-xl border border-red-200 flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined">error</span>
            <span class="font-bold">{{ errorMessage() }}</span>
          </div>
          @if (importErrors().length > 0) {
            <div class="mt-4 flex justify-between items-center">
              <span class="text-xs font-bold text-red-800 uppercase tracking-wider">Lista de Inconsistências</span>
              <button (click)="downloadInconsistencies()" 
                      class="flex items-center gap-1 text-xs bg-white text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all font-bold shadow-sm">
                <span class="material-symbols-outlined text-sm">download</span>
                Baixar XLSX
              </button>
            </div>
            <div class="mt-2 text-xs bg-white/50 p-3 rounded-lg max-h-40 overflow-y-auto border border-red-200">
              <ul class="list-disc list-inside space-y-1">
                @for (error of importErrors(); track $index) {
                  <li>{{ error }}</li>
                }
              </ul>
            </div>
          }
        </div>
      }
    </main>
  `
})
export class Processos {
  private store = inject(StoreService);
  currentUser = this.store.currentUser;
  users = this.store.users;
  nucleos = this.store.nucleos;
  prioridades = this.store.prioridades;
  statusTipos = this.store.statusTipos;
  
  isSubmitting = signal(false);
  isImporting = signal(false);
  importProgress = signal(0);
  successMessage = signal('');
  errorMessage = signal('');
  importErrors = signal<string[]>([]);

  processForm = new FormGroup({
    number: new FormControl('', [Validators.required, Validators.pattern(/^\d{7}-\d{2}\.\d{4}\.8\.17\.\d{4}$/)]),
    entryDate: new FormControl(new Date().toISOString().split('T')[0], Validators.required),
    court: new FormControl('', Validators.required),
    nucleus: new FormControl('1ª CC', Validators.required),
    priority: new FormControl('2-Sem prioridade', Validators.required),
    status: new FormControl('Pendente', Validators.required),
    assignedToId: new FormControl<string | null>(null),
    valorCustas: new FormControl(0),
    assignmentDate: new FormControl<string | null>(null),
    completionDate: new FormControl<string | null>(null),
    observacao: new FormControl('')
  });

  stripPriorityPrefix(priority: string): string {
    if (!priority) return '';
    return priority.replace(/^\d+-/, '');
  }

  getAssignedName(): string {
    const assignedToId = this.processForm.get('assignedToId')?.value;
    if (!assignedToId) return '';
    const user = this.users().find(u => u.id === assignedToId);
    return user ? user.name : '';
  }

  handleAssignInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value) {
      this.processForm.patchValue({ assignedToId: null });
      return;
    }
    const user = this.users().find(u => u.name.toLowerCase() === value.toLowerCase() && u.role !== 'Administrador');
    if (user) {
      this.processForm.patchValue({ assignedToId: user.id });
    } else {
      // Revert to current if invalid
      input.value = this.getAssignedName();
    }
  }

  async onSubmit() {
    if (this.processForm.valid) {
      this.isSubmitting.set(true);
      this.errorMessage.set('');
      const val = this.processForm.value;
      
      try {
        await this.store.addProcess({
          number: val.number!,
          entryDate: val.entryDate!,
          court: val.court!,
          nucleus: val.nucleus!,
          priority: val.priority!,
          status: val.status!,
          assignedToId: val.assignedToId || null,
          valorCustas: val.valorCustas || 0,
          assignmentDate: val.assignmentDate || null,
          completionDate: val.completionDate || null,
          observacao: val.observacao || '',
          createdAt: new Date().toISOString().split('T')[0]
        });

        this.successMessage.set('Processo cadastrado com sucesso!');
        this.processForm.reset({
          entryDate: new Date().toISOString().split('T')[0],
          nucleus: '1ª CC',
          priority: '2-Sem prioridade',
          assignedToId: null,
          valorCustas: 0,
          assignmentDate: null,
          completionDate: null,
          observacao: ''
        });
        setTimeout(() => this.successMessage.set(''), 3000);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Erro ao cadastrar processo.';
        this.errorMessage.set(message);
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }

  async onImportRealTime() {
    this.isImporting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.importErrors.set([]);
    this.importProgress.set(10);

    try {
      const result = await this.store.importFromStorage();
      this.importProgress.set(100);
      
      if (result.success > 0) {
        this.successMessage.set(`${result.success} novos processos importados. ${result.skipped} ignorados (já existentes).`);
      } else {
        this.successMessage.set(`Processamento concluído. Nenhum novo processo para importar. ${result.skipped} ignorados.`);
      }

      if (result.inconsistencies.length > 0) {
        this.errorMessage.set(`${result.inconsistencies.length} inconsistências encontradas (pendentes no sistema mas ausentes no arquivo).`);
        this.importErrors.set(result.inconsistencies);
      }
    } catch (err: unknown) {
      console.error('Processos: Error in real-time import:', err);
      const message = err instanceof Error ? err.message : 'Erro ao realizar importação em tempo real.';
      this.errorMessage.set(message);
    } finally {
      this.isImporting.set(false);
      setTimeout(() => {
        this.successMessage.set('');
        this.importProgress.set(0);
      }, 10000);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const result = e.target?.result;
        if (!result || !(result instanceof ArrayBuffer)) return;

        const data = new Uint8Array(result);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = utils.sheet_to_json(worksheet) as Record<string, unknown>[];

        if (json.length === 0) {
          this.errorMessage.set('O arquivo está vazio ou não contém dados válidos.');
          return;
        }

        this.isImporting.set(true);
        this.errorMessage.set('Lendo arquivo e preparando importação...');
        this.importProgress.set(0);
        this.importErrors.set([]);
        
        let count = 0;
        let skipped = 0;
        const errors: string[] = [];
        const total = json.length;

        this.errorMessage.set('');

        for (let i = 0; i < total; i++) {
          const row = json[i];
          try {
            const parseDate = (val: unknown) => {
              if (!val) return null;
              if (typeof val === 'number') {
                // Excel date number
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

            // Robust mapping for Excel column names
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

            const number = String(getVal(['Número do Processo', 'Processo', 'Número', 'numero_processo', 'number']) || '').trim();
            const entryDate = parseDate(getVal(['Entrada', 'Data de Entrada', 'Data Entrada', 'entrada', 'data_remessa', 'remessa', 'entryDate', 'entry_date'])) || new Date().toISOString().split('T')[0];
            const court = String(getVal(['Vara', 'Juízo', 'Vara / Juízo', 'court', 'juizo', 'court_name']) || '').trim();
            const nucleus = String(getVal(['Núcleo', 'Nucleo', 'nucleus', 'nucleo']) || '1ª CC').trim();
            const priority = String(getVal(['Prioridade', 'priority', 'prioridade']) || 'Sem prioridade').trim();
            const status = String(getVal(['Status', 'status', 'situacao']) || 'Pendente').trim();
            const valorCustas = Number(getVal(['Valor Custas', 'Valor das Custas', 'custas', 'valor_custas', 'valorCustas']) || 0);
            const assignmentDate = parseDate(getVal(['Atribuição', 'Data de Atribuição', 'Data Atribuição', 'atribuicao', 'data_atribuicao', 'assignmentDate', 'assignment_date']));
            const completionDate = parseDate(getVal(['Cumprimento', 'Data de Cumprimento', 'Data Cumprimento', 'cumprimento', 'data_cumprimento', 'completionDate', 'completion_date']));
            const observacao = String(getVal(['Observação', 'Observacao', 'observacao', 'obs', 'Nota']) || '').trim();
            const accountantName = String(getVal(['Atribuído a', 'Atribuido a', 'Contador', 'Calculista', 'Responsável', 'Responsavel', 'Técnico', 'Tecnico', 'assignedTo', 'assigned_to_id']) || '').trim();

            let assignedToId = null;
            if (accountantName) {
              // Try exact match first, then partial
              const user = this.users().find(u => u.name.toLowerCase() === accountantName.toLowerCase()) ||
                           this.users().find(u => u.name.toLowerCase().includes(accountantName.toLowerCase()));
              if (user) assignedToId = user.id;
            }

            const processData = {
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
              observacao,
              createdAt: new Date().toISOString().split('T')[0]
            };

            if (processData.number) {
              // Check for duplicates locally first to avoid unnecessary API calls
              const existing = this.store.processes().find(p => p.number === processData.number && p.entryDate === processData.entryDate);
              if (existing) {
                skipped++;
              } else {
                await this.store.addProcess(processData);
                count++;
              }
            } else {
              errors.push(`Linha ${i + 1}: Número do processo ausente.`);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            if (msg.includes('Já existe um processo cadastrado')) {
              skipped++;
            } else {
              console.error('Erro ao importar linha:', row, err);
              errors.push(`Linha ${i + 1} (${row['numero'] || 'N/A'}): ${msg}`);
            }
          }
          
          // Update progress
          this.importProgress.set(Math.round(((i + 1) / total) * 100));
        }

        this.isImporting.set(false);
        if (count > 0) {
          this.successMessage.set(`${count} processos importados com sucesso! ${skipped} ignorados (já existentes).`);
        } else if (skipped > 0) {
          this.successMessage.set(`Processamento concluído. ${skipped} processos ignorados por já existirem.`);
        }
        
        if (errors.length > 0) {
          this.errorMessage.set(`${errors.length} falhas encontradas durante a importação.`);
          this.importErrors.set(errors);
        }
        
        setTimeout(() => {
          this.successMessage.set('');
          if (errors.length === 0) this.errorMessage.set('');
        }, 8000);
      } catch (err) {
        console.error('Erro ao ler arquivo:', err);
        this.errorMessage.set('Erro crítico ao processar o arquivo. Verifique o formato.');
        this.isImporting.set(false);
      }
      input.value = ''; // Reset input
    };

    reader.readAsArrayBuffer(file);
  }

  downloadInconsistencies() {
    const errors = this.importErrors();
    if (errors.length === 0) return;

    const data = errors.map(err => ({ Inconsistencia: err }));
    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Inconsistencias');

    const fileName = `inconsistencias_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    writeFile(workbook, fileName);
  }
}
