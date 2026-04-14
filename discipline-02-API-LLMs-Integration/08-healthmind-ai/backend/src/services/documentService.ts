import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Use a separate file so this connection never conflicts with the LangGraph checkpointer
const DB_PATH = path.join(__dirname, '../../healthmind-docs.db');

export type StoredDocument = {
  filename: string;
  content: string;
  uploadedAt: string;
};

// Reuse the same SQLite database file as the LangGraph checkpointer
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS patient_documents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id  TEXT    NOT NULL,
    filename    TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    uploaded_at TEXT    NOT NULL,
    UNIQUE (patient_id, filename)
  );
  CREATE INDEX IF NOT EXISTS idx_patient_docs ON patient_documents (patient_id);
`);

export async function storeDocument(
  patientId: string,
  filename: string,
  content: string,
): Promise<void> {
  // UPSERT: replace any previous version of the same filename for this patient.
  // This ensures re-uploading always refreshes the stored content (no stale placeholders).
  db.prepare(
    `INSERT INTO patient_documents (patient_id, filename, content, uploaded_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(patient_id, filename) DO UPDATE SET
       content    = excluded.content,
       uploaded_at = excluded.uploaded_at`,
  ).run(patientId, filename, content, new Date().toISOString());

  console.log(`✅ Stored/replaced document "${filename}" for patient ${patientId} in SQLite`);
}

export async function searchDocuments(
  patientId: string,
  query: string,
  k = 3,
): Promise<StoredDocument[]> {
  // Fetch all docs for this patient (newest first) and rank by query-term overlap
  const rows = db
    .prepare(
      'SELECT filename, content, uploaded_at FROM patient_documents WHERE patient_id = ? ORDER BY id DESC LIMIT ?',
    )
    .all(patientId, k * 4) as { filename: string; content: string; uploaded_at: string }[];

  if (rows.length === 0) return [];

  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = rows.map((row) => {
    const text = row.content.toLowerCase();
    const score = queryTerms.filter((term) => text.includes(term)).length;
    return {
      doc: { filename: row.filename, content: row.content, uploadedAt: row.uploaded_at },
      score,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ doc }) => doc);
}

export async function getAllDocuments(patientId: string): Promise<StoredDocument[]> {
  const rows = db
    .prepare(
      'SELECT filename, content, uploaded_at FROM patient_documents WHERE patient_id = ? ORDER BY id DESC',
    )
    .all(patientId) as { filename: string; content: string; uploaded_at: string }[];

  return rows.map((r) => ({
    filename: r.filename,
    content: r.content,
    uploadedAt: r.uploaded_at,
  }));
}
