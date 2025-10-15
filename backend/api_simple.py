from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sqlite3
import time
import os

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration
DB_PATH = "faces.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_police_stations_table():
    """Initialize the police_stations table if it doesn't exist"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS police_stations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thana_name TEXT NOT NULL,
                thana_id TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TEXT NOT NULL,
                active BOOLEAN DEFAULT 1
            )
        ''')
        conn.commit()
        conn.close()
        print("Police stations table initialized successfully")
    except Exception as e:
        print(f"Error initializing police stations table: {str(e)}")

# Initialize tables on startup
init_police_stations_table()

@app.get("/test")
async def test_endpoint():
    """Test endpoint to verify FastAPI is working"""
    return {"message": "FastAPI is working!", "status": "success"}

@app.get("/get-police-stations")
async def get_police_stations():
    """
    Get all active police stations from SQLite database
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, thana_name, thana_id FROM police_stations WHERE active = 1")
        rows = cursor.fetchall()
        conn.close()
        
        stations = []
        for row in rows:
            station = {
                "id": row['id'],
                "thana_name": row['thana_name'],
                "thana_id": row['thana_id']
            }
            stations.append(station)
        
        return {"status": "success", "stations": stations}
    
    except Exception as e:
        print(f"Error retrieving police stations: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Error retrieving police stations: {str(e)}"}
        )

@app.post("/register-police-station")
async def register_police_station(
    thana_name: str = Form(...),
    thana_id: str = Form(...),
    password: str = Form(...),
):
    """
    Register a new police station in SQLite database
    """
    try:
        # Validation
        if not thana_name or not thana_id or not password:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "All fields are required"}
            )
        
        if len(password) < 6:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Password must be at least 6 characters long"}
            )
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if thana_id already exists
        cursor.execute("SELECT id FROM police_stations WHERE thana_id = ?", (thana_id,))
        if cursor.fetchone():
            conn.close()
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "This Thana ID already exists"}
            )
        
        # Insert new police station
        cursor.execute(
            "INSERT INTO police_stations (thana_name, thana_id, password, created_at, active) VALUES (?, ?, ?, ?, ?)",
            (thana_name, thana_id, password, time.strftime('%Y-%m-%d %H:%M:%S'), True)
        )
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": f"Police station {thana_name} registered successfully"}
    
    except Exception as e:
        print(f"Error registering police station: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Registration failed: {str(e)}"}
        )

@app.post("/login-police-station")
async def login_police_station(
    thana_id: str = Form(...),
    password: str = Form(...),
):
    """
    Login for police station using SQLite database
    """
    try:
        if not thana_id or not password:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Thana ID and password are required"}
            )
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Find police station by thana_id and password
        cursor.execute(
            "SELECT id, thana_name, thana_id, active FROM police_stations WHERE thana_id = ? AND password = ?",
            (thana_id, password)
        )
        station = cursor.fetchone()
        conn.close()
        
        if not station:
            return JSONResponse(
                status_code=401,
                content={"status": "error", "message": "Invalid Thana ID or password"}
            )
        
        if not station['active']:
            return JSONResponse(
                status_code=401,
                content={"status": "error", "message": "Police station account is inactive"}
            )
        
        return {
            "status": "success",
            "message": "Login successful",
            "data": {
                "id": station['id'],
                "thana_name": station['thana_name'],
                "thana_id": station['thana_id']
            }
        }
    
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Login failed: {str(e)}"}
        )

@app.get("/check-thana-id/{thana_id}")
async def check_thana_id(thana_id: str):
    """
    Check if a thana_id is available (returns true if available, false if taken)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM police_stations WHERE thana_id = ?", (thana_id,))
        exists = cursor.fetchone() is not None
        conn.close()
        
        return {
            "status": "success",
            "available": not exists,
            "message": "Thana ID already exists" if exists else "Thana ID is available"
        }
    
    except Exception as e:
        print(f"Error checking thana ID: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Error checking thana ID: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)