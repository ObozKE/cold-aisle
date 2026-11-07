import { config } from './config.js';
import { testDbConnection } from './db/pool.js';
import { createHttpServer } from './http/server.js';
import { startMqttSubscriber } from './mqtt/subscriber.js';

async function main() {
  console.log('🚀 [ColdAisle Ingest] Initializing Telemetry Ingest & Derivation Service...');

  // 1. Verify Database
  const dbOk = await testDbConnection();
  if (!dbOk) {
    console.error('❌ [Fatal] Database unavailable. Exiting...');
    process.exit(1);
  }

  // 2. Start HTTP Ingest & Health Server
  const app = createHttpServer();
  const server = app.listen(config.PORT, () => {
    console.log(`🌐 [HTTP Server] Listening on http://localhost:${config.PORT}`);
    console.log(`   • Ingest Endpoint: POST http://localhost:${config.PORT}/api/v1/ingest`);
    console.log(`   • Health Probe:    GET  http://localhost:${config.PORT}/health`);
  });

  // 3. Start MQTT Subscriber
  const mqttClient = startMqttSubscriber();

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 [ColdAisle Ingest] Received ${signal}. Shutting down gracefully...`);
    server.close(() => console.log('  ✓ HTTP server closed.'));
    mqttClient.end(false, () => console.log('  ✓ MQTT client disconnected.'));
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ [Fatal] Startup exception:', err);
  process.exit(1);
});
