import os
import io
import csv
import json
import urllib.request
from datetime import datetime, timedelta
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from analytics.tasks import get_db_connection
from psycopg2.extras import RealDictCursor

app = FastAPI(title="Predictive Sales Dashboard")

# Enable CORS for external tracking integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_trigger_reason(score: dict) -> str:
    """Generates an actionable reason to call based on the lead's data."""
    evaluation = float(score.get("evaluation_score", 0))
    conviction = float(score.get("high_conviction_score", 0))
    friction = float(score.get("friction_score", 0))
    
    if evaluation >= 80:
        return "Immediate Upgrade Readiness: Highly active on pricing pages."
    if friction >= 75:
        return "Churn Risk Alert: High error rates or exploratory confusion."
    if conviction >= 80 and score.get("missing_key_feature"):
        feature = score.get("missing_key_feature")
        return f"Upsell Opportunity: Power user missing {feature}."
    if conviction >= 50 and score.get("habit_classification") == "Occasional Visitor":
        return "Engagement Drop: Needs intervention to build daily habit."
        
    return "Routine Check-in: Stable usage pattern."

def calculate_probability(score: dict) -> int:
    """Calculates a simple 0-100% conversion probability based on intent."""
    eval_score = float(score.get("evaluation_score", 0))
    conv_score = float(score.get("high_conviction_score", 0))
    return int(min((eval_score * 0.7) + (conv_score * 0.3), 100))

def fetch_leads():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Join Intent Scores and Benchmarks
    cursor.execute("""
        SELECT 
            i.user_id,
            i.high_conviction_score,
            i.friction_score,
            i.evaluation_score,
            i.last_calculated_at,
            b.missing_key_feature,
            b.value_gap_percentage,
            b.habit_classification
        FROM user_intent_scores i
        LEFT JOIN user_benchmarks b ON i.user_id = b.user_id
        ORDER BY i.evaluation_score DESC, i.high_conviction_score DESC
    """)
    
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    leads = []
    for row in rows:
        lead = dict(row)
        # Add system generated insights
        lead["trigger_reason"] = generate_trigger_reason(lead)
        lead["conversion_probability"] = calculate_probability(lead)
        leads.append(lead)
        
    return leads

from fastapi.encoders import jsonable_encoder

@app.get("/api/leads")
def get_leads():
    try:
        leads = fetch_leads()
        return JSONResponse({"status": "success", "data": jsonable_encoder(leads)})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.get("/api/export")
def export_leads_csv():
    try:
        leads = fetch_leads()
        
        output = io.StringIO()
        if not leads:
            return StreamingResponse(iter(["No data available"]), media_type="text/csv")
            
        fieldnames = leads[0].keys()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for lead in leads:
            writer.writerow(lead)
            
        output.seek(0)
        
        response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = "attachment; filename=leads.csv"
        return response
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

from pydantic import BaseModel
from typing import Optional
from fastapi import Header

def recalculate_metrics():
    try:
        from scoring_engine.tasks import run_intent_scoring
        from benchmarking.tasks import run_user_benchmarking
        run_intent_scoring.run(days_lookback=14)
        run_user_benchmarking.run()
    except Exception as e:
        print(f"Error recalculating metrics in background: {e}")

class TestEventRequest(BaseModel):
    name: str
    category_a: bool = False
    category_b: bool = False
    category_c: bool = False
    notes: Optional[str] = None
    element_id: Optional[str] = None

@app.post("/api/test-events")
def create_test_event(event: TestEventRequest, background_tasks: BackgroundTasks, x_user_email: Optional[str] = Header(None)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO captured_events (name, category_a, category_b, category_c, notes, user_email, element_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, created_at;
        """, (event.name, event.category_a, event.category_b, event.category_c, event.notes, x_user_email, event.element_id))
        row = cursor.fetchone()
            
        conn.commit()
        cursor.close()
        conn.close()
        
        background_tasks.add_task(recalculate_metrics)
        
        return JSONResponse({
            "status": "success",
            "message": "Event captured successfully!",
            "data": {"id": row[0], "created_at": str(row[1])}
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.get("/api/test-events")
def get_test_events():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT id, name, category_a, category_b, category_c, notes, user_email, created_at, element_id
            FROM captured_events
            ORDER BY created_at DESC;
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return JSONResponse({"status": "success", "data": jsonable_encoder(rows)})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.get("/api/test-events/{event_id}")
def get_test_event(event_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT id, name, category_a, category_b, category_c, notes, user_email, created_at, element_id
            FROM captured_events
            WHERE id = %s;
        """, (event_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            return JSONResponse({"status": "error", "message": "Event not found"}, status_code=404)
        return JSONResponse({"status": "success", "data": jsonable_encoder(row)})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.get("/api/recent-events")
def get_recent_events(start_date: Optional[str] = None, end_date: Optional[str] = None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        api_where_clauses = []
        prototype_where_clauses = []
        sql_params = []
        
        # Build API conditions
        if start_date:
            api_where_clauses.append("timestamp >= %s")
        if end_date:
            api_where_clauses.append("timestamp <= %s")
            
        # Build Prototype conditions
        if start_date:
            prototype_where_clauses.append("created_at >= %s")
        if end_date:
            prototype_where_clauses.append("created_at <= %s")
            
        # Populate sql_params sequentially for each UNION branch
        # Branch 1: api_usage_events
        if start_date:
            sql_params.append(start_date)
        if end_date:
            sql_params.append(end_date + " 23:59:59")
            
        # Branch 2: captured_events
        if start_date:
            sql_params.append(start_date)
        if end_date:
            sql_params.append(end_date + " 23:59:59")
            
        api_where = "WHERE " + " AND ".join(api_where_clauses) if api_where_clauses else ""
        prototype_where = "WHERE " + " AND ".join(prototype_where_clauses) if prototype_where_clauses else ""
        
        query = f"""
            SELECT 'api' AS source, user_id, endpoint, method, status_code::text, 
                   FALSE AS category_a, FALSE AS category_b, FALSE AS category_c, NULL AS notes, timestamp, NULL AS element_id
            FROM api_usage_events
            {api_where}
            UNION ALL
            SELECT 'prototype' AS source, COALESCE(user_email, 'anonymous') AS user_id, name AS endpoint, 'POST' AS method, '200'::text AS status_code, 
                   category_a, category_b, category_c, notes, created_at AS timestamp, element_id
            FROM captured_events
            {prototype_where}
            ORDER BY timestamp DESC
        """
        
        if not start_date and not end_date:
            query += " LIMIT 30"
        else:
            query += " LIMIT 2000"
            
        cursor.execute(query, tuple(sql_params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return JSONResponse({"status": "success", "data": jsonable_encoder(rows)})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/tracker-events")
def create_tracker_event(event: TestEventRequest, background_tasks: BackgroundTasks, x_user_email: Optional[str] = Header(None)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO js_tracked_events (name, category_a, category_b, category_c, notes, user_email, element_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, created_at;
        """, (event.name, event.category_a, event.category_b, event.category_c, event.notes, x_user_email, event.element_id))
        row = cursor.fetchone()
            
        conn.commit()
        cursor.close()
        conn.close()
        
        background_tasks.add_task(recalculate_metrics)
        
        return JSONResponse({
            "status": "success",
            "message": "JS snippet event tracked successfully!",
            "data": {"id": row[0], "created_at": str(row[1])}
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.get("/api/tracker-events")
def get_tracker_events():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT id, name, category_a, category_b, category_c, notes, user_email, created_at, element_id
            FROM js_tracked_events
            ORDER BY created_at DESC;
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return JSONResponse({"status": "success", "data": jsonable_encoder(rows)})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

# Load Partner API Key from environment or manual .env file
NEOTRADER_API_KEY = os.getenv("NEOTRADER_API_KEY")
if not NEOTRADER_API_KEY:
    try:
        # Resolve workspace root .env file
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if line.strip() and not line.startswith("#"):
                        parts = line.strip().split("=", 1)
                        if len(parts) == 2 and parts[0].strip() == "NEOTRADER_API_KEY":
                            NEOTRADER_API_KEY = parts[1].strip().strip('"').strip("'")
                            break
    except Exception as e:
        print(f"Error reading .env manually: {e}")

def resolve_email(user_id: str) -> str:
    """Helper to resolve a customer email address from a user_id."""
    if "@" in user_id:
        return user_id
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check captured_events
        cursor.execute("SELECT DISTINCT user_email FROM captured_events WHERE user_email IS NOT NULL AND user_email LIKE %s LIMIT 1;", (f"%{user_id}%",))
        row = cursor.fetchone()
        if row:
            cursor.close()
            conn.close()
            return row[0]
            
        # Check js_tracked_events
        cursor.execute("SELECT DISTINCT user_email FROM js_tracked_events WHERE user_email IS NOT NULL AND user_email LIKE %s LIMIT 1;", (f"%{user_id}%",))
        row = cursor.fetchone()
        if row:
            cursor.close()
            conn.close()
            return row[0]
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error mapping user_id to email: {e}")
        
    # Standard mapping fallback for local mock users
    if user_id.startswith("user_"):
        return f"{user_id}@neotraders.com"
    return f"{user_id}@example.com"

@app.get("/api/customers/{user_id_or_email}")
def get_customer_details(user_id_or_email: str):
    """Proxy API to call the Partner API securely, falling back to mock profiles if needed."""
    email = resolve_email(user_id_or_email)
    use_mock_fallback = False
    
    if not NEOTRADER_API_KEY or "neotrader_XXXX" in NEOTRADER_API_KEY:
        use_mock_fallback = True
        
    if not use_mock_fallback:
        try:
            url = "https://api.app.neotrader.in/v1/api/partner/customers-details"
            headers = {
                "X-API-Key": NEOTRADER_API_KEY,
                "Content-Type": "application/json"
            }
            payload = json.dumps({"email": email}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
            
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    result = json.loads(response.read().decode("utf-8"))
                    return JSONResponse({"status": "success", "data": result})
        except Exception as e:
            print(f"Partner API request failed: {e}. Falling back to mock details.")
            use_mock_fallback = True
            
    if use_mock_fallback:
        # Generate consistent mock customer profile details based on string hash
        clean_name = user_id_or_email.replace("_", " ").title()
        if "@" in clean_name:
            clean_name = clean_name.split("@")[0].replace(".", " ").title()
            
        hash_val = sum(ord(c) for c in email)
        plans = ["Starter Plan", "Pro Plan", "Enterprise Suite", None]
        statuses = ["Active", "Trialing", "Past Due", "Cancelled"]
        
        plan = plans[hash_val % len(plans)]
        status = statuses[hash_val % len(statuses)] if plan else None
        
        days_ago = hash_val % 300 + 10
        created_at_dt = datetime.now() - timedelta(days=days_ago)
        created_at = created_at_dt.strftime("%Y-%m-%dT%H:%M:%S")
        
        mock_data = {
            "email": email,
            "full_name": clean_name,
            "phone": f"9820{hash_val % 900000 + 100000}",
            "subscription_plan": plan,
            "subscription_status": status,
            "is_active": status in ["Active", "Trialing"] if status else True,
            "created_at": created_at
        }
        return JSONResponse({"status": "success", "data": mock_data})

# Mount the static dashboard files
app.mount("/", StaticFiles(directory="dashboard/public", html=True), name="public")
