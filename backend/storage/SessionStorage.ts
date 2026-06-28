/**
 * SessionStorage — manages agent session files on disk.
 *
 * Each session gets its own directory under workspaceRoot:
 *   workspaceRoot/<sessionId>/
 *     session.json     — full session data
 *     screenshots/     — step screenshots
 *     video/           — session video
 *     snapshots/       — HTML snapshots
 *     report.html      — generated HTML report
 */

import * as path from 'path';
import * as fs from 'fs';
import type { AgentSession } from '../agent/types';

export class SessionStorage {
  constructor(private workspaceRoot: string) {
    fs.mkdirSync(workspaceRoot, { recursive: true });
  }

  save(session: AgentSession): void {
    const dir = this.sessionDir(session.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'session.json'),
      JSON.stringify(session, null, 2),
      'utf-8',
    );
  }

  load(sessionId: string): AgentSession | null {
    const file = path.join(this.sessionDir(sessionId), 'session.json');
    if (!fs.existsSync(file)) return null;

    try {
      const raw = fs.readFileSync(file, 'utf-8');
      return JSON.parse(raw) as AgentSession;
    } catch {
      return null;
    }
  }

  listAll(): AgentSession[] {
    const sessions: AgentSession[] = [];

    if (!fs.existsSync(this.workspaceRoot)) return sessions;

    const dirs = fs.readdirSync(this.workspaceRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const id of dirs) {
      const session = this.load(id);
      if (session) sessions.push(session);
    }

    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  delete(sessionId: string): boolean {
    const dir = this.sessionDir(sessionId);
    if (!fs.existsSync(dir)) return false;

    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  getScreenshots(sessionId: string): string[] {
    const dir = path.join(this.sessionDir(sessionId), 'screenshots');
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .map(f => path.join(dir, f));
  }

  getVideoPath(sessionId: string): string | null {
    const videoDir = path.join(this.sessionDir(sessionId), 'video');
    if (!fs.existsSync(videoDir)) return null;

    const files = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
    if (files.length === 0) return null;
    return path.join(videoDir, files[0]);
  }

  getReportPath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), 'report.html');
  }

  sessionDir(sessionId: string): string {
    return path.join(this.workspaceRoot, sessionId);
  }
}
