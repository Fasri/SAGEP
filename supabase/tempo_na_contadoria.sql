-- Adicionar coluna tempo_na_contadoria na tabela processes
ALTER TABLE processes ADD COLUMN IF NOT EXISTS tempo_na_contadoria INTEGER;

-- Permitir valores nulos nas colunas de posição (processos concluídos não têm posição)
ALTER TABLE processes ALTER COLUMN position DROP NOT NULL;
ALTER TABLE processes ALTER COLUMN priority_position DROP NOT NULL;

-- Comentário: Esta coluna física pode ser usada para armazenar o valor final quando o processo é concluído.
-- Para processos pendentes, o valor é calculado dinamicamente na View.

-- Atualizar a View vw_processes para incluir o cálculo dinâmico
DROP VIEW IF EXISTS vw_processes;

CREATE VIEW vw_processes AS
SELECT
  p.id,
  p.position,           -- Posição Geral (física)
  p.priority_position,  -- Posição Prioridade (física)
  p.number,
  p.entry_date,
  p.court,
  p.nucleus,
  p.priority,
  p.status,
  p.assigned_to_id,
  p.assignment_date,
  p.completion_date,
  p.valor_custas,
  p.observacao,
  p.created_at,
  p.is_return,
  -- priority_level: usado para ordenação
  CASE
    WHEN TRIM(p.priority) ILIKE '%SUPER%'                               THEN 1
    WHEN (TRIM(p.priority) ILIKE '%LEGAL%' OR TRIM(p.priority) ILIKE '1-%' OR TRIM(p.priority) ILIKE '2-%' OR TRIM(p.priority) ILIKE '%ORDEM%')
         AND TRIM(p.priority) NOT ILIKE '%SEM%'                         THEN 2
    ELSE                                                                    3
  END AS priority_level,
  -- tempo_na_contadoria: dias desde a remessa até hoje (se pendente) ou até conclusão
  COALESCE(
    CASE WHEN p.status ILIKE '%pendente%' THEN (CURRENT_DATE - p.entry_date)::integer ELSE NULL END,
    p.tempo_na_contadoria,
    (p.completion_date - p.entry_date)::integer,
    0
  ) AS tempo_na_contadoria
FROM processes p;

-- Garantir permissões na view
GRANT SELECT ON vw_processes TO anon, authenticated, service_role;

-- Função para atualizar a coluna física quando o status mudar
CREATE OR REPLACE FUNCTION trg_update_tempo_final()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudar de Pendente para outra coisa, salva o tempo final e limpa posições
  IF NEW.status NOT ILIKE '%pendente%' AND (OLD.status ILIKE '%pendente%' OR OLD.status IS NULL) THEN
    NEW.tempo_na_contadoria = (NEW.completion_date - NEW.entry_date);
    NEW.position = NULL;
    NEW.priority_position = NULL;
  END IF;
  
  -- Se o processo voltar a ser pendente, limpa o tempo persistido (voltará a ser dinâmico na View)
  IF NEW.status ILIKE '%pendente%' THEN
    NEW.tempo_na_contadoria = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_processes_tempo_final ON processes;
CREATE TRIGGER trg_processes_tempo_final
BEFORE INSERT OR UPDATE OF status, completion_date ON processes
FOR EACH ROW
EXECUTE FUNCTION trg_update_tempo_final();

-- 2. Função de Recálculo Otimizada
-- Removemos versões antigas para evitar o erro "function is not unique"
DROP FUNCTION IF EXISTS update_process_positions();
DROP FUNCTION IF EXISTS update_process_positions(text);

CREATE OR REPLACE FUNCTION update_process_positions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Limpeza preventiva: remove posições de quem não é mais pendente
  UPDATE processes 
  SET position = NULL, priority_position = NULL 
  WHERE status NOT ILIKE '%pendente%';

  WITH base AS (
    SELECT
      id, nucleus, entry_date, priority,
      CASE
        WHEN TRIM(priority) ILIKE '%SUPER%'                               THEN 1
        WHEN (TRIM(priority) ILIKE '%LEGAL%' OR TRIM(priority) ILIKE '1-%' OR TRIM(priority) ILIKE '2-%' OR TRIM(priority) ILIKE '%ORDEM%')
             AND TRIM(priority) NOT ILIKE '%SEM%'                         THEN 2
        ELSE                                                                    3
      END AS p_level
    FROM processes
    WHERE status ILIKE '%pendente%'
  ),

  general_ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY nucleus ORDER BY entry_date ASC, id ASC) as pos
    FROM base
  ),

  priority_ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY nucleus ORDER BY p_level ASC, entry_date ASC, id ASC) as p_pos
    FROM base
    WHERE p_level < 3
  )

  UPDATE processes p
  SET
    position = gr.pos,
    priority_position = pr.p_pos
  FROM general_ranked gr
  LEFT JOIN priority_ranked pr ON pr.id = gr.id
  WHERE p.id = gr.id;
END;
$$;

-- 3. Executar recálculo imediato
SELECT update_process_positions();
