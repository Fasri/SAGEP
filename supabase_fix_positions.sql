-- ============================================================
-- SAGEP: Correção de Estrutura e Posicionamento (CAST EXPLÍCITO)
-- ============================================================

-- 1. Converter priority_level para INTEGER se necessário
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'processes' 
        AND column_name = 'priority_level' 
        AND is_generated = 'ALWAYS'
    ) THEN
        ALTER TABLE processes DROP COLUMN priority_level;
        ALTER TABLE processes ADD COLUMN priority_level INTEGER;
    END IF;
END $$;

ALTER TABLE processes ADD COLUMN IF NOT EXISTS priority_level INTEGER;

-- 2. Função com ORDER BY reforçado (Cast para DATE)
CREATE OR REPLACE FUNCTION update_process_positions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Atualiza níveis
  UPDATE processes
  SET priority_level = 
    CASE
      WHEN priority ILIKE '%super%' THEN 1
      ELSE 2
    END
  WHERE status ILIKE '%pendente%';

  -- Recalcula posições usando cast explícito de data para evitar ordenação de texto
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY nucleus
        ORDER BY 
          (entry_date::date) ASC, 
          (created_at::timestamp) ASC, 
          id ASC
      ) AS new_position,
      CASE
        WHEN priority_level = 1 THEN
          ROW_NUMBER() OVER (
            PARTITION BY nucleus, priority_level
            ORDER BY 
              (entry_date::date) ASC, 
              (created_at::timestamp) ASC, 
              id ASC
          )
        ELSE NULL
      END AS new_priority_position
    FROM processes
    WHERE status ILIKE '%pendente%'
  )
  UPDATE processes p
  SET
    position          = r.new_position,
    priority_position = r.new_priority_position
  FROM ranked r
  WHERE p.id = r.id;
END;
$$;

SELECT update_process_positions();
