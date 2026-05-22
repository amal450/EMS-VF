import { Component, signal, OnInit, inject, OnDestroy, NgZone } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';
import { ConsumptionChartComponent } from './consumption-chart.component';
import { AssetStateService } from '../services/asset-state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, ConsumptionChartComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);
  public authService = inject(AuthService);
  public languageService = inject(LanguageService);
  private assetState = inject(AssetStateService);

  selectedAsset = signal<any>(null);
  private monitorInterval: any;

  liveData = signal<any>({
    V1N: '000', V2N: '000', V3N: '000', V12: '000', V23: '000', V31: '000',
    I1: '0.0', I2: '0.0', I3: '0.0', TKW: '0.00', IKWH: '0.00', HZ: '00.00', PF: '0.00',
    timestamp: new Date()
  });

  // Notification signals
  showNotification = signal<boolean>(false);
  notificationMessage = signal<string>('');
  alertNotificationCount = signal<number>(0);
  private notificationTimeout: any;
  private lastAlertId: number | null = null;

  ngOnInit() {
    // Subscribe to URL changes to ensure we detect every navigation to this page
    this.route.url.subscribe(() => {
      this.route.queryParams.subscribe(params => {
        const id = Number(params['id']);
        if (id && !isNaN(id)) {
          this.zone.run(() => {
            this.fetchAssetDetails(id);
            this.startMonitoring(id);
          });
        } else {
          // No asset selected - stop monitoring and reset all data
          if (this.monitorInterval) clearInterval(this.monitorInterval);
          this.lastAlertId = null;
          this.alertNotificationCount.set(0);
          this.showNotification.set(false);
          this.liveData.set({
            V1N: '000', V2N: '000', V3N: '000', V12: '000', V23: '000', V31: '000',
            I1: '0.0', I2: '0.0', I3: '0.0', TKW: '0.00', IKWH: '0.00', HZ: '00.00', PF: '0.00',
            timestamp: new Date()
          });
          this.selectedAsset.set(null);
        }
      });
    });
  }

  fetchAssetDetails(id: number) {
    this.http.get<any>(`http://localhost:3000/assets/${id}`, {
      headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
    }).subscribe(res => this.selectedAsset.set(res));
  }

  startMonitoring(id: number) {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    
    // Reset alert tracking when changing asset
    this.lastAlertId = null;
    this.alertNotificationCount.set(0);
    this.showNotification.set(false);
    
    this.monitorInterval = setInterval(() => {
      this.http.get<any>(`http://localhost:3000/measurements/latest/${id}`, {
        headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
      }).subscribe(res => {
        if (res) this.liveData.set({ ...res, timestamp: new Date() });
      });
      // Check for new alerts
      this.checkForNewAlerts(id);
    }, 2000);
  }

  ngOnDestroy() { 
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
  }

  private checkForNewAlerts(assetId: number) {
    // Vérifier si l'utilisateur a la permission VIEW_ALERTS et qu'un asset est sélectionné
    if (!this.authService.hasPermission('VIEW_ALERTS') || !assetId) {
      return;
    }
    // Get the latest alert only for the selected asset. Each asset must show its own alert.
    this.http.get<any>(`http://localhost:3000/measurements/alerts/latest?assetId=${assetId}`, {
      headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
    }).subscribe(alert => {
      if (alert && alert.id && alert.id !== this.lastAlertId) {
        this.lastAlertId = alert.id;
        this.showAlertNotification(alert);
      }
    });
  }

  private showAlertNotification(alert: any) {
    this.alertNotificationCount.update(count => count + 1);
    const locale = this.languageService.language() === 'en' ? 'en-US' : 'fr-FR';
    const dateStr = new Date(alert.timestamp).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = new Date(alert.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const translatedAlertMessage = this.languageService.translateAlertMessage(alert.message);
    const message = this.languageService.translate('latestAlertNotification', {
      date: dateStr,
      time: timeStr,
      message: translatedAlertMessage,
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
}
