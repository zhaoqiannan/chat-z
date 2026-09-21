import sys

print("[SAFETY ERROR] 该脚本会导致本地自增 ID 与线上生产库真实用户数据冲突并造成数据覆盖！")
print("禁止全量执行 INSERT OR REPLACE 到线上生产库。如需同步表结构，请使用 `npx wrangler d1 migrations apply chat_db --remote`。")
sys.exit(1)
cursor = conn.cursor()

sql_statements = []

for table, target_cols in remote_cols.items():
    try:
        cursor.execute(f'PRAGMA table_info("{table}")')
        local_info = cursor.fetchall()
        if not local_info:
            continue
        local_cols = [c[1] for c in local_info]
        
        # Intersect columns: only select columns that exist in BOTH local and remote
        valid_cols = [c for c in target_cols if c in local_cols]
        if not valid_cols:
            continue
            
        cols_query = ", ".join([f'"{c}"' for c in valid_cols])
        cursor.execute(f'SELECT {cols_query} FROM "{table}"')
        rows = cursor.fetchall()
        if not rows:
            continue
        print(f"Table {table}: exporting {len(rows)} rows with {len(valid_cols)} columns")
        
        for row in rows:
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
            sql_statements.append(f'INSERT OR REPLACE INTO "{table}" ({cols_query}) VALUES ({vals_str});')
    except Exception as e:
        print(f"Error on {table}: {e}")

output_path = os.path.abspath("sync_data_to_remote.sql")
with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(sql_statements))

print(f"Total {len(sql_statements)} statements written to {output_path}")
