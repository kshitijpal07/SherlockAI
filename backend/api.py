from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import shutil
import os
import time
import uuid
from typing import List, Dict, Any
import json
from record_face_video import recognize_faces_from_video
import tempfile
import base64
from PIL import Image
import io
import torch
import numpy as np
import cv2
from insightface.app import FaceAnalysis
import faiss
import sqlite3
import torchvision.transforms as transforms

app = FastAPI()

# New endpoint to get all face records
@app.get("/records")
async def get_records():
    """
    Retrieve all face records from the SQLite database.
    Returns:
        List of records with id, name, thana, img
    """
    try:
        conn = sqlite3.connect("faces.db")
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, thana, img FROM faces")
        rows = cursor.fetchall()
        conn.close()
        records = []
        for row in rows:
            record = {
                "id": row[0],
                "name": row[1],
                "thana": row[2],
                "img": row[3]
            }
            records.append(record)
        return {"status": "success", "records": records}
    except Exception as e:
        print(f"Error retrieving records: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Error retrieving records: {str(e)}"}
        )
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import shutil
import os
import time
import uuid
from typing import List, Dict, Any
import json
from record_face_video import recognize_faces_from_video
import tempfile
import base64
from PIL import Image
import io
import torch
import numpy as np
import cv2
from insightface.app import FaceAnalysis
import faiss
import sqlite3
import torchvision.transforms as transforms

app = FastAPI()

# Global variables
DB_PATH = "faces.db"
tasks = {}  # Global tasks dictionary for progress tracking

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

def load_face_database():
    """Load face database - placeholder implementation"""
    # This function needs to be implemented based on your database structure
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, location, image_path, embedding FROM faces")
        records = cursor.fetchall()
        conn.close()
        
        if not records:
            return None, []
            
        # Create FAISS index and load embeddings
        # This is a simplified implementation - adjust based on your actual database structure
        embeddings = []
        record_list = []
        
        for record in records:
            if record[4]:  # If embedding exists
                embedding = np.frombuffer(record[4], dtype=np.float32)
                embeddings.append(embedding)
                record_list.append((record[0], record[1], record[2], record[3]))
        
        if embeddings:
            embeddings = np.array(embeddings).astype('float32')
            index = faiss.IndexFlatIP(embeddings.shape[1])
            faiss.normalize_L2(embeddings)
            index.add(embeddings)
            return index, record_list
        else:
            return None, []
    except Exception as e:
        print(f"Error loading face database: {str(e)}")
        return None, []

def process_and_monitor_progress(video_path: str, task_id: str):
    """Process video using the face recognition function and update progress."""
    def update_progress(progress: int):
        if task_id in tasks:
            tasks[task_id]["progress"] = progress
    
    # Call the face recognition function
    results, stats = recognize_faces_from_video(
        video_path=video_path,
        threshold=0.3,
        skip_seconds=3,
        speed_up_factor=1.5,
        exit_delay=10,
        progress_callback=update_progress
    )
    
    # Update task results
    if task_id in tasks:
        processing_time = time.time() - tasks[task_id].get("start_time", time.time())
        tasks[task_id]["results"] = results
        tasks[task_id]["stats"] = stats
        tasks[task_id]["processing_time"] = processing_time
    
    return results, stats

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files - use absolute paths or backend-relative paths
import os
static_base = os.path.dirname(os.path.abspath(__file__))
app.mount("/screenshots_original", StaticFiles(directory=os.path.join(static_base, "screenshots_original")), name="screenshots")
app.mount("/cropped_faces", StaticFiles(directory=os.path.join(static_base, "cropped_faces")), name="cropped_faces")
app.mount("/detected_clips_original", StaticFiles(directory=os.path.join(static_base, "detected_clips_original")), name="detected_clips")

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

@app.post("/upload-suspect")
async def upload_suspect(
    suspect_image: UploadFile = File(...),
    suspect_name: str = Form(...),
    police_station: str = Form(...),
):
    """
    Upload a suspect image and store it in the database (name, thana, img).
    """
    # Create a directory for uploaded images if it doesn't exist
    os.makedirs("backend/images", exist_ok=True)

    # Save the uploaded image with UUID to avoid name conflicts
    image_id = str(uuid.uuid4())
    image_ext = os.path.splitext(suspect_image.filename)[1]
    image_filename = f"{image_id}{image_ext}"
    image_path = f"backend/images/{image_filename}"

    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(suspect_image.file, buffer)

    try:
        conn = sqlite3.connect("faces.db")
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO faces (name, thana, image_path) VALUES (?, ?, ?)",
            (suspect_name, police_station, image_path)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Suspect {suspect_name} added successfully"}
    except Exception as e:
        print(f"Error storing suspect: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Failed to store suspect: {str(e)}"}
        )

@app.post("/process-live-frame")
async def process_live_frame(frame_data: Dict[str, Any] = Body(...)):
    """
    Process a frame from the frontend camera and perform face detection.
    
    Args:
        frame_data: Dictionary containing base64-encoded image data
    
    Returns:
        Detection results with bounding boxes and recognition info
    """
    try:
        base64_image = frame_data.get("image")
        if not base64_image:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "No image data provided"}
            )
        
        # Remove data URL prefix if present
        if "base64," in base64_image:
            base64_image = base64_image.split("base64,")[1]
        
        # Decode the base64 image
        image_bytes = base64.b64decode(base64_image)
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert PIL Image to OpenCV format
        img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        
        # Convert to RGB for face recognition
        img_rgb = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
        
        # Get face features
        face_app = FaceAnalysis(name='buffalo_l')
        face_app.prepare(ctx_id=-1, det_size=(640, 640))
        faces = face_app.get(img_rgb)
        
        if not faces:
            return {"status": "success", "detections": []}
        
        # Load face database
        index, records = load_face_database()
        if index is None:
            return {"status": "success", "detections": [], "message": "No faces in database"}
        
        detections = []
        threshold = 0.5  # Similarity threshold for face recognition
        
        for face in faces:
            # Extract face bounding box
            x1, y1, x2, y2 = map(int, face.bbox)
            
            # Get face embedding
            feature_vector = face.embedding.reshape(1, -1).astype('float32')
            faiss.normalize_L2(feature_vector)
            
            # Search for similar faces in the database
            similarity, index_match = index.search(feature_vector, 1)
            best_similarity = similarity[0][0]
            
            if best_similarity < threshold:
                # Unknown face
                detection = {
                    "bbox": [x1, y1, x2, y2],
                    "name": "Unknown",
                    "location": "Unknown",
                    "similarity": float(best_similarity),
                    "recognized": False
                }
            else:
                # Known face
                matched_id, matched_name, matched_location, matched_image = records[index_match[0][0]]
                detection = {
                    "bbox": [x1, y1, x2, y2],
                    "name": matched_name,
                    "location": matched_location,
                    "similarity": float(best_similarity),
                    "recognized": True,
                    "image_path": matched_image if matched_image else None
                }
            
            detections.append(detection)
        
        return {
            "status": "success",
            "detections": detections
        }
        
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Error processing frame: {str(e)}"}
        )

@app.get("/get-faces")
async def get_faces():
    """
    Retrieve all faces from the SQLite database.
    Returns:
        List of faces with columns: id, name, thana, img
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, thana, img FROM faces")
        rows = cursor.fetchall()
        conn.close()
        faces = []
        for row in rows:
            face_data = {
                "id": row[0],
                "name": row[1],
                "thana": row[2],
                "img": row[3]
            }
            faces.append(face_data)
        return {"status": "success", "faces": faces}
    except Exception as e:
        print(f"Error retrieving faces: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Error retrieving faces: {str(e)}"}
        )

@app.delete("/delete-face/{face_id}")
async def delete_face(face_id: str):
    """
    Delete a face from the SQLite database by ID.
    Args:
        face_id: ID of the face to delete
    Returns:
        Success or error message
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT image_path FROM faces WHERE id = ?", (face_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Face not found"}
            )
        
        image_path = row["image_path"]
        cursor.execute("DELETE FROM faces WHERE id = ?", (face_id,))
        conn.commit()
        conn.close()
        
        # Delete associated image file if it exists
        if image_path:
            # Convert from relative URL to file system path if needed
            if image_path.startswith("backend/"):
                if os.path.exists(image_path):
                    os.remove(image_path)
            elif not image_path.startswith("http"):
                full_path = os.path.join("backend", image_path)
                if os.path.exists(full_path):
                    os.remove(full_path)
        
        return {"status": "success", "message": f"Face with ID {face_id} deleted successfully"}
        
    except Exception as e:
        print(f"Error deleting face: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Error deleting face: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)