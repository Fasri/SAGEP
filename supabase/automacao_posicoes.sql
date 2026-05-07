-- SQL para automatizar o recalculo de posições e prioridades no SAGEP
-- Este script resolve os problemas de:
-- 1. Posições zeradas em novas cargas (via Trigger)
-- 2. Falta de recalculo ao excluir processos (via Trigger)
-- 3. Zerar posição/prioridade para processos não pendentes (lógica na função)

-- 1. Remover a versão antiga para evitar conflitos de sobrecarga
DROP FUNCTION IF EXISTS update_process_positions();

-- 2. Criar a nova função otimizada com suporte a filtro por núcleo
CREATE OR REPLACE FUNCTION update_process_positions(target_nucleus TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Passo A: Zerar posições apenas de quem mudou para status concluído
  -- Otimização: Só mexe em linhas que NÃO são pendentes e AINDA têm posição > 0
  UPDATE processes
  SET 
    position = 0,
    priority_position = NULL
  WHERE status NOT ILIKE '%pendente%'
    AND (position <> 0 OR priority_position IS NOT NULL)
    AND (target_nucleus IS NULL OR nucleus = target_nucleus);

  -- Passo B: Recalcular posições apenas para o núcleo afetado (ou todos se null)
  WITH ranked AS (
    SELECT
      p.id,
      ROW_NUMBER() OVER (
        PARTITION BY p.nucleus
        ORDER BY p.entry_date ASC, p.created_at ASC
      ) AS new_position,
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
      AND (target_nucleus IS NULL OR p.nucleus = target_nucleus)
  )
  UPDATE processes p
  SET
    position          = r.new_position,
    priority_position = r.new_priority_position
  FROM ranked r
  WHERE p.id = r.id;
END;
$$;

-- 2. Criar a função que será chamada pelo Trigger (agora por linha)
CREATE OR REPLACE FUNCTION trigger_recalculate_positions()
RETURNS TRIGGER AS $$
DECLARE
  target_n TEXT;
BEGIN
  -- Identificar o núcleo afetado
  IF (TG_OP = 'DELETE') THEN
    target_n := OLD.nucleus;
  ELSE
    target_n := NEW.nucleus;
  END IF;

  -- Chamamos a função de recalculo apenas para o núcleo afetado
  PERFORM update_process_positions(target_n);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar o Trigger para automatizar o processo
DROP TRIGGER IF EXISTS trg_recalculate_positions ON processes;
CREATE TRIGGER trg_recalculate_positions
AFTER INSERT OR DELETE OR UPDATE OF status, priority, entry_date, nucleus
ON processes
FOR EACH ROW -- Mudado para FOR EACH ROW para capturar o núcleo
EXECUTE FUNCTION trigger_recalculate_positions();

-- 4. Executar uma vez para garantir que tudo esteja correto agora
SELECT update_process_positions();
