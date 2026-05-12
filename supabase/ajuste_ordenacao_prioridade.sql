-- Correção da lógica de prioridades para unificar Prioridade Legal e Sem Prioridade no Dashboard
-- Somente Super Prioridade deve ficar isolada no topo.

-- 1. Atualizar a View vw_processes
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
  -- priority_level: agora apenas 2 níveis para ordenação visual
  -- Nível 1: Super Prioridade
  -- Nível 2: Todo o resto (Legal, Ordem, Sem Prioridade)
  CASE
    WHEN TRIM(p.priority) ILIKE '%SUPER%' THEN 1
    ELSE 2
  END AS priority_level,
  -- tempo_na_contadoria: dias desde a remessa até hoje (se pendente) ou até conclusão
  COALESCE(
    CASE WHEN p.status ILIKE '%pendente%' THEN (CURRENT_DATE - p.entry_date)::integer ELSE NULL END,
    p.tempo_na_contadoria,
    (p.completion_date - p.entry_date)::integer,
    0
  ) AS tempo_na_contadoria
FROM processes p;

GRANT SELECT ON vw_processes TO anon, authenticated, service_role;

-- 2. Atualizar a função de recálculo para manter a consistência, 
-- mas ainda permitindo o ranking de Priority Position se desejado.
CREATE OR REPLACE FUNCTION update_process_positions(target_nucleus TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Limpeza preventiva apenas para o núcleo alvo (ou todos se null)
  UPDATE processes 
  SET position = NULL, priority_position = NULL 
  WHERE status NOT ILIKE '%pendente%'
    AND (target_nucleus IS NULL OR nucleus = target_nucleus)
    AND (position IS NOT NULL OR priority_position IS NOT NULL);

  -- 2. Recálculo otimizado usando CTE
  WITH base AS (
    SELECT
      id, nucleus, entry_date, priority,
      CASE
        WHEN TRIM(priority) ILIKE '%SUPER%'                               THEN 1
        WHEN (TRIM(priority) ILIKE '%LEGAL%' OR TRIM(priority) ILIKE '1-%' OR TRIM(priority) ILIKE '2-%' OR TRIM(priority) ILIKE '%ORDEM%')
             AND TRIM(priority) NOT ILIKE '%SEM%'                         THEN 2
        ELSE                                                                    3
      END AS internal_p_level
    FROM processes
    WHERE status ILIKE '%pendente%'
      AND (target_nucleus IS NULL OR nucleus = target_nucleus)
  ),

  general_ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY nucleus ORDER BY entry_date ASC, id ASC) as pos
    FROM base
  ),

  priority_ranked AS (
    -- Mantemos o ranking de prioridade para quem é Super (1) ou Legal (2)
    -- Mas note que a ORDENAÇÃO visual usará a priority_level da View (1 ou 2)
    SELECT id, ROW_NUMBER() OVER (PARTITION BY nucleus, internal_p_level ORDER BY entry_date ASC, id ASC) as p_pos
    FROM base
    WHERE internal_p_level < 3
  )

  -- 3. Update apenas de quem mudou
  UPDATE processes p
  SET
    position = gr.pos,
    priority_position = pr.p_pos
  FROM general_ranked gr
  LEFT JOIN priority_ranked pr ON pr.id = gr.id
  WHERE p.id = gr.id
    AND (target_nucleus IS NULL OR p.nucleus = target_nucleus)
    AND (p.position IS DISTINCT FROM gr.pos OR p.priority_position IS DISTINCT FROM pr.p_pos);
END;
$$;

-- Executar recálculo
SELECT update_process_positions();
