import os
import psycopg2

DB_HOST = os.getenv("ABACUS_DB_HOST", "localhost")
DB_PORT = os.getenv("ABACUS_DB_PORT", "5435")
DB_USER = os.getenv("ABACUS_DB_USER", "postgres")
DB_PASS = os.getenv("ABACUS_DB_PASS", "abacus_password")
DB_NAME = os.getenv("ABACUS_DB_NAME", "abacus")

def init_database():
    try:
        print("Connecting to the database...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            dbname=DB_NAME
        )
        cursor = conn.cursor()

        print("Creating api_usage_events table (Module 1)...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_usage_events (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                status_code INT NOT NULL,
                response_time_ms NUMERIC(8, 2),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_api_user_timestamp ON api_usage_events(user_id, timestamp);

            CREATE TABLE IF NOT EXISTS captured_events (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category_a BOOLEAN DEFAULT FALSE,
                category_b BOOLEAN DEFAULT FALSE,
                category_c BOOLEAN DEFAULT FALSE,
                notes TEXT,
                user_email VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        print("Migrating captured_events table if needed...")
        cursor.execute("""
            ALTER TABLE captured_events ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
        """)

        print("Executing scoring_engine/schema.sql (Module 2)...")
        with open("scoring_engine/schema.sql", "r") as f:
            cursor.execute(f.read())

        print("Executing benchmarking/schema.sql (Module 3)...")
        with open("benchmarking/schema.sql", "r") as f:
            cursor.execute(f.read())

        conn.commit()
        cursor.close()
        conn.close()
        print("✅ Database successfully initialized!")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")

if __name__ == "__main__":
    init_database()
