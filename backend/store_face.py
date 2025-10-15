import cv2
import numpy as np
import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
# Initialize Firestore
import sqlite3
import os
DB_PATH = os.path.join(os.path.dirname(__file__), "faces.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    return conn

# Directories
input_folder = r"images"  # Folder containing images
cropped_faces_dir = "cropped_faces"
feature_file = "features.json"
failed_images_file = "failed_images.json"
name_file = r"name.txt"
location_file = r"location.txt"

os.makedirs(cropped_faces_dir, exist_ok=True)

def natural_sort_key(text):
    """Sorts filenames numerically instead of lexicographically."""
    return [int(part) if part.isdigit() else part for part in re.split(r'(\d+)', text)]

def load_names_and_locations():
    """Loads names and locations from text files into a dictionary."""
    names = []
    locations = []

    # Read names from name.txt
    with open(name_file, "r", encoding="utf-8") as f:
        names = [line.strip() for line in f.readlines()]

    # Read locations from location.txt
    with open(location_file, "r", encoding="utf-8") as f:
        locations = [line.strip() for line in f.readlines()]

    return names, locations

def store_face_data_in_sqlite(person_name, location, image_path, feature_vector):
    """Stores extracted face data in SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    import json
    cursor.execute(
        "INSERT INTO faces (name, location, image_path, features) VALUES (?, ?, ?, ?)",
        (person_name, location, image_path, json.dumps(feature_vector))
    )
    conn.commit()
    conn.close()
    print(f"Stored {person_name} in SQLite.")

def process_images():
    """Processes images sequentially, extracts faces, and stores in SQLite."""
    feature_dict = {}
    failed_images = []

    image_files = sorted(
        [f for f in os.listdir(input_folder) if f.lower().endswith(('.jpg', '.png', '.jpeg'))],
        key=natural_sort_key
    )

    names, locations = load_names_and_locations()

    if len(image_files) != len(names) or len(image_files) != len(locations):
        print("Error: The number of images, names, and locations do not match!")
        return

    # Ensure face_app is defined
    global face_app
    if 'face_app' not in globals():
        from insightface.app import FaceAnalysis
        face_app = FaceAnalysis(name='buffalo_l')
        face_app.prepare(ctx_id=-1, det_size=(640, 640))

    for index, img_name in enumerate(image_files):
        try:
            img_path = os.path.join(input_folder, img_name)
            person_name = names[index]
            location = locations[index]
            img = cv2.imread(img_path)
            if img is None:
                print(f"Error loading {img_path}, deleting...")
                os.remove(img_path)
                continue
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            faces = face_app.get(img_rgb)
            if not faces:
                print(f"No face detected in {img_path}, deleting...")
                os.remove(img_path)
                failed_images.append(img_name)
                continue
            img_h, img_w, _ = img.shape
            for i, face in enumerate(faces):
                x1, y1, x2, y2 = map(int, face.bbox)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(img_w, x2), min(img_h, y2)
                cropped_face = img[y1:y2, x1:x2]
                if cropped_face.size == 0:
                    print(f"Invalid face crop in {img_name}, deleting...")
                    os.remove(img_path)
                    failed_images.append(img_name)
                    continue
                cropped_face_filename = f"{os.path.splitext(img_name)[0]}.jpg"
                cropped_face_path = os.path.join(cropped_faces_dir, cropped_face_filename)
                cv2.imwrite(cropped_face_path, cropped_face)
                feature_vector = face.embedding.tolist()
                if not feature_vector:
                    print(f"Feature extraction failed for {img_name}, deleting...")
                    os.remove(img_path)
                    failed_images.append(img_name)
                    continue
                feature_dict[cropped_face_filename] = feature_vector
                store_face_data_in_sqlite(person_name, location, cropped_face_path, feature_vector)
                print(f"Face detected in {img_name}. Cropped & stored.")
        except Exception as e:
            print(f"Error processing {img_name}: {str(e)}")
            failed_images.append(img_name)

    with open(feature_file, "w") as f:
        json.dump(feature_dict, f, indent=4)
    with open(failed_images_file, "w") as f:
        json.dump(failed_images, f, indent=4)
    print(f"\nFeature vectors saved in {feature_file}")
    print(f"Failed images saved in {failed_images_file}")


def process_single_image(image_path, person_name, location):
    try:
        os.makedirs(cropped_faces_dir, exist_ok=True)
        # Ensure face_app is defined
        global face_app
        if 'face_app' not in globals():
            from insightface.app import FaceAnalysis
            face_app = FaceAnalysis(name='buffalo_l')
            face_app.prepare(ctx_id=-1, det_size=(640, 640))
        img = cv2.imread(image_path)
        if img is None:
            return {"success": False, "error": f"Error loading image {image_path}"}
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = face_app.get(img_rgb)
        if not faces:
            return {"success": False, "error": f"No face detected in {image_path}"}
        img_h, img_w, _ = img.shape
        face = faces[0]
        x1, y1, x2, y2 = map(int, face.bbox)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(img_w, x2), min(img_h, y2)
        cropped_face = img[y1:y2, x1:x2]
        if cropped_face.size == 0:
            return {"success": False, "error": f"Invalid face crop in {image_path}"}
        base_filename = os.path.basename(image_path)
        cropped_face_filename = f"{os.path.splitext(base_filename)[0]}_cropped.jpg"
        cropped_face_path = os.path.join(cropped_faces_dir, cropped_face_filename)
        cv2.imwrite(cropped_face_path, cropped_face)
        feature_vector = face.embedding.tolist()
        if not feature_vector:
            return {"success": False, "error": f"Feature extraction failed for {image_path}"}
        store_face_data_in_sqlite(person_name, location, cropped_face_path, feature_vector)
        try:
            if os.path.exists(feature_file):
                with open(feature_file, "r") as f:
                    feature_dict = json.load(f)
            else:
                feature_dict = {}
            feature_dict[cropped_face_filename] = feature_vector
            with open(feature_file, "w") as f:
                json.dump(feature_dict, f, indent=4)
        except Exception as e:
            print(f"Warning: Could not update features.json: {str(e)}")
        return {
            "success": True,
            "image_path": cropped_face_path,
            "person_name": person_name,
            "location": location
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# Run the feature extraction process
process_images()
