-- SpaceFire AI database schema (SQLite + FTS5).
-- Generated entirely by `python -m app.ingest.run`; original NASA files are never written.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investigations (
  investigation_id TEXT PRIMARY KEY,          -- PSI-69 / PSI-25 / PSI-98
  key TEXT NOT NULL UNIQUE,                   -- flex / bass2 / saffire1
  short_name TEXT NOT NULL,                   -- FLEX / BASS-II / SAFFIRE-I
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  scale TEXT NOT NULL,
  fuel_system TEXT NOT NULL,
  doi TEXT,
  official_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS source_files (
  source_id TEXT PRIMARY KEY,                 -- first 12 hex of sha256
  relative_path TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  investigation_id TEXT,
  role TEXT NOT NULL,                         -- experiment_table / document / metadata / manifest / calibration / archive
  duplicate_of TEXT,                          -- relative_path of the canonical copy
  ingested_at TEXT NOT NULL,
  parse_status TEXT NOT NULL,                 -- parsed / skipped_duplicate / failed / not_parsed
  access_status TEXT NOT NULL DEFAULT 'local',
  notes TEXT
);
CREATE INDEX IF NOT EXISTS ix_source_sha ON source_files(sha256);

CREATE TABLE IF NOT EXISTS experiments (
  experiment_uid TEXT PRIMARY KEY,            -- flex:{row} / bass2:{row} / saffire1:S1
  investigation_id TEXT NOT NULL REFERENCES investigations(investigation_id),
  source_id TEXT NOT NULL REFERENCES source_files(source_id),
  source_row INTEGER NOT NULL,                -- 1-based data row (CSV line = source_row + 1)
  display_id TEXT NOT NULL,
  experiment_kind TEXT NOT NULL,              -- burn / image_set
  raw_json TEXT NOT NULL                      -- ordered [[header, raw_cell], ...] exactly as in source
);
CREATE INDEX IF NOT EXISTS ix_exp_inv_kind ON experiments(investigation_id, experiment_kind);
CREATE INDEX IF NOT EXISTS ix_exp_display ON experiments(investigation_id, display_id);

CREATE TABLE IF NOT EXISTS observations (
  observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_uid TEXT NOT NULL REFERENCES experiments(experiment_uid),
  column_index INTEGER NOT NULL,
  raw_field TEXT NOT NULL,                    -- exact original header
  raw_text TEXT NOT NULL,                     -- exact original cell
  value_kind TEXT NOT NULL,
  numeric_value REAL,
  numeric_low REAL,
  numeric_high REAL,
  text_value TEXT,
  normalized_name TEXT NOT NULL,
  unit_raw TEXT,
  unit_normalized TEXT,
  measurement_role TEXT NOT NULL,             -- identifier / input / output / instrument / context
  derivation_note TEXT
);
CREATE INDEX IF NOT EXISTS ix_obs_exp ON observations(experiment_uid);
CREATE INDEX IF NOT EXISTS ix_obs_name ON observations(normalized_name);

-- Materialized normalized views (derived; raw stays in observations/raw_json)
CREATE TABLE IF NOT EXISTS flex_tests (
  experiment_uid TEXT PRIMARY KEY REFERENCES experiments(experiment_uid),
  test_number INTEGER,
  identifier TEXT NOT NULL,
  series TEXT NOT NULL,                       -- CAL / F / R / C / H / N
  mixture_code TEXT,
  test_date TEXT,                             -- ISO date
  test_gmt TEXT,
  fuel TEXT NOT NULL,
  pressure_mmhg REAL,
  pressure_atm REAL,
  pressure_band TEXT,
  x_o2 REAL, x_n2 REAL, x_co2 REAL, x_he REAL,
  mole_sum REAL,
  diluent TEXT NOT NULL,                      -- CO2 / He / N2-only
  d0_mm REAL, d0_kind TEXT NOT NULL,
  dext_mm REAL, dext_kind TEXT NOT NULL,
  k_mm2_s REAL, k_kind TEXT NOT NULL,
  burn_time_s REAL, burn_time_kind TEXT NOT NULL,
  test_end TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bass2_tests (
  experiment_uid TEXT PRIMARY KEY REFERENCES experiments(experiment_uid),
  pi TEXT NOT NULL,
  test_id TEXT NOT NULL,
  date_raw TEXT, date_iso TEXT, date_doy INTEGER,
  gmt_doy INTEGER,
  sample_id TEXT,
  material_raw TEXT NOT NULL,
  material_class TEXT NOT NULL,
  material_color TEXT,
  geometry TEXT NOT NULL,
  thickness_mm REAL, diameter_mm REAL, width_cm REAL, sides TEXT,
  material_note TEXT,
  flow_restrictor INTEGER,
  fan_raw TEXT, fan_kind TEXT, fan_tokens_json TEXT,
  air_raw TEXT, air_kind TEXT, air_tokens_json TEXT,
  air_single_cm_s REAL,
  radiometer_gain_raw TEXT,
  frames_raw TEXT,
  o2_initial REAL, o2_initial_kind TEXT,
  o2_final REAL, o2_final_kind TEXT,
  co2_initial REAL, co2_initial_kind TEXT,
  co2_final REAL, co2_final_kind TEXT,
  co_initial REAL, co_initial_kind TEXT,
  co_final REAL, co_final_kind TEXT,
  flow_direction TEXT,                        -- from Summary Report Appendix A (verified rows only)
  flow_direction_source TEXT,
  as_run_number INTEGER
);

CREATE TABLE IF NOT EXISTS saffire_burns (
  experiment_uid TEXT PRIMARY KEY REFERENCES experiments(experiment_uid),
  sample TEXT NOT NULL,
  material TEXT,
  thickness_cm REAL, length_cm REAL, width_cm REAL,
  air_flow_cm_s REAL,
  o2_raw TEXT, o2_kind TEXT, o2_low REAL, o2_high REAL,
  ignition_power_w REAL, ignition_time_s REAL,
  burn_time_s REAL,
  flow_direction TEXT,
  camera_1 TEXT, camera_2 TEXT
);

CREATE TABLE IF NOT EXISTS saffire_image_sets (
  image_set_uid TEXT PRIMARY KEY,             -- saffire1:images:F1
  label TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  raw_label TEXT NOT NULL,
  csv_description TEXT NOT NULL,
  csv_role TEXT NOT NULL,                     -- what CSV says (pre-test)
  documented_role TEXT NOT NULL,              -- what DoD/workbook supports
  manifest_set TEXT NOT NULL                  -- PreFlowVis / PostFlowVis
);

CREATE TABLE IF NOT EXISTS saffire_manifest (
  set_label TEXT NOT NULL,                    -- BIT / PreFlowVis / PostFlowVis / Sample1 / Sample2
  camera TEXT NOT NULL,
  frames INTEGER NOT NULL,
  start_utc TEXT NOT NULL,
  end_utc TEXT NOT NULL,
  duration_s REAL NOT NULL,
  median_dt_ms REAL,
  max_gap_ms REAL,
  jpeg_received INTEGER NOT NULL,
  jpeg_corrupt INTEGER NOT NULL,
  zips_listed INTEGER NOT NULL,
  zips_received INTEGER NOT NULL,
  PRIMARY KEY (set_label, camera)
);

CREATE TABLE IF NOT EXISTS saffire_timeline (
  set_label TEXT NOT NULL,
  camera TEXT NOT NULL,
  bin_start_s INTEGER NOT NULL,               -- seconds since first frame of this camera/set
  bin_start_utc TEXT NOT NULL,
  frames INTEGER NOT NULL,
  received INTEGER NOT NULL,
  corrupt INTEGER NOT NULL,
  PRIMARY KEY (set_label, camera, bin_start_s)
);

CREATE TABLE IF NOT EXISTS quality_flags (
  flag_id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  experiment_uid TEXT,
  source_id TEXT,
  source_row INTEGER,
  raw_field TEXT,
  raw_value TEXT,
  rule_id TEXT NOT NULL,
  category TEXT NOT NULL,                     -- missing / invalid / inconsistent / duplicate / document_conflict / source_warning / unit / suspicious
  severity TEXT NOT NULL,                     -- info / warning / critical
  description TEXT NOT NULL,
  derived_value TEXT,
  evidence_ref TEXT,                          -- document / page supporting the flag, if any
  proposed_correction TEXT,
  status TEXT NOT NULL                        -- reported / confirmed / disputed / unresolved
);
CREATE INDEX IF NOT EXISTS ix_flag_exp ON quality_flags(experiment_uid);
CREATE INDEX IF NOT EXISTS ix_flag_rule ON quality_flags(rule_id);

CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source_files(source_id),
  relative_path TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  investigation_id TEXT,
  doc_type TEXT NOT NULL,                     -- nasa_report / paper / slides / requirements / procedure / metadata / data_description
  scope_note TEXT,
  page_count INTEGER,
  printed_page_offset INTEGER,                -- printed = pdf - offset, when known
  rights TEXT NOT NULL,
  extraction_status TEXT NOT NULL,
  low_text_pages_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS document_chunks (
  chunk_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  ordinal INTEGER NOT NULL,
  page_pdf INTEGER,
  page_printed INTEGER,
  section TEXT,
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  is_verified INTEGER NOT NULL DEFAULT 1      -- text is a verbatim extraction of the page
);
CREATE INDEX IF NOT EXISTS ix_chunk_doc ON document_chunks(document_id, ordinal);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_id UNINDEXED, title, section, text,
  tokenize = 'porter unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS evidence_links (
  link_id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_uid TEXT NOT NULL REFERENCES experiments(experiment_uid),
  chunk_id TEXT NOT NULL REFERENCES document_chunks(chunk_id),
  relation_type TEXT NOT NULL,                -- explicit_id / material_scope
  match_method TEXT NOT NULL,
  matched_text TEXT,
  review_status TEXT NOT NULL                 -- auto_unreviewed / curated
);
CREATE INDEX IF NOT EXISTS ix_link_exp ON evidence_links(experiment_uid);

CREATE TABLE IF NOT EXISTS report_records (
  record_id TEXT PRIMARY KEY,                 -- e.g. bass2-sr:5.1:M7
  document_id TEXT NOT NULL,
  table_id TEXT NOT NULL,                     -- 5.1 / 7.1 / A.4 ...
  page_pdf INTEGER NOT NULL,
  page_printed INTEGER,
  row_key TEXT NOT NULL,                      -- identifier as printed (M7, GMT175-T9)
  test_id TEXT NOT NULL,
  experiment_uid TEXT REFERENCES experiments(experiment_uid),
  investigation TEXT NOT NULL,                -- BASS-II or BASS (I)
  verification TEXT NOT NULL,                 -- verified / needs_review / not_applicable
  values_json TEXT NOT NULL,
  units_json TEXT NOT NULL,
  raw_json TEXT NOT NULL,                     -- verbatim printed cells
  checks_json TEXT NOT NULL,
  notes_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_report_exp ON report_records(experiment_uid);

CREATE TABLE IF NOT EXISTS investigation_publications (
  pub_id INTEGER PRIMARY KEY AUTOINCREMENT,
  investigation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT,
  doi TEXT,
  status TEXT,
  source_id TEXT NOT NULL                     -- ISA-Tab i_Investigation.txt
);

CREATE TABLE IF NOT EXISTS external_papers (
  paper_id TEXT PRIMARY KEY,                  -- doi:<doi> or <provider>:<id>
  doi TEXT UNIQUE,
  canonical_url TEXT,
  title TEXT NOT NULL,
  authors_json TEXT NOT NULL DEFAULT '[]',
  year INTEGER,
  venue TEXT,
  abstract TEXT,
  access_type TEXT NOT NULL,                  -- abstract / metadata
  is_open_access INTEGER,
  provider_json TEXT NOT NULL DEFAULT '{}',
  first_seen_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS external_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  analysis_id TEXT PRIMARY KEY,
  analysis_type TEXT NOT NULL,
  input_filter_json TEXT NOT NULL,
  formula TEXT NOT NULL,
  result_json TEXT NOT NULL,
  n INTEGER NOT NULL,
  source_hashes_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_runs (
  run_id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  feature_set_json TEXT NOT NULL,
  split_strategy TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  artifact_path TEXT,
  source_hash TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Phase 13: verified derivatives of the seven newly audited investigations (built by app.ingest.phase13, loaded
-- from processed/curated/phase13/*.json). Values are never edited; raw strings and provenance travel with them.
CREATE TABLE IF NOT EXISTS investigation_registry (
  investigation_id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  scenario TEXT NOT NULL,                     -- material_flame_spread / gaseous_flame_behavior / ...
  readiness TEXT NOT NULL,                    -- quantitative / curated_tables / figure_data / conditions_only / ...
  registry_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS p13_datasets (
  dataset_id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  evidence_class TEXT NOT NULL,
  meta_json TEXT NOT NULL                     -- description, sources (path + sha256), field_specs, counts, notes, extra
);

CREATE TABLE IF NOT EXISTS p13_records (
  record_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES p13_datasets(dataset_id),
  investigation_id TEXT NOT NULL,
  test_id TEXT,
  source_file TEXT NOT NULL,
  source_table TEXT,
  page_pdf INTEGER,
  source_row INTEGER,
  verification TEXT NOT NULL,
  values_json TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  flags_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_p13_rec_ds ON p13_records(dataset_id);
CREATE INDEX IF NOT EXISTS ix_p13_rec_test ON p13_records(investigation_id, test_id);

-- Long-format view of every processed scalar value with its evidence class, units and transformation.
CREATE TABLE IF NOT EXISTS p13_values (
  record_id TEXT NOT NULL REFERENCES p13_records(record_id),
  dataset_id TEXT NOT NULL,
  investigation_id TEXT NOT NULL,
  test_id TEXT,
  field TEXT NOT NULL,
  variable TEXT NOT NULL,
  raw_column TEXT,
  original_value TEXT,
  original_unit TEXT,
  value REAL,
  value_text TEXT,
  unit TEXT,
  unit_status TEXT,
  transform TEXT,
  evidence_class TEXT NOT NULL,
  verification TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_p13_val ON p13_values(dataset_id, field);
