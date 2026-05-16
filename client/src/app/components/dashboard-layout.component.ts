import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, CommonModule, HttpClientModule],
  template: `
    <div class="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      <app-sidebar class="h-full z-20 shrink-0"></app-sidebar>
      <div class="flex-1 flex flex-col h-screen overflow-hidden">
        <header class="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 shrink-0 z-10">
          <div class="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <span>{{ languageService.translate('dashboard') }}</span>
          </div>
          <div class="flex items-center gap-6" *ngIf="authService.currentUser$ | async as user">
            <div>
              <button type="button" aria-label="Change language" class="px-4 py-3 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition flex items-center justify-center cursor-pointer" style="font-family: 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;" (click)="toggleLanguage()">
                <span class="text-2xl">{{ languageService.language() === 'fr' ? '🇫🇷' : '🇺🇸' }}</span>
              </button>
            </div>
            <div class="h-8 w-[1px] bg-slate-200"></div>
            <ng-container *ngIf="authService.hasPermission('VIEW_ALERTS')">
              <button (click)="goTo('alerts')" class="relative p-2.5 rounded-xl transition-all" [class.text-slate-400]="alertCount() === 0" [class.hover:text-slate-500]="alertCount() === 0" [class.hover:bg-slate-50]="alertCount() === 0" [class.text-red-500]="alertCount() > 0" [class.hover:bg-red-50]="alertCount() > 0" [ngClass]="{'animate-bounce': newAlertPulse()}">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                <span *ngIf="alertCount() > 0" class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
              </button>
              <div class="h-8 w-[1px] bg-slate-200"></div>
            </ng-container>
            <div (click)="goTo('profile')" class="flex items-center gap-3 cursor-pointer group">
              <div class="text-right hidden sm:block">
                <p class="text-sm font-black text-cyan-400 leading-none uppercase">{{ user.username }}</p>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{{ user.role }}</p>
              </div>
              
              <!-- AVATAR HEADER : BLEU CIEL TRANSPARENT -->
              <div class="w-10 h-10 rounded-full bg-blue-50/50 border-2 border-blue-100 text-blue-500 flex items-center justify-center transition-all group-hover:border-blue-400 group-hover:scale-105 shadow-sm">
                 <span class="text-sm font-black">{{ (user.username || 'A').charAt(0).toUpperCase() }}</span>
              </div>
            </div>
          </div>
        </header>
        <main class="flex-1 overflow-y-auto bg-white relative">
          <div class="max-w-[1600px] mx-auto"><router-outlet></router-outlet></div>
        </main>
      </div>
    </div>
  `
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public languageService = inject(LanguageService);
  private router = inject(Router);
  private http = inject(HttpClient);
  alertCount = signal<number>(0);
  newAlertPulse = signal<boolean>(false);
  private refreshInterval: any;
  private bounceTimeout: any;

  ngOnInit() {
    this.updateAlertCount();
    this.refreshInterval = setInterval(() => this.updateAlertCount(), 5000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.bounceTimeout) clearTimeout(this.bounceTimeout);
  }

  updateAlertCount() {
    const token = this.authService.getToken();
    if (!token || !this.authService.hasPermission('VIEW_ALERTS')) {
      this.alertCount.set(0);
      return;
    }

    this.http.get<any[]>('http://localhost:3000/measurements/alerts/all', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: alerts => {
        const count = Math.min(alerts?.length || 0, 17);
        const previous = this.alertCount();
        this.alertCount.set(count);
        if (count > previous) {
          this.triggerNotificationPulse();
        }
      },
      error: () => this.alertCount.set(0)
    });
  }

  private triggerNotificationPulse() {
    this.newAlertPulse.set(true);
    if (this.bounceTimeout) clearTimeout(this.bounceTimeout);
    this.bounceTimeout = setTimeout(() => this.newAlertPulse.set(false), 2000);
  }

  goTo(path: string) { this.router.navigate([`/${path}`]); }

  toggleLanguage() {
    const next = this.languageService.language() === 'fr' ? 'en' : 'fr';
    this.languageService.setLanguage(next);
  }
}
