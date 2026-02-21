from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
from datetime import datetime
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__, static_folder='.')

def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            severity TEXT NOT NULL,
            location TEXT NOT NULL,
            description TEXT NOT NULL,
            media_path TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'PENDING'
        )
    ''')
    
    # Explicit migration for existing tables
    c.execute("PRAGMA table_info(incidents)")
    columns = [row[1] for row in c.fetchall()]
    if 'media_path' not in columns:
        try:
            c.execute("ALTER TABLE incidents ADD COLUMN media_path TEXT")
        except sqlite3.OperationalError:
            pass # Column might have been added in a parallel process

    c.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            category TEXT NOT NULL,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS volunteers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            skill TEXT NOT NULL,
            availability TEXT NOT NULL,
            contact TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS shelters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            occupied INTEGER NOT NULL
        )
    ''')
    
    # Seed data if tables are empty
    c.execute("SELECT COUNT(*) FROM inventory")
    if c.fetchone()[0] == 0:
        c.executemany("INSERT INTO inventory (item, quantity, category) VALUES (?, ?, ?)", [
            ('Bottled Water', 1200, 'Food/Water'),
            ('Rice Bags', 500, 'Food/Water'),
            ('First Aid Kits', 150, 'Medical'),
            ('Blankets', 300, 'Supplies'),
            ('Canned Food', 2000, 'Food/Water')
        ])
    
    c.execute("SELECT COUNT(*) FROM volunteers")
    if c.fetchone()[0] == 0:
        c.executemany("INSERT INTO volunteers (name, skill, availability, contact) VALUES (?, ?, ?, ?)", [
            ('John Doe', 'Medical', 'Available', '555-0199'),
            ('Jane Smith', 'Logistics', 'Busy', '555-0188'),
            ('Alex Johnson', 'Search & Rescue', 'Available', '555-0177')
        ])

    c.execute("SELECT COUNT(*) FROM shelters")
    if c.fetchone()[0] == 0:
        c.executemany("INSERT INTO shelters (name, location, capacity, occupied) VALUES (?, ?, ?, ?)", [
            ('Relief Camp Alpha', 'Downtown High School', 500, 320),
            ('Shelter Beta', 'Unity Church', 200, 180),
            ('Rescue Hub Gamma', 'Civic Center', 1000, 450)
        ])

    conn.commit()
    conn.close()

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    c.execute("SELECT COUNT(*) FROM incidents WHERE status='PENDING'")
    active_incidents = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM incidents WHERE severity='critical' AND status='PENDING'")
    critical_alerts = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM incidents WHERE status='RESOLVED'")
    resolved = c.fetchone()[0]
    
    c.execute("SELECT SUM(quantity) FROM inventory")
    total_resources = c.fetchone()[0] or 0
    
    c.execute("SELECT COUNT(*) FROM volunteers WHERE availability='Available'")
    active_volunteers = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM shelters")
    total_camps = c.fetchone()[0]
    
    conn.close()

    return jsonify({
        'volunteers': active_volunteers + 1200, # Base display logic maintained
        'camps': total_camps,
        'resources': f"{total_resources/1000:.1f}k+" if total_resources >= 1000 else f"{total_resources}",
        'critical_alerts': critical_alerts,
        'active_incidents': active_incidents,
        'resolved_24h': resolved
    })

@app.route('/api/incidents', methods=['GET', 'POST'])
def handle_incidents():
    if request.method == 'POST':
        try:
            # Handle both JSON and Multipart-form data for robustness
            if request.is_json:
                data = request.json
                inc_type = data.get('type')
                severity = data.get('severity')
                location = data.get('location')
                description = data.get('description')
                media_filename = None
            else:
                inc_type = request.form.get('type')
                severity = request.form.get('severity')
                location = request.form.get('location')
                description = request.form.get('description')
                
                media_filename = None
                if 'media' in request.files:
                    file = request.files['media']
                    if file and file.filename:
                        media_filename = secure_filename(file.filename)
                        file.save(os.path.join(UPLOAD_FOLDER, media_filename))

            if not all([inc_type, severity, location]):
                return jsonify({'error': 'Missing required fields'}), 400

            conn = sqlite3.connect('database.db')
            c = conn.cursor()
            c.execute('''
                INSERT INTO incidents (type, severity, location, description, media_path)
                VALUES (?, ?, ?, ?, ?)
            ''', (inc_type, severity, location, description, media_filename))
            conn.commit()
            incident_id = c.lastrowid
            conn.close()
            return jsonify({'message': 'Incident reported successfully', 'id': incident_id}), 201
        except Exception as e:
            print(f"Error in /api/incidents: {str(e)}")
            return jsonify({'error': str(e)}), 500
        
    elif request.method == 'GET':
        conn = sqlite3.connect('database.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM incidents ORDER BY timestamp DESC LIMIT 50")
        rows = c.fetchall()
        incidents = [dict(row) for row in rows]
        conn.close()
        return jsonify(incidents)

@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM inventory")
    rows = c.fetchall()
    data = [dict(row) for row in rows]
    conn.close()
    return jsonify(data)

@app.route('/api/volunteers', methods=['GET'])
def get_volunteers():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM volunteers")
    rows = c.fetchall()
    data = [dict(row) for row in rows]
    conn.close()
    return jsonify(data)

@app.route('/api/shelters', methods=['GET'])
def get_shelters():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM shelters")
    rows = c.fetchall()
    data = [dict(row) for row in rows]
    conn.close()
    return jsonify(data)

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
