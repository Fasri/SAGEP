import { Injectable, signal } from '@angular/core';
import { User } from '../types';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private mockUsers: User[] = [
    { id: 'u1', matricula: '10001', name: 'Admin Master', role: 'Administrador', nucleus: 'GERAL', functionalEmail: 'admin@tjpe.jus.br', gmail: 'admin@gmail.com', metaPercentage: 100, birthDate: '1970-01-01', active: true, password: '123456' },
    { id: 'u2', matricula: '10002', name: 'Coord Geral', role: 'Coordenador', nucleus: 'GERAL', functionalEmail: 'coord@tjpe.jus.br', gmail: 'coord@gmail.com', metaPercentage: 100, birthDate: '1975-06-15', active: true, password: '123456' },
    { id: 'u3', matricula: '10003', name: 'Super Visor', role: 'Supervisor', nucleus: 'GERAL', functionalEmail: 'super@tjpe.jus.br', gmail: 'super@gmail.com', metaPercentage: 100, birthDate: '1982-12-10', active: true, password: '123456' },
    { id: 'u4', matricula: '12345', name: 'João Silva', role: 'Chefe', nucleus: '1ª CC', functionalEmail: 'joao.silva@tjpe.jus.br', gmail: 'joaosilva@gmail.com', metaPercentage: 100, birthDate: '1980-05-15', active: true, password: '123456' },
    { id: 'u5', matricula: '23456', name: 'Maria Oliveira', role: 'Gerente', nucleus: '1ª CC', functionalEmail: 'maria.oliveira@tjpe.jus.br', gmail: 'mariaol@gmail.com', metaPercentage: 100, birthDate: '1985-08-20', active: true, password: '123456' },
    { id: 'u6', matricula: '34567', name: 'Carlos Santos', role: 'Contador Judicial', nucleus: '1ª CC', functionalEmail: 'carlos.santos@tjpe.jus.br', gmail: 'carloss@gmail.com', metaPercentage: 100, birthDate: '1990-01-10', active: true, password: '123456' },
    { id: 'u7', matricula: '45678', name: 'Ana Costa', role: 'Contador Judicial', nucleus: '1ª CC', functionalEmail: 'ana.costa@tjpe.jus.br', gmail: 'anacosta@gmail.com', metaPercentage: 100, birthDate: '1992-11-25', active: true, password: '123456' },
    { id: 'u8', matricula: '56789', name: 'Ricardo Pereira', role: 'Chefe', nucleus: '6ª CC', functionalEmail: 'ricardo.p@tjpe.jus.br', gmail: 'ricardop@gmail.com', metaPercentage: 100, birthDate: '1975-03-30', active: true, password: '123456' }
  ];

  users = signal<User[]>(this.mockUsers);
  currentUser = signal<User | null>(null);

  constructor(private supabaseService: SupabaseService) {}

  async loadUsers(normalizeNucleus: (n: string) => string) {
    const client = this.supabaseService.getClient();
    if (!client) {
      console.warn('AuthService: Supabase not configured. Using mock data only.');
      return;
    }

    try {
      console.log('AuthService: Fetching users from Supabase...');
      const { data: users, error: usersError } = await client.from('users').select('*');
      if (usersError) {
        console.error('AuthService: Error fetching users:', usersError);
        this.supabaseService.isSupabaseConnected.set(false);
      } else if (users) {
        this.supabaseService.isSupabaseConnected.set(true);
        console.log(`AuthService: Loaded ${users.length} users from Supabase.`);
        this.users.set(users.map((u: Record<string, unknown>) => ({
          id: String(u['id']),
          matricula: String(u['matricula']),
          name: String(u['name']),
          role: u['role'] as User['role'],
          nucleus: normalizeNucleus(String(u['nucleus'])),
          functionalEmail: String(u['functional_email']),
          gmail: String(u['gmail']),
          metaPercentage: Number(u['meta_percentage']),
          birthDate: String(u['birth_date']),
          active: Boolean(u['active']),
          password: String(u['password'] || '123456')
        })));
      }
    } catch (e) {
      console.error('AuthService: Unexpected error fetching users:', e);
    }
  }

  login(identifier: string, password?: string): boolean {
    const user = this.users().find(u => 
      u.id === identifier || 
      u.matricula === identifier || 
      u.name.toLowerCase() === identifier.toLowerCase()
    );
    if (user && user.password === password) {
      this.currentUser.set(user);
      return true;
    }
    return false;
  }

  logout() {
    this.currentUser.set(null);
  }

  async addUser(user: Omit<User, 'id'>, auditLogFn: (action: string, details: Record<string, unknown>) => void) {
    console.log('AuthService: Adding user...', user);
    const client = this.supabaseService.getClient();
    if (client) {
      const { data, error } = await client.from('users').insert([{
        matricula: user.matricula,
        name: user.name,
        role: user.role,
        nucleus: user.nucleus,
        functional_email: user.functionalEmail,
        gmail: user.gmail,
        meta_percentage: user.metaPercentage,
        birth_date: user.birthDate,
        active: user.active,
        password: user.password || '123456'
      }]).select();

      if (error) {
        this.supabaseService.handleError(error, 'addUser');
        const newId = 'u' + (this.users().length + 1);
        this.users.update(prev => [...prev, { ...user, id: newId }]);
      } else if (data && data[0]) {
        console.log('AuthService: User added successfully to Supabase:', data[0]);
        const newUser = {
          ...user,
          id: data[0].id,
          functionalEmail: data[0].functional_email,
          metaPercentage: data[0].meta_percentage,
          birthDate: data[0].birth_date
        };
        this.users.update(prev => [...prev, newUser]);
        auditLogFn(`Adicionou novo usuário ${user.name}`, { user });
      }
    } else {
      console.warn('AuthService: Supabase not configured. Adding user locally only.');
      const newId = 'u' + (this.users().length + 1);
      this.users.update(prev => [...prev, { ...user, id: newId }]);
      auditLogFn(`Adicionou novo usuário ${user.name} (Local)`, { user });
    }
  }

  async updateUser(updatedUser: User, auditLogFn: (action: string, details: Record<string, unknown>) => void) {
    console.log('AuthService: Updating user...', updatedUser);
    this.users.update(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    
    if (this.currentUser()?.id === updatedUser.id) {
      this.currentUser.set(updatedUser);
    }

    const client = this.supabaseService.getClient();
    if (client) {
      if (updatedUser.id.startsWith('u')) {
        console.warn('AuthService: Cannot update mock user in Supabase. ID:', updatedUser.id);
        return;
      }

      const { error } = await client.from('users').update({
        matricula: updatedUser.matricula,
        name: updatedUser.name,
        role: updatedUser.role,
        nucleus: updatedUser.nucleus,
        functional_email: updatedUser.functionalEmail,
        gmail: updatedUser.gmail,
        meta_percentage: updatedUser.metaPercentage,
        birth_date: updatedUser.birthDate,
        active: updatedUser.active,
        password: updatedUser.password
      }).eq('id', updatedUser.id);

      if (error) {
        this.supabaseService.handleError(error, 'updateUser');
      } else {
        console.log('AuthService: User updated successfully in Supabase.');
        auditLogFn(`Atualizou dados do usuário ${updatedUser.name}`, { updatedUser });
      }
    } else {
      auditLogFn(`Atualizou dados do usuário ${updatedUser.name} (Local)`, { updatedUser });
    }
  }

  async deleteUser(userId: string, auditLogFn: (action: string, details: Record<string, unknown>) => void) {
    console.log('AuthService: Deleting user...', userId);
    const userToDelete = this.users().find(u => u.id === userId);
    this.users.update(prev => prev.filter(u => u.id !== userId));

    const client = this.supabaseService.getClient();
    if (client) {
      if (userId.startsWith('u')) {
        console.warn('AuthService: Cannot delete mock user from Supabase. ID:', userId);
        return;
      }

      const { error } = await client.from('users').delete().eq('id', userId);
      if (error) {
        this.supabaseService.handleError(error, 'deleteUser');
      } else {
        console.log('AuthService: User deleted successfully from Supabase.');
        auditLogFn(`Removeu usuário ${userToDelete?.name}`, { userId });
      }
    } else {
      auditLogFn(`Removeu usuário ${userToDelete?.name} (Local)`, { userId });
    }
  }
}
