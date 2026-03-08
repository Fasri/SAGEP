import {ChangeDetectionStrategy, Component, inject, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {RouterOutlet, RouterLink, RouterLinkActive} from '@angular/router';
import {StoreService} from './services/store';

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

  loginForm = new FormGroup({
    userId: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required)
  });

  login() {
    if (this.loginForm.valid) {
      this.store.login(this.loginForm.value.userId!, this.loginForm.value.password!);
    }
  }

  logout() {
    this.store.logout();
    this.loginForm.reset();
  }

  reconnect() {
    this.store.loadData();
  }
}

