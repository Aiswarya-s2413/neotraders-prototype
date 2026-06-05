import os
import io
import csv
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
        run_intent_scoring(days_lookback=14)
        run_user_benchmarking()
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
def get_recent_events():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT 'api' AS source, user_id, endpoint, method, status_code::text, 
                   FALSE AS category_a, FALSE AS category_b, FALSE AS category_c, NULL AS notes, timestamp, NULL AS element_id
            FROM api_usage_events
            UNION ALL
            SELECT 'tracker' AS source, COALESCE(user_email, 'anonymous') AS user_id, name AS endpoint, 'POST' AS method, '200'::text AS status_code, 
                   category_a, category_b, category_c, notes, created_at AS timestamp, element_id
            FROM js_tracked_events
            UNION ALL
            SELECT 'prototype' AS source, COALESCE(user_email, 'anonymous') AS user_id, name AS endpoint, 'POST' AS method, '200'::text AS status_code, 
                   category_a, category_b, category_c, notes, created_at AS timestamp, element_id
            FROM captured_events
            ORDER BY timestamp DESC
            LIMIT 30;
        """)
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

# Mount the static dashboard files
app.mount("/", StaticFiles(directory="dashboard/public", html=True), name="public")
