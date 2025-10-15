def insert_sample_face():
    conn = sqlite3.connect('faces.db')
    cursor = conn.cursor()
    cursor.execute("INSERT INTO faces (name, thana, img, image_path) VALUES (?, ?, ?, ?)",
                   ("John Doe", "Thana Central", "/path/to/image.jpg", "/path/to/image.jpg"))
    conn.commit()
    conn.close()
    print("Inserted sample face record.")
def add_img_column():
    conn = sqlite3.connect('faces.db')
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(faces)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'img' not in columns:
        cursor.execute("ALTER TABLE faces ADD COLUMN img TEXT")
        print("Added 'img' column to faces table.")
    else:
        print("'img' column already exists.")
    conn.commit()
    conn.close()

import sqlite3

def add_thana_column():
    conn = sqlite3.connect('faces.db')
    cursor = conn.cursor()
    # Check if 'thana' column exists
    cursor.execute("PRAGMA table_info(faces)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'thana' not in columns:
        cursor.execute("ALTER TABLE faces ADD COLUMN thana TEXT")
        print("Added 'thana' column to faces table.")
    else:
        print("'thana' column already exists.")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    add_thana_column()
    add_img_column()
    insert_sample_face()
import sqlite3

# Connect to (or create) the local database
conn = sqlite3.connect('faces.db')
cursor = conn.cursor()

# Create a table for faces
cursor.execute('''
CREATE TABLE IF NOT EXISTS faces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    thana TEXT NOT NULL,
    img TEXT
)
''')

conn.commit()
conn.close()

print('SQLite database and faces table created: id, name, thana, img.')
