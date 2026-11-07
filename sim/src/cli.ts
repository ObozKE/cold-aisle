import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Command } from 'commander';
import { ScenarioEngine } from './scenarios/engine.js';
import { ScenarioName } from './scenarios/types.js';
import { TelemetryPublisher } from './publisher.js';
import mqtt from 'mqtt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const program = new Command();

program
  .name('coldaisle-sim')
  .description('Carrier-grade physical twin telemetry & scenario simulator for ColdAisle DCIM')
  .version('1.0.0');

// Main run command (default)
program
  .option('-s, --scenario <scenario>', 'Initial fault scenario profile', process.env.SIM_DEFAULT_SCENARIO || 'normal')
  .option('-p, --protocol <protocol>', 'Transport protocol (mqtt or http)', process.env.SIM_TARGET_PROTOCOL || 'mqtt')
  .option('-i, --interval <interval>', 'Publish interval in milliseconds', process.env.SIM_PUBLISH_INTERVAL_MS || '3000')
  .option('-d, --device <device>', 'Device identifier in catalog', 'sim-node-01')
  .option('--site <site>', 'DCIM site campus identifier', 'NBO1')
  .option('--hall <hall>', 'Data hall identifier', 'hall-alpha')
  .action(async (options) => {
    const validScenarios: ScenarioName[] = [
      'normal',
      'thermal_spike',
      'cdu_leak',
      'power_cut',
      'fuel_depletion',
      'sensor_dropout',
      'recovery',
    ];

    const initialScenario = validScenarios.includes(options.scenario)
      ? (options.scenario as ScenarioName)
      : 'normal';

    const intervalMs = Math.max(500, parseInt(options.interval, 10) || 3000);
    const engine = new ScenarioEngine(initialScenario);

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║       ColdAisle DCIM Telemetry Twin - Scenario Simulator       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(` • Active Device:    ${options.device}`);
    console.log(` • Site / Hall:      ${options.site} / ${options.hall}`);
    console.log(` • Protocol:         ${options.protocol.toUpperCase()}`);
    console.log(` • Publish Cadence:  ${intervalMs}ms`);
    console.log(` • Starting Profile: [${initialScenario.toUpperCase()}]`);
    console.log('\nHotkeys to switch scenario in real-time:');
    console.log(' [1] Normal          [2] Thermal Spike   [3] CDU Leak (Compound)');
    console.log(' [4] Power Cut       [5] Fuel Depletion  [6] Sensor Dropout');
    console.log(' [7] Recovery        [Ctrl+C] Exit\n');

    const publisher = new TelemetryPublisher({
      protocol: options.protocol as 'mqtt' | 'http',
      mqttUrl: process.env.SIM_MQTT_URL || 'mqtt://localhost:1883',
      httpUrl: process.env.SIM_HTTP_URL || 'http://localhost:4000/api/v1/ingest',
      deviceKey: process.env.SIM_DEVICE_KEY || 'dcim_dev_ingest_key_9921',
      deviceId: options.device,
      site: options.site,
      hall: options.hall,
      onScenarioChange: (newScenario) => {
        if (validScenarios.includes(newScenario as ScenarioName)) {
          engine.setScenario(newScenario as ScenarioName);
          console.log(`\n🔀 [Scenario Switch] Engine transitioned to -> [${newScenario.toUpperCase()}]`);
        }
      },
    });

    try {
      await publisher.init();
    } catch (err: any) {
      console.error('❌ Failed to initialize telemetry publisher:', err.message);
      process.exit(1);
    }

    // Setup interactive keyboard inputs if in terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', (key: string) => {
        if (key === '\u0003') {
          // Ctrl+C
          cleanup();
        }
        const keyMap: Record<string, ScenarioName> = {
          '1': 'normal',
          '2': 'thermal_spike',
          '3': 'cdu_leak',
          '4': 'power_cut',
          '5': 'fuel_depletion',
          '6': 'sensor_dropout',
          '7': 'recovery',
        };
        if (keyMap[key]) {
          const target = keyMap[key];
          engine.setScenario(target);
          console.log(`\n⌨️ [Key Event] Injected Scenario Profile -> [${target.toUpperCase()}]`);
        }
      });
    }

    // Main telemetry publishing loop
    let tickCount = 0;
    const intervalTimer = setInterval(async () => {
      tickCount++;
      const { readings, isSilent } = engine.nextTick();
      const scenario = engine.getScenario();

      const timeStr = new Date().toISOString().substring(11, 19) + 'Z';
      const deltaT = (readings.hot_aisle_temp_c - readings.cold_aisle_temp_c).toFixed(1);

      if (isSilent) {
        console.log(
          `[${timeStr}] #${tickCount.toString().padStart(4, '0')} | ` +
          `[${scenario.toUpperCase().padEnd(14)}] | ⚠️ SILENT (Device Offline/Packet Dropout)`
        );
        return;
      }

      try {
        await publisher.publish(readings);
        console.log(
          `[${timeStr}] #${tickCount.toString().padStart(4, '0')} | ` +
          `[${scenario.toUpperCase().padEnd(14)}] | ` +
          `Cold: ${readings.cold_aisle_temp_c.toFixed(1)}°C | ` +
          `Hot: ${readings.hot_aisle_temp_c.toFixed(1)}°C (ΔT: ${deltaT}°C) | ` +
          `CDU: ${readings.coolant_pressure_bar.toFixed(2)}bar (${readings.cdu_reservoir_distance_cm.toFixed(1)}cm) | ` +
          `Diesel: ${readings.diesel_distance_cm.toFixed(1)}cm | ` +
          `IT: ${readings.rack_it_kw.toFixed(1)}kW`
        );
      } catch (err: any) {
        console.error(`❌ Publish error:`, err.message);
      }
    }, intervalMs);

    function cleanup() {
      console.log('\n🛑 Stopping scenario simulator...');
      clearInterval(intervalTimer);
      publisher.close();
      process.exit(0);
    }

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });

// Secondary CLI command to inject a scenario switch remotely into a running simulator
program
  .command('set-scenario <scenario>')
  .description('Publish a scenario switch command over MQTT control topic')
  .action((scenario) => {
    const mqttUrl = process.env.SIM_MQTT_URL || 'mqtt://localhost:1883';
    console.log(`📢 Dispatching scenario control signal '${scenario}' to ${mqttUrl}...`);
    const client = mqtt.connect(mqttUrl);
    client.on('connect', () => {
      client.publish('dcim/control/scenario', scenario, { qos: 1 }, () => {
        console.log(`✅ Control signal '${scenario}' published successfully.`);
        client.end(true, () => process.exit(0));
      });
    });
  });

program.parse(process.argv);
