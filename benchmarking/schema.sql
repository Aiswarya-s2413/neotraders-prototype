-- schema.sql
-- Table schemas for the Power User Benchmarking Module

-- Stores the single "Gold Standard" distribution (updated weekly)
CREATE TABLE IF NOT EXISTS power_user_baseline (
    id SERIAL PRIMARY KEY,
    baseline_date DATE DEFAULT CURRENT_DATE,
    feature_distribution JSONB NOT NULL,
    user_count_sampled INT NOT NULL
);

-- Stores the gap analysis and habits for each user
CREATE TABLE IF NOT EXISTS user_benchmarks (
    user_id VARCHAR(255) PRIMARY KEY,
    missing_key_feature VARCHAR(255),
    value_gap_percentage NUMERIC(5, 2),
    habit_classification VARCHAR(50),
    last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
