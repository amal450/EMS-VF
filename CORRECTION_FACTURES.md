## 🔧 CORRECTION: Factures qui ne changent pas selon le mois

### 🎯 Problème Identifié
La requête SQL qui calcule les données de facturation groupait par date mais **ne sélectionnait pas la colonne de date**. Cela peut causer des problèmes avec Drizzle ORM où les données ne sont pas correctement groupées par jour.

### 📝 Corrections Apportées

**Fichier:** `server/src/measurements/measurements.service.ts`

**Avant:**
```typescript
const dailyData = await this.db.select({
  avgpower: sql`cast(avg(coalesce(${schema.measurements.TKW}, 0)) as float)`.as('avgpower')
}).from(schema.measurements)
  // ... where clause ...
  .groupBy(sql`date_trunc('day', ${schema.measurements.timestamp})`)
  .orderBy(sql`1`);
```

**Après:**
```typescript
const dailyData = await this.db.select({
  day: sql`date_trunc('day', ${schema.measurements.timestamp})`.as('day'),  // ← AJOUTÉ
  avgpower: sql`cast(avg(coalesce(${schema.measurements.TKW}, 0)) as float)`.as('avgpower')
}).from(schema.measurements)
  // ... where clause ...
  .groupBy(sql`date_trunc('day', ${schema.measurements.timestamp})`)
  .orderBy(sql`date_trunc('day', ${schema.measurements.timestamp})`);  // ← FIXÉ
```

### 🔍 Logs de Débogage Ajoutés
Des logs console ont été ajoutés pour aider au diagnostic:
- Affiche la plage de dates pour chaque calcul de facturation
- Montre le nombre de jours trouvés et la consommation d'énergie calculée
- Aide à identifier si des mesures existent pour le mois sélectionné

### ✅ Prochaines Étapes

1. **Reconstruire le serveur:**
   ```bash
   cd server
   npm run build
   ```

2. **Redémarrer le serveur:**
   ```bash
   npm start
   ```

3. **Tester dans le navigateur:**
   - Ouvrir la page des factures
   - Changer le mois
   - Observer les logs console du serveur pour voir les valeurs calculées

4. **Diagnostic (optionnel):**
   - Exécuter le script de diagnostic:
     ```bash
     node test-billing-query.js
     ```
   - Mettre à jour les identifiants de base de données dans le script avant d'exécuter

### 🐛 Autres Causes Possibles

Si le problème persiste après cette correction, vérifiez:

1. **Données manquantes** - La table `measurements` a-t-elle des données pour les différents mois?
   - Exécutez les simulateurs:
     ```bash
     node simulator.js  # ou
     node super-seed.js
     ```

2. **Valeurs fixes** - Les tarifs sont hardcodés dans le code:
   - `rateJour: 0.290`
   - `ratePointeMatin: 0.417`
   - `primePuissance: 22000.000`
   
   Ils ne changeront jamais, mais `activeEnergy` devrait varier selon le mois.

3. **Cache** - Vérifiez que votre navigateur ne met pas les réponses en cache:
   - Videz le cache (Ctrl+F5)
   - Ouvrez les outils de développement (F12) et cochez "Désactiver la mise en cache"

### 📊 Résumé des Changements
| Aspect | Avant | Après |
|--------|-------|-------|
| Sélection des données | Seulement `avgpower` | `day` + `avgpower` |
| Tri | Par ordre (SQL `1`) | Par date explicite |
| Logging | Aucun | Logs détaillés |
| Compatibilité | Drizzle ORM (incertain) | Drizzle ORM (correct) |
