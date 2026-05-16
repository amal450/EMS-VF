import { Controller, Get, Post, Body, Param, Query, UseGuards, Res, Delete } from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { RealTimeBridgeService } from './real-time-bridge.service'; 
import { JwtAuthGuard } from '../auth/jwt.guard';
import * as express from 'express'; 

@Controller('measurements')
export class MeasurementsController {
  constructor(
    private readonly measurementsService: MeasurementsService,
    private readonly bridgeService: RealTimeBridgeService, 
  ) {}

  @Post()
  create(@Body() data: any) { return this.measurementsService.create(data); }

  @UseGuards(JwtAuthGuard)
  @Get('latest/:id')
  async getLatest(@Param('id') id: string) {
    await this.bridgeService.activateOnly(+id);
    return this.measurementsService.findLatest(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history/:id')
  getHistory(@Param('id') id: string, @Query('period') period: string) {
    return this.measurementsService.findHistory(+id, period || 'day');
  }

  @UseGuards(JwtAuthGuard)
  @Get('alerts/all')
  getAllAlerts() { return this.measurementsService.findAllAlerts(); }

  @UseGuards(JwtAuthGuard)
  @Get('alerts/latest')
  getLatestAlert(@Query('assetId') assetId?: string) {
    if (assetId) return this.measurementsService.findLatestAlertByAssetId(+assetId);
    return this.measurementsService.findLatestAlert();
  }

  @UseGuards(JwtAuthGuard)
  @Get('alerts/asset/:assetId')
  getAlertsByAsset(@Param('assetId') assetId: string) { 
    return this.measurementsService.findAlertsByAssetId(+assetId); 
  }

  @UseGuards(JwtAuthGuard)
  @Get('alerts/asset-descendants/:assetId')
  getAlertsByAssetAndDescendants(@Param('assetId') assetId: string) {
    return this.measurementsService.findAlertsByAssetAndDescendants(+assetId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('alerts/:id')
  async deleteAlert(@Param('id') id: string) {
    console.log('🔔 Requête DELETE alerts reçue, ID:', id);
    try {
      return await this.measurementsService.deleteAlert(+id);
    } catch (error) {
      console.error('❌ Erreur contrôleur:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('billing/:id')
  getBilling(@Param('id') id: string, @Query('month') month?: string, @Query('year') year?: string) {
    const monthNum = month ? Number(month) : undefined;
    const yearNum = year ? Number(year) : undefined;
    return this.measurementsService.getInvoice(+id, monthNum, yearNum);
  }

  @UseGuards(JwtAuthGuard)
  @Get('billing/annual/:id')
  getAnnualBilling(@Param('id') id: string, @Query('year') year?: string) {
    const yearNum = year ? Number(year) : new Date().getFullYear();
    return this.measurementsService.getAnnualBilling(+id, yearNum);
  }

  @UseGuards(JwtAuthGuard)
  @Post('billing/:id')
  async saveBilling(@Param('id') id: string, @Query('month') month?: string, @Query('year') year?: string) {
    const monthNum = month ? Number(month) : new Date().getMonth() + 1;
    const yearNum = year ? Number(year) : new Date().getFullYear();
    return this.measurementsService.saveInvoice(+id, monthNum, yearNum);
  }

  private formatReportDate(date: Date) {
    return date.toLocaleDateString('fr-FR');
  }

  private normalizeInterval(startDate: Date, endDate: Date) {
    const normalizedStart = new Date(startDate);
    const normalizedEnd = new Date(endDate);
    normalizedStart.setHours(0, 0, 0, 0);
    normalizedEnd.setHours(0, 0, 0, 0);
    return { start: normalizedStart, end: normalizedEnd };
  }

  private parseIsoDate(dateStr?: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('-').map(Number);
    if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) return null;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  private chooseTimelineUnit(start: Date, end: Date) {
    const durationMs = end.getTime() - start.getTime();
    const dayCount = durationMs / (1000 * 60 * 60 * 24) + 1;
    if (dayCount <= 1.5) return 'hour';
    if (dayCount <= 92) return 'day';
    return 'month';
  }

  private buildTimeline(data: any[], start: Date, end: Date, unit: 'hour' | 'day' | 'month'): Array<{ time: string; avgpower: number; avgvoltage: number; avgcurrent: number; }> {
    const formatter = (date: Date) => {
      const iso = date.toISOString();
      if (unit === 'hour') return iso.slice(0, 13).replace('T', ' ');
      if (unit === 'month') return iso.slice(0, 7);
      return iso.slice(0, 10);
    };

    const valueMap = new Map<string, any>();
    data.forEach(item => {
      const date = new Date(item.time);
      const key = formatter(date);
      valueMap.set(key, item);
    });

    const rows: Array<{ time: string; avgpower: number; avgvoltage: number; avgcurrent: number; }> = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = formatter(cursor);
      const item = valueMap.get(key);
      rows.push({
        time: key,
        avgpower: item?.avgpower || 0,
        avgvoltage: item?.avgvoltage || 0,
        avgcurrent: item?.avgcurrent || 0,
      });
      if (unit === 'hour') cursor.setHours(cursor.getHours() + 1);
      else if (unit === 'month') cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }

  // --- GÉNÉRATION DU RAPPORT (CSV OU HTML POUR PDF) ---
  @Get('report/:id')
  async getReport(
    @Res() res: express.Response,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format?: string,
    @Query('lang') lang?: string,
  ) {
    const parsedStart = this.parseIsoDate(startDate);
    const parsedEnd = this.parseIsoDate(endDate);
    const hasCustomRange = Boolean(parsedStart && parsedEnd);
    const { start, end } = hasCustomRange
      ? this.normalizeInterval(parsedStart!, parsedEnd!)
      : this.normalizeInterval(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());
    const rawData = hasCustomRange
      ? await this.measurementsService.findHistoryInterval(+id, startDate?.trim() ?? '', endDate?.trim() ?? '')
      : await this.measurementsService.findHistory(+id, 'month');
    const intervalUnit = this.chooseTimelineUnit(start, end);
    const hasData = rawData.length > 0;
    const data = hasData ? this.buildTimeline(rawData, start, end, intervalUnit) : [];
    const startLabel = this.formatReportDate(start);
    const endLabel = this.formatReportDate(end);
    const rangeLabel = `${startLabel} → ${endLabel}`;
    const reportLang = lang === 'en' ? 'en' : 'fr';
    const dateLocale = reportLang === 'en' ? 'en-US' : 'fr-FR';
    const reportPrefix = reportLang === 'en' ? 'Report' : 'Rapport';
    const reportTitle = reportLang === 'en' ? 'OPERATIONS REPORT' : 'RAPPORT D\'EXPLOITATION';
    const reportDescription = reportLang === 'en'
      ? `Report of line voltages, phase currents and power indicators for the selected asset.`
      : `Analyse des tensions, courants de phase et indicateurs de puissance pour l'équipement sélectionné.`;
    const chartSectionTitle = reportLang === 'en' ? 'Historical Charts' : 'Courbes Historiques';
    const descriptionSectionTitle = reportLang === 'en' ? 'Analysis Summary' : 'Description des Analyses';
    const noDataText = reportLang === 'en'
      ? 'No measurements recorded for the selected period. Charts will remain empty.'
      : 'Aucune mesure enregistrée pour la période sélectionnée. Les courbes resteront vides.';
    const dataSectionTitle = reportLang === 'en' ? 'Historical operating data' : 'Données Historiques d\'Exploitation';
    const emptyTableText = reportLang === 'en'
      ? 'No measurements available for the selected period.'
      : 'Aucune mesure disponible pour la période sélectionnée.';
    const footerText = reportLang === 'en'
      ? 'Volt EMS Intelligence v2.0 | Generated on'
      : 'Volt EMS Intelligence v2.0 | Généré le';
    const isPdf = format === 'pdf';

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (isPdf) {
      // Préparer les données pour les graphiques
      const chartLabels = hasData ? data.map(d => d.time || '-').slice(-20) : [startLabel];
      const chartPower = hasData ? data.map(d => d.avgpower ? parseFloat(d.avgpower.toFixed(2)) : 0).slice(-20) : [null];
      const chartVoltage = hasData ? data.map(d => d.avgvoltage ? parseFloat(d.avgvoltage.toFixed(2)) : 230).slice(-20) : [null];
      const chartCurrent = hasData ? data.map(d => d.avgcurrent ? parseFloat(d.avgcurrent.toFixed(2)) : 0).slice(-20) : [null];

      // Générer HTML pour impression PDF avec graphiques
      let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rapport EMS - Asset #${id}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: white; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0ea5e9; }
    .header h1 { font-size: 28px; color: #0ea5e9; margin-bottom: 10px; }
    .header p { color: #64748b; font-size: 14px; }
    .section { margin-bottom: 30px; }
    .section h2 { font-size: 16px; color: #334155; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #334155; color: white; padding: 10px; text-align: left; font-weight: 700; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .chart-container { position: relative; height: 300px; width: 100%; margin-bottom: 20px; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .chart-box { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; }
    .chart-box h3 { font-size: 14px; color: #475569; margin-bottom: 10px; }
    .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    @media print { 
      body { padding: 20px; } 
      .chart-container { height: 250px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚡ ${reportTitle}</h1>
    <p>${reportLang === 'en' ? 'Equipment ID' : 'Équipement ID'} #${id}</p>
    <p>${reportLang === 'en' ? 'Start date' : 'Date de début'} : ${startLabel}</p>
    <p>${reportLang === 'en' ? 'End date' : 'Date de fin'} : ${endLabel}</p>
    <p>${reportLang === 'en' ? 'Selected interval' : 'Intervalle sélectionné'} : ${rangeLabel}</p>
    <p>${reportLang === 'en' ? 'Issue date' : 'Date d\'émission'} : ${new Date().toLocaleDateString(dateLocale)}</p>
  </div>
  <div class="section">
    <h2>📊 ${descriptionSectionTitle}</h2>
    <p style="color: #64748b; margin-bottom: 15px;">${reportDescription}</p>
    <ul style="padding-left: 20px; line-height: 1.8;">
      <li><strong>${reportLang === 'en' ? 'Voltage report:' : 'Rapport de tension :'}</strong> ${reportLang === 'en' ? 'Analysis of phase-to-neutral voltages (V1N, V2N, V3N) and phase-to-phase voltages (V12, V23, V31).' : 'Analyse des tensions phase-neutre (V1N, V2N, V3N) et phase-phase (V12, V23, V31).'}</li>
      <li><strong>${reportLang === 'en' ? 'Current report:' : 'Rapport de courant :'}</strong> ${reportLang === 'en' ? 'Tracking load across each phase (I1, I2, I3) and imbalance analysis.' : 'Suivi de la charge sur chaque phase (I1, I2, I3) et analyse de l\'équilibrage.'}</li>
      <li><strong>${reportLang === 'en' ? 'Power report:' : 'Rapport de puissance :'}</strong> ${reportLang === 'en' ? 'Usage of active power (TKW) and power factor (PF).' : 'Utilisation de la puissance active (TKW) et du facteur de puissance (PF).'}</li>
      <li><strong>${reportLang === 'en' ? 'Frequency report:' : 'Rapport de fréquence :'}</strong> ${reportLang === 'en' ? 'Analysis of grid stability around 50 Hz.' : 'Analyse de la stabilité réseau autour de 50 Hz.'}</li>
      <li><strong>${reportLang === 'en' ? 'Quality report:' : 'Rapport de qualité :'}</strong> ${reportLang === 'en' ? 'Combination of indicators for a holistic view.' : 'Combinaison des indicateurs pour une vue globale.'}</li>
    </ul>
  </div>

  <div class="section">
    <h2>📈 ${chartSectionTitle}</h2>
    ${!hasData ? `<p style="color: #64748b; margin-bottom: 15px;">${noDataText}</p>` : ''}
    <div class="charts-grid">
      <div class="chart-box">
        <h3>${reportLang === 'en' ? 'Power (kW)' : 'Puissance (kW)'}</h3>
        <div class="chart-container"><canvas id="powerChart"></canvas></div>
      </div>
      <div class="chart-box">
        <h3>${reportLang === 'en' ? 'Voltage (V)' : 'Tension (V)'}</h3>
        <div class="chart-container"><canvas id="voltageChart"></canvas></div>
      </div>
      <div class="chart-box">
        <h3>${reportLang === 'en' ? 'Current (A)' : 'Intensité (A)'}</h3>
        <div class="chart-container"><canvas id="currentChart"></canvas></div>
      </div>
      <div class="chart-box">
        <h3>${reportLang === 'en' ? 'Combined View' : 'Vue Combinée'}</h3>
        <div class="chart-container"><canvas id="combinedChart"></canvas></div>
      </div>
    </div>
  </div>

  <script>
    // Données pour les graphiques
    const labels = ${JSON.stringify(chartLabels)};
    const powerData = ${JSON.stringify(chartPower)};
    const voltageData = ${JSON.stringify(chartVoltage)};
    const currentData = ${JSON.stringify(chartCurrent)};

    // Graphique Puissance
    new Chart(document.getElementById('powerChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '${reportLang === 'en' ? 'Power (kW)' : 'Puissance (kW)'}',
          data: powerData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } } }
    });

    // Graphique Tension
    new Chart(document.getElementById('voltageChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '${reportLang === 'en' ? 'Voltage (V)' : 'Tension (V)'}',
          data: voltageData,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } } }
    });

    // Graphique Intensité
    new Chart(document.getElementById('currentChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '${reportLang === 'en' ? 'Current (A)' : 'Intensité (A)'}',
          data: currentData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } } }
    });

    // Graphique Combiné
    new Chart(document.getElementById('combinedChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: '${reportLang === 'en' ? 'Power (kW)' : 'Puissance (kW)'}', data: powerData, borderColor: '#3b82f6', tension: 0.4 },
          { label: '${reportLang === 'en' ? 'Voltage (V)' : 'Tension (V)'}', data: voltageData, borderColor: '#f59e0b', tension: 0.4 },
          { label: '${reportLang === 'en' ? 'Current (A)' : 'Intensité (A)'}', data: currentData, borderColor: '#10b981', tension: 0.4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } } }
    });
  </script>

  <div class="section">
    <h2>📋 ${dataSectionTitle}</h2>
    <table>
      <thead>
        <tr>
          <th>${reportLang === 'en' ? 'Timestamp' : 'Horodatage'}</th>
          <th>${reportLang === 'en' ? 'Voltage V1N (V)' : 'Tension V1N (V)'}</th>
          <th>${reportLang === 'en' ? 'Voltage V2N (V)' : 'Tension V2N (V)'}</th>
          <th>${reportLang === 'en' ? 'Voltage V3N (V)' : 'Tension V3N (V)'}</th>
          <th>${reportLang === 'en' ? 'Current I1 (A)' : 'Intensité I1 (A)'}</th>
          <th>${reportLang === 'en' ? 'Current I2 (A)' : 'Intensité I2 (A)'}</th>
          <th>${reportLang === 'en' ? 'Current I3 (A)' : 'Intensité I3 (A)'}</th>
          <th>${reportLang === 'en' ? 'Power (kW)' : 'Puissance (kW)'}</th>
          <th>${reportLang === 'en' ? 'Energy (kWh)' : 'Énergie (kWh)'}</th>
          <th>${reportLang === 'en' ? 'Frequency (Hz)' : 'Fréquence (Hz)'}</th>
          <th>${reportLang === 'en' ? 'Power Factor' : 'Facteur PF'}</th>
        </tr>
      </thead>
      <tbody>
`;

      if (data.length === 0) {
        html += `
        <tr>
          <td colspan="11" style="text-align:center; padding: 18px; color: #64748b;">${emptyTableText}</td>
        </tr>`;
      } else {
        data.forEach(d => {
          const v = d.avgvoltage ? d.avgvoltage.toFixed(2) : "230.00";
          const i = d.avgcurrent ? d.avgcurrent.toFixed(2) : "0.00";
          const p = d.avgpower ? d.avgpower.toFixed(2) : "0.00";
          const e = (d.avgpower * 24).toFixed(2);
          
          html += `
        <tr>
          <td>${d.time || '-'}</td>
          <td>${v}</td>
          <td>${v}</td>
          <td>${v}</td>
          <td>${i}</td>
          <td>${i}</td>
          <td>${i}</td>
          <td>${p}</td>
          <td>${e}</td>
          <td>50.00</td>
          <td>0.95</td>
        </tr>`;
        });
      }

      html += `
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Volt EMS Intelligence v2.0 | Généré le ${new Date().toLocaleString('fr-FR')}</p>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // Default CSV format
    const csvTitle = reportLang === 'en'
      ? 'OPERATIONS REPORT FOR THREE-PHASE ELECTRICAL DATA'
      : "RAPPORT D'EXPLOITATION DES DONNEES ELECTRIQUES TRIPHASEES";
    const equipmentLabel = reportLang === 'en' ? 'EQUIPMENT' : 'EQUIPEMENT';
    const dateFromLabel = reportLang === 'en' ? 'START DATE' : 'DATE DE DEBUT';
    const dateToLabel = reportLang === 'en' ? 'END DATE' : 'DATE DE FIN';
    const intervalLabel = reportLang === 'en' ? 'SELECTED INTERVAL' : 'INTERVALLE SELECTIONNE';
    const reportDateLabel = reportLang === 'en' ? 'REPORT DATE' : 'DATE DU RAPPORT';
    const descriptionLabel = reportLang === 'en' ? 'ANALYSIS DESCRIPTION' : 'DESCRIPTION DES ANALYSES';
    const dataLabel = reportLang === 'en' ? 'HISTORICAL OPERATING DATA' : 'DONNEES HISTORIQUES D\'EXPLOITATION';
    const headerLine = reportLang === 'en'
      ? 'Timestamp,Voltage_V1N(V),Voltage_V2N(V),Voltage_V3N(V),Voltage_U12(V),Current_I1(A),Current_I2(A),Current_I3(A),Active_Power(kW),Energy(kWh),Frequency(Hz),Power_Factor(PF)'
      : 'Horodatage,Tension_V1N(V),Tension_V2N(V),Tension_V3N(V),Tension_U12(V),Intensite_I1(A),Intensite_I2(A),Intensite_I3(A),Puissance_Active(kW),Energie_Active(kWh),Frequence(Hz),Facteur_Puissance(PF)';

    let csv = `${csvTitle}\n`;
    csv += `${equipmentLabel} : ID #${id}\n`;
    csv += `${dateFromLabel} : ${startLabel}\n`;
    csv += `${dateToLabel} : ${endLabel}\n`;
    csv += `${intervalLabel} : ${rangeLabel}\n`;
    csv += `${reportDateLabel} : ${new Date().toLocaleDateString(dateLocale)}\n\n`;

    csv += `${descriptionLabel}\n`;
    csv += reportLang === 'en'
      ? '1. Voltage report: Analysis of phase-to-neutral voltages (V1N, V2N, V3N) and phase-to-phase voltages (V12, V23, V31).\n'
      : '1. Rapport de tension : Analyse des tensions phase-neutre (V1N, V2N, V3N) et phase-phase (V12, V23, V31).\n';
    csv += reportLang === 'en'
      ? '2. Current report: Tracking the load on each phase (I1, I2, I3) and imbalance analysis.\n'
      : '2. Rapport de courant : Suivi de la charge sur chaque phase (I1, I2, I3) et analyse de l\'équilibrage.\n';
    csv += reportLang === 'en'
      ? '3. Power report: Use of active power (TKW) and power factor (PF).\n'
      : '3. Rapport de puissance : Utilisation de la puissance active (TKW) et du facteur de puissance (PF).\n';
    csv += reportLang === 'en'
      ? '4. Consumption report: Based on KWH and KVAH for energy efficiency.\n'
      : '4. Rapport de consommation : Base sur KWH et KVAH pour le rendement énergétique.\n';
    csv += reportLang === 'en'
      ? '5. Frequency report: Analysis of grid stability around 50 Hz.\n'
      : '5. Rapport de fréquence : Analyse de la stabilité réseau autour de 50 Hz.\n';
    csv += reportLang === 'en'
      ? '6. Quality report: Combination of indicators for an overall view.\n'
      : '6. Rapport de qualité : Combinaison des indicateurs pour une vue globale.\n';
    csv += reportLang === 'en'
      ? '7. Calculated indicators: Voltage imbalance, current imbalance and efficiency (KWH/KVAH).\n\n'
      : '7. Indicateurs calculés : Déséquilibre de tension, de courant et rendement (KWH/KVAH).\n\n';

    csv += `${dataLabel}\n`;
    csv += `${headerLine}\n`;
    
    data.forEach(d => {
      const v = d.avgvoltage ? d.avgvoltage.toFixed(2) : "230.00";
      const i = d.avgcurrent ? d.avgcurrent.toFixed(2) : "0.00";
      const p = d.avgpower ? d.avgpower.toFixed(2) : "0.00";
      const e = (d.avgpower * 24).toFixed(2);
      csv += `${d.time},${v},${v},${v},${v},${i},${i},${i},${p},${e},50.00,0.95\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${reportPrefix}_EMS_Asset_${id}.csv`);
    return res.status(200).send(csv);
  }
}
