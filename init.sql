-- 1. Zapnutí TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Vytvoření vlastních datových typů (ENUM)
CREATE TYPE machine_status_type AS ENUM ('OK', 'WARNING', 'FAULT', 'STOPPED');
CREATE TYPE sensor_status_type AS ENUM ('available', 'maintenance', 'active');
CREATE TYPE severity_type AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE user_role AS ENUM ('admin', 'operator', 'user');

-- 3. Vytvoření běžných tabulek (Dimension tables)
CREATE TABLE users (
    id_user SERIAL PRIMARY KEY,
    username text UNIQUE NOT NULL,
    email text UNIQUE NOT NULL,
    hashed_password text NOT NULL,
    role user_role DEFAULT 'user'::user_role NOT NULL,
    creation_time timestamp with time zone DEFAULT now() NOT NULL,
    last_login timestamp with time zone
);

CREATE TABLE machines (
    id_machine SERIAL PRIMARY KEY,
    name text NOT NULL,
    type text,
    location text NOT NULL,
    installation_date date DEFAULT now() NOT NULL,
    status machine_status_type DEFAULT 'STOPPED'::machine_status_type,
    description text,
    -- SLOUPCE PRO KONEKTIVITU
    opc_ua_url VARCHAR(255),
    ftp_host VARCHAR(100),
    ftp_user VARCHAR(100),
    ftp_password VARCHAR(100),
    ftp_dir VARCHAR(255) DEFAULT '/C:/BufferData/',
    is_active_collection BOOLEAN DEFAULT FALSE,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE machine_alert_policy (
    id_machine integer PRIMARY KEY REFERENCES machines(id_machine) ON DELETE CASCADE,
    operating_mode text NOT NULL DEFAULT 'normal',
    anomaly_threshold_startup double precision NOT NULL DEFAULT 0.85,
    anomaly_threshold_normal double precision NOT NULL DEFAULT 0.75,
    anomaly_threshold_overload double precision NOT NULL DEFAULT 0.90,
    anomaly_threshold_maintenance double precision NOT NULL DEFAULT 0.99,
    consecutive_anomaly_limit integer NOT NULL DEFAULT 2,
    cooldown_minutes integer NOT NULL DEFAULT 20,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE ml_models (
    id_model SERIAL PRIMARY KEY,
    name text NOT NULL,
    version text,
    type text,
    path_to_model text NOT NULL,
    accuracy double precision,
    training_date timestamp with time zone DEFAULT now(),
    description text,
    is_active boolean DEFAULT true,
    training_status text DEFAULT 'ready'::text NOT NULL
);

CREATE TABLE sensors (
    id_sensor SERIAL PRIMARY KEY,
    serial_number text UNIQUE NOT NULL,
    description text NOT NULL,
    status sensor_status_type DEFAULT 'available'::sensor_status_type,
    id_machine integer REFERENCES machines(id_machine) ON DELETE CASCADE,
    "position" text,
    module_path text,
    channel_no integer,
    sampling_rate double precision,
    calibration_date date,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    UNIQUE (id_machine, channel_no)
);

-- PŘESTUPNÍ TABULKA PRO B&R IIoT CONNECTOR
CREATE TABLE iiot_buffer (
    id SERIAL PRIMARY KEY,
    "messageId" text,
    "applicationId" text,
    "uploadTimestamp" timestamp with time zone,
    "scheduledTimestamp" timestamp with time zone,
    tags text,
    data jsonb,
    "customerInformation" text,
    "edgeNodeId" text
);

-- =========================================================================
-- 4. Vytvoření časových tabulek připravených pro TimescaleDB (Hypertables)
-- =========================================================================

CREATE TABLE measurements (
    id_measurement SERIAL,
    id_sensor integer NOT NULL REFERENCES sensors(id_sensor) ON DELETE CASCADE,
    "timestamp" timestamp with time zone DEFAULT now(),
    raw_data_path text,
    notes text,
    
    -- CHARAKTERISTICKÉ HODNOTY DOPOČÍTANÉ ZE SUROVÝCH DAT
    rms_raw double precision,
    peak_raw double precision,
    kurtosis_raw double precision,
    rms_acl_env double precision,
    dif_kt_raw double precision,
    skewness_raw double precision,
    act_speed double precision,
    
    PRIMARY KEY (id_measurement, "timestamp")
);

CREATE TABLE feature_data (
    id_featureset SERIAL,
    id_measurement integer, 
    id_machine integer REFERENCES machines(id_machine) ON DELETE CASCADE,
    "time" timestamp with time zone DEFAULT now(),
    id_sensor integer NOT NULL REFERENCES sensors(id_sensor) ON DELETE CASCADE,
    
    -- KOMPLETNÍ HODNOTY Z OPC UA / IIoT
    rms_raw double precision,
    peak_raw double precision,
    kurtosis_raw double precision,
    rms_acl_env double precision,
    dif_kt_raw double precision,
    skewness_raw double precision,
    act_speed double precision,
    
    PRIMARY KEY (id_featureset, "time")
);

CREATE TABLE analysis_results (
    id_analysis SERIAL,
    id_model integer NOT NULL REFERENCES ml_models(id_model) ON DELETE CASCADE,
    prediction_type text NOT NULL,
    prediction_value double precision,
    confidence double precision,
    "timestamp" timestamp with time zone DEFAULT now(),
    id_measurement integer NOT NULL, 
    prediction_label text,
    PRIMARY KEY (id_analysis, "timestamp")
);

CREATE TABLE service_notes (
    id_note SERIAL PRIMARY KEY,
    id_machine integer NOT NULL REFERENCES machines(id_machine) ON DELETE CASCADE,
    id_analysis integer,
    id_user integer NOT NULL REFERENCES users(id_user),
    "timestamp" timestamp with time zone DEFAULT now(),
    content text NOT NULL,
    severity severity_type DEFAULT 'INFO'::severity_type,
    deleted_at timestamp with time zone
);

CREATE TABLE buffer_download_jobs (
    id_job SERIAL PRIMARY KEY,
    id_machine integer NOT NULL REFERENCES machines(id_machine) ON DELETE CASCADE,
    id_sensor integer REFERENCES sensors(id_sensor) ON DELETE SET NULL,
    work_id text NOT NULL,
    buffer_type text NOT NULL DEFAULT 'raw',
    channel integer NOT NULL,
    buffer_number integer NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    csv_filename text,
    remote_path text,
    local_path text,
    file_hash text,
    error_detail text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone
);

CREATE INDEX idx_buffer_download_jobs_machine_created ON buffer_download_jobs(id_machine, created_at DESC);
CREATE INDEX idx_buffer_download_jobs_work_id ON buffer_download_jobs(work_id);

-- 5. Samotné převedení časových tabulek na TimescaleDB Hypertables
SELECT create_hypertable('measurements', 'timestamp');
SELECT create_hypertable('feature_data', 'time');
SELECT create_hypertable('analysis_results', 'timestamp');

-- =========================================================================
-- 6. DB TRIGGER A FUNKCE PRO ZPRACOVÁNÍ JSON DAT Z B&R CONNECTOUR
-- =========================================================================
CREATE OR REPLACE FUNCTION process_iiot_json()
RETURNS TRIGGER AS $$
BEGIN
    WITH parsed_data AS (
        SELECT
            (resp->>'sourceTimestamp')::timestamp with time zone as ts,
            substring(resp->>'nodeId' from '\[([0-9]+)\]')::integer as id_sensor,
            split_part(resp->>'nodeId', '.', 2) as variable_name,
            (resp->>'value')::double precision as val
        FROM jsonb_array_elements( (NEW.data::jsonb) -> 'opc-ua-read' -> 'responses' ) as resp
        WHERE resp->'statusCode'->>'name' = 'Good'
    ),
    pivoted_data AS (
        SELECT
            ts,
            id_sensor,
            MAX(CASE WHEN variable_name = 'RmsAccRaw' THEN val END) as rms_raw,
            MAX(CASE WHEN variable_name = 'KurtosisRaw' THEN val END) as kurtosis_raw,
            MAX(CASE WHEN variable_name = 'RmsAccEnvelope' THEN val END) as rms_acl_env,
            MAX(CASE WHEN variable_name = 'Vdi3832KtRaw' THEN val END) as dif_kt_raw,
            MAX(CASE WHEN variable_name = 'SkewnessRaw' THEN val END) as skewness_raw,
            MAX(CASE WHEN variable_name = 'ActSpeed' THEN val END) as act_speed
        FROM parsed_data
        GROUP BY ts, id_sensor
    )
    
    INSERT INTO feature_data ("time", id_sensor, id_machine, rms_raw, peak_raw, kurtosis_raw, rms_acl_env, dif_kt_raw, skewness_raw, act_speed)
    SELECT 
        ts, 
        id_sensor, 
        (SELECT id_machine FROM sensors WHERE id_sensor = pivoted_data.id_sensor LIMIT 1),
        rms_raw,
        rms_raw * 1.414,
        kurtosis_raw,
        rms_acl_env,
        dif_kt_raw,
        skewness_raw,
        act_speed
    FROM pivoted_data;

    DELETE FROM iiot_buffer WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_iiot_to_timescale
AFTER INSERT ON iiot_buffer
FOR EACH ROW
EXECUTE FUNCTION process_iiot_json();

-- 7. Vložení počátečních dat (Pouze admin)
INSERT INTO users (id_user, username, email, hashed_password, role, creation_time, last_login)
VALUES (
    1,
    'admin',
    'admin@vut.cz',
    '$2b$12$hMxV0Sbjwmt3n9b1/PX5XOPIL83ULMtNT2PfFbib1UWeThxBwizQm',
    'admin',
    '2026-01-07 09:50:50.519587+00',
    '2026-04-23 06:46:51.150605+00'
);

INSERT INTO machines (id_machine, name, type, location, status, description, is_active_collection)
VALUES (
    1,
    'Ventilator 01',
    'Ventilator',
    'Test bench',
    'OK',
    'Primary machine for vibro diagnostics',
    TRUE
);

INSERT INTO machine_alert_policy (id_machine)
VALUES (1)
ON CONFLICT (id_machine) DO NOTHING;

INSERT INTO sensors (id_sensor, serial_number, description, status, id_machine, "position", sampling_rate, calibration_date)
VALUES
    (1, 'auto-1', 'Channel 1 sensor', 'active', 1, 'Channel 1', 'IF3.ST1.IF1.ST2', 1, 0, CURRENT_DATE),
    (2, 'auto-2', 'Channel 2 sensor', 'active', 1, 'Channel 2', 'IF3.ST1.IF1.ST2', 2, 0, CURRENT_DATE),
    (3, 'auto-3', 'Channel 3 sensor', 'active', 1, 'Channel 3', 'IF3.ST1.IF1.ST2', 3, 0, CURRENT_DATE),
    (4, 'auto-4', 'Channel 4 sensor', 'active', 1, 'Channel 4', 'IF3.ST1.IF1.ST2', 4, 0, CURRENT_DATE);

-- 8. Vlozeni vychoziho katalogu ML modelu
INSERT INTO ml_models (name, version, type, path_to_model, accuracy, description, is_active, training_status)
VALUES
    ('AE_ANOWGAN', '1.0', 'Anomaly Detection', 'models/AE_ANOWGAN/v1', 0.92, 'Detekce anomalii pomoci AE-AnoWGAN', true, 'ready'),
    ('1D_CNN', '1.0', 'Fault Classification', 'models/1DCNN/v1/bearing_fault_model.pth', 0.95, 'Klasifikace poruch lozisek pomoci 1D CNN', true, 'ready'),
    ('Bi-LSTM', '1.0', 'RUL Prediction', 'models/Bi-LSTM/v1', 0.90, 'Predikce zbytkove zivotnosti (RUL) pomoci Bi-LSTM', true, 'ready');

-- 9. Synchronizace sekvence
SELECT setval('users_id_user_seq', (SELECT MAX(id_user) FROM users));
SELECT setval('machines_id_machine_seq', (SELECT MAX(id_machine) FROM machines));
SELECT setval('sensors_id_sensor_seq', (SELECT MAX(id_sensor) FROM sensors));