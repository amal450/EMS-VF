import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full p-10 bg-[#f8fafc] overflow-y-auto custom-scrollbar">
      
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
          <input type="date" class="px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700 font-bold outline-none" [value]="reportStartDate()" (change)="reportStartDate.set($any($event.target).value)" />
          <label class="text-slate-500 text-[11px] uppercase tracking-[0.2em] font-black">{{ languageService.translate('toLabel') }}</label>
          <input type="date" class="px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700 font-bold outline-none" [value]="reportEndDate()" (change)="reportEndDate.set($any($event.target).value)" />
        </div>
        <div class="flex flex-col gap-3 items-start md:items-end">
          <button (click)="loadReportDateRange()" class="px-6 py-3 rounded-full bg-sky-500 text-white font-black uppercase tracking-[0.2em] hover:bg-sky-600 transition">{{ languageService.translate('refresh') }}</button>
        </div>
      </div>

      <!-- GRAND CONTENEUR LUMINEUX -->
      <div class="bg-white/70 backdrop-blur-sm rounded-[2.5rem] shadow-[0_0_60px_rgba(59,130,246,0.1)] border border-white p-12">
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
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
    const token = this.auth.getToken();
    if (!token) return;
    const params = new URLSearchParams({
      startDate: this.reportStartDate(),
      endDate: this.reportEndDate(),
      format: 'pdf',
      lang: this.languageService.language(),
      ts: Date.now().toString()
    }).toString();

    // Fetch HTML content and download as PDF (HTML file that can be printed to PDF)
    this.http.get(`http://localhost:3000/measurements/report/${id}?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      responseType: 'text'
    }).subscribe({
      next: (htmlContent: string) => {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.languageService.translate('reportFilePrefix')}_${name.replace(/\s+/g, '_')}_${this.reportStartDate()}_${this.reportEndDate()}.pdf.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading PDF:', err);
      }
    });
  }
}
