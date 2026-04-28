# Relatório de Code Review - App Contadoria

Revisão baseada no `code-review-checklist`.

## 1. Segurança (Security)

🔴 **BLOCKING: Autenticação no Frontend e Senhas em Texto Plano**
- No arquivo `src/app/services/store.ts` (linhas 733-744 e 317) a autenticação é feita diretamente no frontend (`user.password === password`).
- As senhas dos usuários vêm do banco de dados (Supabase) em texto plano e o fallback é a string hardcoded `'123456'`. 
- **Solução Exigida:** A autenticação deve ser gerida pelo backend (ex: Supabase Auth). Nunca envie senhas, mesmo hasheadas, para o cliente. As credenciais mockadas também não devem expor senhas.

🔴 **BLOCKING: Exposição de Dados de Usuários**
- A aplicação faz um `.select('*')` na tabela de `users` e armazena todos os usuários na memória do cliente (`this.users.set(...)`). Isso significa que qualquer usuário logado (ou não) faz download da lista completa de usuários com seus emails e senhas (se armazenados de forma insegura).

## 2. Qualidade do Código (Code Quality)

🟡 **SUGGESTION: Violação do Princípio de Responsabilidade Única (SRP)**
- O serviço `StoreService` (em `src/app/services/store.ts`) é um "God Object" com mais de 2.100 linhas e 84 KB. Ele lida com estado global (Signals), requisições HTTP via cliente do Supabase, normalização de dados, fallback local e regras de negócio.
- **Sugestão:** Divida o serviço em múltiplos serviços menores (ex: `AuthService`, `ProcessService`, `UserService`, `SupabaseApiService`).

🟡 **SUGGESTION: Funções Duplicadas (DRY)**
- As funções `ensureNucleusExists`, `ensurePriorityExists` e `ensureStatusExists` em `store.ts` são cópias quase exatas umas das outras. Isso viola o princípio DRY. 
- **Sugestão:** Extraia a lógica comum para uma função genérica `ensureEntityExists(tableName, entityName)`.

🟢 **NIT: Mistura de Idiomas**
- O código alterna constantemente entre inglês e português, até na mesma classe/interface (`statusTipos`, `prioridades`, `processes`, `fetchPaginatedProcesses`). 
- **Sugestão:** Padronize o idioma do domínio da aplicação. Se é "Process", use "Priority" e "StatusType", ou mude tudo para o português.

## 3. Performance

🟡 **SUGGESTION: Paginação Client-Side Potencialmente Perigosa**
- Em `fetchAllFilteredProcesses` no `store.ts`, há um loop `while(hasMore)` que continua buscando lotes de 1.000 registros até bater o teto de 200.000 registros e guarda tudo num array `allData`.
- **Sugestão:** Se a tabela de processos crescer consideravelmente, isso causará crash no navegador por falta de memória (Out of Memory). Relatórios e exportações grandes devem ser feitos no backend ou paginados rigidamente sob demanda.

## 4. Práticas Modernas e Anti-Patterns

🟢 **NIT: Uso do tipo `any`**
- Em `store.ts`, há o uso de `any` na declaração `let allData: any[] = [];` durante a paginação infinita.
- **Sugestão:** Substitua por uma tipagem correta ou utilize `Record<string, unknown>[]` como feito em outros mapeamentos do arquivo.

❓ **QUESTION: Por que o uso de "fuzzy matching" (`normalizeNucleus`, etc) ocorre sempre no Frontend?**
- A normalização de strings (removendo acentos e limpando textos de codificação quebrada - `fixEncoding`) acontece no carregamento de dados e na gravação localmente. Seria melhor rodar um job no banco (via script SQL) para corrigir os dados legados ou padronizar as tabelas relacionais de uma vez por todas para não punir a performance do frontend cada vez que as entidades são instanciadas.

## Resumo
A arquitetura do Angular usando Signals está bem intencionada, mas a segurança é o ponto mais fraco atual do projeto. A gestão de estado necessita ser refatorada para ser mais testável e fácil de manter.
