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
    const excludedNuclei = ['8ª CC', '8 CC', '8ªCC', '8CC', 'CCJ', 'CONTADORIA REMOTA', 'GERAL'];
    let list = this.store.nucleos().filter(n => !excludedNuclei.includes(n.nome.trim().toUpperCase())).map(n => n.nome);
    if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      list = [user.nucleus];
    } else if (user.role === 'Gestor 1_7') {
      list = ['1ª CCJ', '7ª CCJ'];
    }
    return list.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  });

  // Lista de todos os núcleos para o Admin/Coordenador/Supervisor/Gestor atribuir
  allAvailableNuclei = computed(() => {
    const defaultList = ['1ª CC', '2ª CC', '3ª CC', '4ª CC', '5ª CC', '6ª CC', '7ª CC', '1ª CCJ', '2ª CCJ', '7ª CCJ'];
    const excludedNuclei = ['8ª CC', '8 CC', '8ªCC', '8CC', 'CCJ', 'CONTADORIA REMOTA', 'GERAL'];
    const fromStore = (this.store.nucleos() || [])
      .filter(n => n && n.nome && !excludedNuclei.includes(n.nome.trim().toUpperCase()))
      .map(n => n.nome.trim());

    const combined = Array.from(new Set([...defaultList, ...fromStore]))
      .filter(n => !excludedNuclei.includes(n.toUpperCase()));
    return combined.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  });

  isEditing = signal(false);
  selectedUserId = signal<string | null>(null);
  selectedAtribuicaoNucleos = signal<string[]>([]);

  // Computed list based on role permissions
  filteredUsers = computed(() => {
    const user = this.currentUser();
    if (!user) return [];

    let list: User[] = [];

    // Admins, Coordinators, Supervisors see all
    if (['Administrador', 'Coordenador', 'Supervisor'].includes(user.role)) {
      list = this.allUsers();
    } else if (user.role === 'Gestor CC' || user.role === 'Gestor CCJ') {
      // Gestores de Área - vêem apenas contadores do próprio núcleo cadastrado
      list = this.allUsers().filter(u => u.nucleus === user.nucleus);
    } else if (user.role === 'Gestor 1_7') {
      list = this.allUsers().filter(u => ['1ª CCJ', '7ª CCJ'].includes(u.nucleus));
    } else if (['Chefe', 'Gerente'].includes(user.role)) {
      // Chefes and Gerentes see only their nucleus
      list = this.allUsers().filter(u => u.nucleus === user.nucleus);
    }

    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  });

  // Check if current user can perform CRUD
  canManage = computed(() => {
    const user = this.currentUser();
    if (!user || !user.role) return false;
    const r = user.role.trim().toLowerCase();
    const allowed = ['administrador', 'coordenador', 'supervisor', 'gestor cc', 'gestor ccj', 'gestor 1_7', 'chefe', 'gerente'];
    return allowed.includes(r);
  });

  // Check if current user can manage auto assignment nuclei for users
  canManageAtribuicaoNucleos = computed(() => {
    return this.canManage();
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

  toggleAtribuicaoNucleus(nucleusName: string) {
    if (!this.canManageAtribuicaoNucleos()) return;
    this.selectedAtribuicaoNucleos.update(current => {
      if (current.includes(nucleusName)) {
        return current.filter(n => n !== nucleusName);
      } else {
        return [...current, nucleusName];
      }
    });
  }

  isAtribuicaoNucleusSelected(nucleusName: string): boolean {
    return this.selectedAtribuicaoNucleos().includes(nucleusName);
  }

  saveUser() {
    if (this.userForm.valid && this.canManage()) {
      const formVal = this.userForm.value;
      const userData: Omit<User, 'id'> = {
        matricula: formVal.matricula!,
        name: formVal.name!,
        functionalEmail: formVal.functionalEmail!,
        gmail: formVal.gmail!,
        nucleus: formVal.nucleus!,
        metaPercentage: formVal.metaPercentage!,
        birthDate: formVal.birthDate!,
        role: formVal.role!,
        active: formVal.active ?? true,
        atribuicaoNucleos: this.selectedAtribuicaoNucleos()
      };

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
    this.selectedAtribuicaoNucleos.set(user.atribuicaoNucleos || []);
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
    this.selectedAtribuicaoNucleos.set([]);
    this.userForm.reset({
      metaPercentage: 100,
      role: 'Contador Judicial',
      active: true
    });
  }
}
