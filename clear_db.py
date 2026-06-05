import os
import psycopg2

DB_HOST = os.getenv("ABACUS_DB_HOST", "localhost")
DB_PORT = os.getenv("ABACUS_DB_PORT", "5435")
DB_USER = os.getenv("ABACUS_DB_USER", "postgres")
DB_PASS = os.getenv("ABACUS_DB_PASS", "abacus_password")
DB_NAME = os.getenv("ABACUS_DB_NAME", "abacus")

def clear_database():
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

        print("Clearing all tables...")
        # TRUNCATE empties the tables extremely fast and resets auto-incrementing IDs
        cursor.execute("""
            TRUNCATE TABLE api_usage_events RESTART IDENTITY CASCADE;
            TRUNCATE TABLE user_intent_scores RESTART IDENTITY CASCADE;
            TRUNCATE TABLE power_user_baseline RESTART IDENTITY CASCADE;
            TRUNCATE TABLE user_benchmarks RESTART IDENTITY CASCADE;
            TRUNCATE TABLE captured_events RESTART IDENTITY CASCADE;
            TRUNCATE TABLE js_tracked_events RESTART IDENTITY CASCADE;
        """)

        conn.commit()
        cursor.close()
        conn.close()
        print("✅ Database successfully cleared!")
        
    except Exception as e:
        print(f"❌ Error clearing database: {e}")

if __name__ == "__main__":
    clear_database()
