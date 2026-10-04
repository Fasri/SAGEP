-- Script de Migração: Permitir Atribuição Automática de Usuários em Múltiplos Núcleos
-- Este script adiciona a coluna atribuicao_nucleos como array de texto na tabela users.

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS atribuicao_nucleos text[] DEFAULT '{}';

-- Comentário explicativo na coluna
COMMENT ON COLUMN users.atribuicao_nucleos IS 'Lista de nomes dos núcleos adicionais em que o usuário está apto a receber processos na atribuição automática.';
