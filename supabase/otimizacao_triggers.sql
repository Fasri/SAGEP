-- =========================================================================
-- SAGEP: Otimização de Performance e Resolução de Timeouts (Statement Triggers)
-- =========================================================================

-- 1. REMOVER A TRIGGER DE LINHA (ROW TRIGGER) ANTERIOR
DROP TRIGGER IF EXISTS trg_recalculate_positions ON processes;
DROP FUNCTION IF EXISTS trigger_recalculate_positions();

-- 2. CRIAR A NOVA FUNÇÃO DE TRIGGER BASEADA EM INSTRUÇÃO (STATEMENT)
CREATE OR REPLACE FUNCTION trigger_recalculate_positions_stmt()
RETURNS TRIGGER AS $$
DECLARE
  nucleus_record RECORD;
  should_recalculate BOOLEAN := FALSE;
BEGIN
  -- Se for INSERT ou DELETE, sempre recalculamos
  IF TG_OP = 'INSERT' THEN
    should_recalculate := TRUE;
  ELSIF TG_OP = 'DELETE' THEN
    should_recalculate := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Para UPDATE, só recalculamos se alguma das colunas relevantes mudou
    IF EXISTS (
      SELECT 1 
      FROM new_table n
      JOIN old_table o ON n.id = o.id
      WHERE n.status IS DISTINCT FROM o.status
         OR n.priority IS DISTINCT FROM o.priority
         OR n.entry_date IS DISTINCT FROM o.entry_date
         OR n.nucleus IS DISTINCT FROM o.nucleus
    ) THEN
      should_recalculate := TRUE;
    END IF;
  END IF;

  -- Se for detectada alteração relevante, fazemos o recálculo
  IF should_recalculate THEN
    -- Se for INSERT ou UPDATE, olhamos na transition table NEW_TABLE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      FOR nucleus_record IN SELECT DISTINCT nucleus FROM new_table LOOP
        IF nucleus_record.nucleus IS NOT NULL THEN
          PERFORM update_process_positions(nucleus_record.nucleus);
        END IF;
      END LOOP;
    -- Se for DELETE, olhamos na transition table OLD_TABLE
    ELSIF TG_OP = 'DELETE' THEN
      FOR nucleus_record IN SELECT DISTINCT nucleus FROM old_table LOOP
        IF nucleus_record.nucleus IS NOT NULL THEN
          PERFORM update_process_positions(nucleus_record.nucleus);
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. CRIAR OS NOVOS TRIGGERS BASEADOS EM INSTRUÇÃO (STATEMENT TRIGGERS)
-- Nota: Transition tables requerem triggers separados por operação no Postgres

-- Trigger para INSERT
DROP TRIGGER IF EXISTS trg_recalculate_positions_insert ON processes;
CREATE TRIGGER trg_recalculate_positions_insert
AFTER INSERT ON processes
REFERENCING NEW TABLE AS new_table
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_recalculate_positions_stmt();

-- Trigger para DELETE
DROP TRIGGER IF EXISTS trg_recalculate_positions_delete ON processes;
CREATE TRIGGER trg_recalculate_positions_delete
AFTER DELETE ON processes
REFERENCING OLD TABLE AS old_table
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_recalculate_positions_stmt();

-- Trigger para UPDATE
-- Nota: Para usar transition tables (new_table/old_table) no trigger de UPDATE, 
-- o PostgreSQL exige que a trigger escute o UPDATE geral (sem lista de colunas "OF status, ...").
-- A filtragem por colunas alteradas é feita de forma ultra-otimizada dentro da função.
DROP TRIGGER IF EXISTS trg_recalculate_positions_update ON processes;
CREATE TRIGGER trg_recalculate_positions_update
AFTER UPDATE ON processes
REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_recalculate_positions_stmt();

-- 4. AJUSTAR O AUTOVACUUM NA TABELA DE PROCESSOS
-- Mantém as estatísticas do pg_class sempre corretas (277k), evitando
-- que o dashboard force count(*)s sequenciais demorados.
ALTER TABLE processes SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- 5. EXECUTAR RECALCULO GERAL E ANALYZE (ATUALIZAR ESTATÍSTICAS)
SELECT update_process_positions();
ANALYZE processes;
ANALYZE users;
