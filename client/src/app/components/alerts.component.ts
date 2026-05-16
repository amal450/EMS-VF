import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';
import { AssetStateService } from '../services/asset-state.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full p-10 bg-[#f8fafc] overflow-y-auto custom-scrollbar">
      
      <!-- NOTIFICATION TOAST (Temporaire 2 sec) -->
      <div *ngIf="showNotification()" 
           class="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
        <div class="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl shadow-2xl border border-red-400 max-w-2xl">
          <p class="text-sm font-bold tracking-wide">{{ notificationMessage() }}</p>
        </div>
      </div>
      
      <!-- HEADER STYLE DÉGRADÉ -->
      <div class="mb-10 flex justify-between items-end">
        <div>
          <h1 class="text-4xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent tracking-tight mb-2 uppercase">
            {{ languageService.translate('alertJournal') }}
          </h1>
          <p class="text-slate-500 font-medium italic">{{ languageService.translate('alertsSubtitle') }}</p>
        </div>
        
        <!-- Badge Statut avec Lumière -->
        <div class="bg-white rounded-2xl px-6 py-3 border-2 border-red-100 shadow-[0_0_15px_rgba(239,68,68,0.1)] flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
          <span class="text-xs font-black text-slate-700 uppercase tracking-widest">{{ languageService.translate('activeMonitoring') }}</span>
        </div>
      </div>

      <!-- GRAND CONTENEUR (Grand Case avec Lumière Rouge/Rose) -->
      <div class="bg-white/70 backdrop-blur-sm rounded-[2.5rem] shadow-[0_0_50px_rgba(239,68,68,0.12)] border border-white p-10">
        
        <div class="space-y-6">
          
          <!-- Légende des colonnes -->
          <div class="grid grid-cols-12 px-10 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <div class="col-span-3">{{ languageService.translate('dateTime') }}</div>
            <div class="col-span-3 text-center">{{ languageService.translate('equipment') }}</div>
            <div class="col-span-3 text-center">{{ languageService.translate('messageLabel') }}</div>
            <div class="col-span-3 text-right">{{ languageService.translate('measuredValue') }}</div>
          </div>

          <!-- CARTES ALERTES (Lumière Permanente au survol) -->
          <div *ngFor="let a of alerts()" 
               class="bg-white rounded-3xl p-5 border-2 border-slate-50 shadow-sm grid grid-cols-12 items-center transition-all hover:scale-[1.01] hover:border-red-100 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            
            <!-- Date & Heure -->
            <div class="col-span-3 flex items-center gap-4">
              <div class="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <span class="text-sm font-bold text-slate-600">{{ a.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}</span>
            </div>

            <!-- Équipement -->
            <div class="col-span-3 text-center">
              <p class="font-black text-slate-900 uppercase tracking-tight text-lg">{{ a.assetName }}</p>
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{{ languageService.translate('hardwareNode') }}</p>
            </div>

            <!-- Message Badge -->
            <div class="col-span-3 flex justify-center">
              <span class="px-5 py-2 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100 shadow-sm">
                {{ languageService.translateAlertMessage(a.message) }}
              </span>
            </div>

            <!-- Valeur Mesurée -->
            <div class="col-span-3 flex justify-end items-center gap-3">
              <div class="text-right">
                <p class="text-xl font-black text-red-600 leading-none">{{ a.value }}A</p>
                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{{ languageService.translate('thresholdLabel') }}: {{ a.threshold }}A</p>
              </div>
              <!-- Icône d'alerte lumineuse -->
              <div class="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.2)] border border-red-100">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <!-- Bouton Supprimer -->
              <button type="button" (click)="askDeleteAlert(a.id, a.assetName, a.message)" 
                      class="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-500 text-slate-500 hover:text-white flex items-center justify-center transition-all border border-slate-300 hover:border-red-500 font-bold text-lg cursor-pointer shadow-sm hover:shadow-md"
                      [title]="languageService.translate('delete')">
                ×
              </button>
            </div>

          </div>

          <!-- Message si vide -->
          <div *ngIf="alerts().length === 0" class="p-20 text-center text-slate-300 font-bold italic">
            <div class="text-5xl mb-4 opacity-10">🛡️</div>
            {{ languageService.translate('noAlerts') }}
          </div>

        </div>
      </div>
    </div>

    <!-- MODAL : CONFIRMATION DE SUPPRESSION D'ALERTE -->
    <div *ngIf="showDeleteAlertModal()" class="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md">
      <div class="bg-white p-10 rounded-[2.5rem] w-96 text-center shadow-[0_0_50px_rgba(239,68,68,0.3)] border border-white animate-in zoom-in duration-200">
        <div class="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold border border-red-100">!</div>
        <h3 class="text-2xl font-black text-slate-900 mb-2">{{ languageService.translate('deleteItemTitle') }}</h3>
        <p class="text-sm text-slate-400 px-4 mb-8 italic text-center">{{ languageService.translate('deleteAlertConfirm', { label: alertToDeleteLabel() }) }}</p>
        <div class="flex gap-4">
          <button type="button" (click)="showDeleteAlertModal.set(false)" class="flex-1 py-3.5 font-bold bg-slate-100 text-slate-500 rounded-2xl transition">{{ languageService.translate('no') }}</button>
          <button type="button" (click)="confirmDeleteAlert()" class="flex-1 py-3.5 font-black bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/30 hover:bg-red-600 transition">{{ languageService.translate('yes') }}, {{ languageService.translate('delete') }}</button>
        </div>
      </div>
    </div>
  `
})
export class AlertsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private assetService = inject(AssetStateService);
  public languageService = inject(LanguageService);
  alerts = signal<any[]>([]);
  lastAlert = signal<any>(null);
  showNotification = signal<boolean>(false);
  notificationMessage = signal<string>('');
  private notificationTimeout: any;
  private alertCheckInterval: any;

  ngOnInit() {
    // Subscribe to route URL changes to detect every navigation to this page
    this.route.url.subscribe(() => {
      this.route.queryParams.subscribe(params => {
        const id = Number(params['id']);
        if (id && !isNaN(id)) {
          // Asset is selected - load its alerts
          this.loadAlertsForAsset(id);
        } else {
          // No asset selected - clear alerts
          this.alerts.set([]);
          this.lastAlert.set(null);
          this.showNotification.set(false);
        }
      });
    });

    // Also set up polling for asset changes from the service
    let lastId: number | null = null;
    this.alertCheckInterval = setInterval(() => {
      const asset = this.assetService.selectedAsset();
      const id = asset ? asset.id : null;
      if (id !== lastId && id !== null) {
        lastId = id;
        this.loadAlertsForAsset(id);
      } else if (id === null && lastId !== null) {
        lastId = null;
        this.alerts.set([]);
        this.lastAlert.set(null);
        this.showNotification.set(false);
      }
    }, 500);
  }

  ngOnDestroy() {
    if (this.alertCheckInterval) clearInterval(this.alertCheckInterval);
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
  }

  private loadAlertsForAsset(assetId: number) {
    const token = this.auth.getToken();
    if (!token) return;

    // First try exact asset alerts
    this.http.get<any[]>(`http://localhost:3000/measurements/alerts/asset/${assetId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(res => {
      const list = res || [];
      if (list.length > 0) {
        this.alerts.set(list);
        this.updateLastAlert();
      } else {
        // Fallback: if exact asset has no alerts, try fetching alerts from descendants
        this.http.get<any[]>(`http://localhost:3000/measurements/alerts/asset-descendants/${assetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).subscribe(res2 => {
          this.alerts.set(res2 || []);
          this.updateLastAlert();
        }, err2 => {
          console.error('Error loading descendant alerts for asset:', err2);
          this.alerts.set([]);
        });
      }
    }, err => {
      console.error('Error loading alerts for asset:', err);
      this.alerts.set([]);
    });
  }

  private updateLastAlert() {
    if (this.alerts().length > 0) {
      const newAlert = this.alerts()[0];
      this.lastAlert.set(newAlert);
      this.showAlertNotification(newAlert);
    } else {
      this.lastAlert.set(null);
    }
  }

  private showAlertNotification(alert: any) {
    const locale = this.languageService.language() === 'en' ? 'en-US' : 'fr-FR';
    const dateStr = new Date(alert.timestamp).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = new Date(alert.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const translatedMessage = this.languageService.translateAlertMessage(alert.message);
    const message = this.languageService.translate('latestAlertNotification', {
      date: dateStr,
      time: timeStr,
      message: translatedMessage,
      asset: alert.assetName,
      value: alert.value?.toString() ?? '',
      threshold: alert.threshold?.toString() ?? ''
    });
    
    this.notificationMessage.set(message);
    this.showNotification.set(true);

    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.notificationTimeout = setTimeout(() => {
      this.showNotification.set(false);
    }, 3000);
  }

  showDeleteAlertModal = signal<boolean>(false);
  alertToDeleteId: number | null = null;
  alertToDeleteLabel = signal<string>('');

  askDeleteAlert(alertId: number, assetName: string, message: string) {
    if (!alertId || alertId === null || alertId === undefined) {
      console.error('ID alerte invalide:', alertId);
      return;
    }

    this.alertToDeleteId = alertId;
    this.alertToDeleteLabel.set(`${assetName} - ${message}`);
    this.showDeleteAlertModal.set(true);
  }

  confirmDeleteAlert() {
    if (!this.alertToDeleteId) {
      console.error('Aucune alerte sélectionnée pour suppression');
      return;
    }

    const numId = Number(this.alertToDeleteId);
    console.log('🗑️ Suppression alerte ID:', numId);
    
    this.http.delete(`http://localhost:3000/measurements/alerts/${numId}`, {
      headers: { Authorization: `Bearer ${this.auth.getToken()}` }
    }).subscribe({
      next: (response) => {
        console.log('✅ Alerte supprimée avec succès ID:', numId, response);
        this.alerts.update(alerts => alerts.filter(a => a.id !== numId));
        this.showDeleteAlertModal.set(false);
        this.alertToDeleteId = null;
        this.alertToDeleteLabel.set('');
        this.reloadAlerts();
        this.notificationMessage.set(this.languageService.translate('alertDeleted'));
        this.showNotification.set(true);
        if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
        this.notificationTimeout = setTimeout(() => this.showNotification.set(false), 3000);
      },
      error: (err) => {
        console.error('❌ Erreur suppression alerte:', numId, err);
        window.alert(this.languageService.translate('alertDeleteError'));
      }
    });
  }

  private reloadAlerts() {
    const token = this.auth.getToken();
    if (!token) return;
    
    this.http.get<any[]>('http://localhost:3000/measurements/alerts/all', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res) => {
        console.log('📊 Alertes rechargées:', res?.length || 0);
        this.alerts.set(res || []);
      },
      error: (err) => console.error('❌ Erreur rechargement alertes:', err)
    });
  }
}
