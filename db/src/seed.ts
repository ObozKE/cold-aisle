import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  console.log('⚡ [ColdAisle DB] Seeding Nairobi DC1 Baseline Infrastructure...');
  const seedDir = path.resolve(__dirname, '../seed');
  const files = fs
    .readdirSync(seedDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of files) {
      const filePath = path.join(seedDir, file);
      console.log(`  -> Executing: ${file}`);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await client.query(sql);
      console.log(`  ✓ Completed: ${file}`);
    }

    // Verify seeded counts
    const siteCount = await client.query('SELECT COUNT(*) FROM sites;');
    const hallCount = await client.query('SELECT COUNT(*) FROM halls;');
    const rackCount = await client.query('SELECT COUNT(*) FROM racks;');
    const assetCount = await client.query('SELECT COUNT(*) FROM assets;');
    const deviceCount = await client.query('SELECT COUNT(*) FROM devices;');
    const sensorCount = await client.query('SELECT COUNT(*) FROM sensors;');
    const ruleCount = await client.query('SELECT COUNT(*) FROM alert_rules;');
    const policyCount = await client.query('SELECT COUNT(*) FROM escalation_policies;');
    const endpointCount = await client.query('SELECT COUNT(*) FROM webhook_endpoints;');

    console.log('\n📊 [ColdAisle DB Verification Summary]:');
    console.log(`  • Sites:               ${siteCount.rows[0].count}`);
    console.log(`  • Data Halls:          ${hallCount.rows[0].count}`);
    console.log(`  • Server Racks:        ${rackCount.rows[0].count}`);
    console.log(`  • Plant Assets:        ${assetCount.rows[0].count}`);
    console.log(`  • Ingestion Devices:   ${deviceCount.rows[0].count}`);
    console.log(`  • Registered Sensors:  ${sensorCount.rows[0].count}`);
    console.log(`  • Alert Rules:         ${ruleCount.rows[0].count}`);
    console.log(`  • Escalation Policies: ${policyCount.rows[0].count}`);
    console.log(`  • Webhook Endpoints:   ${endpointCount.rows[0].count}`);

    console.log('✅ [ColdAisle DB] Seed data verification complete.\n');
  } catch (error) {
    console.error('❌ [ColdAisle DB] Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
