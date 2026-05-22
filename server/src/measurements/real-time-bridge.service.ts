import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../db/database.provider';
import * as schema from '../db/schema';
import WebSocket from 'ws';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class RealTimeBridgeService implements OnModuleInit {
  private activeSocket: WebSocket | null = null;
  private activeAssetId: number | null = null;
  private connectingAssetId: number | null = null;
  private wasOpen = false;
  private disconnectTimer: NodeJS.Timeout | null = null;

  constructor(@Inject(DATABASE_CONNECTION) private db: any) {}

  async onModuleInit() {}

  async activateOnly(assetId: number) {
    this.resetDisconnectTimer();

    if (this.activeAssetId === assetId && this.activeSocket?.readyState === WebSocket.OPEN) return;
    if (this.connectingAssetId === assetId && this.activeSocket?.readyState === WebSocket.CONNECTING) return;

    const [asset] = await this.db.select().from(schema.assets).where(eq(schema.assets.id, assetId));
    if (asset && asset.webSocketLink) {
      if (this.activeAssetId !== assetId) {
        this.stopCurrentConnection();
      }
      this.connectingAssetId = asset.id;
      this.createSocketConnection(asset);
    } else {
      // If the selected asset has no websocket link, keep any existing active connection open.
      // This allows parent assets like Ligne1/site1 to continue receiving aggregated alerts
      // from descendant equipment streams instead of dropping the current data feed.
      if (this.activeSocket?.readyState === WebSocket.OPEN) {
        console.log(`Asset ${assetId} has no websocket link. Keeping existing connection open for aggregated alerts.`);
        return;
      }
      this.stopCurrentConnection();
    }
  }

  private createSocketConnection(asset: any) {
    try {
      this.activeSocket = new WebSocket(asset.webSocketLink);

      this.activeSocket.on('open', () => {
        this.activeAssetId = asset.id;
        this.connectingAssetId = null;
        this.wasOpen = true;
      });

      this.activeSocket.on('message', async (data) => {
        try {
          const p = JSON.parse(data.toString());
          // Enregistre les données temps réel dans la table measurements.
          // Cela permet au dashboard de récupérer le dernier point via /measurements/latest/:id.
          await this.db.insert(schema.measurements).values({
            assetId: asset.id,
            V1N: Number(p.V1N ?? p.v1n ?? 0),
            V2N: Number(p.V2N ?? p.v2n ?? 0),
            V3N: Number(p.V3N ?? p.v3n ?? 0),
            V12: Number(p.V12 ?? p.v12 ?? 0),
            V23: Number(p.V23 ?? p.v23 ?? 0),
            V31: Number(p.V31 ?? p.v31 ?? 0),
            I1: Number(p.I1 ?? p.i1 ?? 0),
            I2: Number(p.I2 ?? p.i2 ?? 0),
            I3: Number(p.I3 ?? p.i3 ?? 0),
            TKW: Number(p.TKW ?? p.tkw ?? 0),
            IKWH: Number(p.IKWH ?? p.ikwh ?? 0),
            HZ: Number(p.HZ ?? p.hz ?? 0),
            PF: Number(p.PF ?? p.pf ?? 0),
            KVAH: Number(p.KVAH ?? p.kvah ?? 0),
            timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
          });

          // LOGIQUE ALERTES SPRINT 3
          const maxI = Math.max(p.I1 ?? p.i1 ?? 0, p.I2 ?? p.i2 ?? 0, p.I3 ?? p.i3 ?? 0);
          if (asset.maxCurrent && maxI > asset.maxCurrent) {
            await this.db.insert(schema.alerts).values({
              assetId: asset.id, message: `Surcharge détectée sur ${asset.name}`,
              value: maxI, threshold: asset.maxCurrent
            });
          }

          // --- Génération d'alertes agrégées pour les ancêtres ---
          try {
            const allAssets = await this.db.select().from(schema.assets);
            const findAncestors = (id: number) => {
              const ancestors: any[] = [];
              let current = allAssets.find(a => a.id === id);
              while (current && current.parentId) {
                const parent = allAssets.find(a => a.id === current.parentId);
                if (!parent) break;
                ancestors.push(parent);
                current = parent;
              }
              return ancestors;
            };

            const findDescendantsIds = (id: number): number[] => {
              const children = allAssets.filter(a => a.parentId === id);
              let ids = [id];
              for (const c of children) {
                ids = ids.concat(findDescendantsIds(c.id));
              }
              return ids;
            };

            const ancestors = findAncestors(asset.id);
            for (const anc of ancestors) {
              const descIds = findDescendantsIds(anc.id);
              if (!descIds || descIds.length === 0) continue;

              // Pour chaque descendant, récupérer le dernier enregistrement et sommer le max phase
              let sumMaxI = 0;
              for (const dId of descIds) {
                const recs = await this.db.select().from(schema.measurements).where(eq(schema.measurements.assetId, dId)).orderBy(desc(schema.measurements.timestamp)).limit(1);
                const r = recs[0];
                if (!r) continue;
                const m = Math.max(Number(r.I1 || 0), Number(r.I2 || 0), Number(r.I3 || 0));
                sumMaxI += m;
              }

              if (anc.maxCurrent && sumMaxI > anc.maxCurrent) {
                // éviter doublons: vérifier la dernière alerte
                const last = await this.db.select().from(schema.alerts).where(eq(schema.alerts.assetId, anc.id)).orderBy(desc(schema.alerts.timestamp)).limit(1);
                const lastAlert = last[0];
                const shouldInsert = !lastAlert || Number(lastAlert.value) !== Number(sumMaxI);
                if (shouldInsert) {
                  console.log(`Création alerte agrégée pour ${anc.name}: valeur=${sumMaxI}, seuil=${anc.maxCurrent}`);
                  await this.db.insert(schema.alerts).values({
                    assetId: anc.id,
                    message: `Surcharge détectée sur ${anc.name}`,
                    value: sumMaxI,
                    threshold: anc.maxCurrent,
                    timestamp: new Date()
                  });
                }
              }
            }
          } catch (aggErr) {
            console.warn('Erreur génération alertes agrégées:', aggErr);
          }

        } catch (e) {
          console.warn('WebSocket message handling error:', e);
        }
      });

      this.activeSocket.on('error', (err) => {
        console.warn('WebSocket error:', err?.toString?.() || err);
        if (this.activeSocket?.readyState !== WebSocket.OPEN) {
          this.stopCurrentConnection();
        }
      });

      this.activeSocket.on('unexpected-response', (_req, res) => {
        console.warn('WebSocket unexpected response:', res.statusCode, res.statusMessage);
        this.stopCurrentConnection();
      });

      this.activeSocket.on('close', () => {
        if (this.activeSocket) {
          this.activeSocket = null;
        }
        this.connectingAssetId = null;
        this.activeAssetId = null;
        this.wasOpen = false;
      });
    } catch (e) {
      console.warn('WebSocket connection failed:', e);
      this.connectingAssetId = null;
      this.activeAssetId = null;
      this.wasOpen = false;
    }
  }

  private stopCurrentConnection() {
    if (this.activeSocket) {
      this.activeSocket.terminate();
      this.activeSocket = null;
    }
    this.activeAssetId = null;
    this.connectingAssetId = null;
    this.wasOpen = false;
  }

  async generateAggregatedAlertsForAsset(assetId: number) {
    const allAssets = await this.db.select().from(schema.assets);
    const target = allAssets.find(a => a.id === assetId);
    if (!target) return;

    const findAncestors = (id: number) => {
      const ancestors: any[] = [];
      let current = allAssets.find(a => a.id === id);
      while (current && current.parentId) {
        const parent = allAssets.find(a => a.id === current.parentId);
        if (!parent) break;
        ancestors.push(parent);
        current = parent;
      }
      return ancestors;
    };

    const findDescendantsIds = (id: number): number[] => {
      const children = allAssets.filter(a => a.parentId === id);
      let ids = [id];
      for (const c of children) {
        ids = ids.concat(findDescendantsIds(c.id));
      }
      return ids;
    };

    const ancestorsAndSelf = [target, ...findAncestors(assetId)];
    for (const anc of ancestorsAndSelf) {
      const descIds = findDescendantsIds(anc.id);
      if (!descIds || descIds.length === 0) continue;

      let sumMaxI = 0;
      for (const dId of descIds) {
        const recs = await this.db.select().from(schema.measurements).where(eq(schema.measurements.assetId, dId)).orderBy(desc(schema.measurements.timestamp)).limit(1);
        const r = recs[0];
        if (!r) continue;
        const m = Math.max(Number(r.I1 || 0), Number(r.I2 || 0), Number(r.I3 || 0));
        sumMaxI += m;
      }

      if (anc.maxCurrent && sumMaxI > anc.maxCurrent) {
        const last = await this.db.select().from(schema.alerts).where(eq(schema.alerts.assetId, anc.id)).orderBy(desc(schema.alerts.timestamp)).limit(1);
        const lastAlert = last[0];
        const shouldInsert = !lastAlert || Number(lastAlert.value) !== Number(sumMaxI);
        if (shouldInsert) {
          console.log(`Création alerte agrégée (backup) pour ${anc.name}: valeur=${sumMaxI}, seuil=${anc.maxCurrent}`);
          await this.db.insert(schema.alerts).values({
            assetId: anc.id,
            message: `Surcharge détectée sur ${anc.name}`,
            value: sumMaxI,
            threshold: anc.maxCurrent,
            timestamp: new Date()
          });
        }
      }
    }
  }

  private resetDisconnectTimer() {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = setTimeout(() => this.stopCurrentConnection(), 10000);
  }
}
