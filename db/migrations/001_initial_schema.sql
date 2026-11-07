-- =============================================================================
-- Migration 001: Initial Schema for ColdAisle DCIM Telemetry Twin
-- Compatible with PostgreSQL 16
-- =============================================================================

-- Ensure clean teardown if rebuilding
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhook_endpoints CASCADE;
DROP TABLE IF EXISTS escalation_policies CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS pue_samples CASCADE;
DROP TABLE IF EXISTS readings CASCADE;
DROP TABLE IF EXISTS sensors CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS racks CASCADE;
DROP TABLE IF EXISTS halls CASCADE;
DROP TABLE IF EXISTS sites CASCADE;

-- Sites (Data Center Campuses)
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    location VARCHAR(128) NOT NULL DEFAULT 'Nairobi, Kenya',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Nairobi',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Halls within a Site
CREATE TABLE halls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    total_floor_sqm NUMERIC(8,2) NOT NULL DEFAULT 350.00,
    cooling_type VARCHAR(64) NOT NULL DEFAULT 'In-Row CDU + Chilled Water Loop',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, code)
);

-- Racks in a Data Hall
CREATE TABLE racks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hall_id UUID NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    label VARCHAR(32) NOT NULL,
    row VARCHAR(16) NOT NULL,
    position INTEGER NOT NULL,
    rated_kw NUMERIC(6,2) NOT NULL DEFAULT 15.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(hall_id, label)
);

-- Physical Plant Infrastructure Assets (CDUs, Tanks, Gensets, UPS)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    hall_id UUID REFERENCES halls(id) ON DELETE SET NULL,
    tag VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL, -- 'cdu', 'diesel_tank', 'generator', 'ups'
    geometry_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Telemetry Ingestion Devices (Microcontrollers, Simulators)
CREATE TABLE devices (
    id VARCHAR(64) PRIMARY KEY, -- 'wokwi-esp32-01', 'sim-node-01'
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    hall_id UUID NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    api_key_hash VARCHAR(128) NOT NULL,
    firmware_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0-telemetry',
    publish_interval_sec INTEGER NOT NULL DEFAULT 5,
    last_seen_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'offline', -- 'online', 'stale', 'offline'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sensor Registry
CREATE TABLE sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    rack_id UUID REFERENCES racks(id) ON DELETE SET NULL,
    code VARCHAR(64) NOT NULL, -- e.g. 'cold_aisle_temp_c', 'coolant_pressure_bar'
    kind VARCHAR(32) NOT NULL, -- 'temp_cold', 'temp_hot', 'humidity', 'level', 'pressure', 'power_it', etc.
    unit VARCHAR(16) NOT NULL, -- '°C', '%RH', 'bar', 'cm', '%', 'L', 'kW', 'h'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, code)
);

-- Time-Series Sensor Readings
CREATE TABLE readings (
    id BIGSERIAL PRIMARY KEY,
    sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value NUMERIC(12,4) NOT NULL
);

CREATE INDEX idx_readings_sensor_ts ON readings (sensor_id, ts DESC);
CREATE INDEX idx_readings_ts ON readings (ts DESC);

-- PUE Derived Samples (Time-Bucket aggregated and instantaneous)
CREATE TABLE pue_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hall_id UUID NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    it_kw NUMERIC(10,3) NOT NULL,
    cooling_kw NUMERIC(10,3) NOT NULL,
    ups_loss_kw NUMERIC(10,3) NOT NULL,
    other_kw NUMERIC(10,3) NOT NULL,
    total_kw NUMERIC(10,3) NOT NULL,
    pue NUMERIC(6,3) NOT NULL
);

CREATE INDEX idx_pue_samples_hall_ts ON pue_samples (hall_id, ts DESC);
CREATE INDEX idx_pue_samples_ts ON pue_samples (ts DESC);

-- Alert Rules Definition
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    scope VARCHAR(64) NOT NULL DEFAULT 'global', -- 'global', 'hall', 'rack', 'asset'
    metric VARCHAR(64) NOT NULL,
    operator VARCHAR(16) NOT NULL, -- '>', '<', 'outside', 'compound'
    warn_threshold NUMERIC(10,3),
    crit_threshold NUMERIC(10,3),
    for_seconds INTEGER NOT NULL DEFAULT 0,
    hysteresis NUMERIC(10,3) NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active and Historical Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    severity VARCHAR(16) NOT NULL, -- 'warn', 'critical'
    state VARCHAR(16) NOT NULL DEFAULT 'firing', -- 'firing', 'acknowledged', 'resolved'
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acked_at TIMESTAMPTZ,
    acked_by VARCHAR(128),
    ack_note TEXT,
    resolved_at TIMESTAMPTZ,
    last_value NUMERIC(12,4),
    dedupe_key VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enforce unique dedupe_key only while an alert is active (firing or acknowledged)
CREATE UNIQUE INDEX idx_alerts_unique_open_dedupe ON alerts (dedupe_key) WHERE state != 'resolved';
CREATE INDEX idx_alerts_state_opened ON alerts (state, opened_at DESC);

-- Escalation Webhook Policies
CREATE TABLE escalation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    tiers JSONB NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook Endpoints (NOC Pager, Slack, SMS)
CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(255) NOT NULL,
    kind VARCHAR(32) NOT NULL DEFAULT 'generic', -- 'generic', 'slack', 'africastalking_sms'
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delivery Audit Log for Webhook Dispatches
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    tier INTEGER NOT NULL DEFAULT 1,
    attempt INTEGER NOT NULL DEFAULT 1,
    status_code INTEGER,
    response_ms INTEGER,
    error TEXT,
    payload JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliveries_alert ON webhook_deliveries (alert_id, sent_at DESC);
