-- Create Roles Enum
CREATE TYPE user_role AS ENUM ('Administrador', 'Coordenador', 'Supervisor', 'Chefe', 'Gerente', 'Contador Judicial');

-- Create Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'Contador Judicial',
  nucleus TEXT NOT NULL,
  functional_email TEXT UNIQUE NOT NULL,
  gmail TEXT UNIQUE NOT NULL,
  meta_percentage INTEGER NOT NULL DEFAULT 100,
  birth_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  password TEXT NOT NULL DEFAULT '123456',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Processes Table
CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position INTEGER NOT NULL,
  priority_position INTEGER,
  number TEXT UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  court TEXT NOT NULL,
  nucleus TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  assigned_to_id UUID REFERENCES users(id),
  assignment_date DATE,
  completion_date DATE,
  valor_custas DECIMAL(12,2) DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

-- Create Policies (Simplified for testing without Supabase Auth)
CREATE POLICY "Public users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete users" ON users FOR DELETE USING (true);

CREATE POLICY "Processes are viewable by everyone" ON processes FOR SELECT USING (true);
CREATE POLICY "Anyone can manage processes" ON processes FOR ALL USING (true);

-- Insert Initial Mock Data (Optional, but helpful for migration)
-- Note: You'll need to update these with real UUIDs if you want to use them as references
INSERT INTO users (matricula, name, role, nucleus, functional_email, gmail, meta_percentage, birth_date, active, password)
VALUES 
('10001', 'Admin Master', 'Administrador', 'GERAL', 'admin@tjpe.jus.br', 'admin@gmail.com', 100, '1970-01-01', true, '123456'),
('10002', 'Coord Geral', 'Coordenador', 'GERAL', 'coord@tjpe.jus.br', 'coord@gmail.com', 100, '1975-06-15', true, '123456'),
('10003', 'Super Visor', 'Supervisor', 'GERAL', 'super@tjpe.jus.br', 'super@gmail.com', 100, '1982-12-10', true, '123456'),
('12345', 'João Silva', 'Chefe', '1ª CC', 'joao.silva@tjpe.jus.br', 'joaosilva@gmail.com', 100, '1980-05-15', true, '123456'),
('23456', 'Maria Oliveira', 'Gerente', '1ª CC', 'maria.oliveira@tjpe.jus.br', 'mariaol@gmail.com', 100, '1985-08-20', true, '123456'),
('34567', 'Carlos Santos', 'Contador Judicial', '1ª CC', 'carlos.santos@tjpe.jus.br', 'carloss@gmail.com', 100, '1990-01-10', true, '123456'),
('45678', 'Ana Costa', 'Contador Judicial', '1ª CC', 'ana.costa@tjpe.jus.br', 'anacosta@gmail.com', 100, '1992-11-25', true, '123456'),
('56789', 'Ricardo Pereira', 'Chefe', '6ª CC', 'ricardo.p@tjpe.jus.br', 'ricardop@gmail.com', 100, '1975-03-30', true, '123456');
