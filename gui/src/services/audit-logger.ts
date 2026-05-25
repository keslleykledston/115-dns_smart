import { Database } from 'better-sqlite3';

export class AuditLogger {
  /**
   * Log an admin action to the database
   */
  public static log(
    db: Database,
    userId: number,
    username: string,
    action: string,
    target?: string,
    details?: string
  ): void {
    try {
      db.prepare(`
        INSERT INTO audit_log (user_id, username, action, target, details)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, username, action, target || null, details || null);
      
      console.log(`[AUDIT] User ${username} (ID: ${userId}) performed action: ${action} on ${target || 'system'}`);
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }
}

export default AuditLogger;
