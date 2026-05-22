import { Component, OnInit, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { AssetStateService } from '../services/asset-state.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full p-10 bg-[#f8fafc] overflow-y-auto custom-scrollbar">
      
      <!-- NOTIFICATION TOAST (Temporaire 2 sec) -->
      <div *ngIf="showNotification()" 
           class="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-[2rem] shadow-[0_0_30px_rgba(239,68,68,0.15)] max-w-2xl">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-black">!</div>
            <p class="text-sm font-bold tracking-wide">{{ notificationMessage() }}</p>
          </div>
        </div>
      </div>
      
      <!-- HEADER STYLE DÉGRADÉ -->
      <div class="mb-10 flex justify-between items-end">
        <div>
          <h1 class="text-4xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent tracking-tight mb-2 uppercase">
            Journal des Alertes
          </h1>
          <p class="text-slate-500 font-medium italic">Historique des dépassements de seuils d'intensité détectés en temps réel.</p>
        </div>
        
        <!-- Badge Statut avec Lumière -->
        <div class="bg-white rounded-2xl px-6 py-3 border-2 border-red-100 shadow-[0_0_15px_rgba(239,68,68,0.1)] flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
          <span class="text-xs font-black text-slate-700 uppercase tracking-widest">Surveillance Active</span>
        </div>
      </div>

      <!-- GRAND CONTENEUR (Grand Case avec Lumière Rouge/Rose) -->
      <div class="bg-white/70 backdrop-blur-sm rounded-[2.5rem] shadow-[0_0_50px_rgba(239,68,68,0.12)] border border-white p-10">
        
        <div class="space-y-6">
          
          <!-- Légende des colonnes -->
          <div class="grid grid-cols-12 px-10 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <div class="col-span-3">Date & Heure</div>
            <div class="col-span-3 text-center">Équipement</div>
            <div class="col-span-3 text-center">Message</div>
            <div class="col-span-3 text-right">Valeur Mesurée</div>
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
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hardware Node</p>
            </div>

            <!-- Message Badge -->
            <div class="col-span-3 flex justify-center">
              <span class="px-5 py-2 bg-red-50 text-red-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100 shadow-[0_0_12px_rgba(239,68,68,0.12)]">
                {{ a.message }}
              </span>
            </div>

            <!-- Valeur Mesurée -->
            <div class="col-span-3 flex justify-end items-center gap-3">
              <div class="text-right">
                <p class="text-xl font-black text-red-600 leading-none">{{ a.value }}A</p>
                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Seuil: {{ a.threshold }}A</p>
              </div>
              <!-- Icône d'alerte lumineuse -->
              <div class="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.2)] border border-red-100">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
            </div>

          </div>

          <!-- Message si vide -->
          <div *ngIf="alerts().length === 0" class="p-20 text-center text-slate-300 font-bold italic">
            <div class="text-5xl mb-4 opacity-10">🛡️</div>
            Aucune anomalie détectée dans l'historique.
          </div>

        </div>
      </div>
    </div>
  `
})
export class AlertsComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private assetState = inject(AssetStateService);
  private route = inject(ActivatedRoute);
  alerts = signal<any[]>([]);
  // Effect declared as a field so it's created within an injection context
  private _assetSelectionEffect = effect(() => {
    const sa = this.assetState.selectedAsset();
    if (sa && sa.id) {
      Promise.resolve().then(() => this.loadAlertsForAsset(sa.id));
    }
  });
  lastAlert = signal<any>(null);
  showNotification = signal<boolean>(false);
  notificationMessage = signal<string>('');
  private notificationTimeout: any;

  ngOnInit() {
    // If a query param 'id' is present, load alerts for that asset (and descendants).
    // Schedule loads in a microtask to avoid changing bindings during initial change detection.
    this.route.queryParams.subscribe(params => {
      const id = Number(params['id']);
      if (id && !isNaN(id)) {
        Promise.resolve().then(() => this.loadAlertsForAsset(id));
      } else {
        const selected = this.assetState.selectedAsset();
        if (selected && selected.id) {
          Promise.resolve().then(() => this.loadAlertsForAsset(selected.id));
        } else {
          Promise.resolve().then(() => this.loadAllAlerts());
        }
      }
    });
  }

  private loadAllAlerts() {
    this.http.get<any[]>('http://localhost:3000/measurements/alerts/all', {
      headers: { Authorization: `Bearer ${this.auth.getToken()}` }
    }).subscribe(res => {
      this.alerts.set(res);
      this.updateLastAlert();
    });
  }

  private loadAlertsForAsset(assetId: number) {
    this.http.get<any[]>(`http://localhost:3000/measurements/alerts/asset/${assetId}`, {
      headers: { Authorization: `Bearer ${this.auth.getToken()}` }
    }).subscribe(res => {
      this.alerts.set(res || []);
      this.updateLastAlert();
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
    const dateStr = new Date(alert.timestamp).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = new Date(alert.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const message = `🔴 DERNIÈRE ALERTE (${dateStr} ${timeStr}) : ${alert.message} sur ${alert.assetName} – ${alert.value}A (Seuil ${alert.threshold}A)`;
    
    this.notificationMessage.set(message);
    this.showNotification.set(true);

    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.notificationTimeout = setTimeout(() => {
      this.showNotification.set(false);
    }, 3000);
  }
}