import {ChangeDetectionStrategy, Component, inject, computed, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {RouterOutlet, RouterLink, RouterLinkActive} from '@angular/router';
import {StoreService} from './services/store';
import {User} from './types';
import {startWith} from 'rxjs';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private store = inject(StoreService);

  currentUser = this.store.currentUser;
  users = this.store.users;
  isSupabaseConnected = this.store.isSupabaseConnected;
  showLogin = computed(() => !this.currentUser());
  loginError = signal<string | null>(null);
  showDropdown = signal(false);

  loginForm = new FormGroup({
    userId: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required)
  });

  // Convert form value changes to a signal so computed() can track it
  private userIdValue = toSignal(
    this.loginForm.get('userId')!.valueChanges.pipe(startWith('')),
    { initialValue: '' }
  );

  filteredUsers = computed(() => {
    const term = (this.userIdValue() || '').toLowerCase();
    if (!term && !this.showDropdown()) return [];
    
    const allUsers = this.users();
    if (!term) return allUsers.slice(0, 10);

    return allUsers.filter(u => 
      u.name.toLowerCase().includes(term) || 
      u.matricula.toLowerCase().includes(term) ||
      u.nucleus.toLowerCase().includes(term)
    ).slice(0, 10);
  });

  login() {
    this.loginError.set(null);
    if (this.loginForm.valid) {
      const success = this.store.login(this.loginForm.value.userId!, this.loginForm.value.password!);
      if (!success) {
        this.loginError.set('Usuário ou senha inválidos.');
      }
    }
  }

  logout() {
    this.store.logout();
    this.loginForm.reset();
  }

  reconnect() {
    this.store.loadData();
  }

  selectUser(user: User) {
    this.loginForm.patchValue({ userId: user.matricula });
    this.showDropdown.set(false);
  }

  onInputFocus() {
    this.showDropdown.set(true);
  }

  onInputBlur() {
    // Small delay to allow click event on dropdown to fire
    setTimeout(() => this.showDropdown.set(false), 200);
  }
}

