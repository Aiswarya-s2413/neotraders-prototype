import psycopg2
import os
import random
from datetime import datetime, timedelta, timezone
from scoring_engine.calculator import CORE_ROUTES, EVALUATION_ROUTES, FRICTION_ROUTES

DB_HOST = os.getenv("ABACUS_DB_HOST", "localhost")
DB_PORT = os.getenv("ABACUS_DB_PORT", "5432")
DB_USER = os.getenv("ABACUS_DB_USER", "postgres")
DB_PASS = os.getenv("ABACUS_DB_PASS", "abacus_password")
DB_NAME = os.getenv("ABACUS_DB_NAME", "abacus")

def seed_data():
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, dbname=DB_NAME)
    cursor = conn.cursor()

    users = ["user_1001", "user_1002", "user_1003", "user_1004", "user_1005"]
    
    print("Generating 250 mock API events...")
    now = datetime.now(timezone.utc)
    
    events = []
    for _ in range(250):
        user = random.choice(users)
        
        # Determine what kind of route they hit
        rand = random.random()
        if rand < 0.6:
            route = random.choice(CORE_ROUTES)
            status = 200
        elif rand < 0.8:
            route = random.choice(FRICTION_ROUTES)
            status = random.choice([200, 400, 403, 500])
        else:
            route = random.choice(EVALUATION_ROUTES)
            status = 200
            
        timestamp = now - timedelta(days=random.randint(0, 10), hours=random.randint(0, 23))
        
        events.append((user, route, "GET", status, random.uniform(10.0, 150.0), timestamp))
        
    cursor.executemany("""
        INSERT INTO api_usage_events (user_id, endpoint, method, status_code, response_time_ms, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, events)
    
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Seeded mock events successfully!")

if __name__ == "__main__":
    seed_data()
