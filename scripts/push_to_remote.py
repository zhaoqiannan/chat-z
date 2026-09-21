import sys

print("[SAFETY ERROR] 该脚本会导致本地自增 ID 与线上生产库真实用户数据冲突并造成数据覆盖！")
print("禁止全量执行 INSERT OR REPLACE 到线上生产库。如需同步表结构，请使用 `npx wrangler d1 migrations apply chat_db --remote`。")
sys.exit(1)
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
