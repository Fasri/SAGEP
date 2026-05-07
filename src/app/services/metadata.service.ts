import { Injectable, signal } from '@angular/core';
import { Nucleo, Prioridade, StatusTipo } from '../types';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class MetadataService {
  nucleos = signal<Nucleo[]>([]);
  prioridades = signal<Prioridade[]>([]);
  statusTipos = signal<StatusTipo[]>([]);

  constructor(private supabaseService: SupabaseService) {}

  async loadMetadata() {
    const client = this.supabaseService.getClient();
    if (!client) return;

    try {
      const [{ data: nucleos }, { data: prioridades }, { data: statusTipos }] = await Promise.all([
        client.from('nucleos').select('*'),
        client.from('prioridades').select('*'),
        client.from('status').select('*'),
      ]);

      const needsSeed = !nucleos?.length || !prioridades?.length || !statusTipos?.length;
      if (needsSeed) await this.seedDatabase();

      const finalNucleos = nucleos?.length ? nucleos : (await client.from('nucleos').select('*')).data;
      const finalPrioridades = prioridades?.length ? prioridades : (await client.from('prioridades').select('*')).data;
      const finalStatus = statusTipos?.length ? statusTipos : (await client.from('status').select('*')).data;

      if (finalNucleos) {
        this.nucleos.set(finalNucleos.map((n: Record<string, unknown>) => ({
          id: String(n['id']),
          nome: String(n['nome']),
          descricao: String(n['descricao'] || ''),
          lastAssignedUserId: n['last_assigned_user_id'] ? String(n['last_assigned_user_id']) : null
        })));
      }
      if (finalPrioridades) this.prioridades.set(finalPrioridades as any);
      if (finalStatus) this.statusTipos.set(finalStatus as any);
    } catch (error) {
      console.error('MetadataService: Error loading metadata:', error);
    }
  }

  async seedDatabase() {
    const client = this.supabaseService.getClient();
    if (!client) return;

    console.log('MetadataService: Seeding database with default values...');
    
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
      for (const item of defaultNucleos) {
        const { data } = await client.from('nucleos').select('id').eq('nome', item.nome).maybeSingle();
        if (!data) {
          const { error } = await client.from('nucleos').insert([item]);
          if (error) console.error(`MetadataService: Error seeding nucleus ${item.nome}:`, error.message);
        }
      }
      
      for (const item of defaultPrioridades) {
        const { data } = await client.from('prioridades').select('id').eq('nome', item.nome).maybeSingle();
        if (!data) {
          const { error } = await client.from('prioridades').insert([item]);
          if (error) console.error(`MetadataService: Error seeding priority ${item.nome}:`, error.message);
        }
      }
      
      for (const item of defaultStatus) {
        const { data } = await client.from('status').select('id').eq('nome', item.nome).maybeSingle();
        if (!data) {
          const { error } = await client.from('status').insert([item]);
          if (error) console.error(`MetadataService: Error seeding status ${item.nome}:`, error.message);
        }
      }
      
      console.log('MetadataService: Database seeded/verified successfully.');
    } catch (error) {
      console.error('MetadataService: Error seeding database:', error);
    }
  }

  fixEncoding(text: string): string {
    if (!text) return '';
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
      .replace(/[\uFFFD]/g, 'ª');
  }

  normalizeNucleus(name: string): string {
    if (!name) return '1ª CC';
    const fixed = this.fixEncoding(name).trim();
    const n = fixed.toUpperCase();
    
    const found = this.nucleos().find(item => item.nome.toUpperCase() === n);
    if (found) return found.nome;

    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const fixedNormalized = normalize(fixed);
    const fuzzyFound = this.nucleos().find(item => normalize(item.nome) === fixedNormalized);
    if (fuzzyFound) return fuzzyFound.nome;

    const fuzzy = n.replace(/[^A-Z0-9]/g, '');
    
    if (fuzzy === '1CC' || fuzzy === '1CAMARACIVEL') return '1ª CC';
    if (fuzzy === '2CC' || fuzzy === '2CAMARACIVEL') return '2ª CC';
    if (fuzzy === '3CC' || fuzzy === '3CAMARACIVEL') return '3ª CC';
    if (fuzzy === '4CC' || fuzzy === '4CAMARACIVEL') return '4ª CC';
    if (fuzzy === '5CC' || fuzzy === '5CAMARACIVEL') return '5ª CC';
    if (fuzzy === '6CC' || fuzzy === '6CAMARACIVEL') return '6ª CC';
    if (fuzzy === '7CC' || fuzzy === '7CAMARACIVEL') return '7ª CC';
    if (fuzzy === '8CC' || fuzzy === '8CAMARACIVEL') return '8ª CC';
    
    if (fuzzy.includes('1CCJ')) return '1ª CCJ';
    if (fuzzy.includes('2CCJ')) return '2ª CCJ';
    if (fuzzy === 'CCJ') return 'CCJ';

    return fixed;
  }

  normalizePriority(name: string): string {
    if (!name) return '2-Sem prioridade';
    const fixed = this.fixEncoding(name).trim();
    const n = fixed.toUpperCase();
    
    const foundExact = this.prioridades().find(item => item.nome.toUpperCase() === n);
    if (foundExact) return foundExact.nome;

    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const fixedNormalized = normalize(fixed);
    const fuzzyFound = this.prioridades().find(item => normalize(item.nome) === fixedNormalized);
    if (fuzzyFound) return fuzzyFound.nome;

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
    
    return fixed;
  }

  normalizeStatus(name: string): string {
    if (!name) return 'Pendente';
    const fixed = this.fixEncoding(name).trim();
    
    const found = this.statusTipos().find(s => s.nome.toLowerCase() === fixed.toLowerCase());
    if (found) return found.nome;
    
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const fixedNormalized = normalize(fixed);
    const fuzzyFound = this.statusTipos().find(s => normalize(s.nome) === fixedNormalized);
    if (fuzzyFound) return fuzzyFound.nome;
    
    return fixed;
  }

  async ensureStatusExists(statusName: string) {
    const client = this.supabaseService.getClient();
    if (!statusName || !client) return;
    try {
      const { data, error } = await client.from('status').select('id').eq('nome', statusName).maybeSingle();
      if (error) {
        console.error(`MetadataService: Error checking status "${statusName}":`, error.message);
        return;
      }
      if (!data) {
        const { error: insertError } = await client.from('status').insert([{ nome: statusName, descricao: 'Adicionado automaticamente' }]);
        if (!insertError) {
          const { data: allStatus } = await client.from('status').select('*');
          if (allStatus) this.statusTipos.set(allStatus);
        }
      }
    } catch (e) {
      console.error(`MetadataService: Exception in ensureStatusExists`, e);
    }
  }

  async ensureNucleusExists(nucleusName: string) {
    const client = this.supabaseService.getClient();
    if (!nucleusName || !client) return;
    try {
      const { data, error } = await client.from('nucleos').select('id').eq('nome', nucleusName).maybeSingle();
      if (error) {
        console.error(`MetadataService: Error checking nucleus "${nucleusName}":`, error.message);
        return;
      }
      if (!data) {
        const { error: insertError } = await client.from('nucleos').insert([{ nome: nucleusName, descricao: 'Adicionado automaticamente' }]);
        if (!insertError) {
          const { data: allNucleos } = await client.from('nucleos').select('*');
          if (allNucleos) this.nucleos.set(allNucleos);
        }
      }
    } catch (e) {
      console.error(`MetadataService: Exception in ensureNucleusExists`, e);
    }
  }

  async ensurePriorityExists(priorityName: string) {
    const client = this.supabaseService.getClient();
    if (!priorityName || !client) return;
    try {
      const { data, error } = await client.from('prioridades').select('id').eq('nome', priorityName).maybeSingle();
      if (error) {
        console.error(`MetadataService: Error checking priority "${priorityName}":`, error.message);
        return;
      }
      if (!data) {
        const { error: insertError } = await client.from('prioridades').insert([{ nome: priorityName, descricao: 'Adicionado automaticamente' }]);
        if (!insertError) {
          const { data: allPriorities } = await client.from('prioridades').select('*');
          if (allPriorities) this.prioridades.set(allPriorities);
        }
      }
    } catch (e) {
      console.error(`MetadataService: Exception in ensurePriorityExists`, e);
    }
  }
}
