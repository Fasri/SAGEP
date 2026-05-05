-- ============================================================
-- SAGEP: Função update_process_positions (VERSÃO CORRIGIDA)
--
-- REGRAS:
--   position          → chegada cronológica dentro do NÚCLEO
--                       (NÃO é afetada por prioridade)
--
--   priority_position → rank dentro do grupo de prioridade no núcleo
--                       Super prioridade:   rank entre supers do núcleo
--                       Demais prioridades: rank entre legais/ordens do núcleo
--                       Sem prioridade:     NULL
-- ============================================================

CREATE OR REPLACE FUNCTION update_process_positions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  WITH ranked AS (
    SELECT
      p.id,

      -- Posição Geral: puramente cronológica dentro do núcleo
      ROW_NUMBER() OVER (
        PARTITION BY p.nucleus
        ORDER BY p.entry_date ASC, p.created_at ASC
      ) AS new_position,

      -- Posição Prioridade: rank dentro do grupo no núcleo
      CASE
        WHEN p.priority ILIKE '%super%' THEN
          ROW_NUMBER() OVER (
            PARTITION BY p.nucleus, 'super'::text
            ORDER BY p.entry_date ASC, p.created_at ASC
          )
        WHEN p.priority NOT ILIKE '%sem%'
          AND p.priority NOT ILIKE '2-sem%'
          AND p.priority IS NOT NULL
          AND p.priority <> '' THEN
          ROW_NUMBER() OVER (
            PARTITION BY p.nucleus, 'other'::text
            ORDER BY p.entry_date ASC, p.created_at ASC
          )
        ELSE NULL
      END AS new_priority_position

    FROM processes p
    WHERE p.status ILIKE '%pendente%'
  )
  UPDATE processes p
  SET
    position          = r.new_position,
    priority_position = r.new_priority_position
  FROM ranked r
  WHERE p.id = r.id;
END;
$$;

-- Após aplicar: SELECT update_process_positions();
