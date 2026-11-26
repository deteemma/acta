# Cherche le texte des demandes d'essai dans les tables de state.db (ticket 10).
import sqlite3

MOTIFS = ("MARQUEUR-ESSAI-T10", "Vergers du Lac")
c = sqlite3.connect("file:/opt/data/state.db?mode=ro", uri=True)
tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type IN ('table')")]
for t in tables:
    try:
        cols = [r[1] for r in c.execute(f'PRAGMA table_info("{t}")')]
        for col in cols:
            for m in MOTIFS:
                n = c.execute(f'SELECT count(*) FROM "{t}" WHERE CAST("{col}" AS TEXT) LIKE ?', (f"%{m}%",)).fetchone()[0]
                if n:
                    print(f"{t}.{col} : {n} ligne(s) avec « {m} »")
    except Exception as e:
        print(f"{t} : illisible ({e})")
print("pages libres :", c.execute("PRAGMA freelist_count").fetchone()[0],
      "| auto_vacuum :", c.execute("PRAGMA auto_vacuum").fetchone()[0],
      "| secure_delete :", c.execute("PRAGMA secure_delete").fetchone()[0])
