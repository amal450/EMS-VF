import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { AssetStateService } from '../services/asset-state.service';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full p-10 bg-[#f8fafc] overflow-y-auto custom-scrollbar">
      
      <!-- HEADER : TITRE DÉGRADÉ ET BOUTONS PILLS -->
      <div class="mb-10 flex justify-between items-center px-4">
        <div>
          <h1 class="text-4xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent tracking-tight mb-2 uppercase">
            Facture : {{ assetName() }}
          </h1>
          <p class="text-slate-400 font-bold italic text-sm uppercase tracking-widest">Récapitulatif financier mensuel</p>
        </div>
        
        <div class="flex items-center gap-3 no-print whitespace-nowrap">
          <div class="flex items-center gap-2 text-slate-500 text-[11px] uppercase tracking-[0.2em] font-black">
            <span>Mois</span>
            <select class="px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700 font-bold outline-none" [value]="selectedMonth()" (change)="selectedMonth.set(toNumber($any($event.target).value)); loadBillingData();">
              <option *ngFor="let month of months" [value]="month.value">{{ month.label }}</option>
            </select>
          </div>
          <div class="flex items-center gap-2 text-slate-500 text-[11px] uppercase tracking-[0.2em] font-black">
            <span>Année</span>
            <input type="number" min="2000" max="2100" class="w-24 px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700 font-bold outline-none" [value]="selectedYear()" (input)="selectedYear.set(toNumber($any($event.target).value)); loadBillingData();" />
          </div>
          <button (click)="loadBillingData()" 
                  class="px-8 py-3 bg-cyan-500/10 text-cyan-600 border-2 border-cyan-500/20 rounded-full font-black text-[12px] uppercase shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:bg-cyan-500 hover:text-white transition-all flex items-center gap-2">
            <span>🔄</span> Recalculer
          </button>
          <button (click)="downloadPDF()" 
                  class="px-8 py-3 bg-purple-500/10 text-purple-600 border-2 border-purple-500/20 rounded-full font-black text-[12px] uppercase shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:bg-purple-600 hover:text-white transition-all flex items-center gap-2">
            <span>📥</span> Télécharger PDF
          </button>
        </div>
      </div>

      <!-- GRAND CADRE AVEC EFFET LUMIÈRE (Glow) -->
      <div class="max-w-5xl mx-auto bg-white/40 backdrop-blur-md rounded-[3rem] shadow-[0_0_80px_rgba(59,130,246,0.12)] border border-white p-10 mb-12">
        
        <div class="overflow-hidden rounded-[2rem] border border-white shadow-sm bg-white/30">
          <table class="w-full text-left border-collapse">
            <thead>
              <!-- CAPTURE 1 : EN-TÊTE TRANSPARENT ET DÉGRADÉ -->
              <tr class="bg-gradient-to-r from-cyan-400/80 to-purple-500/80 backdrop-blur-md text-white">
                <th class="p-5 px-10 text-[10px] uppercase tracking-[0.25em] font-black italic">Désignation / Libellé</th>
                <th class="p-5 text-[10px] uppercase tracking-[0.25em] font-black text-center italic">Consommation</th>
                <th class="p-5 text-[10px] uppercase tracking-[0.25em] font-black text-center italic">P.U (DT)</th>
                <th class="p-5 px-10 text-[10px] uppercase tracking-[0.25em] font-black text-right italic">Montant (DT)</th>
              </tr>
            </thead>
            <tbody class="text-slate-600">
              
              <!-- CAPTURE 4 : ÉNERGIE ACTIVE (VERT SUPPRIMÉ -> STYLE ÉPURÉ) -->
              <tr class="bg-white/60 border-l-[12px] border-emerald-400/50">
                <td class="p-6 px-8 font-black uppercase text-[12px] text-emerald-600 tracking-wider">Énergie Active (kWh)</td>
                <!-- CHIFFRES STYLE PROFESSIONNEL MONO -->
                <td class="p-6 text-center font-mono font-black text-[#1e293b] text-xl">{{ bill().activeEnergy | number:'1.2-2' }}</td>
                <td class="p-6 text-center text-slate-300">-</td>
                <td class="p-6 px-10 text-right font-mono font-black text-[#1e293b] text-xl">{{ calculateEnergyHT() | number:'1.3-3' }}</td>
              </tr>

              <!-- Lignes de Détails -->
              <tr class="border-b border-white/50">
                <td class="p-4 px-14 text-[11px] font-bold text-slate-400 uppercase italic">Consommation Jour</td>
                <td class="p-4 text-center font-mono font-bold text-slate-600">{{ (bill().activeEnergy * 0.4) | number:'1.2-2' }}</td>
                <td class="p-4 text-center font-mono text-slate-400 text-xs">0.290</td>
                <td class="p-4 px-10 text-right font-mono font-bold text-slate-600">{{ (bill().activeEnergy * 0.4 * 0.29) | number:'1.3-3' }}</td>
              </tr>
              <tr class="border-b border-white/50">
                <td class="p-4 px-14 text-[11px] font-bold text-blue-400/80 uppercase italic">Pointe (Matin & Soir)</td>
                <td class="p-4 text-center font-mono font-black text-blue-700/70">{{ (bill().activeEnergy * 0.2) | number:'1.2-2' }}</td>
                <td class="p-4 text-center font-mono font-bold text-blue-300 text-xs">0.417</td>
                <td class="p-4 px-10 text-right font-mono font-black text-blue-700/70">{{ (bill().activeEnergy * 0.2 * 0.417) | number:'1.3-3' }}</td>
              </tr>
              <tr class="border-b border-white/50">
                <td class="p-4 px-14 text-[11px] font-bold text-slate-400 uppercase italic">Consommation Nuit</td>
                <td class="p-4 text-center font-mono font-bold text-slate-600">{{ (bill().activeEnergy * 0.4) | number:'1.2-2' }}</td>
                <td class="p-4 text-center font-mono text-slate-400 text-xs">0.222</td>
                <td class="p-4 px-10 text-right font-mono font-bold text-slate-600">{{ (bill().activeEnergy * 0.4 * 0.222) | number:'1.3-3' }}</td>
              </tr>

              <!-- Redevance -->
              <tr class="border-b border-white/50 bg-slate-50/30">
                <td class="p-6 px-8 font-black text-slate-400 text-[11px] uppercase tracking-widest">Redevance Puissance</td>
                <td class="p-6 text-center text-[10px] text-slate-300 font-bold uppercase italic">Forfait Annuel</td>
                <td class="p-6 text-center font-mono font-bold text-slate-400 text-xs">11.000</td>
                <td class="p-6 px-10 text-right font-mono font-black text-[#1e293b] text-lg">{{ bill().primePuissance | number:'1.3-3' }}</td>
              </tr>

              <!-- TVA -->
              <tr class="bg-red-50/5 border-b border-white/50">
                <td colspan="3" class="p-5 px-8 font-black text-[11px] text-slate-300 uppercase tracking-widest">TVA sur Consommation (19%)</td>
                <td class="p-5 px-10 text-right font-mono font-black text-red-400/80 text-lg">{{ calculateTVA() | number:'1.3-3' }}</td>
              </tr>

              <!-- CAPTURE 2 : TOTAL AVEC DÉGRADÉ ET TRANSPARENCE -->
              <tr class="bg-gradient-to-r from-cyan-400/90 to-purple-600/90 text-white shadow-2xl">
                <td colspan="3" class="p-6 px-10 text-xl font-black uppercase tracking-[0.4em] italic">Total Net TTC</td>
                <td class="p-6 px-10 text-right">
                  <span class="text-4xl font-mono font-black italic tracking-tighter">{{ calculateTotal() | number:'1.3-3' }}</span>
                  <small class="text-[10px] uppercase font-bold ml-2 opacity-70 italic">DT</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-8 flex justify-between items-center opacity-30 px-4">
          <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Volt EMS Intelligence v2.0</p>
          <div class="w-24 h-px bg-slate-400"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    @media print {
      /* Hide everything by default */
      * { visibility: hidden; }
      
      /* Show only the invoice frame and its contents */
      :host, :host * { visibility: visible; }
      
      :host { 
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        background: white !important; 
        z-index: 9999;
        margin: 0;
        padding: 0;
      }
      
      /* Hide header and buttons */
      .mb-10, .mb-12 { display: none !important; }
      
      /* Style the invoice frame */
      .max-w-5xl { 
        max-width: 100% !important; 
        margin: 0 !important;
        padding: 0 !important;
      }
      
      .bg-white\\/40, .bg-white\\/30 {
        background: white !important; 
        border: 2px solid #333 !important; 
        backdrop-filter: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding: 20px !important;
      }
      
      /* Ensure table is visible */
      table, thead, tbody, tr, th, td { 
        visibility: visible !important;
      }
      
      thead tr {
        background: #333 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      tr { 
        background: white !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      tr.bg-white\\/60 {
        background: #f0f0f0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      body { 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
    }
  `]
})
export class BillingComponent implements OnInit {
  private http = inject(HttpClient);
  public authService = inject(AuthService);
  private assetService = inject(AssetStateService);
  window = window;

  assetName = signal<string>('Équipement');
  bill = signal<any>({ 
    activeEnergy: 0, 
    rateJour: 0.290, 
    ratePointeMatin: 0.417, 
    rateSoir: 0.377, 
    rateNuit: 0.222, 
    primePuissance: 22000.000 
  });
  selectedMonth = signal<number>(new Date().getMonth() + 1);
  selectedYear = signal<number>(new Date().getFullYear());
  months = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' }
  ];
  years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  ngOnInit() {
    this.loadBillingData();
  }

  loadBillingData() {
    const selected = this.assetService.selectedAsset();
    const id = selected ? selected.id : 3; 
    this.assetName.set(selected ? selected.name : 'TGBT Principal');

    const token = this.authService.getToken();
    if (!token) return;

    const month = this.selectedMonth();
    const year = this.selectedYear();
    const url = `http://localhost:3000/measurements/billing/${id}?month=${month}&year=${year}`;

    this.http.get<any>(url, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(res => {
      if (res) this.bill.set(res);
    });
  }

  calculateEnergyHT() {
    const b = this.bill();
    return (b.activeEnergy * 0.4 * b.rateJour) + 
           (b.activeEnergy * 0.2 * b.ratePointeMatin) + 
           (b.activeEnergy * 0.4 * b.rateNuit);
  }

  calculateTVA() {
    return (this.calculateEnergyHT() + this.bill().primePuissance) * (this.bill().tva || 0.19);
  }

  toNumber(value: any) {
    return Number(value);
  }

  calculateTotal() {
    return this.calculateEnergyHT() + this.bill().primePuissance + this.calculateTVA();
  }

  downloadPDF() {
    const b = this.bill();
    const name = this.assetName();
    const month = this.selectedMonth();
    const year = this.selectedYear();
    const monthLabel = this.months.find(m => m.value === month)?.label || String(month);
    
    // Generate HTML content for the invoice
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Facture - ${name} ${monthLabel} ${year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: white; }
    .invoice-box { max-width: 800px; margin: 0 auto; padding: 40px; border: 2px solid #333; border-radius: 10px; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0ea5e9; }
    .header h1 { font-size: 32px; color: #0ea5e9; margin-bottom: 10px; }
    .header p { color: #64748b; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
    th { background: #333; color: white; padding: 12px; text-align: left; font-weight: 700; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
    td { padding: 10px; border: 1px solid #ddd; }
    td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: center; }
    tr:nth-child(even) { background: #f8fafc; }
    .total-row { background: #0ea5e9 !important; color: white; font-weight: 700; }
    .total-row td { border: none; }
    .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="invoice-box">
    <div class="header">
      <h1>⚡ FACTURE</h1>
      <p>Équipement: ${name}</p>
      <p>Période : ${monthLabel} ${year}</p>
      <p>Date d'émission : ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Désignation / Libellé</th>
          <th>Consommation</th>
          <th>P.U (DT)</th>
          <th>Montant (DT)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Énergie Active (kWh)</strong></td>
          <td>${b.activeEnergy?.toFixed(2) || '0.00'}</td>
          <td>-</td>
          <td>${this.calculateEnergyHT().toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">Consommation Jour</td>
          <td>${(b.activeEnergy * 0.4).toFixed(2)}</td>
          <td>0.290</td>
          <td>${(b.activeEnergy * 0.4 * 0.29).toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">Pointe (Matin & Soir)</td>
          <td>${(b.activeEnergy * 0.2).toFixed(2)}</td>
          <td>0.417</td>
          <td>${(b.activeEnergy * 0.2 * 0.417).toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">Consommation Nuit</td>
          <td>${(b.activeEnergy * 0.4).toFixed(2)}</td>
          <td>0.222</td>
          <td>${(b.activeEnergy * 0.4 * 0.222).toFixed(3)}</td>
        </tr>
        <tr>
          <td><strong>Prime Puissance (DT)</strong></td>
          <td>-</td>
          <td>-</td>
          <td>${b.primePuissance?.toFixed(3) || '0.000'}</td>
        </tr>
        <tr>
          <td><strong>TVA (19%)</strong></td>
          <td>-</td>
          <td>-</td>
          <td>${this.calculateTVA().toFixed(3)}</td>
        </tr>
        <tr class="total-row">
          <td><strong>TOTAL TTC</strong></td>
          <td>-</td>
          <td>-</td>
          <td><strong>${this.calculateTotal().toFixed(3)} DT</strong></td>
        </tr>
      </tbody>
    </table>
    
    <div class="footer">
      <p>Document généré par le système EMS - Energy Management System</p>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Facture_${name.replace(/\s+/g, '_')}_${monthLabel}_${year}_${new Date().toISOString().slice(0,10)}.pdf.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
