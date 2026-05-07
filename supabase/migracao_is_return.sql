-- Adicionar coluna is_return na tabela processes
ALTER TABLE processes ADD COLUMN IF NOT EXISTS is_return BOOLEAN DEFAULT false;

-- Função para verificar se um processo é um retorno
CREATE OR REPLACE FUNCTION check_is_return()
RETURNS TRIGGER AS $$
BEGIN
    -- Verifica se já existe outro processo com o mesmo número e núcleo, mas data de remessa diferente
    IF EXISTS (
        SELECT 1 FROM processes 
        WHERE number = NEW.number 
          AND nucleus = NEW.nucleus 
          AND entry_date <> NEW.entry_date
          AND id <> NEW.id -- Garante que não está comparando com ele mesmo (no caso de update)
    ) THEN
        NEW.is_return := true;
    ELSE
        NEW.is_return := false;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para definir is_return antes de inserir ou atualizar
DROP TRIGGER IF EXISTS trg_check_is_return ON processes;
CREATE TRIGGER trg_check_is_return
BEFORE INSERT OR UPDATE OF number, nucleus, entry_date
ON processes
FOR EACH ROW
EXECUTE FUNCTION check_is_return();

-- Opcional: Atualizar registros existentes (cuidado com performance em 200k+ linhas)
-- Mas para 200k linhas, podemos fazer um update em lote
UPDATE processes p
SET is_return = true
WHERE EXISTS (
    SELECT 1 FROM processes p2
    WHERE p2.number = p.number 
      AND p2.nucleus = p.nucleus 
      AND p2.entry_date <> p.entry_date
      AND p2.id <> p.id
);
