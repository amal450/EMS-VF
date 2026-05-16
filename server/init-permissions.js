const { Client } = require('pg');

async function initializePermissions() {
  const client = new Client({
    connectionString: 'postgresql://postgres:hadil123@localhost:5432/ems_db'
  });

  try {
    await client.connect();
    console.log('📊 Initializing permissions...');

    // Create permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description TEXT
      );
    `);

    // Create user_permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, permission_id)
      );
    `);

    // Insert default permissions
    const permissions = [
      { code: 'VIEW_DASHBOARD', name: 'Voir le tableau de bord', description: 'Accès au tableau de bord principal' },
      { code: 'VIEW_REPORTS', name: 'Voir les rapports', description: 'Accès aux rapports mensuels/annuels' },
      { code: 'VIEW_INVOICES', name: 'Voir les factures', description: 'Accès aux factures et facturation' },
      { code: 'VIEW_ALERTS', name: 'Voir les alertes', description: 'Voir les alertes et anomalies' },
      { code: 'MANAGE_THRESHOLDS', name: 'Gérer les seuils', description: 'Modifier les seuils d\'alerte' },
      { code: 'MANAGE_ASSETS', name: 'Gérer les assets', description: 'Créer/modifier/supprimer les assets' },
      { code: 'MANAGE_USERS', name: 'Gérer les utilisateurs', description: 'Créer/modifier/supprimer les utilisateurs' },
      { code: 'VIEW_CONSUMPTION', name: 'Voir la consommation', description: 'Voir les données temps réel et historiques' },
      { code: 'EXPORT_DATA', name: 'Exporter les données', description: 'Exporter les données en CSV/PDF' },
      { code: 'VIEW_BILLING', name: 'Voir la facturation', description: 'Accès aux détails de facturation' }
    ];

    for (const perm of permissions) {
      await client.query(
        'INSERT INTO permissions (code, name, description) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING',
        [perm.code, perm.name, perm.description]
      );
    }

    console.log('✅ Permissions initialized successfully');
    await client.end();
  } catch (error) {
    console.error('❌ Error initializing permissions:', error);
    await client.end();
    process.exit(1);
  }
}

initializePermissions();
