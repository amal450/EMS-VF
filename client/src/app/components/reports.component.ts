import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Chart from 'chart.js/auto';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full p-10 bg-[#f8fafc] overflow-y-auto custom-scrollbar">
      
      <!-- PDF GENERATION LOADER OVERLAY -->
      <div *ngIf="isGeneratingPDF()" class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-4">
          <div class="w-16 h-16 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin"></div>
          <p class="text-lg font-bold text-slate-700">{{ languageService.translate('generatingPdf') || 'Génération du PDF...' }}</p>
          <p class="text-sm text-slate-500">{{ languageService.translate('pleaseWait') || 'Veuillez patienter' }}</p>
        </div>
      </div>
      
      <!-- HEADER -->
      <div class="mb-10 flex justify-between items-end">
        <div>
          <h1 class="text-4xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent tracking-tight mb-2 uppercase">
            {{ languageService.translate('reportsTitle') }}
          </h1>
          <p class="text-slate-500 font-medium italic text-sm">{{ languageService.translate('reportsSubtitle') }}</p>
        </div>
        
        <div class="bg-white rounded-2xl px-6 py-3 border-2 border-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.1)] flex items-center gap-3">
          <span class="text-emerald-500 text-xl"></span>
          <span class="text-xs font-black text-slate-700 uppercase tracking-widest">{{ languageService.translate('reportsReady') }}</span>
        </div>
      </div>

      <div class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div class="flex flex-wrap items-center gap-3">
          <label class="text-slate-500 text-[11px] uppercase tracking-[0.2em] font-black">{{ languageService.translate('fromLabel') }}</label>
          <input type="date" class="px-3 py-2 rounded-full border border-cyan-400/30 bg-white/70 text-slate-700 font-black outline-none shadow-[0_0_24px_rgba(56,189,248,0.16)] ring-1 ring-cyan-400/20 transition-all duration-200 focus:ring-2 focus:ring-cyan-300/30" [value]="reportStartDate()" (change)="reportStartDate.set($any($event.target).value)" />
          <label class="text-slate-500 text-[11px] uppercase tracking-[0.2em] font-black">{{ languageService.translate('toLabel') }}</label>
          <input type="date" class="px-3 py-2 rounded-full border border-cyan-400/30 bg-white/70 text-slate-700 font-black outline-none shadow-[0_0_24px_rgba(56,189,248,0.16)] ring-1 ring-cyan-400/20 transition-all duration-200 focus:ring-2 focus:ring-cyan-300/30" [value]="reportEndDate()" (change)="reportEndDate.set($any($event.target).value)" />
        </div>
        <div class="flex flex-col gap-3 items-start md:items-end">
          <button (click)="loadReportDateRange()" class="px-6 py-3 rounded-xl font-black uppercase tracking-[0.2em] transition-all border-2 border-sky-200 bg-sky-500/5 text-sky-600 shadow-sm hover:bg-sky-600 hover:text-white">{{ languageService.translate('refresh') }}</button>
        </div>
      </div>

      <!-- GRAND CONTENEUR LUMINEUX -->
      <div class="relative bg-white/75 backdrop-blur-sm rounded-[2.5rem] border border-white/70 p-12 shadow-[0_0_80px_rgba(59,130,246,0.18)] overflow-hidden">
        <div class="pointer-events-none absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-cyan-200/30 via-sky-100/20 to-purple-200/20 blur-3xl"></div>
        <div class="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          <!-- CARTES DE RAPPORTS - Include SITE now -->
          <div *ngFor="let asset of assets()" 
               class="bg-white rounded-[2rem] p-6 border-2 transition-all hover:scale-[1.02] hover:shadow-xl flex flex-col justify-between min-h-[280px]"
               [class.border-sky-100]="asset.type === 'SITE'" [class.shadow-[0_0_25px_rgba(14,165,233,0.15)]]="asset.type === 'SITE'"
               [class.border-purple-100]="asset.type === 'TGBT'" [class.shadow-[0_0_25px_rgba(168,85,247,0.1)]]="asset.type === 'TGBT'"
               [class.border-orange-100]="asset.type === 'ARMOIRE'" [class.shadow-[0_0_25px_rgba(245,158,11,0.1)]]="asset.type === 'ARMOIRE'"
               [class.border-emerald-100]="asset.type === 'LIGNE'" [class.shadow-[0_0_25px_rgba(16,185,129,0.1)]]="asset.type === 'LIGNE'"
               [class.border-pink-100]="asset.type === 'EQUIPEMENT'" [class.shadow-[0_0_25px_rgba(244,114,182,0.1)]]="asset.type === 'EQUIPEMENT'">
            
            <div>
              <div class="flex justify-between items-start mb-4">
                <!-- ICONS -->
                <div class="w-10 h-10 rounded-xl bg-white shadow-md border border-slate-50 flex items-center justify-center">
                   <svg *ngIf="asset.type === 'SITE'" class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                   <svg *ngIf="asset.type === 'TGBT'" class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                   <svg *ngIf="asset.type === 'ARMOIRE'" class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                   <svg *ngIf="asset.type === 'LIGNE'" class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                   <svg *ngIf="asset.type === 'EQUIPEMENT'" class="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
                </div>

                <span [class]="'px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.12em] ' + 
                      (asset.type === 'SITE' ? 'bg-sky-50 text-sky-600' : 
                       asset.type === 'TGBT' ? 'bg-purple-50 text-purple-600' : 
                       asset.type === 'ARMOIRE' ? 'bg-orange-50 text-orange-500' : 
                       asset.type === 'LIGNE' ? 'bg-emerald-50 text-emerald-500' : 'bg-pink-50 text-pink-500')">
                  {{ languageService.translateAssetType(asset.type) }}
                </span>
              </div>

              <h3 class="text-xl font-black text-slate-800 mb-4 tracking-tight uppercase">{{ asset.name }}</h3>
              
              <ul class="space-y-2 mb-6">
                <li class="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                   <span class="w-1 h-1 rounded-full bg-blue-500"></span> {{ languageService.translate('analysisVoltageCurrent') }}
                </li>
                <li class="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                   <span class="w-1 h-1 rounded-full bg-blue-500"></span> {{ languageService.translate('powerSummary') }}
                </li>
                <li class="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                   <span class="w-1 h-1 rounded-full bg-blue-500"></span> {{ languageService.translate('gridStability') }}
                </li>
              </ul>
            </div>
            
<!-- BOUTONS EXPORTER -->
            <div class="flex gap-2">
              <button (click)="downloadPDF(asset.id, asset.name)" class="flex-1 py-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all border-2 shadow-sm flex items-center justify-center gap-1 bg-sky-500/5 text-sky-600 border-sky-200 hover:bg-sky-600 hover:text-white">
                 {{ languageService.translate('exportPdf') }}
              </button>
              <button (click)="downloadCSV(asset.id, asset.name)" class="flex-1 py-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all border-2 shadow-sm flex items-center justify-center gap-1 bg-purple-500/5 text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white">
                 {{ languageService.translate('exportCsv') }}
              </button>
            </div>
          </div>
        </div>

        <div *ngIf="assets().length === 0" class="p-20 text-center text-slate-300 font-bold italic">
            {{ languageService.translate('loadingIndustryAssets') }}
        </div>
      </div>
    </div>
  `
})
export class ReportsComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  public languageService = inject(LanguageService);
  assets = signal<any[]>([]);
  reportStartDate = signal<string>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  reportEndDate = signal<string>(new Date().toISOString().slice(0, 10));
  isGeneratingPDF = signal<boolean>(false);



  ngOnInit() {
    const token = this.auth.getToken();
    this.http.get<any[]>('http://localhost:3000/assets/tree', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(res => {
      const list: any[] = [];
      const flatten = (items: any[]) => {
        items.forEach(i => {
          list.push(i);
          if (i.children && i.children.length > 0) flatten(i.children);
        });
      };
      if (res) {
        flatten(res);
        // Include SITE now
        this.assets.set(list);
      }
    });
  }

  downloadCSV(id: number, name: string) {
    const token = this.auth.getToken();
    if (!token) return;
    const params = new URLSearchParams({
      startDate: this.reportStartDate(),
      endDate: this.reportEndDate(),
      lang: this.languageService.language()
    }).toString();

    this.http.get(`http://localhost:3000/measurements/report/${id}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'text'
    }).subscribe({
      next: (csvData: string) => {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.languageService.translate('reportFilePrefix')}_${name.replace(/\s+/g, '_')}_${this.reportStartDate()}_${this.reportEndDate()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading CSV:', err);
      }
    });
  }

  loadReportDateRange() {
    // Cette méthode est prête pour un futur aperçu de rapport.
    console.log('Intervalle rapport sélectionné', this.reportStartDate(), this.reportEndDate());
  }

  downloadPDF(id: number, name: string) {
    (async () => {
      const token = this.auth.getToken();
      if (!token) return;

      this.isGeneratingPDF.set(true);

      try {
        // 1) Fetch history data for charts
        const period = 'month';
        let history: any[] = [];
        try {
          const historyRes: any[] | undefined = await firstValueFrom(this.http.get<any[]>(`http://localhost:3000/measurements/history/${id}?period=${period}`, {
            headers: { Authorization: `Bearer ${token}` }
          }));
          history = historyRes || [];
        } catch (e) {
          console.warn('Could not fetch history data, proceeding without images:', e);
          history = [];
        }

        const renderChart = async (cfg: any) => {
          const canvas: HTMLCanvasElement = document.createElement('canvas');
          canvas.width = 900;
          canvas.height = 300;
          canvas.style.position = 'fixed';
          canvas.style.left = '-9999px';
          document.body.appendChild(canvas);
          const chart = new Chart(canvas, cfg);
          await new Promise(resolve => setTimeout(resolve, 50));
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          chart.destroy();
          document.body.removeChild(canvas);
          return dataUrl;
        };

        const labels = history.map(d => {
          const date = new Date(d.time);
          return `${date.getDate()}/${date.getMonth() + 1}`;
        });
        const powerData = history.map(d => d.avgpower || 0);
        const voltageData = history.map(d => d.avgvoltage || 0);
        const currentData = history.map(d => d.avgcurrent || 0);

        const chartsToRender = [
          { type: 'line', data: { labels, datasets: [{ label: 'Power (kW)', data: powerData, borderColor: '#3b82f6', borderWidth: 2, pointRadius: 0 }] }, options: { responsive: false, animation: false, plugins: { legend: { display: false } } } },
          { type: 'line', data: { labels, datasets: [{ label: 'Voltage (V)', data: voltageData, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0 }] }, options: { responsive: false, animation: false, plugins: { legend: { display: false } } } },
          { type: 'line', data: { labels, datasets: [{ label: 'Current (A)', data: currentData, borderColor: '#10b981', borderWidth: 2, pointRadius: 0 }] }, options: { responsive: false, animation: false, plugins: { legend: { display: false } } } },
          { type: 'line', data: { labels, datasets: [
            { label: 'Power (kW)', data: powerData, borderColor: '#3b82f6', borderWidth: 1.5, pointRadius: 0 },
            { label: 'Voltage (V)', data: voltageData, borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: 'rgba(245,158,11,0.04)' },
            { label: 'Current (A)', data: currentData, borderColor: '#10b981', borderWidth: 1.5, pointRadius: 0 }
          ] }, options: { responsive: false, animation: false, plugins: { legend: { display: false } } } }
        ];

        const images: string[] = [];
        for (const cfg of chartsToRender) {
          try {
            const img = await renderChart(cfg);
            images.push(img);
          } catch (err) {
            console.error('Chart render failed', err);
            images.push('');
          }
        }

        const payload = {
          startDate: this.reportStartDate(),
          endDate: this.reportEndDate(),
          lang: this.languageService.language(),
          images
        };

        console.log('Requesting report PDF via POST', { assetId: id, startDate: this.reportStartDate(), endDate: this.reportEndDate() });
        const pdfBlob: Blob = await firstValueFrom(this.http.post(`http://localhost:3000/measurements/report/${id}/pdf`, payload, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          responseType: 'blob' as const
        }));

        if (!pdfBlob || pdfBlob.size === 0) {
          console.error('Received empty PDF blob for report', { assetId: id });
        }

        const rawFileName = `${this.languageService.translate('reportFilePrefix')}_${name.replace(/\s+/g, '_')}_${this.reportStartDate()}_${this.reportEndDate()}.pdf`;
        const fileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);

      } catch (err) {
        console.error('Error generating report PDF with charts:', err);
      } finally {
        this.isGeneratingPDF.set(false);
      }
    })();
  }


}
