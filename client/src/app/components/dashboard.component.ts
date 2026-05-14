import { Component, signal, OnInit, inject, OnDestroy, NgZone } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ConsumptionChartComponent } from './consumption-chart.component';

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
    this.route.queryParams.subscribe(params => {
      const id = Number(params['id']);
      if (id && !isNaN(id)) {
        this.zone.run(() => {
          this.fetchAssetDetails(id);
          this.startMonitoring(id);
        });
      }
    });
  }

  fetchAssetDetails(id: number) {
    this.http.get<any>(`http://localhost:3000/assets/${id}`, {
      headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
    }).subscribe(res => this.selectedAsset.set(res));
  }

  startMonitoring(id: number) {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.monitorInterval = setInterval(() => {
      this.http.get<any>(`http://localhost:3000/measurements/latest/${id}`, {
        headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
      }).subscribe(res => {
        if (res) this.liveData.set({ ...res, timestamp: new Date() });
      });
      // Check for new alerts
      this.checkForNewAlerts();
    }, 2000);
  }

  ngOnDestroy() { if (this.monitorInterval) clearInterval(this.monitorInterval); }

  private checkForNewAlerts() {
    this.http.get<any>('http://localhost:3000/measurements/alerts/latest', {
      headers: { 'Authorization': `Bearer ${this.authService.getToken()}` }
    }).subscribe(alert => {
      if (alert && alert.id !== this.lastAlertId) {
        this.lastAlertId = alert.id;
        this.showAlertNotification(alert);
      }
    });
  }

  private showAlertNotification(alert: any) {
    this.alertNotificationCount.update(count => count + 1);
    const dateStr = new Date(alert.timestamp).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = new Date(alert.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const message = `ALERTE : ${alert.message} sur ${alert.assetName} – ${alert.value}A (Seuil ${alert.threshold}A)`;

    this.notificationMessage.set(message);
    this.showNotification.set(true);

    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.notificationTimeout = setTimeout(() => {
      this.showNotification.set(false);
    }, 3000);
  }
}
