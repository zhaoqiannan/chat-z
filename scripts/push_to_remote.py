import subprocess
import os
import json
import sqlite3

with open("remote_columns.json", "r") as f:
    remote_cols = json.load(f)

db_path = os.path.abspath(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/9ccf6da6a0800caac2b1ceb8a7da5f936ef38ff869b79dad74ceb83919e4d6b4.sqlite")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

for table, target_cols in remote_cols.items():
    if table in ["d1_migrations", "_cf_KV", "sqlite_sequence"]:
        continue
    try:
        cursor.execute(f'PRAGMA table_info("{table}")')
        local_info = cursor.fetchall()
        if not local_info:
            continue
        local_cols = [c[1] for c in local_info]
        valid_cols = [c for c in target_cols if c in local_cols]
        if not valid_cols:
            continue
            
        cols_query = ", ".join([f'"{c}"' for c in valid_cols])
        cursor.execute(f'SELECT {cols_query} FROM "{table}"')
        rows = cursor.fetchall()
        if not rows:
            print(f"[{table}] 0 rows, skipping.")
            continue
        print(f"[{table}] Syncing {len(rows)} rows...")
        
        # Batch by 20 rows per chunk file
        batch_size = 20
        for i in range(0, len(rows), batch_size):
            chunk_rows = rows[i:i+batch_size]
            statements = []
            for row in chunk_rows:
                val_list = []
                for val in row:
                    if val is None:
                        val_list.append("NULL")
                    elif isinstance(val, (int, float)):
                        val_list.append(str(val))
                    else:
                        escaped = str(val).replace("'", "''")
                        val_list.append(f"'{escaped}'")
                vals_str = ", ".join(val_list)
                statements.append(f'INSERT OR REPLACE INTO "{table}" ({cols_query}) VALUES ({vals_str});')
            
            chunk_sql = "\n".join(statements)
            with open("temp_chunk.sql", "w", encoding="utf-8") as tf:
                tf.write(chunk_sql)
            
            res = subprocess.run(
                ["npx", "wrangler", "d1", "execute", "chat_db", "--remote", "--file=temp_chunk.sql", "--yes"],
                capture_output=True,
                text=True
            )
            if res.returncode != 0:
                print(f"Error on {table} chunk {i}: {res.stderr or res.stdout}")
            else:
                print(f"  Synced rows {i} to {i+len(chunk_rows)} for {table}")
    except Exception as e:
        print(f"Error on table {table}: {e}")

if os.path.exists("temp_chunk.sql"):
    os.remove("temp_chunk.sql")

print("Sync completed!")
