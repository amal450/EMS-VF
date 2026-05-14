import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  
  userProfile = signal<any>({ username: 'Chargement...', email: '', role: '' });
  passwords = signal({ current: '', new: '', confirm: '' });
  isLoading = signal(false);
  errorMessage = signal('');

  // --- Signaux pour la Modal de Succès ---
  showSuccessModal = signal(false);
  successMessage = signal('');
  modalTheme = signal<'green' | 'purple'>('green');

  ngOnInit() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.userProfile.set({
            username: user.username || 'Utilisateur',
            email: user.email || '',
            role: user.role || 'ADMIN'
          });
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  saveProfile() {
    const user = this.authService.currentUserValue;
    if (!user || !user.id) {
      this.errorMessage.set('Utilisateur non connecté');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.updateProfile(user.id, {
      username: this.userProfile().username,
      email: this.userProfile().email
    }).pipe(take(1)).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.modalTheme.set('green');
        this.successMessage.set('Vos informations ont été mises à jour avec succès !');
        this.showSuccessModal.set(true);

        const updatedUser = Array.isArray(res) ? res[0] : res;
        if (updatedUser) {
          this.userProfile.set({
            username: updatedUser.username || this.userProfile().username,
            email: updatedUser.email || this.userProfile().email,
            role: updatedUser.role || this.userProfile().role
          });
        } else {
          const current = this.authService.currentUserValue;
          if (current) {
            this.userProfile.set({
              username: current.username || this.userProfile().username,
              email: current.email || this.userProfile().email,
              role: current.role || this.userProfile().role
            });
          }
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Erreur lors de la mise à jour');
        console.error('Update profile error:', err);
      }
    });
  }

  updatePassword() {
    const user = this.authService.currentUserValue;
    if (!user || !user.id) {
      this.errorMessage.set('Utilisateur non connecté');
      return;
    }

    if (this.passwords().new !== this.passwords().confirm) {
      this.errorMessage.set('Les mots de passe ne correspondent pas');
      return;
    }

    if (this.passwords().new.length < 4) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 4 caractères');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.updatePassword(user.id, this.passwords().new).pipe(take(1)).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.modalTheme.set('purple');
        this.successMessage.set('Mot de passe modifié avec succès !');
        this.showSuccessModal.set(true);
        this.passwords.set({ current: '', new: '', confirm: '' });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Erreur lors de la modification du mot de passe');
        console.error('Update password error:', err);
      }
    });
  }

  closeSuccess() {
    this.showSuccessModal.set(false);
  }
}
