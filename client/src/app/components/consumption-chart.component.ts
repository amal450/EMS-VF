import { Component, Input, OnChanges, SimpleChanges, signal, inject, OnDestroy, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-consumption-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-10">
      
      <!-- 1. GRAPHIQUE SUIVI EN DIRECT -->
      <div *ngIf="mode === 'live'" class="bg-white p-6 rounded-[2.5rem] border-2 border-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.12)] h-full transition-all">
        <div class="flex justify-between items-center mb-4 px-2">
          <h2 class="text-[15px] font-bold text-[#1e293b] flex items-center gap-2 tracking-tight">
            <svg class="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            SUIVI EN DIRECT (P, V, I)
          </h2>
          <span class="text-[9px] font-black text-emerald-500 animate-pulse tracking-tighter">● LIVE MONITORING</span>
        </div>
        <div class="h-[250px] w-full"><canvas #realtimeCanvas></canvas></div>
      </div>

      <!-- 2. GRAPHIQUE ANALYSE HISTORIQUE -->
      <div *ngIf="mode === 'history'" class="bg-white p-8 rounded-[2.5rem] border-2 border-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.12)] transition-all">
        <div class="flex justify-between items-center mb-8 px-2">
          <h2 class="text-[15px] font-bold text-[#1e293b] flex items-center gap-2 tracking-tight">
            <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4"/>
            </svg>
            ANALYSE HISTORIQUE
          </h2>
          
          <div class="flex bg-[#f1f3f9] p-1 rounded-full border border-slate-100 shadow-inner">
            <button (click)="setPeriod('day')" [class.bg-white]="period() === 'day'" [class.text-purple-600]="period() === 'day'"
                    class="px-5 py-1.5 rounded-full text-[10px] font-bold transition-all text-slate-400">JOUR</button>
            <button (click)="setPeriod('week')" [class.bg-white]="period() === 'week'" [class.text-purple-600]="period() === 'week'"
                    class="px-5 py-1.5 rounded-full text-[10px] font-bold transition-all text-slate-400 mx-1">SEMAINE</button>
            <button (click)="setPeriod('month')" [class.bg-white]="period() === 'month'" [class.text-purple-600]="period() === 'month'"
                    class="px-5 py-1.5 rounded-full text-[10px] font-bold transition-all text-slate-400">MOIS</button>
          </div>
        </div>

        <div class="h-[350px] w-full relative">
           <canvas #historyCanvas></canvas>
           <div *ngIf="noData()" class="absolute inset-0 flex items-center justify-center bg-white/80">
             <p class="text-slate-400 font-medium text-sm italic">Collecte des données en cours...</p>
           </div>
        </div>

        <div class="flex justify-center gap-10 mt-8">
          <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-[#3b82f6]"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Puissance (kW)</span></div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-[#f59e0b]"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Tension (V)</span></div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-[#10b981]"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Intensité (A)</span></div>
        </div>
      </div>
    </div>
  `
})
export class ConsumptionChartComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
  @Input() assetId: any;
  @Input() realtimeData: any; 
  @Input() mode: string = 'live'; 

  @ViewChild('realtimeCanvas') realtimeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('historyCanvas') historyCanvas!: ElementRef<HTMLCanvasElement>;

  private http = inject(HttpClient);
  period = signal<string>('day');
  noData = signal<boolean>(false);
  private viewReady = false;
  
  private rtChart: any;
  private histChart: any;
  private refreshInterval: any;

  ngOnInit() {
    if (this.mode === 'history') {
      this.refreshInterval = setInterval(() => { if (this.assetId) this.fetchHistory(); }, 30000);
    }
  }

  ngAfterViewInit() {
    this.viewReady = true;
    if (this.mode === 'history' && this.assetId) {
      this.fetchHistory();
    }
  }

  ngOnDestroy() { 
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.rtChart) this.rtChart.destroy();
    if (this.histChart) this.histChart.destroy();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['assetId'] && this.assetId && this.mode === 'history' && this.viewReady) {
      this.fetchHistory();
    }
    if (changes['realtimeData'] && this.realtimeData && this.mode === 'live') this.updateRealtimeChart();
  }

  setPeriod(p: string) {
    this.period.set(p);
    this.fetchHistory();
  }

  private updateRealtimeChart() {
    if (!this.realtimeCanvas || !this.realtimeData) return;
    if (!this.rtChart) this.initRealtimeChart();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.rtChart.data.labels.push(time);
    this.rtChart.data.datasets[0].data.push(parseFloat(this.realtimeData.TKW || 0));
    this.rtChart.data.datasets[1].data.push(parseFloat(this.realtimeData.V1N || 0));
    this.rtChart.data.datasets[2].data.push(parseFloat(this.realtimeData.I1 || 0));
    if (this.rtChart.data.labels.length > 20) {
      this.rtChart.data.labels.shift();
      this.rtChart.data.datasets.forEach((d: any) => d.data.shift());
    }
    this.rtChart.update('none');
  }

  private initRealtimeChart() {
    this.rtChart = new Chart(this.realtimeCanvas.nativeElement, {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'Puissance', data: [], borderColor: '#3b82f6', borderWidth: 1.5, tension: 0.4, pointRadius: 0, yAxisID: 'y' },
        { label: 'Tension', data: [], borderColor: '#f59e0b', borderWidth: 1.5, tension: 0.4, pointRadius: 0, yAxisID: 'yV', fill: true, backgroundColor: 'rgba(245, 158, 11, 0.02)' },
        { label: 'Intensité', data: [], borderColor: '#10b981', borderWidth: 1.5, tension: 0.4, pointRadius: 0, yAxisID: 'y' }
      ]},
      options: this.getChartOptions()
    });
  }

  fetchHistory() {
    if (!this.assetId) {
      this.noData.set(true);
      return;
    }

    const token = localStorage.getItem('auth_token');
    this.noData.set(true);
    this.http.get<any[]>(`http://localhost:3000/measurements/history/${this.assetId}?period=${this.period()}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res: any[]) => {
        if (res && res.length > 0) {
          this.noData.set(false);
          this.initHistoryChart(res);
        } else {
          this.noData.set(true);
        }
      },
      error: () => {
        this.noData.set(true);
      }
    });
  }

  private initHistoryChart(data: any[]) {
    if (!this.historyCanvas) return;
    const labels = data.map(d => {
      const date = new Date(d.time);
      return this.period() === 'day' ? `${date.getHours()}h` : `${date.getDate()}/${date.getMonth() + 1}`;
    });

    if (this.histChart) this.histChart.destroy();
    this.histChart = new Chart(this.historyCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Puissance', data: data.map(d => d.avgpower), borderColor: '#3b82f6', borderWidth: 2, tension: 0.4, yAxisID: 'y', pointRadius: 0 },
          { label: 'Tension', data: data.map(d => d.avgvoltage), borderColor: '#f59e0b', borderWidth: 2, tension: 0.4, yAxisID: 'yV', fill: true, backgroundColor: 'rgba(245, 158, 11, 0.04)', pointRadius: 0 },
          { label: 'Intensité', data: data.map(d => d.avgcurrent), borderColor: '#10b981', borderWidth: 2, tension: 0.4, yAxisID: 'y', pointRadius: 0 }
        ]
      },
      options: this.getChartOptions()
    });
  }

  // --- CONFIGURATION DU TOOLTIP (MISE À JOUR STYLE CAPTURE 2) ---
  private getChartOptions(): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#ffffff',
          titleColor: '#1e293b',
          titleFont: { size: 14, weight: 'bold' as const },
          bodyFont: { size: 13, weight: '500' },
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 15,
          cornerRadius: 12,
          displayColors: false, // On cache les carrés pour utiliser le texte coloré
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y !== null ? context.parsed.y.toFixed(2) : '0.00';
              
              // Ajout des unités dynamiquement selon le label
              let unit = '';
              if (label.includes('Intensité')) unit = '(A)';
              if (label.includes('Puissance')) unit = '(kW)';
              if (label.includes('Tension')) unit = '(V)';
              
              return `${label} ${unit} : ${value}`;
            },
            // Logique de couleur du texte par ligne
            labelTextColor: (context: any) => {
              const label = context.dataset.label || '';
              if (label.includes('Intensité')) return '#10b981'; // Vert
              if (label.includes('Puissance')) return '#3b82f6'; // Bleu
              if (label.includes('Tension')) return '#f59e0b';   // Orange
              return '#1e293b';
            }
          }
        }
      },
      scales: {
        y: { type: 'linear' as const, position: 'left' as const, min: 0, max: 600, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
        yV: { type: 'linear' as const, position: 'right' as const, min: 50, max: 600, grid: { display: false }, ticks: { font: { size: 10 }, color: '#f59e0b' } },
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } }
      }
    };
  }
}
