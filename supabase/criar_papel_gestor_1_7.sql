-- Script de Migração Supabase: Adicionar Papel 'Gestor 1_7' e Núcleo '7ª CCJ'

-- 1. Adicionar o novo papel ao ENUM user_role no Supabase
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Gestor 1_7';

-- 2. Garantir a existência do núcleo 7ª CCJ na tabela nucleos
INSERT INTO nucleos (nome, descricao)
VALUES ('7ª CCJ', '7ª Câmara Regional')
ON CONFLICT (nome) DO NOTHING;

-- 3. (Opcional) Inserir usuário de teste para o perfil Gestor 1_7
INSERT INTO users (matricula, name, role, nucleus, functional_email, gmail, meta_percentage, birth_date, active, password)
VALUES 
('90003', 'Gestor 1 e 7 CCJ', 'Gestor 1_7', '1ª CCJ', 'gestor.1_7@tjpe.jus.br', 'gestor.1_7@gmail.com', 100, '1980-01-01', true, '123456')
ON CONFLICT (matricula) DO NOTHING;
