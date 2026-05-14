import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../db/database.provider';
import * as schema from '../db/schema';
import { desc, eq, sql, and, gte, lt, inArray } from 'drizzle-orm';

@Injectable()
export class MeasurementsService {
  constructor(@Inject(DATABASE_CONNECTION) private db: any) {}

  async create(data: any) {
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    const inserted = await this.db.insert(schema.measurements).values({
      assetId: Number(data.assetId),

      V1N: Number(data.V1N),
      V2N: Number(data.V2N),
      V3N: Number(data.V3N),

      V12: Number(data.V12),
      V23: Number(data.V23),
      V31: Number(data.V31),

      I1: Number(data.I1),
      I2: Number(data.I2),
      I3: Number(data.I3),

      TKW: Number(data.TKW),
      IKWH: Number(data.IKWH),

      HZ: Number(data.HZ),
      PF: Number(data.PF) || Number(data.cos_phi) || 0.95,
      KVAH: Number(data.KVAH),

      timestamp,
    }).returning();

    const month = timestamp.getMonth() + 1;
    const year = timestamp.getFullYear();
    await this.saveInvoice(Number(data.assetId), month, year);

    return inserted;
  }

  async findLatest(assetId: number) {
    const allAssets = await this.db.select().from(schema.assets);
    const getAllDescendantIds = (id: number): number[] => {
      const children = allAssets.filter(a => a.parentId === id);
      let ids = [id];
      for (const child of children) { ids = [...ids, ...getAllDescendantIds(child.id)]; }
      return ids;
    };
    const targetIds = getAllDescendantIds(assetId);
    if (targetIds.length === 0) return null;
    const latestRecords = await Promise.all(targetIds.map(async (id) => {
        const res = await this.db.select().from(schema.measurements).where(eq(schema.measurements.assetId, id)).orderBy(desc(schema.measurements.timestamp)).limit(1);
        return res[0];
    }));
    const validData = latestRecords.filter(r => r != null);
    if (validData.length === 0) return null;
    const agg = validData.reduce((acc, curr) => ({
      V1N: acc.V1N + (Number(curr.V1N) || 0), V2N: acc.V2N + (Number(curr.V2N) || 0), V3N: acc.V3N + (Number(curr.V3N) || 0),
      V12: acc.V12 + (Number(curr.V12) || 0), V23: acc.V23 + (Number(curr.V23) || 0), V31: acc.V31 + (Number(curr.V31) || 0),
      I1: acc.I1 + (Number(curr.I1) || 0), I2: acc.I2 + (Number(curr.I2) || 0), I3: acc.I3 + (Number(curr.I3) || 0),
      HZ: acc.HZ + (Number(curr.HZ) || 0), PF: acc.PF + (Number(curr.PF) || 0),
      TKW: acc.TKW + (Number(curr.TKW) || 0), IKWH: acc.IKWH + (Number(curr.IKWH) || 0), count: acc.count + 1
    }), { V1N:0, V2N:0, V3N:0, V12:0, V23:0, V31:0, I1:0, I2:0, I3:0, HZ:0, PF:0, TKW:0, IKWH:0, count:0 });
    return {
      V1N: (agg.V1N / agg.count).toFixed(1), V2N: (agg.V2N / agg.count).toFixed(1), V3N: (agg.V3N / agg.count).toFixed(1),
      V12: (agg.V12 / agg.count).toFixed(1), V23: (agg.V23 / agg.count).toFixed(1), V31: (agg.V31 / agg.count).toFixed(1),
      I1: (agg.I1 / agg.count).toFixed(2), I2: (agg.I2 / agg.count).toFixed(2), I3: (agg.I3 / agg.count).toFixed(2),
      HZ: (agg.HZ / agg.count).toFixed(2), PF: (agg.PF / agg.count).toFixed(2),
      TKW: agg.TKW.toFixed(2), IKWH: agg.IKWH.toFixed(2), timestamp: validData[0].timestamp
    };
  }

  async findHistory(assetId: number, period: string) {
    try {
      const allAssets = await this.db.select().from(schema.assets);
      const getAllDescendantIds = (id: number): number[] => {
        const children = allAssets.filter(a => a.parentId === id);
        let ids = [id];
        for (const child of children) { ids = [...ids, ...getAllDescendantIds(child.id)]; }
        return ids;
      };
      const targetIds = getAllDescendantIds(assetId);
      if (targetIds.length === 0) return [];
      const startDate = new Date();
      let sqlInterval = 'day';

      if (period === 'day') {
        sqlInterval = 'hour';
        startDate.setHours(startDate.getHours() - 24);
      } else if (period === 'week') {
        sqlInterval = 'day';
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'month') {
        sqlInterval = 'day';
        startDate.setDate(startDate.getDate() - 30);
      } else {
        sqlInterval = 'day';
        startDate.setDate(startDate.getDate() - 30);
      }

      return await this.db.select({
          time: sql`date_trunc(${sqlInterval}, ${schema.measurements.timestamp})`.as('time'),
          avgpower: sql`cast(avg(coalesce(${schema.measurements.TKW}, 0)) as float)`.as('avgpower'),
          avgvoltage: sql`cast(avg((coalesce(${schema.measurements.V1N},230) + coalesce(${schema.measurements.V2N},230) + coalesce(${schema.measurements.V3N},230)) / 3) as float)`.as('avgvoltage'),
          avgcurrent: sql`cast(avg((coalesce(${schema.measurements.I1},0) + coalesce(${schema.measurements.I2},0) + coalesce(${schema.measurements.I3},0)) / 3) as float)`.as('avgcurrent'),
        }).from(schema.measurements)
        .where(and(inArray(schema.measurements.assetId, targetIds), gte(schema.measurements.timestamp, startDate)))
        .groupBy(sql`1`).orderBy(sql`1`);
    } catch (error) { return []; }
  }

  private chooseGroupingUnit(startDate: Date, endDate: Date) {
    const durationMs = endDate.getTime() - startDate.getTime();
    const dayCount = durationMs / (1000 * 60 * 60 * 24) + 1;
    if (dayCount <= 1.5) return 'hour';
    if (dayCount <= 92) return 'day';
    return 'month';
  }

  private parseIsoDate(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('-').map(Number);
    if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) return null;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  async findHistoryInterval(assetId: number, startDateStr: string, endDateStr: string) {
    try {
      const allAssets = await this.db.select().from(schema.assets);
      const getAllDescendantIds = (id: number): number[] => {
        const children = allAssets.filter(a => a.parentId === id);
        let ids = [id];
        for (const child of children) { ids = [...ids, ...getAllDescendantIds(child.id)]; }
        return ids;
      };
      const targetIds = getAllDescendantIds(assetId);
      if (targetIds.length === 0) return [];

      const startDate = this.parseIsoDate(startDateStr);
      const endDate = this.parseIsoDate(endDateStr);
      if (!startDate || !endDate) return [];

      const normalizedStart = new Date(startDate);
      const normalizedEnd = new Date(endDate);
      normalizedStart.setHours(0, 0, 0, 0);
      normalizedEnd.setHours(0, 0, 0, 0);
      if (normalizedEnd < normalizedStart) {
        return [];
      }

      const endExclusive = new Date(normalizedEnd);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endExclusive.setHours(0, 0, 0, 0);
      const sqlInterval = this.chooseGroupingUnit(normalizedStart, normalizedEnd);

      return await this.db.select({
          time: sql`date_trunc(${sqlInterval}, ${schema.measurements.timestamp})`.as('time'),
          avgpower: sql`cast(avg(coalesce(${schema.measurements.TKW}, 0)) as float)`.as('avgpower'),
          avgvoltage: sql`cast(avg((coalesce(${schema.measurements.V1N},230) + coalesce(${schema.measurements.V2N},230) + coalesce(${schema.measurements.V3N},230)) / 3) as float)`.as('avgvoltage'),
          avgcurrent: sql`cast(avg((coalesce(${schema.measurements.I1},0) + coalesce(${schema.measurements.I2},0) + coalesce(${schema.measurements.I3},0)) / 3) as float)`.as('avgcurrent'),
        }).from(schema.measurements)
        .where(and(
          inArray(schema.measurements.assetId, targetIds),
          gte(schema.measurements.timestamp, normalizedStart),
          lt(schema.measurements.timestamp, endExclusive)
        ))
        .groupBy(sql`1`).orderBy(sql`1`);
    } catch (error) { return []; }
  }

  async findAllAlerts() {
    return await this.db.select({
      id: schema.alerts.id, assetName: schema.assets.name, message: schema.alerts.message,
      value: schema.alerts.value, threshold: schema.alerts.threshold, timestamp: schema.alerts.timestamp,
    }).from(schema.alerts).leftJoin(schema.assets, eq(schema.alerts.assetId, schema.assets.id)).orderBy(desc(schema.alerts.timestamp));
  }

  async findLatestAlert() {
    const result = await this.db.select({
      id: schema.alerts.id, assetName: schema.assets.name, message: schema.alerts.message,
      value: schema.alerts.value, threshold: schema.alerts.threshold, timestamp: schema.alerts.timestamp,
    }).from(schema.alerts).leftJoin(schema.assets, eq(schema.alerts.assetId, schema.assets.id)).orderBy(desc(schema.alerts.timestamp)).limit(1);
    return result[0] || null;
  }

  private async getAssetAndDescendantIds(assetId: number): Promise<number[]> {
    const allAssets = await this.db.select().from(schema.assets);
    const findChildren = (id: number): number[] => {
      const children = allAssets.filter(a => a.parentId === id);
      let ids = [id];
      for (const child of children) { ids = [...ids, ...findChildren(child.id)]; }
      return ids;
    };
    return findChildren(assetId);
  }

  async calculateBilling(assetId: number, month?: number, year?: number) {
    const targetIds = await this.getAssetAndDescendantIds(assetId);
    const startDate = new Date();
    const endDate = new Date();

    if (month && year) {
      startDate.setFullYear(year, month - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setFullYear(year, month - 1, 1);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }

    const dailyData = await this.db.select({
      avgpower: sql`cast(avg(coalesce(${schema.measurements.TKW}, 0)) as float)`.as('avgpower')
    }).from(schema.measurements)
      .where(and(
        inArray(schema.measurements.assetId, targetIds),
        gte(schema.measurements.timestamp, startDate),
        lt(schema.measurements.timestamp, endDate)
      ))
      .groupBy(sql`date_trunc('day', ${schema.measurements.timestamp})`)
      .orderBy(sql`1`);

    if (!dailyData || dailyData.length === 0) {
      return {
        activeEnergy: 0,
        rateJour: 0,
        ratePointeMatin: 0,
        rateSoir: 0,
        rateNuit: 0,
        primePuissance: 0,
        tva: 0,
        municipal: 0,
        month: month || null,
        year: year || null
      };
    }

    const totalPower = dailyData.reduce((acc, curr) => acc + (curr.avgpower || 0), 0);
    return {
      activeEnergy: totalPower * 24,
      rateJour: 0.290,
      ratePointeMatin: 0.417,
      rateSoir: 0.377,
      rateNuit: 0.222,
      primePuissance: 22000.000,
      tva: 0.19,
      municipal: 0.005,
      month: month || null,
      year: year || null
    };
  }

  private calculateInvoiceTotal(billing: any) {
    const energyPrice = (billing.activeEnergy * 0.4 * billing.rateJour) +
                        (billing.activeEnergy * 0.2 * billing.ratePointeMatin) +
                        (billing.activeEnergy * 0.4 * billing.rateNuit);
    const tva = (energyPrice + billing.primePuissance) * billing.tva;
    return {
      subtotal: energyPrice,
      tva,
      totalAmount: energyPrice + billing.primePuissance + tva
    };
  }

  private normalizeMonthYear(month?: number, year?: number) {
    const now = new Date();
    return {
      month: month && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
      year: year && year >= 2000 ? year : now.getFullYear()
    };
  }

  async saveInvoice(assetId: number, month: number, year: number) {
    const billing = await this.calculateBilling(assetId, month, year);
    const totals = this.calculateInvoiceTotal(billing);
    const existing = await this.db.select({ id: schema.facture.id })
      .from(schema.facture)
      .where(and(
        eq(schema.facture.assetId, assetId),
        eq(schema.facture.month, month),
        eq(schema.facture.year, year)
      ));

    const invoiceData = {
      assetId,
      activeEnergy: billing.activeEnergy,
      rateJour: billing.rateJour,
      ratePointeMatin: billing.ratePointeMatin,
      rateSoir: billing.rateSoir,
      rateNuit: billing.rateNuit,
      primePuissance: billing.primePuissance,
      tva: billing.tva,
      municipal: billing.municipal,
      totalAmount: totals.totalAmount,
      month,
      year,
      timestamp: new Date()
    };

    if (existing.length > 0) {
      await this.db.update(schema.facture).set(invoiceData).where(eq(schema.facture.id, existing[0].id));
      return { id: existing[0].id, ...invoiceData };
    }

    const [created] = await this.db.insert(schema.facture).values(invoiceData).returning();
    return created;
  }

  async getInvoice(assetId: number, month?: number, year?: number) {
    const normalized = this.normalizeMonthYear(month, year);
    const targetMonth = normalized.month;
    const targetYear = normalized.year;

    return this.saveInvoice(assetId, targetMonth, targetYear);
  }

  async getAnnualBilling(assetId: number, year?: number) {
    const targetYear = year && year >= 2000 ? year : new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const data = await Promise.all(months.map(async (month) => {
      const billing = await this.calculateBilling(assetId, month, targetYear);
      const totals = this.calculateInvoiceTotal(billing);
      return {
        month,
        year: targetYear,
        activeEnergy: billing.activeEnergy,
        totalAmount: totals.totalAmount,
      };
    }));

    return data;
  }

  async deleteAlert(alertId: number) {
    try {
      console.log('🗑️ Suppression alerte ID:', alertId);
      const result = await this.db.delete(schema.alerts).where(eq(schema.alerts.id, alertId));
      console.log('✅ Alerte supprimée avec succès:', result);
      return { success: true, message: 'Alerte supprimée', id: alertId };
    } catch (error) {
      console.error('❌ Erreur suppression alerte:', error);
      throw error;
    }
  }
}
