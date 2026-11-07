-- =============================================================================
-- Seed 001: Nairobi DC1 (Sameer Africa), Halls, Racks, Assets, Rules & Policies
-- =============================================================================

-- Clean existing seed data
DELETE FROM webhook_deliveries;
DELETE FROM webhook_endpoints;
DELETE FROM escalation_policies;
DELETE FROM alerts;
DELETE FROM alert_rules;
DELETE FROM readings;
DELETE FROM sensors;
DELETE FROM devices;
DELETE FROM assets;
DELETE FROM racks;
DELETE FROM halls;
DELETE FROM sites;

-- 1. Site: Nairobi DC1
INSERT INTO sites (id, code, name, location, timezone)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'NBO1',
    'Nairobi DC1 (Enterprise Park, Mombasa Rd)',
    'Nairobi, Kenya',
    'Africa/Nairobi'
);

-- 2. Data Halls (2 Halls)
INSERT INTO halls (id, site_id, code, name, total_floor_sqm, cooling_type)
VALUES 
(
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111111',
    'hall-alpha',
    'Data Hall Alpha (Cold-Aisle Containment)',
    420.00,
    'In-Row CDU + Chilled Water Loop'
),
(
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111111',
    'hall-beta',
    'Data Hall Beta (High-Density HPC)',
    420.00,
    'Direct-to-Chip Liquid + In-Row CDU'
);

-- 3. Racks (6 racks per hall = 12 total)
INSERT INTO racks (hall_id, label, row, position, rated_kw) VALUES
('22222222-2222-2222-2222-222222222201', 'RACK-A01', 'Row A', 1, 15.00),
('22222222-2222-2222-2222-222222222201', 'RACK-A02', 'Row A', 2, 15.00),
('22222222-2222-2222-2222-222222222201', 'RACK-A03', 'Row A', 3, 15.00),
('22222222-2222-2222-2222-222222222201', 'RACK-A04', 'Row A', 4, 15.00),
('22222222-2222-2222-2222-222222222201', 'RACK-A05', 'Row A', 5, 15.00),
('22222222-2222-2222-2222-222222222201', 'RACK-A06', 'Row A', 6, 15.00),

('22222222-2222-2222-2222-222222222202', 'RACK-B01', 'Row B', 1, 20.00),
('22222222-2222-2222-2222-222222222202', 'RACK-B02', 'Row B', 2, 20.00),
('22222222-2222-2222-2222-222222222202', 'RACK-B03', 'Row B', 3, 20.00),
('22222222-2222-2222-2222-222222222202', 'RACK-B04', 'Row B', 4, 20.00),
('22222222-2222-2222-2222-222222222202', 'RACK-B05', 'Row B', 5, 20.00),
('22222222-2222-2222-2222-222222222202', 'RACK-B06', 'Row B', 6, 20.00);

-- 4. Assets: 2 CDUs, 1 Diesel Tank, 1 Generator, 2 UPS Units
INSERT INTO assets (id, site_id, hall_id, tag, name, type, geometry_config)
VALUES
(
    '33333333-3333-3333-3333-333333333301',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'CDU-01',
    'In-Row CDU Primary Loop Alpha',
    'cdu',
    '{
        "tank_height_cm": 40.0,
        "usable_height_cm": 35.0,
        "deadzone_cm": 5.0,
        "capacity_litres": 80.0,
        "nominal_pressure_bar": 2.5,
        "leak_detection_rate_pct_min": 2.0
    }'::jsonb
),
(
    '33333333-3333-3333-3333-333333333302',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222202',
    'CDU-02',
    'In-Row CDU Primary Loop Beta',
    'cdu',
    '{
        "tank_height_cm": 40.0,
        "usable_height_cm": 35.0,
        "deadzone_cm": 5.0,
        "capacity_litres": 80.0,
        "nominal_pressure_bar": 2.5,
        "leak_detection_rate_pct_min": 2.0
    }'::jsonb
),
(
    '33333333-3333-3333-3333-333333333303',
    '11111111-1111-1111-1111-111111111111',
    NULL,
    'DIESEL-TK-01',
    'Main Generator Bulk Day Tank',
    'diesel_tank',
    '{
        "tank_height_cm": 150.0,
        "usable_height_cm": 135.0,
        "deadzone_cm": 15.0,
        "capacity_litres": 2000.0,
        "nominal_burn_rate_lph": 65.0,
        "full_load_burn_rate_lph": 110.0
    }'::jsonb
),
(
    '33333333-3333-3333-3333-333333333304',
    '11111111-1111-1111-1111-111111111111',
    NULL,
    'GENSET-01',
    'Standby Diesel Generator 1000kVA',
    'generator',
    '{
        "rated_kva": 1000,
        "rated_kw": 800,
        "voltage": 415,
        "fuel_type": "Ultra-Low Sulfur Diesel"
    }'::jsonb
),
(
    '33333333-3333-3333-3333-333333333305',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'UPS-A',
    'Modular Online Double-Conversion UPS A',
    'ups',
    '{
        "rated_kw": 250.0,
        "efficiency_nominal": 0.940
    }'::jsonb
);

-- 5. Ingestion Devices
-- Note: api_key_hash is SHA256 of 'dcim_dev_ingest_key_9921'
INSERT INTO devices (id, site_id, hall_id, name, api_key_hash, firmware_version, publish_interval_sec, status)
VALUES
(
    'wokwi-esp32-01',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'ESP32 Physical Twin Hall-A (Wokwi)',
    'de9dcb74a60e9c0a3b61a1b8699140d6082c572cfb07809b4faa18849a8252e8',
    'v1.2.0-wokwi',
    5,
    'online'
),
(
    'sim-node-01',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'Node Scenario Simulator Hall-A',
    'de9dcb74a60e9c0a3b61a1b8699140d6082c572cfb07809b4faa18849a8252e8',
    'v1.0.0-node-sim',
    3,
    'online'
);

-- 6. Sensor Registry mapping device channels to assets/metrics
INSERT INTO sensors (device_id, asset_id, code, kind, unit)
VALUES
-- wokwi-esp32-01 channels
('wokwi-esp32-01', NULL, 'cold_aisle_temp_c', 'temp_cold', '°C'),
('wokwi-esp32-01', NULL, 'cold_aisle_rh', 'humidity', '%RH'),
('wokwi-esp32-01', NULL, 'hot_aisle_temp_c', 'temp_hot', '°C'),
('wokwi-esp32-01', NULL, 'hot_aisle_rh', 'humidity', '%RH'),
('wokwi-esp32-01', '33333333-3333-3333-3333-333333333301', 'coolant_pressure_bar', 'pressure', 'bar'),
('wokwi-esp32-01', '33333333-3333-3333-3333-333333333301', 'cdu_reservoir_distance_cm', 'level', 'cm'),
('wokwi-esp32-01', '33333333-3333-3333-3333-333333333303', 'diesel_distance_cm', 'level', 'cm'),
('wokwi-esp32-01', NULL, 'rack_it_kw', 'power_it', 'kW'),

-- sim-node-01 channels (matches payload schema)
('sim-node-01', NULL, 'cold_aisle_temp_c', 'temp_cold', '°C'),
('sim-node-01', NULL, 'cold_aisle_rh', 'humidity', '%RH'),
('sim-node-01', NULL, 'hot_aisle_temp_c', 'temp_hot', '°C'),
('sim-node-01', NULL, 'hot_aisle_rh', 'humidity', '%RH'),
('sim-node-01', '33333333-3333-3333-3333-333333333301', 'coolant_pressure_bar', 'pressure', 'bar'),
('sim-node-01', '33333333-3333-3333-3333-333333333301', 'cdu_reservoir_distance_cm', 'level', 'cm'),
('sim-node-01', '33333333-3333-3333-3333-333333333303', 'diesel_distance_cm', 'level', 'cm'),
('sim-node-01', NULL, 'rack_it_kw', 'power_it', 'kW');

-- 7. Alert Rules (Standard DCIM & ASHRAE Envelopes)
INSERT INTO alert_rules (code, name, scope, metric, operator, warn_threshold, crit_threshold, for_seconds, hysteresis, enabled, metadata)
VALUES
(
    'RULE_COLD_TEMP',
    'Cold Aisle Supply Temperature High',
    'hall',
    'cold_aisle_temp_c',
    '>',
    27.0,
    32.0,
    5,
    0.5,
    true,
    '{"runbook": "Check CRAH units, damper positions, and chilled water supply valve."}'::jsonb
),
(
    'RULE_DELTA_T',
    'Hot/Cold Aisle Delta-T High',
    'hall',
    'delta_t_c',
    '>',
    15.0,
    20.0,
    10,
    1.0,
    true,
    '{"runbook": "Inspect rack blanking panels, tile airflow perforation, and fan trays."}'::jsonb
),
(
    'RULE_HUMIDITY',
    'Cold Aisle Relative Humidity Out of Envelope',
    'hall',
    'cold_aisle_rh',
    'outside',
    20.0,
    80.0,
    15,
    2.0,
    true,
    '{"runbook": "Verify ultrasonic humidifier steam canister and dewpoint controller."}'::jsonb
),
(
    'RULE_COOLANT_PRESSURE',
    'CDU Coolant Loop Pressure Low',
    'asset',
    'coolant_pressure_bar',
    '<',
    1.50,
    1.00,
    5,
    0.15,
    true,
    '{"runbook": "Check primary loop recirculation pump and expansion tank bladder."}'::jsonb
),
(
    'RULE_CDU_LEAK_COMPOUND',
    'CDU Coolant Leak Suspicion (Compound Rule)',
    'asset',
    'cdu_leak_suspicion',
    'compound',
    1.50, -- Level drop rate %/min warning
    2.00, -- Level drop rate %/min critical (AND pressure drop)
    5,
    0.2,
    true,
    '{"runbook": "EMERGENCY: Suspected glycol/water breach. Check subfloor drip trays and isolate manifold solenoid."}'::jsonb
),
(
    'RULE_RESERVOIR_LEVEL',
    'CDU Expansion Reservoir Level Low',
    'asset',
    'cdu_reservoir_level_pct',
    '<',
    30.0,
    15.0,
    5,
    3.0,
    true,
    '{"runbook": "Top up distilled glycol coolant mixture in expansion reservoir tank."}'::jsonb
),
(
    'RULE_DIESEL_LEVEL',
    'Generator Day Tank Fuel Level Low',
    'asset',
    'diesel_level_pct',
    '<',
    40.0,
    20.0,
    10,
    2.0,
    true,
    '{"runbook": "Contact Vivo Energy / TotalEnergies fuel vendor for priority bulk dispatch."}'::jsonb
),
(
    'RULE_DIESEL_RUNTIME',
    'Diesel Generator Autonomy Time Critical',
    'asset',
    'diesel_runtime_hours',
    '<',
    4.0,
    2.0,
    10,
    0.5,
    true,
    '{"runbook": "Immediate fuel tanker dispatch required. Shed non-essential testing load."}'::jsonb
),
(
    'RULE_PUE_HIGH',
    'Data Hall PUE Inefficiency High',
    'hall',
    'pue',
    '>',
    1.60,
    2.00,
    15,
    0.05,
    true,
    '{"runbook": "Review chiller plant optimization, economizer status, and CRAH setpoints."}'::jsonb
),
(
    'RULE_DEVICE_STALE',
    'Telemetry Device Stale / Heartbeat Missed',
    'device',
    'device_stale_seconds',
    '>',
    15.0, -- 3x 5s publish interval
    50.0, -- 10x 5s publish interval
    0,
    0.0,
    true,
    '{"runbook": "Check physical sensor microcontroller power, gateway switch, and WiFi link."}'::jsonb
);

-- 8. Webhook Endpoints
INSERT INTO webhook_endpoints (id, name, url, secret, kind, enabled)
VALUES
(
    '44444444-4444-4444-4444-444444444401',
    'Local NOC Mock On-Call Sink',
    'http://localhost:3000/api/mock-oncall',
    'coldaisle_default_hmac_secret_4421',
    'generic',
    true
),
(
    '44444444-4444-4444-4444-444444444402',
    'Slack Escalation NOC Channel',
    'http://localhost:3000/api/mock-oncall?sink=slack',
    'coldaisle_default_hmac_secret_4421',
    'slack',
    true
);

-- 9. Escalation Policies (Tier 1: 0s, Tier 2: 300s, Tier 3: 900s)
INSERT INTO escalation_policies (id, name, tiers, is_default)
VALUES
(
    '55555555-5555-5555-5555-555555555501',
    'Standard Tier-III 3-Tier NOC Escalation',
    '[
        {
            "tier": 1,
            "delay_seconds": 0,
            "endpoint_ids": ["44444444-4444-4444-4444-444444444401"]
        },
        {
            "tier": 2,
            "delay_seconds": 300,
            "endpoint_ids": ["44444444-4444-4444-4444-444444444401", "44444444-4444-4444-4444-444444444402"]
        },
        {
            "tier": 3,
            "delay_seconds": 900,
            "endpoint_ids": ["44444444-4444-4444-4444-444444444401", "44444444-4444-4444-4444-444444444402"]
        }
    ]'::jsonb,
    true
);

-- 10. Initial Baseline pue_sample for immediate chart rendering
INSERT INTO pue_samples (hall_id, ts, it_kw, cooling_kw, ups_loss_kw, other_kw, total_kw, pue)
VALUES (
    '22222222-2222-2222-2222-222222222201',
    NOW() - INTERVAL '5 minutes',
    46.80,
    11.48,
    2.98,
    4.50,
    65.76,
    1.405
);
