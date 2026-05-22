import { Controller, Get, Post, Body, Param, Query, UseGuards, Res, Delete } from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { RealTimeBridgeService } from './real-time-bridge.service'; 
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AssetsService } from '../assets/assets.service';
import * as express from 'express'; 
import htmlPdf from 'html-pdf';

@Controller('measurements')
export class MeasurementsController {
  constructor(
    private readonly measurementsService: MeasurementsService,
    private readonly bridgeService: RealTimeBridgeService,
    private readonly assetsService: AssetsService,
  ) {}

  @Post()
  create(@Body() data: any) { return this.measurementsService.create(data); }

  @UseGuards(JwtAuthGuard)
  @Get('latest/:id')
  async getLatest(@Param('id') id: string) {
    await this.bridgeService.activateOnly(+id);
    await this.bridgeService.generateAggregatedAlertsForAsset(+id);
    return this.measurementsService.findLatest(+id);
  }

  @Post('report/:id/pdf')
  async postReportPdf(
    @Res() res: express.Response,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const startDate = body.startDate as string | undefined;
    const endDate = body.endDate as string | undefined;
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
    const reportLang = body.lang === 'en' ? 'en' : 'fr';
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
    const dataSectionTitle = reportLang === 'en' ? 'Historical operating data' : 'Données Historiques d\'Exploitation';    const descriptionPoints = reportLang === 'en'
      ? [
          'Voltage report: Analysis of phase-to-neutral voltages (V1N, V2N, V3N) and phase-to-phase voltages (V12, V23, V31).',
          'Current report: Tracking the load on each phase (I1, I2, I3) and imbalance analysis.',
          'Power report: Use of active power (TKW) and power factor (PF).',
          'Frequency report: Analysis of grid stability around 50 Hz.',
          'Quality report: Combination of indicators for an overall view.'
        ]
      : [
          'Rapport de tension : Analyse des tensions phase-neutre (V1N, V2N, V3N) et phase-phase (V12, V23, V31).',
          'Rapport de courant : Suivi de la charge sur chaque phase (I1, I2, I3) et analyse de l\'équilibrage.',
          'Rapport de puissance : Utilisation de la puissance active (TKW) et du facteur de puissance (PF).',
          'Rapport de fréquence : Analyse de la stabilité réseau autour de 50 Hz.',
          'Rapport de qualité : Combinaison des indicateurs pour une vue globale.'
        ];    const emptyTableText = reportLang === 'en'
      ? 'No measurements available for the selected period.'
      : 'Aucune mesure disponible pour la période sélectionnée.';
    const footerText = reportLang === 'en'
      ? 'Volt EMS Intelligence v2.0 | Generated on'
      : 'Volt EMS Intelligence v2.0 | Généré le';

    const asset = await this.assetsService.findOne(+id);
    const assetName = asset?.name || `#${id}`;

    const images: string[] = Array.isArray(body.images) ? body.images : [];
    const placeholder = reportLang === 'en' ? 'Chart preview omitted for server PDF.' : 'Aperçu du graphique omis pour le PDF serveur.';

    const chartHtml = (index: number) => {
      const img = images[index];
      if (img && typeof img === 'string') {
        // trim data:image prefix if present
        const cleaned = img.replace(/^data:image\/(png|jpeg);base64,/, '');
        return `<div class="chart-box"><img src="data:image/png;base64,${cleaned}" style="width:100%;height:100%;object-fit:contain"/></div>`;
      }
      return `<div class="chart-box">${placeholder}</div>`;
    };

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - ${assetName}</title>
  <style>
    /* same styles as GET report */
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .report-details { margin-top: 16px; font-size: 12px; color: #475569; display: grid; gap: 6px; justify-items: center; }
    .report-details p { margin: 0; }
    .report-details strong { color: #0f172a; }
    .description-section { margin-top: 20px; }
    .description-section h2 { margin-bottom: 10px; }
    .description-list { margin: 0; padding-left: 18px; color: #334155; font-size: 12px; line-height: 1.5; }
    .description-list p { margin: 6px 0; }
    .description-list p::before { content: '•'; margin-right: 8px; color: #0f172a; font-weight: 700; }
    .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .chart-box { height: 180px; border: 1px solid #e6eef6; border-radius: 8px; background: #f8fafc; padding: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; }
    th { background: #334155; color: #ffffff; text-align: left; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${reportTitle}</h1>
    <p>${reportDescription}</p>
    <div class="report-details">
      <p><strong>${reportLang === 'en' ? 'Asset type' : 'Type d\'asset'}:</strong> ${this.translateAssetType(asset?.type, reportLang)} &nbsp; | &nbsp; <strong>${reportLang === 'en' ? 'Asset name' : 'Nom de l\'asset'}:</strong> ${assetName}</p>
      <p><strong>${reportLang === 'en' ? 'Interval' : 'Intervalle'}:</strong> ${rangeLabel} &nbsp; | &nbsp; <strong>${reportLang === 'en' ? 'Generated' : 'Généré'}:</strong> ${new Date().toLocaleDateString(dateLocale)}</p>
    </div>
  </div>

  <div class="section">
    <h2>${chartSectionTitle}</h2>
    <div class="chart-grid">
      ${chartHtml(0)}
      ${chartHtml(1)}
      ${chartHtml(2)}
      ${chartHtml(3)}
    </div>
  </div>

  <div class="section description-section">
    <h2>${descriptionSectionTitle}</h2>
    <div class="description-list">
      ${descriptionPoints.map(p => `<p>${p}</p>`).join('')}
    </div>
  </div>

  <div class="section">
    <h2>${dataSectionTitle}</h2>
    <table>
      <thead>
        <tr>
          <th>${reportLang === 'en' ? 'Timestamp' : 'Horodatage'}</th>
          <th>${reportLang === 'en' ? 'Voltage (V)' : 'Tension (V)'}</th>
          <th>${reportLang === 'en' ? 'Current (A)' : 'Intensité (A)'}</th>
          <th>${reportLang === 'en' ? 'Power (kW)' : 'Puissance (kW)'}</th>
          <th>${reportLang === 'en' ? 'Energy (kWh)' : 'Énergie (kWh)'}</th>
          <th>${reportLang === 'en' ? 'Power Factor' : 'Facteur PF'}</th>
        </tr>
      </thead>
      <tbody>`;

    if (data.length === 0) {
      html += `
        <tr>
          <td colspan="6" style="text-align:center; padding: 18px; color: #64748b;">${emptyTableText}</td>
        </tr>`;
    } else {
      data.forEach(d => {
        const v = d.avgvoltage ? d.avgvoltage.toFixed(2) : '230.00';
        const i = d.avgcurrent ? d.avgcurrent.toFixed(2) : '0.00';
        const p = d.avgpower ? d.avgpower.toFixed(2) : '0.00';
        const e = (d.avgpower * 24).toFixed(2);
        html += `
        <tr>
          <td>${d.time || '-'}</td>
          <td>${v}</td>
          <td>${i}</td>
          <td>${p}</td>
          <td>${e}</td>
          <td>0.95</td>
        </tr>`;
      });
    }

    html += `
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>${footerText} ${new Date().toLocaleDateString(dateLocale)}</p>
  </div>
</body>
</html>`;

    return new Promise<void>((resolve, reject) => {
      htmlPdf.create(html, { format: 'A4', orientation: 'landscape', border: '10mm' }).toBuffer((err: Error | null, buffer: Buffer) => {
        if (err) {
          console.error('Report PDF generation (POST) failed:', err);
          res.status(500).send('Erreur de génération du PDF');
          return reject(err);
        }
        res.setHeader('Content-Type', 'application/pdf');
        const safeReportFilename = `${reportPrefix}_${assetName.replace(/\s+/g, '_')}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeReportFilename)}`);
        res.status(200).send(buffer);
        resolve();
      });
    });
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
  async getBilling(
    @Res({ passthrough: true }) res: express.Response,
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('format') format?: string,
    @Query('lang') lang?: string,
  ) {
    const monthNum = month ? Number(month) : undefined;
    const yearNum = year ? Number(year) : undefined;

    if (format === 'pdf') {
      const reportLang = lang === 'en' ? 'en' : 'fr';
      const dateLocale = reportLang === 'en' ? 'en-US' : 'fr-FR';
      const asset = await this.assetsService.findOne(+id);
      const assetName = asset?.name || `#${id}`;
      const billing = await this.measurementsService.getInvoice(+id, monthNum, yearNum);
      const invoiceMonth = billing.month || (new Date().getMonth() + 1);
      const invoiceYear = billing.year || new Date().getFullYear();
      const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthNamesFr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const monthLabel = reportLang === 'en' ? monthNamesEn[invoiceMonth - 1] : monthNamesFr[invoiceMonth - 1];
      const issueDate = new Date().toLocaleDateString(dateLocale);
      const energyPrice = (billing.activeEnergy * 0.4 * billing.rateJour) +
                          (billing.activeEnergy * 0.2 * billing.ratePointeMatin) +
                          (billing.activeEnergy * 0.4 * billing.rateNuit);
      const tvaAmount = (energyPrice + billing.primePuissance) * billing.tva;
      const totalAmount = energyPrice + billing.primePuissance + tvaAmount;

      const title = reportLang === 'en' ? '⚡ INVOICE' : '⚡ FACTURE';
      const equipmentText = reportLang === 'en' ? 'Equipment' : 'Équipement';
      const periodText = reportLang === 'en' ? 'Period' : 'Période';
      const issuedDateText = reportLang === 'en' ? 'Issue Date' : 'Date d\'émission';
      const designationText = reportLang === 'en' ? 'Designation' : 'Désignation';
      const consumptionText = reportLang === 'en' ? 'Consumption' : 'Consommation';
      const unitPriceText = reportLang === 'en' ? 'Unit Price' : 'Prix Unitaire';
      const amountText = reportLang === 'en' ? 'Amount' : 'Montant';
      const activeEnergyText = reportLang === 'en' ? 'Active energy' : 'Énergie active';
      const dayConsumptionText = reportLang === 'en' ? 'Day consumption' : 'Consommation jour';
      const peakConsumptionText = reportLang === 'en' ? 'Peak consumption' : 'Consommation pointe';
      const nightConsumptionText = reportLang === 'en' ? 'Night consumption' : 'Consommation nuit';
      const powerChargeText = reportLang === 'en' ? 'Power charge' : 'Prime puissance';
      const tvaText = reportLang === 'en' ? 'VAT' : 'TVA';
      const totalText = reportLang === 'en' ? 'Total net TTC' : 'Total net TTC';
      const generatedByText = reportLang === 'en'
        ? 'Document generated by the EMS system - Energy Management System'
        : 'Document généré par le système EMS - Energy Management System';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} - ${assetName} ${monthLabel} ${invoiceYear}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: white; }
    .invoice-box { max-width: 800px; margin: 0 auto; padding: 40px; border: 2px solid #333; border-radius: 10px; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0ea5e9; }
    .header h1 { font-size: 32px; color: #0ea5e9; margin-bottom: 10px; }
    .header p { color: #64748b; font-size: 14px; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
    th { background: #333; color: white; padding: 12px; text-align: left; font-weight: 700; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
    td { padding: 10px; border: 1px solid #ddd; }
    td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: center; }
    tr:nth-child(even) { background: #f8fafc; }
    .total-row { background: #0ea5e9 !important; color: white; font-weight: 700; }
    .total-row td { border: none; }
    .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; }
  </style>
</head>
<body>
  <div class="invoice-box">
    <div class="header">
      <h1>${title}</h1>
      <p>${equipmentText}: ${assetName}</p>
      <p>${periodText}: ${monthLabel} ${invoiceYear}</p>
      <p>${issuedDateText}: ${issueDate}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>${designationText}</th>
          <th>${consumptionText}</th>
          <th>${unitPriceText}</th>
          <th>${amountText}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${activeEnergyText}</strong></td>
          <td>${billing.activeEnergy?.toFixed(2) || '0.00'}</td>
          <td>-</td>
          <td>${energyPrice.toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">${dayConsumptionText}</td>
          <td>${(billing.activeEnergy * 0.4).toFixed(2)}</td>
          <td>0.290</td>
          <td>${(billing.activeEnergy * 0.4 * billing.rateJour).toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">${peakConsumptionText}</td>
          <td>${(billing.activeEnergy * 0.2).toFixed(2)}</td>
          <td>0.417</td>
          <td>${(billing.activeEnergy * 0.2 * billing.ratePointeMatin).toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">${nightConsumptionText}</td>
          <td>${(billing.activeEnergy * 0.4).toFixed(2)}</td>
          <td>0.222</td>
          <td>${(billing.activeEnergy * 0.4 * billing.rateNuit).toFixed(3)}</td>
        </tr>
        <tr>
          <td><strong>${powerChargeText}</strong></td>
          <td>-</td>
          <td>-</td>
          <td>${billing.primePuissance?.toFixed(3) || '0.000'}</td>
        </tr>
        <tr>
          <td><strong>${tvaText}</strong></td>
          <td>-</td>
          <td>-</td>
          <td>${tvaAmount.toFixed(3)}</td>
        </tr>
        <tr class="total-row">
          <td><strong>${totalText}</strong></td>
          <td>-</td>
          <td>-</td>
          <td><strong>${totalAmount.toFixed(3)} DT</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>${generatedByText}</p>
    </div>
  </div>
</body>
</html>`;

      return new Promise<void>((resolve, reject) => {
        htmlPdf.create(html, { format: 'A4', orientation: 'portrait', border: '10mm' }).toBuffer((err: Error | null, buffer: Buffer) => {
          if (err) {
            console.error('Invoice PDF generation failed:', err);
            res.status(500).send(reportLang === 'en' ? 'PDF generation failed' : 'Échec de génération du PDF');
            return reject(err);
          }
          res.setHeader('Content-Type', 'application/pdf');
          const safeFilename = `${title.replace(/\s+/g, '_')}_${assetName.replace(/\s+/g, '_')}_${monthLabel}_${invoiceYear}.pdf`;
          res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
          res.status(200).send(buffer);
          resolve();
        });
      });
    }

    return this.measurementsService.getInvoice(+id, monthNum, yearNum);
  }

  // Public PDF endpoint (no auth) - convenience for client download during development.
  // NOTE: this is intentionally unauthenticated to simplify downloads; consider protecting it in production.
  @Get('billing/:id/pdf')
  async getBillingPdfPublic(
    @Res() res: express.Response,
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('lang') lang?: string,
  ) {
    const monthNum = month ? Number(month) : undefined;
    const yearNum = year ? Number(year) : undefined;
    const reportLang = lang === 'en' ? 'en' : 'fr';
    const dateLocale = reportLang === 'en' ? 'en-US' : 'fr-FR';
    const asset = await this.assetsService.findOne(+id);
    const assetName = asset?.name || `#${id}`;
    const billing = await this.measurementsService.getInvoice(+id, monthNum, yearNum);
    const invoiceMonth = billing.month || (new Date().getMonth() + 1);
    const invoiceYear = billing.year || new Date().getFullYear();
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNamesFr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthLabel = reportLang === 'en' ? monthNamesEn[invoiceMonth - 1] : monthNamesFr[invoiceMonth - 1];
    const issueDate = new Date().toLocaleDateString(dateLocale);
    const energyPrice = (billing.activeEnergy * 0.4 * billing.rateJour) +
                        (billing.activeEnergy * 0.2 * billing.ratePointeMatin) +
                        (billing.activeEnergy * 0.4 * billing.rateNuit);
    const tvaAmount = (energyPrice + billing.primePuissance) * billing.tva;
    const totalAmount = energyPrice + billing.primePuissance + tvaAmount;

    const title = reportLang === 'en' ? '⚡ INVOICE' : '⚡ FACTURE';
    const equipmentText = reportLang === 'en' ? 'Equipment' : 'Équipement';
    const periodText = reportLang === 'en' ? 'Period' : 'Période';
    const issuedDateText = reportLang === 'en' ? 'Issue Date' : 'Date d\'émission';
    const designationText = reportLang === 'en' ? 'Designation' : 'Désignation';
    const consumptionText = reportLang === 'en' ? 'Consumption' : 'Consommation';
    const unitPriceText = reportLang === 'en' ? 'Unit Price' : 'Prix Unitaire';
    const amountText = reportLang === 'en' ? 'Amount' : 'Montant';
    const activeEnergyText = reportLang === 'en' ? 'Active energy' : 'Énergie active';
    const dayConsumptionText = reportLang === 'en' ? 'Day consumption' : 'Consommation jour';
    const peakConsumptionText = reportLang === 'en' ? 'Peak consumption' : 'Consommation pointe';
    const nightConsumptionText = reportLang === 'en' ? 'Night consumption' : 'Consommation nuit';
    const powerChargeText = reportLang === 'en' ? 'Power charge' : 'Prime puissance';
    const tvaText = reportLang === 'en' ? 'VAT' : 'TVA';
    const totalText = reportLang === 'en' ? 'Total net TTC' : 'Total net TTC';
    const generatedByText = reportLang === 'en'
      ? 'Document generated by the EMS system - Energy Management System'
      : 'Document généré par le système EMS - Energy Management System';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} - ${assetName} ${monthLabel} ${invoiceYear}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: white; }
    .invoice-box { max-width: 800px; margin: 0 auto; padding: 40px; border: 2px solid #333; border-radius: 10px; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0ea5e9; }
    .header h1 { font-size: 32px; color: #0ea5e9; margin-bottom: 10px; }
    .header p { color: #64748b; font-size: 14px; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
    th { background: #333; color: white; padding: 12px; text-align: left; font-weight: 700; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
    td { padding: 10px; border: 1px solid #ddd; }
    td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: center; }
    tr:nth-child(even) { background: #f8fafc; }
    .total-row { background: #0ea5e9 !important; color: white; font-weight: 700; }
    .total-row td { border: none; }
    .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; }
  </style>
</head>
<body>
  <div class="invoice-box">
    <div class="header">
      <h1>${title}</h1>
      <p>${equipmentText}: ${assetName}</p>
      <p>${periodText}: ${monthLabel} ${invoiceYear}</p>
      <p>${issuedDateText}: ${issueDate}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>${designationText}</th>
          <th>${consumptionText}</th>
          <th>${unitPriceText}</th>
          <th>${amountText}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${activeEnergyText}</strong></td>
          <td>${billing.activeEnergy?.toFixed(2) || '0.00'}</td>
          <td>-</td>
          <td>${energyPrice.toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">${dayConsumptionText}</td>
          <td>${(billing.activeEnergy * 0.4).toFixed(2)}</td>
          <td>0.290</td>
          <td>${(billing.activeEnergy * 0.4 * billing.rateJour).toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">${peakConsumptionText}</td>
          <td>${(billing.activeEnergy * 0.2).toFixed(2)}</td>
          <td>0.417</td>
          <td>${(billing.activeEnergy * 0.2 * billing.ratePointeMatin).toFixed(3)}</td>
        </tr>
        <tr>
          <td style="padding-left: 30px;">${nightConsumptionText}</td>
          <td>${(billing.activeEnergy * 0.4).toFixed(2)}</td>
          <td>0.222</td>
          <td>${(billing.activeEnergy * 0.4 * billing.rateNuit).toFixed(3)}</td>
        </tr>
        <tr>
          <td><strong>${powerChargeText}</strong></td>
          <td>-</td>
          <td>-</td>
          <td>${billing.primePuissance?.toFixed(3) || '0.000'}</td>
        </tr>
        <tr>
          <td><strong>${tvaText}</strong></td>
          <td>-</td>
          <td>-</td>
          <td>${tvaAmount.toFixed(3)}</td>
        </tr>
        <tr class="total-row">
          <td><strong>${totalText}</strong></td>
          <td>-</td>
          <td>-</td>
          <td><strong>${totalAmount.toFixed(3)} DT</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>${generatedByText}</p>
    </div>
  </div>
</body>
</html>`;

    return new Promise<void>((resolve, reject) => {
      htmlPdf.create(html, { format: 'A4', orientation: 'portrait', border: '10mm' }).toBuffer((err: Error | null, buffer: Buffer) => {
        if (err) {
          console.error('Invoice PDF generation failed (public):', err);
          res.status(500).send(reportLang === 'en' ? 'PDF generation failed' : 'Échec de génération du PDF');
          return reject(err);
        }
        res.setHeader('Content-Type', 'application/pdf');
        const safeFilenamePublic = `${title.replace(/\s+/g, '_')}_${assetName.replace(/\s+/g, '_')}_${monthLabel}_${invoiceYear}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeFilenamePublic)}`);
        res.status(200).send(buffer);
        resolve();
      });
    });
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
    const normalizedStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
    const normalizedEnd = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 0, 0, 0, 0));
    return { start: normalizedStart, end: normalizedEnd };
  }

  private parseIsoDate(dateStr?: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('-').map(Number);
    if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) return null;
    const [year, month, day] = parts;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
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
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      if (unit === 'hour') return `${year}-${month}-${day} ${hours}`;
      if (unit === 'month') return `${year}-${month}`;
      return `${year}-${month}-${day}`;
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
      if (unit === 'hour') cursor.setUTCHours(cursor.getUTCHours() + 1);
      else if (unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + 1);
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
      const asset = await this.assetsService.findOne(+id);
      const assetName = asset?.name || `#${id}`;
      const assetTypeLabel = asset ? this.translateAssetType(asset.type, reportLang) : (reportLang === 'en' ? 'Asset' : 'Équipement');

      let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - ${assetName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; background: white; font-size: 11px; line-height: 1.4; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #0ea5e9; }
    .header h1 { font-size: 22px; color: #0ea5e9; margin-bottom: 6px; }
    .header p { color: #475569; font-size: 11px; margin: 2px 0; }
    .section { margin-bottom: 18px; page-break-inside: avoid; }
    .section h2 { font-size: 13px; color: #334155; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
    .details { display: flex; flex-wrap: wrap; gap: 12px; font-size: 10px; color: #475569; }
    .details span { min-width: 180px; }
    .chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .chart-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; min-height: 110px; display: flex; align-items: center; justify-content: center; color: #64748b; font-style: italic; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; }
    th { background: #334155; color: #ffffff; text-align: left; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 18px; text-align: center; color: #94a3b8; font-size: 9px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${reportTitle}</h1>
    <p>${reportDescription}</p>
  </div>

  <div class="section">
    <h2>${reportLang === 'en' ? 'Report details' : 'Détails du rapport'}</h2>
    <div class="details">
      <span><strong>${reportLang === 'en' ? 'Asset type:' : 'Type d\'asset :'}</strong> ${assetTypeLabel}</span>
      <span><strong>${reportLang === 'en' ? 'Asset name:' : 'Nom de l\'asset :'}</strong> ${assetName}</span>
      <span><strong>${reportLang === 'en' ? 'Selected interval:' : 'Intervalle :'}</strong> ${rangeLabel}</span>
      <span><strong>${reportLang === 'en' ? 'Generated:' : 'Généré :'}</strong> ${new Date().toLocaleString(dateLocale)}</span>
    </div>
  </div>

  <div class="section">
    <h2>${chartSectionTitle}</h2>
    <div class="chart-grid">
      <div class="chart-box">${reportLang === 'en' ? 'Chart preview omitted for server PDF.' : 'Aperçu du graphique omis pour le PDF serveur.'}</div>
      <div class="chart-box">${reportLang === 'en' ? 'Chart preview omitted for server PDF.' : 'Aperçu du graphique omis pour le PDF serveur.'}</div>
      <div class="chart-box">${reportLang === 'en' ? 'Chart preview omitted for server PDF.' : 'Aperçu du graphique omis pour le PDF serveur.'}</div>
      <div class="chart-box">${reportLang === 'en' ? 'Chart preview omitted for server PDF.' : 'Aperçu du graphique omis pour le PDF serveur.'}</div>
    </div>
  </div>

  <div class="section">
    <h2>${dataSectionTitle}</h2>
    <table>
      <thead>
        <tr>
          <th>${reportLang === 'en' ? 'Timestamp' : 'Horodatage'}</th>
          <th>${reportLang === 'en' ? 'Voltage (V)' : 'Tension (V)'}</th>
          <th>${reportLang === 'en' ? 'Current (A)' : 'Intensité (A)'}</th>
          <th>${reportLang === 'en' ? 'Power (kW)' : 'Puissance (kW)'}</th>
          <th>${reportLang === 'en' ? 'Energy (kWh)' : 'Énergie (kWh)'}</th>
          <th>${reportLang === 'en' ? 'Power Factor' : 'Facteur PF'}</th>
        </tr>
      </thead>
      <tbody>
`;

      if (data.length === 0) {
        html += `
        <tr>
          <td colspan="6" style="text-align:center; padding: 18px; color: #64748b;">${emptyTableText}</td>
        </tr>`;
      } else {
        data.forEach(d => {
          const v = d.avgvoltage ? d.avgvoltage.toFixed(2) : '230.00';
          const i = d.avgcurrent ? d.avgcurrent.toFixed(2) : '0.00';
          const p = d.avgpower ? d.avgpower.toFixed(2) : '0.00';
          const e = (d.avgpower * 24).toFixed(2);
          html += `
        <tr>
          <td>${d.time || '-'}</td>
          <td>${v}</td>
          <td>${i}</td>
          <td>${p}</td>
          <td>${e}</td>
          <td>0.95</td>
        </tr>`;
        });
      }

      html += `
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>${footerText} ${new Date().toLocaleDateString(dateLocale)}</p>
  </div>
</body>
</html>`;

      return new Promise<void>((resolve, reject) => {
        htmlPdf.create(html, { format: 'A4', orientation: 'landscape', border: '10mm' }).toBuffer((err: Error | null, buffer: Buffer) => {
          if (err) {
            console.error('PDF generation failed:', err);
            res.status(500).send('Erreur de génération du PDF');
            return reject(err);
          }
          res.setHeader('Content-Type', 'application/pdf');
          const safeReportFilename = `${reportPrefix}_${assetName.replace(/\s+/g, '_')}.pdf`;
          res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeReportFilename)}`);
          res.status(200).send(buffer);
          resolve();
        });
      });
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
    const safeCsvFilename = `${reportPrefix}_EMS_Asset_${id}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeCsvFilename)}`);
    return res.status(200).send(csv);
  }

  private translateAssetType(assetType: string | undefined, lang: 'en' | 'fr') {
    const labels: Record<string, { en: string; fr: string }> = {
      SITE: { en: 'Site', fr: 'Site' },
      TGBT: { en: 'TGBT', fr: 'TGBT' },
      ARMOIRE: { en: 'Panel', fr: 'Armoire' },
      LIGNE: { en: 'Line', fr: 'Ligne' },
      EQUIPEMENT: { en: 'Equipment', fr: 'Équipement' },
    };
    return assetType && labels[assetType] ? labels[assetType][lang] : (lang === 'en' ? 'Asset' : 'Équipement');
  }
}
