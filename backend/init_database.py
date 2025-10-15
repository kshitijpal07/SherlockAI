#!/usr/bin/env python3
"""
Database initialization script for SherlockAI
Creates all necessary tables and populates with sample data
"""

import sqlite3
import os
from datetime import datetime

def init_database():
    """Initialize the SQLite database with all required tables"""
    
    # Database file path
    db_path = "faces.db"
    
    try:
        # Connect to database (creates if doesn't exist)
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔧 Initializing SherlockAI database...")
        
        # Create faces table for suspect records
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS faces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                thana TEXT NOT NULL,
                image_path TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                embedding BLOB
            )
        ''')
        print("✅ Created 'faces' table")
        
        # Create police_stations table for authentication
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
        print("✅ Created 'police_stations' table")
        
        # Create analysis_logs table for tracking video analysis
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS analysis_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT UNIQUE NOT NULL,
                video_name TEXT NOT NULL,
                status TEXT DEFAULT 'processing',
                progress INTEGER DEFAULT 0,
                results TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                police_station_id INTEGER,
                FOREIGN KEY (police_station_id) REFERENCES police_stations (id)
            )
        ''')
        print("✅ Created 'analysis_logs' table")
        
        # Commit table creation
        conn.commit()
        
        # Insert sample police stations
        print("\n📊 Adding sample data...")
        
        sample_stations = [
            ("Central Police Station", "CPS001", "password123", datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            ("North Zone Station", "NZS002", "secure456", datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            ("South District HQ", "SDH003", "admin789", datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            ("Airport Security", "APS004", "safety321", datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            ("Railway Police", "RPL005", "train999", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        ]
        
        for station in sample_stations:
            try:
                cursor.execute(
                    "INSERT INTO police_stations (thana_name, thana_id, password, created_at) VALUES (?, ?, ?, ?)",
                    station
                )
                print(f"   + {station[0]} (ID: {station[1]})")
            except sqlite3.IntegrityError:
                print(f"   ⚠️  {station[0]} already exists, skipping...")
        
        # Insert sample suspect records
        sample_suspects = [
            ("John Doe", "Central Police Station", "sample_images/john_doe.jpg"),
            ("Jane Smith", "North Zone Station", "sample_images/jane_smith.jpg"),
            ("Mike Johnson", "South District HQ", "sample_images/mike_johnson.jpg"),
            ("Sarah Wilson", "Airport Security", "sample_images/sarah_wilson.jpg"),
            ("Robert Brown", "Railway Police", "sample_images/robert_brown.jpg")
        ]
        
        for suspect in sample_suspects:
            try:
                cursor.execute(
                    "INSERT INTO faces (name, thana, image_path) VALUES (?, ?, ?)",
                    suspect
                )
                print(f"   + Suspect: {suspect[0]} ({suspect[1]})")
            except sqlite3.IntegrityError:
                print(f"   ⚠️  Suspect {suspect[0]} already exists, skipping...")
        
        # Commit all changes
        conn.commit()
        conn.close()
        
        print(f"\n🎉 Database initialization completed successfully!")
        print(f"📁 Database file: {os.path.abspath(db_path)}")
        print(f"🔐 Sample login credentials:")
        print("   Thana ID: CPS001, Password: password123 (Central Police Station)")
        print("   Thana ID: NZS002, Password: secure456 (North Zone Station)")
        print("   Thana ID: SDH003, Password: admin789 (South District HQ)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error initializing database: {str(e)}")
        return False

def check_database_status():
    """Check current database status and display table info"""
    
    db_path = "faces.db"
    
    if not os.path.exists(db_path):
        print("❌ Database file does not exist. Run initialization first.")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("📊 Database Status:")
        print("=" * 50)
        
        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"📋 Tables: {len(tables)}")
        for table in tables:
            print(f"   - {table[0]}")
        
        # Check police stations
        cursor.execute("SELECT COUNT(*) FROM police_stations")
        station_count = cursor.fetchone()[0]
        print(f"🏢 Police Stations: {station_count}")
        
        # Check suspects
        cursor.execute("SELECT COUNT(*) FROM faces")
        suspect_count = cursor.fetchone()[0]
        print(f"👤 Suspects: {suspect_count}")
        
        # Check analysis logs
        cursor.execute("SELECT COUNT(*) FROM analysis_logs")
        log_count = cursor.fetchone()[0]
        print(f"📝 Analysis Logs: {log_count}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error checking database: {str(e)}")

if __name__ == "__main__":
    print("🚀 SherlockAI Database Initializer")
    print("=" * 50)
    
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        check_database_status()
    else:
        init_database()
        print("\n" + "=" * 50)
        check_database_status()