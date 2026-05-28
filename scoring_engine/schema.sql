-- schema.sql
-- Table schema for storing user intent scores in the Abacus Database

CREATE TABLE IF NOT EXISTS user_intent_scores (
    user_id VARCHAR(255) PRIMARY KEY,
    high_conviction_score NUMERIC(5, 2) DEFAULT 0.0,
    friction_score NUMERIC(5, 2) DEFAULT 0.0,
    evaluation_score NUMERIC(5, 2) DEFAULT 0.0,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying users with high evaluation score or conviction quickly (Module 4)
CREATE INDEX IF NOT EXISTS idx_evaluation_score ON user_intent_scores(evaluation_score DESC);
CREATE INDEX IF NOT EXISTS idx_conviction_score ON user_intent_scores(high_conviction_score DESC);
CREATE INDEX IF NOT EXISTS idx_friction_score ON user_intent_scores(friction_score DESC);
