import cv2
import numpy as np
import os
import time
import firebase_admin
from firebase_admin import credentials, firestore
from insightface.app import FaceAnalysis

# Initialize Firestore
cred = credentials.Certificate(r"crime-ffe7e-firebase-adminsdk-fbsvc-83a9b36b50.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Initialize FaceAnalysis model
face_app = FaceAnalysis(name='buffalo_l')
face_app.prepare(ctx_id=-1, det_size=(640, 640))

# Create necessary directories
os.makedirs("screenshots_original", exist_ok=True)
os.makedirs("detected_clips_original", exist_ok=True)
os.makedirs("highlights", exist_ok=True)  # New directory for highlight clips


def load_face_data():
    """Fetches stored face data from Firestore."""
    faces_ref = db.collection("faces").stream()
    face_database = {}
    for doc in faces_ref:
        data = doc.to_dict()
        if "feature_vector" in data and "name" in data:
            face_database[data["name"]] = np.array(data["feature_vector"])
    return face_database


def cosine_similarity(vec1, vec2):
    """Computes cosine similarity between two vectors."""
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))


def format_time(seconds):
    """Formats seconds into MM:SS format."""
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)
    return f"{minutes}:{seconds:02d}"


def recognize_faces_from_video(video_path, threshold=0.3, skip_seconds=3, speed_up_factor=1.5, exit_delay=10, progress_callback=None):
    """Detects, recognizes faces, and saves clips in a video."""

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return [], {"framesProcessed": 0, "matchesFound": 0}

    frame_rate = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    normal_wait_time = int(1000 / frame_rate)  # Normal playback speed
    # Speed-up playback time
    fast_wait_time = int(normal_wait_time / speed_up_factor)

    face_database = load_face_data()
    print(f"Loaded {len(face_database)} faces from database")

    active_faces = {}  # Tracks active faces with their last detected timestamp
    face_clips = {}  # Stores start timestamps for video clips
    frame_count = 0
    
    # Store results for API return
    results = []

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")  # Codec for saving video clips
    out = None

    # Create a buffer for storing frames for highlight video
    highlight_frames = []
    highlight_mode = False
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    highlight_output_path = f"highlights/highlight_{timestamp}.mp4"

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        current_time = cap.get(cv2.CAP_PROP_POS_MSEC) / \
            1000  # Convert ms to seconds
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = face_app.get(img_rgb)
        detected_faces = []

        for face in faces:
            detected_feature_vector = np.array(face.embedding)
            best_match, best_score = None, 0

            for stored_name, stored_vector in face_database.items():
                similarity = cosine_similarity(
                    detected_feature_vector, stored_vector)
                if similarity > best_score:
                    best_score = similarity
                    best_match = stored_name

            if best_score >= threshold:
                detected_faces.append((best_match, current_time))
                bbox = face.bbox.astype(int)
                cv2.rectangle(frame, (bbox[0], bbox[1]),
                              (bbox[2], bbox[3]), (0, 255, 0), 2)
                cv2.putText(frame, f"{best_match} ({best_score:.2f})", (bbox[0], bbox[1] - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # Handle entries and exits
        for name, timestamp in detected_faces:
            if name not in active_faces:
                # New face detected (Entry)
                active_faces[name] = timestamp
                print(
                    f"Match Found: {name} at {format_time(timestamp)} (Entry)")

                # Save screenshot
                formatted_time = format_time(timestamp).replace(':', '-')
                screenshot_filename = f"screenshots_original/{name}entry{formatted_time}.jpg"
                cv2.imwrite(screenshot_filename, frame)
                print(f"Screenshot saved: {screenshot_filename}")
                
                # Add to results
                results.append({
                    "suspectName": name,
                    "timestamp": format_time(timestamp),
                    "screenshot": f"/screenshots_original/{name}entry{formatted_time}.jpg"
                })

                # Start video clip
                clip_filename = f"detected_clips_original/{name}_{format_time(timestamp).replace(':', '_')}.mp4"
                out = cv2.VideoWriter(
                    clip_filename, fourcc, frame_rate, (frame.shape[1], frame.shape[0]))
                face_clips[name] = clip_filename  # Store clip file
            else:
                # Face is still present, update timestamp
                active_faces[name] = timestamp

        # Check for exits
        to_remove = []
        for name, last_seen in active_faces.items():
            if current_time - last_seen > exit_delay:
                # Face disappeared (Exit)
                print(
                    f"Match Found: {name} at {format_time(last_seen)} (Exit)")

                # Save screenshot
                formatted_time = format_time(last_seen).replace(':', '-')
                screenshot_filename = f"screenshots_original/{name}exit{formatted_time}.jpg"
                cv2.imwrite(screenshot_filename, frame)
                print(f"Screenshot saved: {screenshot_filename}")
                
                # Add to results
                results.append({
                    "suspectName": name,
                    "timestamp": format_time(last_seen),
                    "screenshot": f"/screenshots_original/{name}exit{formatted_time}.jpg"
                })

                to_remove.append(name)

                # Stop recording video clip
                if out and name in face_clips:
                    out.release()
                    out = None

        # Remove exited faces from active list
        for name in to_remove:
            active_faces.pop(name, None)

        # Update progress if callback is provided
        frame_count += 1
        if progress_callback and total_frames > 0:
            progress = int((frame_count / total_frames) * 100)
            progress_callback(progress)

        # Resize frame for display
        height, width = frame.shape[:2]
        new_width = 800
        new_height = int((new_width / width) * height)
        frame_resized = cv2.resize(frame, (new_width, new_height))

        # Adaptive playback logic
        if detected_faces:
            # We're in normal speed mode - collect frames for highlight video
            if not highlight_mode:
                highlight_mode = True
                print(
                    f"Normal speed mode started at {format_time(current_time)}")

            # Add current frame to highlight
            highlight_frames.append(frame.copy())

            # Process subsequent frames at normal speed
            processing_interval = int(frame_rate)
            for i in range(processing_interval):
                ret, frame = cap.read()
                if not ret:
                    break

                # Add each frame to highlights
                highlight_frames.append(frame.copy())

                # Writing to individual face clips if active
                if out:
                    out.write(frame)

                frame_resized = cv2.resize(frame, (new_width, new_height))
                cv2.imshow("Face Recognition", frame_resized)
                if cv2.waitKey(normal_wait_time) & 0xFF == ord('q'):
                    break
                frame_count += 1
                
                # Update progress
                if progress_callback and total_frames > 0:
                    progress = int((frame_count / total_frames) * 100)
                    progress_callback(progress)
        else:
            # We're in fast mode - not collecting frames
            if highlight_mode:
                highlight_mode = False
                print(f"Fast mode resumed at {format_time(current_time)}")

            skip_frames = int(frame_rate * skip_seconds)
            cap.set(cv2.CAP_PROP_POS_FRAMES, cap.get(
                cv2.CAP_PROP_POS_FRAMES) + skip_frames)
            frame_count += skip_frames
            
            # Update progress after skipping frames
            if progress_callback and total_frames > 0:
                progress = int((frame_count / total_frames) * 100)
                progress_callback(progress)
                
            ret, frame = cap.read()
            if not ret:
                break
            frame_resized = cv2.resize(frame, (new_width, new_height))
            cv2.imshow("Face Recognition", frame_resized)
            if cv2.waitKey(fast_wait_time) & 0xFF == ord('q'):
                break

    # Save the highlight video if we collected any frames
    if highlight_frames:
        print(f"Creating highlight video with {len(highlight_frames)} frames")
        height, width = highlight_frames[0].shape[:2]
        highlight_writer = cv2.VideoWriter(
            highlight_output_path, fourcc, frame_rate, (width, height))

        for highlight_frame in highlight_frames:
            highlight_writer.write(highlight_frame)

        highlight_writer.release()
        print(f"Highlight video saved to: {highlight_output_path}")

    cap.release()
    cv2.destroyAllWindows()
    if out:
        out.release()

    print("\nFinal exits recorded for all faces.")
    print(
        f"Total Execution Time: {format_time(cap.get(cv2.CAP_PROP_POS_MSEC) / 1000)}")
    
    # Return results and stats
    stats = {
        "framesProcessed": frame_count,
        "matchesFound": len(results)
    }
    
    return results, stats