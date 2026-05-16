import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html'
})
export class UserManagementComponent implements OnInit {
  private http = inject(HttpClient);
  public authService = inject(AuthService);
  public languageService = inject(LanguageService);

  users = signal<any[]>([]);
  availablePermissions = signal<any[]>([]);
  
  // --- Signaux pour les Fenêtres (Modals) ---
  showUserModal = signal(false);
  showDeleteModal = signal(false);
  isEditMode = signal(false);
  
  // Formulaire
  userForm = signal({ 
    id: null as number | null, 
    username: '', 
    email: '', 
    password: '', 
    role: 'AGENT',
    permissionIds: [] as number[]
  });
  
  userToDelete = signal<any>(null);
  message = signal('');
  messageType = signal<'success' | 'error' | ''>('');

  showSuccessModal = signal(false);
  successTitleKey = signal('');
  successMessageKey = signal('');
  successMessageParams = signal<Record<string, string> | undefined>(undefined);
  successTheme = signal<'green' | 'purple'>('green');

  ngOnInit() {
    this.loadUsers();
    this.loadPermissions();
  }

  loadUsers() {
    const token = this.authService.getToken();
    this.http.get<any[]>('http://localhost:3000/users', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(res => this.users.set(res));
  }

  loadPermissions() {
    const token = this.authService.getToken();
    this.http.get<any[]>('http://localhost:3000/users/permissions/all', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res) => {
        console.log('Permissions loaded:', res);
        if (!res || res.length === 0) {
          this.setDefaultPermissions();
        } else {
          this.availablePermissions.set(res);
        }
      },
      error: (err) => {
        console.error('Error loading permissions:', err);
        this.setDefaultPermissions();
      }
    });
  }

  private setDefaultPermissions() {
    this.availablePermissions.set([
      { id: 3, code: 'VIEW_ALERTS', name: 'Voir les alertes', description: 'Voir les alertes et anomalies' },
      { id: 4, code: 'VIEW_REPORTS', name: 'Voir les rapports', description: 'Accès aux rapports mensuels/annuels' },
      { id: 5, code: 'VIEW_INVOICES', name: 'Voir les factures', description: 'Accès aux factures et facturation' },
      { id: 7, code: 'MANAGE_ASSETS', name: 'Gérer les assets', description: 'Créer/modifier/supprimer les assets' },
      { id: 8, code: 'MANAGE_USERS', name: 'Gérer les utilisateurs', description: 'Créer/modifier/supprimer les utilisateurs' }
    ]);
  }

  // --- ACTIONS DES BOUTONS ---

  private clearMessage() {
    this.message.set('');
    this.messageType.set('');
  }

  private setMessage(text: string, type: 'success' | 'error' | '') {
    this.message.set(text);
    this.messageType.set(type);
  }

  private showSuccess(titleKey: string, messageKey: string, theme: 'green' | 'purple' = 'green', params?: Record<string, string>) {
    this.clearMessage();
    this.successTitleKey.set(titleKey);
    this.successMessageKey.set(messageKey);
    this.successMessageParams.set(params);
    this.successTheme.set(theme);
    this.showSuccessModal.set(true);
  }

  closeSuccessModal() {
    this.showSuccessModal.set(false);
  }

  openAdd() {
    this.clearMessage();
    this.isEditMode.set(false);
    this.userForm.set({ id: null, username: '', email: '', password: '', role: 'AGENT', permissionIds: [] });
    this.showUserModal.set(true);
  }

  openEdit(user: any) {
    this.clearMessage();
    this.isEditMode.set(true);
    const token = this.authService.getToken();
    // Charger les permissions de l'utilisateur
    this.http.get<any[]>(`http://localhost:3000/users/${user.id}/permissions`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(perms => {
      const permIds = perms.map(p => p.id);
      this.userForm.set({ ...user, password: '', permissionIds: permIds });
      this.showUserModal.set(true);
    });
  }

  askDelete(user: any) {
    this.userToDelete.set(user);
    this.showDeleteModal.set(true);
  }

  togglePermission(permissionId: number) {
    const form = this.userForm();
    const perms = form.permissionIds;
    if (perms.includes(permissionId)) {
      form.permissionIds = perms.filter(id => id !== permissionId);
    } else {
      form.permissionIds = [...perms, permissionId];
    }
    this.userForm.set({ ...form });
  }

  onRoleChange() {
    // Quand le rôle change, réinitialiser les permissions
    const form = this.userForm();
    const role = form.role;
    
    // Récupérer les permissions disponibles pour le nouveau rôle
    const availablePerms = this.getPermissionsByRole(role);
    const availablePermIds = availablePerms.map(p => p.id);
    
    // Garder uniquement les permissions valides pour ce rôle
    const validPermIds = form.permissionIds.filter(id => availablePermIds.includes(id));
    
    this.userForm.set({ ...form, permissionIds: validPermIds });
  }

  saveUser() {
    const data = this.userForm();
    const token = this.authService.getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const payload: any = { ...data, permissions: data.permissionIds };
    delete payload.permissionIds;

    if (this.isEditMode()) {
      if (!payload.password) {
        delete payload.password; // Preserve existing password when user leaves the field empty
      }
      this.http.patch(`http://localhost:3000/users/${data.id}`, payload, { headers })
        .subscribe({
          next: () => {
            this.loadUsers();
            this.showUserModal.set(false);
            this.showSuccess('userUpdatedTitle', 'userUpdatedText', 'purple');
          },
          error: (err) => {
            const msg = err?.error?.message || err?.message || 'Erreur lors de la mise à jour.';
            this.setMessage(msg, 'error');
          }
        });
    } else {
      this.http.post('http://localhost:3000/users', payload, { headers })
        .subscribe({
          next: () => {
            this.loadUsers();
            this.showUserModal.set(false);
            this.showSuccess('accountCreatedTitle', 'accountCreatedText', 'green');
          },
          error: (err) => {
            const msg = err?.error?.message || err?.message || 'Erreur lors de la création du compte.';
            this.setMessage(msg, 'error');
          }
        });
    }
  }

  confirmDelete() {
    const user = this.userToDelete();
    if (!user) return;
    const token = this.authService.getToken();
    this.http.delete(`http://localhost:3000/users/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(() => {
      this.loadUsers();
      this.showDeleteModal.set(false);
    });
  }

  isPermissionSelected(permissionId: number): boolean {
    return this.userForm().permissionIds.includes(permissionId);
  }

  translatePermissionName(permission: any): string {
    if (!permission?.code) return permission?.name || '';
    const translated = this.languageService.translatePermissionName(permission.code);
    return translated === `permissionName_${permission.code}` ? permission.name : translated;
  }

  translatePermissionDescription(permission: any): string {
    if (!permission?.code) return permission?.description || '';
    const translated = this.languageService.translatePermissionDescription(permission.code);
    return translated === `permissionDescription_${permission.code}` ? permission.description : translated;
  }

  getPermissionsByRole(role: string): any[] {
    const perms = this.availablePermissions();
    if (!perms || perms.length === 0) return [];

    const normalizedRole = role?.toUpperCase().replace(/\s+/g, '_');

    const visiblePermissions = ['VIEW_ALERTS', 'VIEW_REPORTS', 'VIEW_INVOICES', 'MANAGE_ASSETS', 'MANAGE_USERS'];
    const agentPermissions = ['VIEW_ALERTS', 'VIEW_INVOICES'];
    const managerPermissions = ['VIEW_ALERTS', 'VIEW_REPORTS', 'VIEW_INVOICES'];
    const adminPermissions = ['VIEW_ALERTS', 'VIEW_REPORTS', 'VIEW_INVOICES', 'MANAGE_ASSETS', 'MANAGE_USERS'];

    if (normalizedRole === 'AGENT') {
      return perms.filter(p => agentPermissions.includes(p.code));
    } else if (['RESPONSABLE_ENERGIE', 'RESP_ENERGIE'].includes(normalizedRole)) {
      return perms.filter(p => managerPermissions.includes(p.code));
    } else if (normalizedRole === 'ADMIN') {
      return perms.filter(p => adminPermissions.includes(p.code));
    }

    return perms.filter(p => visiblePermissions.includes(p.code));
  }
}
