/**
 * TEST SCRIPT FOR BILLING ISSUE
 * This script helps diagnose why invoice values don't change by month
 */

// Replace with your database connection details
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'your_password', // Update this
  host: 'localhost',
  port: 5432,
  database: 'ems_db' // Update this
});

async function testBillingCalculation() {
  try {
    console.log('🔍 DIAGNOSTIC: Testing Billing Query Issues\n');

    // 1. Check if measurements table has data
    console.log('1️⃣  Checking measurements table...');
    const measurementsCount = await pool.query(
      'SELECT COUNT(*) as count FROM measurements'
    );
    console.log(`   Total measurements: ${measurementsCount.rows[0].count}\n`);

    // 2. Check data distribution by month
    console.log('2️⃣  Measurements per month/year:');
    const monthDistribution = await pool.query(`
      SELECT 
        DATE_TRUNC('month', timestamp) as month,
        COUNT(*) as count,
        AVG(tkw) as avg_power,
        MIN(tkw) as min_power,
        MAX(tkw) as max_power
      FROM measurements
      GROUP BY DATE_TRUNC('month', timestamp)
      ORDER BY month DESC
      LIMIT 12
    `);
    
    if (monthDistribution.rows.length === 0) {
      console.log('   ❌ NO MEASUREMENT DATA FOUND FOR ANY MONTH!\n');
      console.log('   👉 This is your problem! You need to populate test data first.\n');
    } else {
      monthDistribution.rows.forEach(row => {
        console.log(`   ${row.month}: ${row.count} measurements, avg_power=${row.avg_power?.toFixed(2)}`);
      });
    }
    console.log('');

    // 3. Simulate the calculateBilling query for different months
    console.log('3️⃣  Simulating calculateBilling queries:');
    const assetId = 3; // Default asset in code
    
    for (let month = 1; month <= 3; month++) {
      const year = 2024;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      
      const result = await pool.query(`
        SELECT 
          DATE_TRUNC('day', timestamp) as day,
          AVG(COALESCE(tkw, 0))::float as avgpower
        FROM measurements
        WHERE asset_id = $1
          AND timestamp >= $2
          AND timestamp < $3
        GROUP BY DATE_TRUNC('day', timestamp)
        ORDER BY day
      `, [assetId, startDate, endDate]);
      
      const totalPower = result.rows.reduce((sum, row) => sum + (row.avgpower || 0), 0);
      const activeEnergy = totalPower * 24;
      
      console.log(`   Month ${month}/${year}: ${result.rows.length} days, activeEnergy=${activeEnergy.toFixed(2)}`);
    }
    console.log('');

    // 4. Check facture table
    console.log('4️⃣  Checking facture (invoices) table:');
    const factureCount = await pool.query('SELECT COUNT(*) as count FROM facture');
    console.log(`   Total invoices: ${factureCount.rows[0].count}`);
    
    const factureData = await pool.query(`
      SELECT month, year, active_energy, total_amount, COUNT(*) as count
      FROM facture
      GROUP BY month, year, active_energy, total_amount
      ORDER BY year DESC, month DESC
      LIMIT 12
    `);
    
    if (factureData.rows.length === 0) {
      console.log('   ❌ NO INVOICE DATA FOUND!\n');
    } else {
      factureData.rows.forEach(row => {
        console.log(`   ${row.month}/${row.year}: activeEnergy=${row.active_energy?.toFixed(2)}, total=${row.total_amount?.toFixed(2)}`);
      });
    }
    console.log('');

    console.log('📋 SUMMARY:');
    if (measurementsCount.rows[0].count === 0) {
      console.log('   ❌ Problem: No measurement data in database');
      console.log('   ✅ Solution: Run simulator to populate test data');
      console.log('      $ node server/simulator.js  or  node server/super-seed.js\n');
    } else if (monthDistribution.rows.length === 1) {
      console.log('   ⚠️  Only 1 month of data exists');
      console.log('   ✅ Solution: Populate multiple months of test data\n');
    } else {
      console.log('   ✅ Multiple months of data exist');
      console.log('   🔧 Check if activeEnergy values are different');
      console.log('   📊 If values are the same, check the query logic\n');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testBillingCalculation();
