import sqlite3
import os

db_path = os.path.abspath(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/9ccf6da6a0800caac2b1ceb8a7da5f936ef38ff869b79dad74ceb83919e4d6b4.sqlite")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# We will export tables: users, works, characters, factions, items, world_rules, chapters, chapter_versions, chapter_ai_chats, memory_fragments, outlines, notes, materials, timelines
tables = [
  "users",
  "works",
  "characters",
  "factions",
  "items",
  "world_rules",
  "chapters",
  "chapter_versions",
  "chapter_ai_chats",
  "memory_fragments",
  "outlines",
  "notes",
  "materials",
  "timelines"
]

sql_statements = []

for table in tables:
    try:
        cursor.execute(f'PRAGMA table_info("{table}")')
        columns_info = cursor.fetchall()
        if not columns_info:
            continue
        col_names = [col[1] for col in columns_info]
        
        cursor.execute(f'SELECT * FROM "{table}"')
        rows = cursor.fetchall()
        if not rows:
            continue
        print(f"Exporting {table}: {len(rows)} rows")
        
        cols_str = ", ".join([f'"{c}"' for c in col_names])
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
            sql_statements.append(f'INSERT OR REPLACE INTO "{table}" ({cols_str}) VALUES ({vals_str});')
    except Exception as e:
        print(f"Error on {table}: {e}")

# Handle character_relations separately to match remote schema (source_character_id, target_character_id, relation_name)
try:
    cursor.execute('SELECT id, work_id, source_char_id, target_char_id, relation_type, background_story, relation_tag, created_at, updated_at FROM character_relations')
    rel_rows = cursor.fetchall()
    for r in rel_rows:
        sql_statements.append(
            f'INSERT OR REPLACE INTO "character_relations" ("id", "work_id", "source_character_id", "target_character_id", "relation_name", "description", "color", "created_at", "updated_at") VALUES ({r[0]}, {r[1]}, {r[2]}, {r[3]}, \'{r[4]}\', \'{r[5] or ""}\', \'{r[6] or ""}\', {r[7]}, {r[8]});'
        )
    print(f"Exported character_relations: {len(rel_rows)} rows")
except Exception as e:
    print(f"Rel err: {e}")

output_path = os.path.abspath("sync_data_to_remote.sql")
with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(sql_statements))

print(f"Generated {output_path} with {len(sql_statements)} statements.")
