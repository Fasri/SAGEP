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

### 5.3 Regras de Posição (V2)

#### 5.3.1 Níveis de Prioridade (priority_level)

Para fins de ordenação visual e agrupamento no Dashboard, os processos são divididos em **2 Níveis**:
*   **Nível 1 (Super Prioridade)**: Processos que contenham "SUPER" na prioridade. Sempre aparecem no topo da lista.
*   **Nível 2 (Geral)**: Todos os demais processos (Prioridade Legal, Ordem Superior, Sem Prioridade). Aparecem abaixo do Nível 1, ordenados estritamente por ordem de chegada.

#### 5.3.2 Posição Geral (position)

- Calculada **por núcleo** (cada núcleo tem sua própria sequência).
- Reflete a **ordem cronológica absoluta de chegada** (`entry_date::date` ASC, `created_at` ASC, `id` ASC).
- É um número sequencial (1º, 2º, 3º...) que nunca se repete no mesmo núcleo.
- **Não é afetada pela prioridade.**

#### 5.3.3 Posição Prioridade (priority_position)

- Indica o ranking relativo dentro do grupo de processos prioritários:
    - **Para Super Prioridade**: Ranking (1, 2, 3...) apenas entre os processos Super do mesmo núcleo.
    - **Para Prioridade Legal/Ordem**: Ranking (1, 2, 3...) apenas entre os processos Legal/Ordem do mesmo núcleo.
    - **Para Sem Prioridade**: Fica vazio (`—`).
- Os rankings de Super e Legal são independentes (ambos podem ter um "1º" no seu respectivo grupo).

#### 5.3.4 Ordem Visual na Tela

A lista exibe os processos na seguinte ordem obrigatória:
1.  `priority_level` (Nível 1 primeiro, depois Nível 2).
2.  `position` (Fila única de chegada cronológica).

Isso garante que o Super esteja sempre no topo, e que no grupo geral, a fila seja respeitada por quem chegou primeiro, independentemente de ter "Prioridade Legal" ou não.

#### 5.3.4 Recalculo Inteligente de Posições

Para garantir a performance com alto volume de dados (200k+ registros) e 70 usuários simultâneos, o recálculo segue uma lógica de **mínimo esforço**:
- **Escopo por Núcleo**: O sistema recalcula apenas as posições do núcleo afetado pela mudança, ignorando os demais núcleos.
- **Filtro de Delta**: Ao zerar posições de processos concluídos, o banco ignora os milhares de registros já processados, focando apenas no registro que acabou de mudar de status.
- **Trigger Otimizado**: O trigger `trg_recalculate_positions` opera no modo `FOR EACH ROW` para identificar o núcleo exato e disparar o recalculo apenas onde necessário.

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
| **Processos Retornados** | Filtra processos que já passaram pelo mesmo núcleo anteriormente |

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

### 5.11 Processos de Retorno

O sistema identifica automaticamente processos que retornaram à Contadoria para o mesmo núcleo.

#### 5.11.1 Regra de Identificação
Um processo é marcado como **Retorno** (`is_return = true`) se:
1.  Já existe outro registro no banco com o **mesmo número**.
2.  O registro existente pertence ao **mesmo núcleo**.
3.  A **data de remessa** (`entry_date`) é diferente.

#### 5.11.2 Comportamento Visual e Funcional
- **Realce**: No Dashboard, os processos de retorno são destacados com um fundo laranja suave (`bg-orange-50`) e o número do processo em laranja forte.
- **Automação**: A identificação é feita via trigger no banco de dados, garantindo que mesmo importações externas (ETL/Excel) sejam classificadas corretamente.
- **Filtro Combinado**: O filtro de processos retornados pode ser usado simultaneamente com outros filtros (ex: ver retornos não atribuídos).
- **Exclusão da Distribuição Automática**: Processos de retorno não entram no sorteio automático e exigem atribuição manual.

### 5.12 Atribuição Automática (Round-Robin)

O sistema possui uma ferramenta de distribuição em lote para equilibrar a carga de trabalho entre os contadores do núcleo.

#### 5.12.1 Funcionamento
- Utiliza o algoritmo **Round-Robin** para garantir que cada contador receba a mesma quantidade de processos de forma sequencial.
- O sistema memoriza o último contador que recebeu um processo no núcleo para continuar a distribuição exatamente de onde parou na próxima execução.

#### 5.12.2 Restrições de Distribuição (Segurança)
Para garantir a qualidade e a priorização correta, os seguintes processos **não são distribuídos automaticamente**:
1.  **Super Prioridades**: Devido à urgência e complexidade, devem ser atribuídos manualmente pelo gestor.
2.  **Processos de Retorno**: Como já passaram pelo núcleo, devem ser analisados pelo gestor para decidir se voltam para o mesmo contador original ou para um novo.

#### 5.12.3 Confirmação e Transparência
- O modal de confirmação exibe um aviso explícito sobre estas exclusões (Retornos e Super Prioridades).
- O contador de "Pendentes Sem Atribuição" no modal reflete apenas o saldo real de processos que serão distribuídos.

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

## 11. Performance e Escalabilidade (Otimização Free Tier)

Visando suportar 70 usuários simultâneos sem exceder os limites do plano gratuito do Supabase, foram implementadas as seguintes estratégias:

### 11.1 Backend (PostgreSQL Otimizado)
- **Redução de I/O**: A função `update_process_positions` utiliza filtros booleanos para evitar a atualização de 192.000+ linhas concluídas a cada transação.
- **Escalabilidade Horizontal**: O recalculo segmentado por núcleo permite que múltiplos chefes de núcleos diferentes trabalhem ao mesmo tempo sem causar *locks* globais na tabela de processos.
- **Timeout Prevention**: A redução da carga de processamento eliminou os erros de *statement timeout* (código 57014) observados em tabelas de grande porte.

### 11.2 Frontend (User Experience & Concurrency)
- **Atualizações Otimistas (Optimistic UI)**: A interface do Dashboard reage instantaneamente aos comandos do usuário (mudar status, prioridade ou atribuição) antes mesmo da confirmação do servidor.
- **Controle de Concorrência**: Implementado um delay estratégico (Debounce) de 500ms entre a escrita no banco e o recarregamento da lista (`loadServerData`), permitindo que os gatilhos do banco finalizem o processamento de forma consistente.
- **Redução de Overhead**: Removida a redundância de chamadas RPC via código TypeScript, centralizando a lógica de integridade de dados exclusivamente em triggers do banco de dados.

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
| **Processo de Retorno** | Processo que retorna ao mesmo núcleo com data de remessa diferente |
