/**
 * SEEDER COMPLET - 12 mois de données avec consommations variées
 * Cela permettra à l'utilisateur de voir des factures différentes selon le mois
 */

const API_URL = 'http://localhost:3000/measurements';
const ASSET_ID = 3; // ID de l'équipement (ajustez si nécessaire)

async function generateMonthlyData() {
  const currentYear = new Date().getFullYear();
  
  console.log('📊 Génération de 12 mois de données de test...\n');
  
  // Boucle sur les 12 derniers mois
  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - monthOffset);
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    
    // Consommations variables par saison (hiver vs été)
    let baseConsumption;
    if ([12, 1, 2].includes(month)) {
      baseConsumption = 18 + Math.random() * 8; // Hiver: +consommation chauffage
    } else if ([6, 7, 8].includes(month)) {
      baseConsumption = 8 + Math.random() * 5; // Été: -consommation
    } else {
      baseConsumption = 12 + Math.random() * 6; // Autres mois
    }
    
    // Générer 25-28 jours de données pour ce mois
    const daysInMonth = new Date(year, month, 0).getDate();
    const numDays = Math.min(28, daysInMonth);
    
    console.log(`🗓️  ${month.toString().padStart(2, '0')}/${year}: génération de ${numDays} jours...`);
    
    for (let day = 1; day <= numDays; day++) {
      const timestamp = new Date(year, month - 1, day, 12, 0, 0);
      
      // Varier légèrement la consommation jour par jour
      const dailyVariation = baseConsumption + (Math.random() - 0.5) * 3;
      const TKW = Math.max(1, Number(dailyVariation.toFixed(2)));
      
      const data = {
        assetId: ASSET_ID,
        V1N: 230 + Math.random() * 2,
        V2N: 229 + Math.random() * 2,
        V3N: 231 + Math.random() * 2,
        V12: 400 + Math.random() * 2,
        V23: 401 + Math.random() * 2,
        V31: 399 + Math.random() * 2,
        I1: TKW * 0.8 + Math.random() * 2,
        I2: TKW * 0.8 + Math.random() * 2,
        I3: TKW * 0.8 + Math.random() * 2,
        TKW: TKW,
        IKWH: day * TKW * 0.5,
        HZ: 50 + Math.random() * 0.1,
        PF: 0.93 + Math.random() * 0.03,
        KVAH: TKW * 1.1,
        timestamp: timestamp.toISOString()
      };
      
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          process.stdout.write('.');
        } else {
          console.log(`\n❌ Erreur pour ${month}/${day}: status ${response.status}`);
        }
      } catch (error) {
        console.log(`\n❌ Erreur connexion: ${error.message}`);
        return;
      }
    }
    console.log(` ✅ mois ${month}/${year} terminé (TKW moyen: ${baseConsumption.toFixed(1)})`);
  }
  
  console.log('\n✨ SUCCÈS! 12 mois de données ont été créés!');
  console.log('📌 Maintenant vous pouvez:');
  console.log('   1. Actualiser la page de facturation');
  console.log('   2. Changer le mois pour voir des valeurs différentes');
  console.log('   3. Vérifier les logs du serveur pour voir les calculs');
}

generateMonthlyData().catch(err => {
  console.error('💥 Erreur fatal:', err);
  process.exit(1);
});
