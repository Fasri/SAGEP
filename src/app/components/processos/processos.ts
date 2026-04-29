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
  templateUrl: './processos.html',
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
    console.log('UI: onImportRealTime clicked');
    this.isImporting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.importErrors.set([]);
    this.importProgress.set(10);

    try {
      console.log('UI: Calling store.importFromStorage()...');
      const result = await this.store.importFromStorage();
      console.log('UI: store.importFromStorage() finished with result:', result);
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
        
        console.log(`UI: Starting local file import. Total rows: ${json.length}`);
        if (json.length > 0) {
          console.log('UI: First row sample:', json[0]);
          console.log('UI: Column headers:', Object.keys(json[0]));
        }

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
            const entryDate = parseDate(getVal(['Data de Remessa', 'Entrada', 'Data de Entrada', 'Data Entrada', 'entrada', 'data_remessa', 'remessa', 'entryDate', 'entry_date'])) || new Date().toISOString().split('T')[0];
            const court = String(getVal(['Vara', 'Juízo', 'Vara / Juízo', 'court', 'juizo', 'court_name']) || '').trim();
            const nucleus = String(getVal(['Núcleo', 'Nucleo', 'nucleus', 'nucleo']) || '1ª CC').trim();
            const priority = String(getVal(['Prioridade', 'priority', 'prioridade']) || 'Sem prioridade').trim();
            const status = String(getVal(['Cumprimento', 'Status', 'status', 'situacao']) || 'Pendente').trim();
            const valorCustas = Number(getVal(['Valor Custas', 'Valor das Custas', 'custas', 'valor_custas', 'valorCustas']) || 0);
            const assignmentDate = parseDate(getVal(['Atribuição', 'Data de Atribuição', 'Data Atribuição', 'atribuicao', 'data_atribuicao', 'assignmentDate', 'assignment_date']));
            const completionDate = parseDate(getVal(['Data de Cumprimento', 'Cumprimento', 'Data de Cumprimento', 'Data Cumprimento', 'cumprimento', 'data_cumprimento', 'completionDate', 'completion_date']));
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
