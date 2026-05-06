-- Adiciona coluna para rastrear o último acesso dos usuários
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Comentário para o usuário: Execute este comando no SQL Editor do Supabase
