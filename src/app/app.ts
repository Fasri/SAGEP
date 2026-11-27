import {ChangeDetectionStrategy, Component, inject, computed, signal} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
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
  private sanitizer = inject(DomSanitizer);

  currentUser = this.store.currentUser;
  users = this.store.users;
  isSupabaseConnected = this.store.isSupabaseConnected;
  isMfaEnrolled = this.store.isMfaEnrolled;
  showLogin = computed(() => !this.currentUser());
  loginError = signal<string | null>(null);
  showDropdown = signal(false);
  
  showLinksDropdown = signal(false);
  
  showChangePasswordModal = signal(false);
  changePasswordError = signal<string | null>(null);
  changePasswordSuccess = signal(false);

  // 2FA Login Challenge
  showMfaChallenge = signal(false);
  mfaCodeControl = new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]);
  mfaLoginError = signal<string | null>(null);
  isVerifyingMfa = signal(false);

  // 2FA Enrollment Modal
  showMfaEnrollModal = signal(false);
  mfaEnrollData = signal<{ factorId: string; qrCode: string; secret: string; uri: string } | null>(null);
  mfaEnrollCodeControl = new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]);
  mfaEnrollError = signal<string | null>(null);
  mfaEnrollSuccess = signal(false);
  isLoadingMfaEnroll = signal(false);
  isSubmittingMfaEnroll = signal(false);
  copiedSecret = signal(false);

  // Regra de prazo: Obrigatório a partir de segunda-feira, 30/11/2026
  mfaDeadline = new Date('2026-11-30T00:00:00-03:00');

  isMfaPastDeadline = computed(() => {
    return new Date() >= this.mfaDeadline;
  });

  daysUntilMfaDeadline = computed(() => {
    const diff = this.mfaDeadline.getTime() - new Date().getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  });

  canCloseMfaEnrollModal = computed(() => {
    return !this.isMfaPastDeadline() || this.isMfaEnrolled();
  });

  requiresMfaSetup = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return !this.isMfaEnrolled();
  });

  safeQrSvg = computed(() => {
    const data = this.mfaEnrollData();
    if (!data?.qrCode) return null;
    if (data.qrCode.startsWith('<svg')) {
      return this.sanitizer.bypassSecurityTrustHtml(data.qrCode);
    }
    return null;
  });

  qrCodeImageSrc = computed(() => {
    const data = this.mfaEnrollData();
    if (!data?.qrCode) return '';
    if (data.qrCode.startsWith('data:')) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(data.qrCode);
    }
    return '';
  });

  toggleLinksDropdown(event: Event) {
    event.stopPropagation();
    this.showLinksDropdown.set(!this.showLinksDropdown());
  }

  closeLinksDropdown() {
    this.showLinksDropdown.set(false);
  }

  requiresPasswordChange = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return user.senhaAlterada === false || user.password === '123456';
  });

  isDefaultPassword = this.requiresPasswordChange;

  loginForm = new FormGroup({
    userId: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required)
  });

  changePasswordForm = new FormGroup({
    currentPassword: new FormControl('', Validators.required),
    newPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: new FormControl('', Validators.required)
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
      (u.nucleus && u.nucleus.toLowerCase().includes(term))
    ).slice(0, 10);
  });

  async login() {
    this.loginError.set(null);
    if (this.loginForm.valid) {
      const input = (this.loginForm.value.userId || '').trim();
      
      // Bloqueia expressamente tentativa de login por matrícula numérica
      if (/^\d+$/.test(input)) {
        this.loginError.set('O login por matrícula não é permitido. Por favor, digite seu nome ou e-mail.');
        return;
      }

      const result = await this.store.login(input, this.loginForm.value.password!);

      if (result.requiresMfa) {
        this.showMfaChallenge.set(true);
        this.mfaCodeControl.reset();
        this.mfaLoginError.set(null);
        return;
      }

      if (!result.success) {
        this.loginError.set(result.error || 'Usuário ou senha inválidos. Utilize seu nome ou e-mail.');
      } else {
        this.handlePostLogin();
      }
    }
  }

  async verifyMfaLogin() {
    if (this.mfaCodeControl.invalid) return;
    this.mfaLoginError.set(null);
    this.isVerifyingMfa.set(true);

    const success = await this.store.verifyMfaLogin(this.mfaCodeControl.value!);
    this.isVerifyingMfa.set(false);

    if (success) {
      this.showMfaChallenge.set(false);
      this.mfaCodeControl.reset();
      this.handlePostLogin();
    } else {
      this.mfaLoginError.set('Código 2FA incorreto ou expirado. Verifique no aplicativo Google Authenticator.');
    }
  }

  cancelMfaChallenge() {
    this.showMfaChallenge.set(false);
    this.mfaCodeControl.reset();
    this.mfaLoginError.set(null);
  }

  handlePostLogin() {
    // 1. Checa troca de senha provisória
    if (this.requiresPasswordChange()) {
      setTimeout(() => this.openChangePasswordModal(), 350);
      return;
    }

    // 2. Se o usuário ainda não tiver 2FA configurado:
    // Se passou do prazo (a partir de 30/11) ou antes do prazo, oferece abertura
    if (this.requiresMfaSetup()) {
      setTimeout(() => this.openMfaEnrollModal(), 400);
    }
  }

  async openMfaEnrollModal() {
    this.showMfaEnrollModal.set(true);
    this.mfaEnrollError.set(null);
    this.mfaEnrollSuccess.set(false);
    this.mfaEnrollCodeControl.reset();
    this.copiedSecret.set(false);
    this.isLoadingMfaEnroll.set(true);

    const data = await this.store.startMfaEnrollment();
    this.isLoadingMfaEnroll.set(false);
    if (data) {
      this.mfaEnrollData.set(data);
    } else {
      this.mfaEnrollError.set('Não foi possível gerar a chave de ativação do 2FA. Tente novamente.');
    }
  }

  closeMfaEnrollModal() {
    if (!this.canCloseMfaEnrollModal() && !this.isMfaEnrolled()) {
      return; // Bloqueado após o prazo
    }
    this.showMfaEnrollModal.set(false);
    this.mfaEnrollData.set(null);
    this.mfaEnrollError.set(null);
  }

  async confirmMfaEnrollment() {
    if (this.mfaEnrollCodeControl.invalid) return;
    const data = this.mfaEnrollData();
    if (!data) return;

    this.isSubmittingMfaEnroll.set(true);
    this.mfaEnrollError.set(null);

    const result = await this.store.confirmMfaEnrollment(data.factorId, this.mfaEnrollCodeControl.value!);
    this.isSubmittingMfaEnroll.set(false);

    if (result.success) {
      this.mfaEnrollSuccess.set(true);
      setTimeout(() => {
        this.closeMfaEnrollModal();
      }, 2000);
    } else {
      this.mfaEnrollError.set(result.error || 'Código inválido. Digite os 6 dígitos do Google Authenticator.');
    }
  }

  copySecret() {
    const data = this.mfaEnrollData();
    if (data?.secret) {
      navigator.clipboard.writeText(data.secret);
      this.copiedSecret.set(true);
      setTimeout(() => this.copiedSecret.set(false), 2500);
    }
  }

  async logout() {
    await this.store.logout();
    this.loginForm.reset();
  }

  reconnect() {
    this.store.loadData();
  }

  selectUser(user: User) {
    this.loginForm.patchValue({ userId: user.name });
    this.showDropdown.set(false);
  }

  onInputFocus() {
    this.showDropdown.set(true);
  }

  onInputBlur() {
    // Small delay to allow click event on dropdown to fire
    setTimeout(() => this.showDropdown.set(false), 200);
  }

  openChangePasswordModal() {
    this.changePasswordForm.reset();
    this.changePasswordError.set(null);
    this.changePasswordSuccess.set(false);
    this.showChangePasswordModal.set(true);
  }

  closeChangePasswordModal() {
    this.showChangePasswordModal.set(false);
  }

  async changePassword() {
    this.changePasswordError.set(null);
    this.changePasswordSuccess.set(false);

    if (this.changePasswordForm.invalid) {
      this.changePasswordError.set('Preencha todos os campos corretamente. A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.changePasswordForm.value;
    const user = this.currentUser();

    if (!user) return;

    if (currentPassword !== user.password) {
      this.changePasswordError.set('Senha atual incorreta.');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.changePasswordError.set('A nova senha e a confirmação não coincidem.');
      return;
    }

    if (newPassword === currentPassword) {
      this.changePasswordError.set('A nova senha não pode ser igual à senha atual.');
      return;
    }

    const updatedUser: User = { 
      ...user, 
      password: newPassword!,
      senhaAlterada: true 
    };
    await this.store.updateUser(updatedUser);
    await this.store.changePassword(newPassword!);
    
    this.changePasswordSuccess.set(true);
    setTimeout(() => {
      this.closeChangePasswordModal();
    }, 2000);
  }
}

