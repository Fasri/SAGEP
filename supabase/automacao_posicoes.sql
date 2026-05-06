-- SQL para automatizar o recalculo de posições e prioridades no SAGEP
-- Este script resolve os problemas de:
-- 1. Posições zeradas em novas cargas (via Trigger)
-- 2. Falta de recalculo ao excluir processos (via Trigger)
-- 3. Zerar posição/prioridade para processos não pendentes (lógica na função)

-- 1. Atualizar a função principal de recalculo
CREATE OR REPLACE FUNCTION update_process_positions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Passo A: Zerar posições de processos que NÃO estão pendentes
  -- Conforme solicitado: "quando o processo não for pendente zere o posicao geral e prioridade"
  UPDATE processes
  SET 
    position = 0,
    priority_position = NULL
  WHERE status NOT ILIKE '%pendente%';

  -- Passo B: Recalcular posições de todos os processos PENDENTES
  -- A ordem é baseada na data de entrada e data de criação (chegada cronológica)
  WITH ranked AS (
    SELECT
      p.id,
      -- Posição Geral dentro do Núcleo
      ROW_NUMBER() OVER (
        PARTITION BY p.nucleus
        ORDER BY p.entry_date ASC, p.created_at ASC
      ) AS new_position,
      -- Posição de Prioridade (Rank interno do grupo)
      CASE
        -- Super Prioridade
        WHEN p.priority ILIKE '%super%' THEN
          ROW_NUMBER() OVER (
            PARTITION BY p.nucleus, 'super'::text
            ORDER BY p.entry_date ASC, p.created_at ASC
          )
        -- Prioridade Legal (qualquer uma que não seja "sem prioridade")
        WHEN p.priority NOT ILIKE '%sem%'
          AND p.priority NOT ILIKE '2-sem%'
          AND p.priority IS NOT NULL
          AND p.priority <> '' THEN
          ROW_NUMBER() OVER (
            PARTITION BY p.nucleus, 'other'::text
            ORDER BY p.entry_date ASC, p.created_at ASC
          )
        -- Sem prioridade ou outros
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

-- 2. Criar a função que será chamada pelo Trigger
CREATE OR REPLACE FUNCTION trigger_recalculate_positions()
RETURNS TRIGGER AS $$
BEGIN
  -- Chamamos a função de recalculo global
  PERFORM update_process_positions();
  -- Em triggers AFTER STATEMENT o retorno é ignorado, mas RETURN NULL é o padrão
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar o Trigger para automatizar o processo
-- O trigger dispara após qualquer mudança que afete a ordem ou o status
DROP TRIGGER IF EXISTS trg_recalculate_positions ON processes;
CREATE TRIGGER trg_recalculate_positions
AFTER INSERT OR DELETE OR UPDATE OF status, priority, entry_date, nucleus
ON processes
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_recalculate_positions();

-- 4. Executar uma vez para garantir que tudo esteja correto agora
SELECT update_process_positions();
