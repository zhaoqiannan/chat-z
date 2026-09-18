import sqlite3
import os

db_path = os.path.abspath(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/9ccf6da6a0800caac2b1ceb8a7da5f936ef38ff869b79dad74ceb83919e4d6b4.sqlite")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(outlines)")
    existing_cols = [c[1] for c in cursor.fetchall()]
    
    cols_to_add = [
        ("level", "integer DEFAULT 1"),
        ("summary", "text"),
        ("timeframe", "text"),
        ("location", "text"),
    ]
    for col_name, col_type in cols_to_add:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE outlines ADD COLUMN {col_name} {col_type}")
                print(f"Added local column {col_name}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
                
    cursor.execute("UPDATE outlines SET level = 2 WHERE parent_id IS NOT NULL")
    cursor.execute("UPDATE outlines SET level = 1 WHERE parent_id IS NULL")
    conn.commit()
    conn.close()
    print("Local DB 0016 columns verified and updated.")
else:
    print("Local DB file not found:", db_path)
