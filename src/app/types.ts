export type Role = 'Administrador' | 'Coordenador' | 'Supervisor' | 'Chefe' | 'Gerente' | 'Contador Judicial';

export interface User {
  id: string;
  matricula: string;
  name: string;
  role: Role;
  nucleus: string;
  functionalEmail: string;
  gmail: string;
  metaPercentage: number;
  birthDate: string;
  active: boolean;
  password?: string;
}

export interface Nucleo {
  id: string;
  nome: string;
  descricao: string;
  lastAssignedUserId?: string | null;
}

export interface Prioridade {
  id: string;
  nome: string;
  descricao: string;
}

export interface StatusTipo {
  id: string;
  nome: string;
  descricao: string;
}

export interface Process {
  id: string;
  position: number;
  priorityPosition: number | null;
  number: string;
  entryDate: string; // Format: YYYY-MM-DD
  court: string;
  nucleus: string;
  priority: string; // Changed to string to support dynamic priorities
  status: string;   // Changed to string to support dynamic status
  assignedToId: string | null;
  assignmentDate?: string | null; // When assigned
  completionDate?: string | null; // When status changed to something other than 'Pendente'
  valorCustas?: number;
  observacao?: string;
  createdAt?: string; // Data de upload/criação
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  createdAt: string;
  details?: Record<string, unknown>;
}
