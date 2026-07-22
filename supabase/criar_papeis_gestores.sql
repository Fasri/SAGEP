-- Script de Migração: Adicionar Papéis Gestor CC e Gestor CCJ

-- 1. Adicionar os novos papéis ao enum existente
-- Nota: O PostgreSQL não suporta 'IF NOT EXISTS' diretamente no 'ALTER TYPE ADD VALUE' em versões muito antigas, mas no Supabase (Postgres 15+) é perfeitamente suportado.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Gestor CC';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Gestor CCJ';

-- 2. Inserir usuários de teste correspondentes aos novos perfis
INSERT INTO users (matricula, name, role, nucleus, functional_email, gmail, meta_percentage, birth_date, active, password)
VALUES 
('90001', 'Gestor Custas', 'Gestor CC', '1ª CC', 'gestor.cc@tjpe.jus.br', 'gestor.cc@gmail.com', 100, '1980-01-01', true, '123456'),
('90002', 'Gestor Calculos', 'Gestor CCJ', '1ª CCJ', 'gestor.ccj@tjpe.jus.br', 'gestor.ccj@gmail.com', 100, '1980-01-01', true, '123456')
ON CONFLICT (matricula) DO NOTHING;
