from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil
import os
import time
import uuid
from typing import List, Dict, Any
import json
from record_face_video import recognize_faces_from_video
import tempfile
from fastapi import Form, Body
import base64
from PIL import Image
import io
import torch
import numpy as np
import cv2
from insightface.app import FaceAnalysis
import faiss
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware to allow requests from the frontend
# This must be added before any routes or other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Initialize Firestore with error handling
try:
    # Check if app is already initialized
    firebase_app = firebase_admin.get_app()
except ValueError:
    # If not, initialize it
    try:
        cred = credentials.Certificate("crime-ffe7e-firebase-adminsdk-fbsvc-83a9b36b50.json")
        firebase_app = firebase_admin.initialize_app(cred)
        print("Firebase initialized successfully")
    except Exception as e:
        print(f"Error initializing Firebase: {str(e)}")

# Get Firestore client
try:
    db = firestore.client()
except Exception as e:
    print(f"Error getting Firestore client: {str(e)}")
    db = None

# Store analysis tasks
tasks = {}

# Load sketch to image model
from sketch_to_color import Generator, denormalize
import torchvision.transforms as transforms

# Initialize model
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
generator = Generator().to(device)
try:
    generator.load_state_dict(torch.load("generator_pix2pix.pth", map_location=device))
    generator.eval()
    sketch_model_loaded = True
except Exception as e:
    print(f"Error loading sketch-to-image model: {str(e)}")
    sketch_model_loaded = False

# Define transformations for sketch input
sketch_transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
    transforms.Normalize([0.5], [0.5])
])

# Initialize FaceAnalysis model for live detection
try:
    live_face_app = FaceAnalysis(name='buffalo_l')
    live_face_app.prepare(ctx_id=-1, det_size=(640, 640))
    live_recognition_ready = True
except Exception as e:
    print(f"Error initializing face recognition: {str(e)}")
    live_recognition_ready = False

# Load face database for live detection
def load_face_database():
    """Fetches stored face data from Firestore and builds a FAISS index."""
    try:
        faces_ref = db.collection("faces").stream()
        records = []
        feature_vectors = []
        
        for doc in faces_ref:
            data = doc.to_dict()
            if "feature_vector" in data and "name" in data:
                feature_vector = np.array(data["feature_vector"]).astype('float32')
                records.append((doc.id, data["name"], data.get("location", "Unknown"), data.get("image_path", "")))
                feature_vectors.append(feature_vector)
        
        if not feature_vectors:
            return None, []
        
        feature_vectors = np.array(feature_vectors).astype('float32')
        faiss.normalize_L2(feature_vectors)
        
        index = faiss.IndexFlatIP(feature_vectors.shape[1])
        index.add(feature_vectors)
        
        return index, records
    except Exception as e:
        print(f"Error loading face database: {str(e)}")
        return None, []

@app.get("/")
def read_root():
    return {"message": "CCTV Analysis API is running"}

# New endpoint for sketch to image conversion
@app.post("/sketch-to-image")
async def sketch_to_image(sketch: UploadFile = File(...)):
    if not sketch_model_loaded:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Sketch-to-image model not loaded"}
        )
    
    try:
        # Read the uploaded sketch
        contents = await sketch.read()
        sketch_img = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Transform the image
        sketch_tensor = sketch_transform(sketch_img).unsqueeze(0).to(device)
        
        # Generate the colored image
        with torch.no_grad():
            generated_image = generator(sketch_tensor).squeeze(0).cpu().detach()
        
        # Convert to image format
        generated_image = denormalize(generated_image).permute(1, 2, 0).numpy()
        generated_image = (generated_image * 255).astype(np.uint8)
        
        # Convert to base64 for sending to frontend
        generated_pil = Image.fromarray(generated_image)
        buffered = io.BytesIO()
        generated_pil.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return {"status": "success", "generated_image": f"data:image/jpeg;base64,{img_str}"}
    
    except Exception as e:
        print(f"Error processing sketch: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Error processing sketch: {str(e)}"}
        )

@app.post("/upload-video")
async def upload_video(video: UploadFile = File(...)):
    # Generate a unique task ID
    task_id = str(uuid.uuid4())
    
    # Create a directory for uploaded files if it doesn't exist
    os.makedirs("uploads", exist_ok=True)
    
    # Save the uploaded video
    file_path = f"uploads/{task_id}_{video.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)
    
    # Initialize task data
    tasks[task_id] = {
        "status": "uploaded",
        "file_path": file_path,
        "progress": 0,
        "results": None,
        "stats": None,
        "processing_time": None
    }
    
    return {"task_id": task_id, "status": "uploaded"}

@app.post("/analyze-video/{task_id}")
async def analyze_video(task_id: str, background_tasks: BackgroundTasks):
    if task_id not in tasks:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    
    # Update task status
    tasks[task_id]["status"] = "processing"
    
    # Start processing in the background
    background_tasks.add_task(process_video, task_id)
    
    return {"task_id": task_id, "status": "processing"}

@app.get("/analysis-status/{task_id}")
async def get_analysis_status(task_id: str):
    if task_id not in tasks:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    
    return tasks[task_id]

# Background processing function
def process_video(task_id: str):
    task = tasks[task_id]
    file_path = task["file_path"]
    
    start_time = time.time()
    
    # Call the face recognition function modified to return results
    # We need to modify the recognize_faces_from_video function to return results
    results, stats = process_and_monitor_progress(file_path, task_id)
    
    # Update task with results
    processing_time = time.time() - start_time
    tasks[task_id]["status"] = "completed"
    tasks[task_id]["progress"] = 100
    tasks[task_id]["results"] = results
    tasks[task_id]["stats"] = stats
    tasks[task_id]["processing_time"] = processing_time

# Function to process video and monitor progress
def process_and_monitor_progress(video_path: str, task_id: str):
    """Process video using the face recognition function and update progress."""
    
    # Define a progress callback function
    def update_progress(progress: int):
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
    
    return results, stats

# Add a route to serve static files
from fastapi.staticfiles import StaticFiles
app.mount("/screenshots_original", StaticFiles(directory="screenshots_original"), name="screenshots")
app.mount("/cropped_faces", StaticFiles(directory="cropped_faces"), name="cropped_faces")
app.mount("/detected_clips_original", StaticFiles(directory="detected_clips_original"), name="detected_clips")

@app.post("/upload-suspect")
async def upload_suspect(
    suspect_image: UploadFile = File(...),
    suspect_name: str = Form(...),
    police_station: str = Form(...),
):
    """
    Upload a suspect image and store it in the database.
    This calls store_faces.py functionality to extract face features and store them.
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
    
    # Create temporary text files for name and location
    with tempfile.NamedTemporaryFile(mode="w", delete=False, prefix="name_", suffix=".txt") as name_file:
        name_file.write(suspect_name)
        name_file_path = name_file.name
        
    with tempfile.NamedTemporaryFile(mode="w", delete=False, prefix="location_", suffix=".txt") as location_file:
        location_file.write(police_station)
        location_file_path = location_file.name
    
    try:
        # Import here to avoid circular imports
        import sys
        # Use sys_path to avoid name conflict with os
        import os as os_module
        sys.path.append(os_module.path.dirname(os_module.path.abspath(__file__)))
        from store_faces import process_single_image
        
        # Process the image and store in database
        result = process_single_image(
            image_path=image_path,
            person_name=suspect_name,
            location=police_station
        )
        
        if result["success"]:
            return {"status": "success", "message": f"Suspect {suspect_name} added successfully"}
        else:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": result["error"]}
            )
    except Exception as e:
        print(f"Error processing suspect image: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Failed to process image: {str(e)}"}
        )
    finally:
        # Clean up temporary files
        if os.path.exists(name_file_path):
            os.remove(name_file_path)
        if os.path.exists(location_file_path):
            os.remove(location_file_path)

@app.post("/process-live-frame")
async def process_live_frame(frame_data: Dict[str, Any] = Body(...)):
    """
    Process a frame from the frontend camera and perform face detection.
    
    Args:
        frame_data: Dictionary containing base64-encoded image data
        
    Returns:
        Detection results including recognized faces
    """
    if not live_recognition_ready:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Live recognition system not initialized"}
        )
    
    try:
        # Extract the base64 image data
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
        faces = live_face_app.get(img_rgb)
        
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
    Retrieve all faces from the Firestore database.
    
    Returns:
        List of faces with their details
    """
    try:
        if not db:
            return JSONResponse(
                status_code=500,
                content={"status": "error", "message": "Database not initialized"}
            )
        
        faces_ref = db.collection("faces").stream()
        faces = []
        
        for doc in faces_ref:
            data = doc.to_dict()
            if "name" in data:
                face_data = {
                    "id": doc.id,
                    "name": data.get("name", "Unknown"),
                    "location": data.get("location", "Unknown"),
                    "image_path": data.get("image_path", ""),
                    "created_at": data.get("created_at", "")
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
    Delete a face from the Firestore database by ID.
    
    Args:
        face_id: ID of the face to delete
        
    Returns:
        Success or error message
    """
    try:
        if not db:
            return JSONResponse(
                status_code=500,
                content={"status": "error", "message": "Database not initialized"}
            )
        
        # Get the face data to find the image path
        face_ref = db.collection("faces").document(face_id)
        face_data = face_ref.get().to_dict()
        
        # Delete the face document from Firestore
        face_ref.delete()
        
        # Delete associated image file if it exists
        if face_data and "image_path" in face_data and face_data["image_path"]:
            image_path = face_data["image_path"]
            # Convert from relative URL to file system path if needed
            if image_path.startswith("backend/"):
                # The path is already a file system path
                if os.path.exists(image_path):
                    os.remove(image_path)
            elif not image_path.startswith("http"):
                # Construct file path from relative path
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
