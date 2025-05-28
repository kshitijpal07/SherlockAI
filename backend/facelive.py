import cv2
import numpy as np
import json
import faiss
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

def load_face_database():
    """Fetches stored face data from Firestore and builds a FAISS index."""
    faces_ref = db.collection("faces").stream()
    records = []
    feature_vectors = []
    
    for doc in faces_ref:
        data = doc.to_dict()
        if "feature_vector" in data and "name" in data:
            feature_vector = np.array(data["feature_vector"]).astype('float32')
            records.append((doc.id, data["name"], data.get("location", "Unknown")))
            feature_vectors.append(feature_vector)
    
    if not feature_vectors:
        return None, []
    
    feature_vectors = np.array(feature_vectors).astype('float32')
    faiss.normalize_L2(feature_vectors)
    
    index = faiss.IndexFlatIP(feature_vectors.shape[1])
    index.add(feature_vectors)
    
    return index, records

def recognize_live():
    """Performs live face recognition using FAISS and Firestore."""
    index, records = load_face_database()
    if index is None:
        print("No faces in database")
        return

    cap = cv2.VideoCapture(0)  # Use webcam
    threshold = 0.3
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = face_app.get(frame_rgb)

        for face in faces:
            feature_vector = face.embedding.reshape(1, -1).astype('float32')
            faiss.normalize_L2(feature_vector)

            similarity, index_match = index.search(feature_vector, 1)
            best_similarity = similarity[0][0]
            
            x1, y1, x2, y2 = map(int, face.bbox)
            
            if best_similarity < threshold:
                matched_name = "Unknown"
                matched_location = "Unknown"
            else:
                matched_id, matched_name, matched_location = records[index_match[0][0]]
                print(f"Recognized: {matched_name} from {matched_location} (Similarity: {best_similarity:.2f})")
            
            # Draw bounding box and label
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            display_text = f"{matched_name} - {matched_location} ({best_similarity:.2f})"
            cv2.putText(frame, display_text, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        
        # Resize for display
        display_width = 800
        aspect_ratio = display_width / frame.shape[1]
        display_height = int(frame.shape[0] * aspect_ratio)
        resized_frame = cv2.resize(frame, (display_width, display_height))
        
        cv2.imshow("Live Face Recognition", resized_frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()

# Run live recognition
recognize_live()