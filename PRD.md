# PRD — SAGEP
## Sistema de Acompanhamento e Gestão de Processos da Contadoria
**Tribunal de Justiça de Pernambuco (TJPE)**

---

> **Versão:** 1.0  
> **Data:** 29/04/2026  
> **Status:** Aprovação

---

## 1. Visão Geral

### 1.1 Problema

A Contadoria do TJPE recebe centenas de processos judiciais por remessa para elaboração de cálculos. Antes do SAGEP, o controle era feito manualmente em planilhas, causando:

- Perda de rastreabilidade (quem está com qual processo)
- Dificuldade em priorizar processos urgentes (mandados judiciais, liminares)
- Ausência de métricas sobre produtividade e tempo de conclusão
- Inconsistências entre o arquivo de importação e o sistema real

### 1.2 Solução

O SAGEP é uma plataforma web que centraliza o recebimento, a distribuição e o acompanhamento dos processos judiciais na Contadoria, com:

- Fila de processos por núcleo com regras de prioridade
- Atribuição manual e automática de processos aos contadores
- Importação automatizada via arquivo XLSX ou ETL agendado
- Controle de acesso por papel hierárquico
- Logs de auditoria de todas as ações

---

## 2. Objetivos de Negócio

| Objetivo | Métrica de Sucesso |
|---|---|
| Eliminar controle manual por planilha | 100% dos processos cadastrados no sistema |
| Garantir atendimento às prioridades legais | Super prioridades sempre no topo da fila |
| Distribuição equitativa de processos | Desvio máximo de ±1 processo por contador no round-robin |
| Rastreabilidade completa | Cada ação registrada em log de auditoria |
| Atualização automática diária | ETL executa sem intervenção manual |

---

## 3. Stakeholders

| Papel | Responsabilidade |
|---|---|
| Coordenador da Contadoria | Aprovador do produto; define regras de negócio |
| Chefes de Núcleo | Usuários primários; gerenciam atribuições |
| Contadores Judiciais | Usuários finais; executam os cálculos |
| TI / Desenvolvedor | Mantenedor técnico |

---

## 4. Perfis de Usuário e Permissões

### 4.1 Hierarquia de Papéis

```
Administrador
    └── Coordenador
            └── Supervisor
                    └── Chefe / Gerente
                                └── Contador Judicial
```

### 4.2 Tabela de Permissões

| Ação | Administrador | Coordenador | Supervisor | Chefe / Gerente | Contador Judicial |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver todos os processos | ✅ | ✅ | ✅ | ✅ (próprio núcleo) | ✅ (próprios) |
| Filtrar por núcleo | ✅ | ✅ | ✅ | ❌ | ❌ |
| Atribuir processos | ✅ | ✅ | ✅ | ✅ | ❌ |
| Alterar prioridade | ✅ | ✅ | ✅ | ✅ | ❌ |
| Alterar status (cumprimento) | ✅ | ✅ | ✅ | ✅ | ✅ (próprios) |
| Excluir processo | ✅ | ✅ | ❌ | ❌ | ❌ |
| Importar processos (arquivo) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Importar tempo real (Storage) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Atribuição automática | ✅ | ✅ | ✅ | ✅ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver logs de auditoria | ✅ | ✅ | ❌ | ❌ | ❌ |

### 4.3 Visibilidade de Processos por Papel

- **Administrador / Coordenador / Supervisor:** Veem todos os processos de todos os núcleos
- **Chefe / Gerente:** Veem processos do próprio núcleo + processos atribuídos a si
- **Contador Judicial:** Veem apenas processos atribuídos a si

---

## 5. Regras de Negócio

### 5.1 Núcleos

Cada processo pertence a um **Núcleo** (ex: 1ª CC, 2ª CC, 3ª CC). Os núcleos são as unidades organizacionais da Contadoria. Cada contador pertence a um núcleo e só pode ser atribuído a processos do seu núcleo.

### 5.2 Prioridades

Os processos possuem um nível de prioridade que determina a ordem de atendimento:

| Nível | Nome | Exemplos | Ação |
|---|---|---|---|
| **1** | Super prioridade | Mandado judicial urgente, liminar | Sempre no topo da fila visual |
| **2** | Demais prioridades | Prioridade legal, Ordem Superior, 1-* | Abaixo do Super na fila visual |
| **3** | Sem prioridade | Processo regular | Ordem normal de chegada |

> ⚠️ A prioridade **não altera** a Posição Geral do processo. Apenas define onde ele aparece na lista visual.

### 5.3 Regras de Posição

#### 5.3.1 Posição Geral (`position`)

- Calculada **por núcleo** (cada núcleo tem sua própria sequência)
- Reflete a **ordem cronológica de chegada** (`entry_date` ASC, `id` ASC como desempate)
- **Não é afetada pela prioridade**
- Exemplo:
  ```
  Núcleo 1CC:
    Pos. 1 → Processo A (27/04, Sem prioridade)  ← chegou 1º
    Pos. 2 → Processo B (28/04, Prioridade legal) ← chegou 2º
    Pos. 3 → Processo C (28/04, Super prioridade) ← chegou 3º (mesmo dia, inserido depois)
  ```

#### 5.3.2 Posição Prioridade (`priority_position`)

- Calculada **por núcleo**, apenas para processos prioritários (níveis 1 e 2)
- Todos os processos prioritários (Super + Legal + Ordem) formam **um único ranking**
- Super prioridade sempre recebe números menores que Legal/Ordem (mesmo que tenha chegado depois)
- Processos sem prioridade recebem `NULL` (exibido como `—` na tela)
- Exemplo (continuando acima):
  ```
  Pos. Prioridade 1 → Processo C (Super, 28/04) ← Super vence Legal no ranking de prioridade
  Pos. Prioridade 2 → Processo B (Legal, 28/04)  ← Legal fica depois do Super
  Processo A → NULL (sem prioridade)
  ```

#### 5.3.3 Ordem Visual na Tela

A lista exibe os processos na seguinte ordem (independente da Posição Geral):
1. **Super prioridade** (entry_date ASC dentro do grupo)
2. **Demais prioridades** (entry_date ASC dentro do grupo)
3. **Sem prioridade** (entry_date ASC)

#### 5.3.4 Recálculo Automático de Posições

As posições são recalculadas automaticamente sempre que:
- Um processo tem seu **status alterado** (ex: Pendente → Cálculo Realizado)
- Um processo é **excluído**
- A **prioridade** de um processo é alterada
- Uma **importação** é concluída

O recálculo é feito via função SQL `update_process_positions()` que atualiza apenas os processos com status `Pendente`.

### 5.4 Status (Cumprimento)

Os status representam o estado atual do processo no fluxo de trabalho:

| Status | Descrição | Efeito |
|---|---|---|
| **Pendente** | Processo aguardando cálculo | Aparece na fila principal; entra no ranking de posições |
| **Cálculo Realizado** | Cálculo concluído | Sai do ranking de pendentes; data de cumprimento registrada |
| **Devolvido sem Cálculo** | Processo devolvido | Listado em "Devolvidos"; ordenado por data de cumprimento decrescente |
| *(outros)* | Status customizáveis | Configuráveis no banco via tabela `status` |

> Ao mudar o status para **não-Pendente**, o sistema registra automaticamente a `completion_date` com a data atual.

### 5.5 Atribuição de Processos

#### 5.5.1 Atribuição Manual

- Chefes, Gerentes, Coordenadores e Supervisores podem atribuir qualquer processo a qualquer contador ativo do mesmo núcleo
- A `assignment_date` é registrada automaticamente na data da atribuição
- Processos Super prioridade **não entram** na atribuição automática

#### 5.5.2 Atribuição Automática (Round-Robin)

Distribui os processos pendentes e não atribuídos de um núcleo entre os contadores selecionados, seguindo a lógica:

1. O usuário seleciona quais contadores participarão da distribuição
2. Os processos são ordenados por `position` ASC (mais antigos primeiro)
3. A distribuição é sequencial (round-robin) começando pelo **próximo contador** após o último que recebeu um processo
4. Processos com **Super prioridade são excluídos** da atribuição automática (devem ser atribuídos manualmente)
5. O sistema memoriza qual foi o **último contador atribuído** (`lastAssignedUserId` no núcleo) para garantir continuidade em execuções seguintes

### 5.6 Importação de Processos

#### 5.6.1 Via Arquivo (CSV/XLSX)

- Formatos aceitos: `.csv`, `.xlsx`, `.xls`
- Colunas mapeadas (flexível, aceita variações de nome):

| Coluna no arquivo | Campo no sistema |
|---|---|
| `numero`, `Número do Processo`, `Processo`, `NPU` | Número do processo |
| `Data de Remessa`, `data_remessa`, `entrada` | Data de remessa |
| `vara`, `Vara`, `Juízo` | Vara / Juízo |
| `nucleo`, `Núcleo` | Núcleo |
| `prioridade`, `Prioridade`, `prioridades` | Prioridade |
| `Cumprimento`, `status`, `situação` | Status |
| `Valor Custas`, `custas` | Valor das custas |
| `Observação`, `obs` | Observação |
| `Atribuído a`, `Contador`, `Responsável` | Atribuição |

- Processos já existentes (mesmo número + data + núcleo) são **ignorados** (não duplicados)
- Inconsistências (processos pendentes no sistema mas ausentes no arquivo) são reportadas e exportáveis em XLSX
- Importação em chunks de 500 registros para evitar timeout

#### 5.6.2 Via Storage (Tempo Real / ETL)

- O sistema verifica um arquivo XLSX em um bucket do Supabase Storage (configurado via variável de ambiente)
- Mesmo mapeamento de colunas da importação por arquivo
- Executado sob demanda pelo usuário (botão "Importar Tempo Real")
- O ETL Python pode depositar o arquivo no Storage automaticamente (agendado externamente)
- Após importação, o sistema chama `update_process_positions()` para recalcular todos os rankings

### 5.7 Campos Editáveis em Linha

Na tabela do dashboard, os usuários autorizados podem editar diretamente:

| Campo | Quem pode editar |
|---|---|
| **Prioridade** | Administrador, Coordenador, Supervisor, Chefe, Gerente |
| **Cumprimento (Status)** | Todos (cada um com suas restrições de visibilidade) |
| **Atribuído a** | Administrador, Coordenador, Supervisor, Chefe, Gerente |
| **Valor Custas** | Todos os que têm acesso ao processo |
| **Observação** | Todos os que têm acesso ao processo |

### 5.8 Filtros Disponíveis

| Filtro | Descrição |
|---|---|
| Busca livre | Número do processo, vara, status, nome do contador |
| Data Início / Data Fim | Filtra por `entry_date` (pendentes) ou `completion_date` (devolvidos) |
| Filtrar por Núcleo | Apenas para Administrador, Coordenador, Supervisor |
| Pendentes / Devolvidos / Todos | Toggle de status rápido |
| Atribuídos a mim | Filtra processos atribuídos ao usuário logado |
| Não Atribuídos | Filtra processos sem contador responsável |
| Contadores Externos | Filtra processos atribuídos a contadores de outros núcleos |

### 5.9 Exportação para Excel

- Exporta todos os processos com os filtros aplicados (não apenas a página atual)
- Campos exportados: Posição Geral, Posição Prioridade, Número, Data de Remessa, Vara, Núcleo, Prioridade, Cumprimento, Valor Custas, Observação, Data de Atribuição, Data de Cumprimento, Atribuído a

### 5.10 Logs de Auditoria

Toda ação relevante é registrada com: usuário, ação, data/hora e detalhes. Ações auditadas:

- Login / Logout
- Adição, atualização e exclusão de usuários
- Inserção, atualização de status, atribuição e exclusão de processos
- Importações (sucesso, ignorados, inconsistências)
- Atribuição automática (quantos processos distribuídos)

---

## 6. Fluxos Principais

### 6.1 Fluxo de Recebimento de Processo

```
ETL Python (agendado) ──→ Arquivo XLSX no Storage
                                      │
                          Importação pelo sistema
                                      │
                          Validação e deduplicação
                                      │
                    Processo inserido com position = N+1 (próxima chegada no núcleo)
                                      │
                    update_process_positions() recalcula todos os pendentes
                                      │
                    Processo aparece na fila do núcleo correspondente
```

### 6.2 Fluxo de Atribuição Manual

```
Chefe acessa dashboard do seu núcleo
          │
          ├── Ordena visualmente: Super → Legal → Sem prioridade
          │
          └── Seleciona contador no campo "Atribuído a"
                        │
                        assignment_date = hoje
                        │
                        Salvo no banco + log de auditoria
```

### 6.3 Fluxo de Conclusão de Processo

```
Contador Judicial acessa sua lista de processos
          │
          └── Altera status de "Pendente" para "Cálculo Realizado"
                        │
                        completion_date = hoje
                        │
                        update_process_positions() recalcula
                        │
                        Processo sai do ranking de pendentes
                        O próximo processo sobe uma posição
```

---

## 7. Arquitetura Técnica

### 7.1 Visão Geral

```
┌─────────────────────────────────────────────────────┐
│                     Frontend                         │
│   Angular 17+ │ TailwindCSS │ Signals │ OnPush CD   │
└──────────────────────────┬──────────────────────────┘
                           │ Supabase JS Client
┌──────────────────────────▼──────────────────────────┐
│                     Supabase                         │
│   PostgreSQL │ Storage │ Auth │ Edge Functions        │
│                                                      │
│   Tabelas: processes, users, nucleos,                │
│            prioridades, status, audit_logs           │
│   View:    vw_processes (posições calculadas)        │
│   RPC:     update_process_positions()                │
└──────────────────────────┬──────────────────────────┘
                           │ Script Python
┌──────────────────────────▼──────────────────────────┐
│                     ETL Python                       │
│   Pandas │ Streamlit │ Supabase Python SDK           │
│   Extrai relatório TJPE → Transforma → Storage       │
└─────────────────────────────────────────────────────┘
```

### 7.2 Tabelas Principais

| Tabela | Descrição |
|---|---|
| `processes` | Processos judiciais; colunas `position` e `priority_position` são atualizadas pelo RPC |
| `users` | Usuários do sistema com papel e núcleo |
| `nucleos` | Núcleos da Contadoria; guarda `last_assigned_user_id` para round-robin |
| `prioridades` | Tipos de prioridade cadastrados |
| `status` | Tipos de status/cumprimento cadastrados |
| `audit_logs` | Log imutável de todas as ações |

### 7.3 View `vw_processes`

Calcula dinamicamente, em tempo real:
- `position`: Posição Geral cronológica por núcleo
- `priority_position`: Posição dentro do ranking de prioridades por núcleo
- `priority_level`: Nível numérico da prioridade (1=Super, 2=Outros, 3=Regular) — usado para ordenação na query

> A view só inclui processos pendentes no cálculo. Processos concluídos mantêm a última posição registrada na tabela.

---

## 8. Variáveis de Ambiente

| Variável | Uso |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública do Supabase |
| `SUPABASE_STORAGE_BUCKET` | Nome do bucket com o arquivo de importação |
| `SUPABASE_STORAGE_FILE_PATH` | Caminho do arquivo XLSX no bucket |

---

## 9. Não-Requisitos (Fora do Escopo)

- ❌ Autenticação via Supabase Auth nativo (autenticação própria por matrícula/senha)
- ❌ App mobile nativo
- ❌ Integração direta com o sistema do TJPE (importação é via arquivo)
- ❌ Geração dos cálculos judiciais (o sistema apenas acompanha o processo)
- ❌ Notificações por e-mail/push

---

## 10. Glossário

| Termo | Definição |
|---|---|
| **Processo** | Ação judicial encaminhada à Contadoria para elaboração de cálculo |
| **Núcleo** | Unidade organizacional da Contadoria (ex: 1ª CC, 2ª CC) |
| **Remessa** | Data em que o processo chegou à Contadoria |
| **Cumprimento** | Status do processo no fluxo da Contadoria |
| **Posição Geral** | Número de chegada cronológica do processo no núcleo |
| **Posição Prioridade** | Rank do processo dentro do grupo de prioritários do núcleo |
| **Round-Robin** | Algoritmo de distribuição sequencial e rotativa entre contadores |
| **ETL** | Processo automatizado de extração, transformação e carga de dados |
| **Super prioridade** | Processo com determinação judicial urgente (ex: liminar, mandado) |
