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
  lastSeen?: string;
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
  priority: string;
  status: string;
  assignedToId: string | null;
  assignmentDate?: string | null;
  completionDate?: string | null;
  valorCustas?: number;
  observacao?: string;
  isReturn?: boolean;
  createdAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  createdAt: string;
  processNumber?: string;
  details?: Record<string, unknown>;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  user: User;
  searchTerm?: string;
  statusFilter?: 'Pendente' | 'Todos' | 'Devolvidos';
  nucleusFilter?: string;
  priorityFilter?: string;
  statusDetailFilter?: string;
  startDate?: string;
  endDate?: string;
  onlyAssignedToMe?: boolean;
  unassignedOnly?: boolean;
  accountantFilter?: string;
  externalAccountantIds?: string[];
}

export interface ReportFilters {
  user: User;
  nucleus?: string;
  startDate?: string;
  endDate?: string;
}
