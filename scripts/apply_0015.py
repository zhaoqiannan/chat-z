import sqlite3
import os
import subprocess

# 1. 本地数据库补齐列
db_path = os.path.abspath(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/9ccf6da6a0800caac2b1ceb8a7da5f936ef38ff869b79dad74ceb83919e4d6b4.sqlite")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(outlines)")
    existing_cols = [c[1] for c in cursor.fetchall()]
    
    cols_to_add = [
        ("category", "text NOT NULL DEFAULT 'chapter'"),
        ("deduction_id", "integer"),
        ("deduction_origin", "text"),
        ("deduction_premise", "text"),
        ("deduction_target", "text"),
        ("deduction_path_title", "text"),
        ("deduction_step_index", "integer"),
    ]
    for col_name, col_type in cols_to_add:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE outlines ADD COLUMN {col_name} {col_type}")
                print(f"Added local column {col_name}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
                
    cursor.execute("UPDATE outlines SET category = 'chapter' WHERE is_from_chapter = 1 OR chapter_id IS NOT NULL")
    conn.commit()
    conn.close()
    print("Local DB 0015 columns verified.")

# 2. 远程数据库应用
remote_sql = """
ALTER TABLE outlines ADD COLUMN category text NOT NULL DEFAULT 'chapter';
ALTER TABLE outlines ADD COLUMN deduction_id integer;
ALTER TABLE outlines ADD COLUMN deduction_origin text;
ALTER TABLE outlines ADD COLUMN deduction_premise text;
ALTER TABLE outlines ADD COLUMN deduction_target text;
ALTER TABLE outlines ADD COLUMN deduction_path_title text;
ALTER TABLE outlines ADD COLUMN deduction_step_index integer;
UPDATE outlines SET category = 'chapter' WHERE is_from_chapter = 1 OR chapter_id IS NOT NULL;
"""
with open("temp_0015.sql", "w", encoding="utf-8") as f:
    f.write(remote_sql)

res = subprocess.run(
    ["npx", "wrangler", "d1", "execute", "chat_db", "--remote", "--file=temp_0015.sql", "--yes"],
    capture_output=True,
    text=True
)
print("Remote result:", res.stdout, res.stderr)
if os.path.exists("temp_0015.sql"):
    os.remove("temp_0015.sql")
