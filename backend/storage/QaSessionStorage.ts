/**
 * QaSessionStorage — saves QA sessions to Supabase with file fallback.
 *
 * Supabase table required (create if not exists):
 *   CREATE TABLE qa_agent_sessions (
 *     id          uuid primary key,
 *     goal        text,
 *     base_url    text,
 *     status      text,
 *     test_summary jsonb,
 *     report       jsonb,
 *     video_path   text,
 *     error        text,
 *     started_at   timestamptz,
 *     finished_at  timestamptz
 *   );
 */

import * as path from 'path';
import * as fs from 'fs';
import type { QaSession } from '../agent/types';

// Lazy-load supabase to avoid crashing if env vars are missing
function getSupabase() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../supabase') as ReturnType<typeof import('@supabase/supabase-js').createClient>;
  } catch {
    return null;
  }
}

const TABLE = 'qa_agent_sessions';

export class QaSessionStorage {
  constructor(private workspaceRoot: string) {
    fs.mkdirSync(workspaceRoot, { recursive: true });
  }

  async save(session: QaSession): Promise<void> {
    // 1. Always save to disk (fast, reliable)
    this.saveToDisk(session);

    // 2. Try Supabase
    try {
      const supabase = getSupabase();
      if (!supabase) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from(TABLE).upsert({
        id:           session.id,
        goal:         session.goal,
        base_url:     session.baseUrl,
        status:       session.status,
        test_summary: session.testSummary ?? null,
        report:       session.report ?? null,
        video_path:   session.videoPath ?? null,
        error:        session.error ?? null,
        started_at:   session.startedAt,
        finished_at:  session.finishedAt ?? null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[QaSessionStorage] Supabase save failed (using file fallback):', msg);
    }
  }

  async list(): Promise<QaSession[]> {
    // Try Supabase first
    try {
      const supabase = getSupabase();
      if (supabase) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .select('*')
          .order('started_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          return data.map(this.mapRow);
        }
      }
    } catch { /* fall through to file */ }

    // File fallback
    return this.listFromDisk();
  }

  async load(id: string): Promise<QaSession | null> {
    // Try Supabase first
    try {
      const supabase = getSupabase();
      if (supabase) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) return this.mapRow(data);
      }
    } catch { /* fall through */ }

    return this.loadFromDisk(id);
  }

  async delete(id: string): Promise<boolean> {
    let deleted = false;

    // Remove from Supabase
    try {
      const supabase = getSupabase();
      if (supabase) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from(TABLE).delete().eq('id', id);
        deleted = true;
      }
    } catch { /* ignore */ }

    // Remove from disk
    const dir = this.sessionDir(id);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      deleted = true;
    }

    return deleted;
  }

  // ─── Disk helpers ─────────────────────────────────────────────────────────

  private saveToDisk(session: QaSession): void {
    const dir = this.sessionDir(session.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'qa_session.json'),
      JSON.stringify(session, null, 2),
      'utf-8',
    );
  }

  private loadFromDisk(id: string): QaSession | null {
    const file = path.join(this.sessionDir(id), 'qa_session.json');
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as QaSession;
    } catch { return null; }
  }

  private listFromDisk(): QaSession[] {
    if (!fs.existsSync(this.workspaceRoot)) return [];

    return fs.readdirSync(this.workspaceRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => this.loadFromDisk(d.name))
      .filter((s): s is QaSession => s !== null)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  sessionDir(id: string): string {
    return path.join(this.workspaceRoot, id);
  }

  // ─── Supabase row mapper ───────────────────────────────────────────────────

  private mapRow(row: Record<string, unknown>): QaSession {
    return {
      id:          String(row.id),
      goal:        String(row.goal || ''),
      baseUrl:     String(row.base_url || ''),
      status:      row.status as QaSession['status'],
      testSummary: row.test_summary as QaSession['testSummary'],
      report:      row.report as QaSession['report'],
      videoPath:   row.video_path ? String(row.video_path) : undefined,
      error:       row.error ? String(row.error) : undefined,
      startedAt:   String(row.started_at),
      finishedAt:  row.finished_at ? String(row.finished_at) : undefined,
    };
  }
}
