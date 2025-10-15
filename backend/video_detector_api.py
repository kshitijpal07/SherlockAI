from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import uvicorn
from ultralytics import YOLO
import cv2
import numpy as np
import os
from tempfile import NamedTemporaryFile
import shutil
from typing import Optional, List
from pydantic import BaseModel
import time

app = FastAPI(
    title="YOLOv8 Video Analysis API",
    description="API for video analysis using YOLOv8 object detection",
    version="1.0.0"
)

# Configuration
MODEL_PATH = "yolov8n.pt"
CONFIDENCE_THRESHOLD = 0.5
TEMP_FOLDER = "temp_files"

# Create temp folder if it doesn't exist
os.makedirs(TEMP_FOLDER, exist_ok=True)

# Load the YOLOv8 model
try:
    model = YOLO(MODEL_PATH)
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

class DetectionResponse(BaseModel):
    filename: str
    processed_filename: str
    detections: List[dict]
    processing_time: float

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "active", "model_loaded": model is not None}

@app.post("/detect/video", response_model=DetectionResponse)
async def detect_video(
    video: UploadFile = File(...),
    conf_threshold: Optional[float] = CONFIDENCE_THRESHOLD,
    save_video: Optional[bool] = True
):
    """
    Process a video file and return detections
    
    Parameters:
    - video: Video file to process
    - conf_threshold: Confidence threshold for detections (0-1)
    - save_video: Whether to save the processed video with annotations
    
    Returns:
    - JSON with detections and processed video path
    """
    if not model:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    if not video.filename.lower().endswith(('.mp4', '.avi', '.mov')):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    # Save uploaded file temporarily
    input_path = os.path.join(TEMP_FOLDER, f"input_{video.filename}")
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)
    
    # Process video
    try:
        # Output path for processed video
        output_path = os.path.join(TEMP_FOLDER, f"processed_{video.filename}")
        
        # Open the video
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise HTTPException(status_code=500, detail="Could not open video file")
        
        # Get video properties
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        
        # Create video writer if save_video is True
        if save_video:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        # Process each frame
        all_detections = []
        frame_count = 0
        start_time = time.time()
        
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break
                
            # Run YOLOv8 inference
            results = model(frame, conf=conf_threshold)
            
            # Get detections for this frame
            frame_detections = []
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    name = model.names[cls]
                    
                    detection = {
                        "frame": frame_count,
                        "class": name,
                        "confidence": conf,
                        "bbox": [x1, y1, x2, y2]
                    }
                    frame_detections.append(detection)
            
            all_detections.extend(frame_detections)
            
            # Save frame if requested
            if save_video:
                # Draw YOLO detections with default visualization
                annotated_frame = results[0].plot()
                out.write(annotated_frame)
            
            frame_count += 1
        
        # Cleanup
        cap.release()
        if save_video:
            out.release()
        
        processing_time = time.time() - start_time
        
        # Prepare response
        response = {
            "filename": video.filename,
            "processed_filename": f"processed_{video.filename}" if save_video else None,
            "detections": all_detections,
            "processing_time": processing_time
        }
        
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup input file
        if os.path.exists(input_path):
            os.remove(input_path)

@app.get("/video/{filename}")
async def get_processed_video(filename: str):
    """
    Retrieve a processed video file
    """
    file_path = os.path.join(TEMP_FOLDER, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    return FileResponse(file_path)

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)