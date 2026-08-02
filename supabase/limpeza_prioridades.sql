-- 1. Unificar as prioridades na tabela processes para as versões sem números
UPDATE processes 
SET priority = 'Super prioridade' 
WHERE priority = '1-Super prioridade';

UPDATE processes 
SET priority = 'Prioridade Legal' 
WHERE priority IN ('2-Prioridade legal', '2-Prioridade Legal', 'Prioridade legal');

UPDATE processes 
SET priority = 'Sem prioridade' 
WHERE priority = '2-Sem prioridade';

-- 2. Deletar os registros de prioridades que contêm números da tabela prioridades
DELETE FROM prioridades 
WHERE nome IN ('1-Super prioridade', '2-Prioridade legal', '2-Sem prioridade');

-- 3. Assegurar o cadastro das prioridades corretas sem número (caso não existam)
INSERT INTO prioridades (nome, descricao)
VALUES 
  ('Sem prioridade', 'Processo comum'),
  ('Prioridade Legal', 'Idoso, doença grave, etc'),
  ('Super prioridade', 'Acima de 80 anos')
ON CONFLICT (nome) DO NOTHING;
