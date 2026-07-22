import {ChangeDetectionStrategy, Component, signal, inject, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {StoreService} from '../../services/store';
import {User, Role} from '../../types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-contadores',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './contadores.html',
})
export class Contadores {
  private store = inject(StoreService);

  currentUser = this.store.currentUser;
  allUsers = this.store.users;
  nuclei = computed(() => {
    const user = this.currentUser();
    if (!user) return [];
    let list = this.store.nucleos().map(n => n.nome);
    if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      list = [user.nucleus];
    }
    return list.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  isEditing = signal(false);
  selectedUserId = signal<string | null>(null);

  // Computed list based on role permissions
  filteredUsers = computed(() => {
    const user = this.currentUser();
    if (!user) return [];

    // Admins, Coordinators, Supervisors see all
    if (['Administrador', 'Coordenador', 'Supervisor'].includes(user.role)) {
      return this.allUsers();
    }

    // Gestores de Área - vêem apenas contadores do próprio núcleo cadastrado
    if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      return this.allUsers().filter(u => u.nucleus === user.nucleus);
    }

    // Chefes and Gerentes see only their nucleus
    if (['Chefe', 'Gerente'].includes(user.role)) {
      return this.allUsers().filter(u => u.nucleus === user.nucleus);
    }

    return [];
  });

  // Check if current user can perform CRUD
  canManage = computed(() => {
    const user = this.currentUser();
    return user ? ['Administrador', 'Coordenador', 'Supervisor', 'Gestor CC', 'Gestor CCJ'].includes(user.role) : false;
  });

  userForm = new FormGroup({
    matricula: new FormControl('', Validators.required),
    name: new FormControl('', Validators.required),
    functionalEmail: new FormControl('', [Validators.required, Validators.email]),
    gmail: new FormControl('', [Validators.required, Validators.email]),
    nucleus: new FormControl('', Validators.required),
    metaPercentage: new FormControl(100, [Validators.required, Validators.min(0), Validators.max(200)]),
    birthDate: new FormControl('', Validators.required),
    role: new FormControl<Role>('Contador Judicial', Validators.required),
    active: new FormControl(true)
  });

  saveUser() {
    if (this.userForm.valid && this.canManage()) {
      const userData = this.userForm.value as Omit<User, 'id'>;
      if (this.isEditing() && this.selectedUserId()) {
        this.store.updateUser({ ...userData, id: this.selectedUserId()! } as User);
      } else {
        this.store.addUser(userData);
      }
      this.resetForm();
    }
  }

  editUser(user: User) {
    if (!this.canManage()) return;
    this.isEditing.set(true);
    this.selectedUserId.set(user.id);
    this.userForm.patchValue(user);
  }

  deleteUser(userId: string) {
    if (!this.canManage()) return;
    if (confirm('Tem certeza que deseja excluir este contador?')) {
      this.store.deleteUser(userId);
    }
  }

  resetForm() {
    this.isEditing.set(false);
    this.selectedUserId.set(null);
    this.userForm.reset({
      metaPercentage: 100,
      role: 'Contador Judicial',
      active: true
    });
  }
}
