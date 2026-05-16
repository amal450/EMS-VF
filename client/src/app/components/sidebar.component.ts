import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);
  public authService = inject(AuthService);
  public languageService = inject(LanguageService);
  
  activeButton = signal('overview');
  
  // --- LE SIGNAL QUI MANQUAIT POUR LE BOUTON ---
  showLogoutModal = signal(false);

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.url;
      if (url.includes('hierarchy')) this.activeButton.set('hierarchy');
      else if (url.includes('users')) this.activeButton.set('users');
      else if (url.includes('alerts')) this.activeButton.set('alerts');
      else if (url.includes('reports')) this.activeButton.set('reports');
      else if (url.includes('billing')) this.activeButton.set('billing');
      else if (url.includes('profile')) this.activeButton.set('profile');
      else this.activeButton.set('overview');
    });
  }

  navigateTo(route: string) {
    this.router.navigate([`/${route}`]);
  }

  // --- FONCTIONS DE DÉCONNEXION ---

  askLogout() {
    this.showLogoutModal.set(true); // Ouvre la fenêtre
  }

  cancelLogout() {
    this.showLogoutModal.set(false); // Ferme la fenêtre
  }

  confirmLogout() {
    this.showLogoutModal.set(false);
    this.authService.logout(); // Vide la session
    this.router.navigate(['/login']); // Redirige vers la connexion
  }
}
