-- ============================================================
-- SAGEP: Solução definitiva de posicionamento
--
-- ESTRATÉGIA: RPC + Colunas Físicas (melhor performance)
--
--   position e priority_position são armazenadas fisicamente
--   na tabela `processes` e atualizadas pelo RPC.
--
--   A view `vw_processes` é simplificada: apenas expõe
--   `priority_level` (necessário para ORDER BY nas queries).
--   NÃO recalcula position/priority_position — usa as físicas.
--
-- ============================================================


-- ============================================================
-- 1. View simplificada (apenas adiciona priority_level)
-- ============================================================

-- Necessário porque a view antiga tinha position como bigint (ROW_NUMBER)
-- e a nova usa a coluna física integer. PostgreSQL não permite ALTER tipo em view.
DROP VIEW IF EXISTS vw_processes;

CREATE VIEW vw_processes AS
SELECT
  p.id,
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
  p.position,           -- valor físico da tabela (atualizado pelo RPC)
  p.priority_position,  -- valor físico da tabela (atualizado pelo RPC)

  -- priority_level: coluna calculada usada apenas para ORDER BY nas queries
  CASE
    WHEN p.priority ILIKE '%super%'                              THEN 1
    WHEN p.priority ILIKE '%legal%'
      OR p.priority ILIKE '1-%'
      OR (p.priority ILIKE '2-%' AND p.priority NOT ILIKE '2-sem%')
      OR p.priority ILIKE '%ordem%'                             THEN 2
    ELSE                                                              3
  END AS priority_level

FROM processes p;


-- ============================================================
-- 2. Função update_process_positions
--    Chamada após: mudança de status, exclusão, alteração de
--    prioridade e importação.
-- ============================================================
CREATE OR REPLACE FUNCTION update_process_positions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  WITH base AS (
    SELECT
      id, nucleus, entry_date, priority,
      CASE
        WHEN priority ILIKE '%super%'                              THEN 1
        WHEN priority ILIKE '%legal%'
          OR priority ILIKE '1-%'
          OR (priority ILIKE '2-%' AND priority NOT ILIKE '2-sem%')
          OR priority ILIKE '%ordem%'                             THEN 2
        ELSE                                                            3
      END AS priority_level
    FROM processes
    WHERE status ILIKE '%pendente%'
  ),

  -- Posição Geral: puramente cronológica dentro do núcleo
  general_ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY nucleus
        ORDER BY entry_date ASC, id ASC
      ) AS new_position
    FROM base
  ),

  -- Posição Prioridade: todos os prioritários juntos no núcleo
  -- Super (level=1) sempre antes de Legal/Ordem (level=2)
  priority_ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY nucleus
        ORDER BY priority_level ASC, entry_date ASC, id ASC
      ) AS new_priority_position
    FROM base
    WHERE priority_level < 3  -- apenas processos prioritários
  )

  UPDATE processes p
  SET
    position          = gr.new_position,
    priority_position = pr.new_priority_position
  FROM general_ranked gr
  LEFT JOIN priority_ranked pr ON pr.id = gr.id
  WHERE p.id = gr.id;
END;
$$;


-- ============================================================
-- 3. Executar agora para recalcular dados existentes
-- ============================================================
SELECT update_process_positions();


-- ============================================================
-- VERIFICAÇÃO: rode após para conferir
-- SELECT nucleus, number, entry_date, priority, position, priority_position, priority_level
-- FROM vw_processes
-- WHERE status ILIKE '%pendente%'
-- ORDER BY nucleus, priority_level, entry_date;
-- ============================================================
