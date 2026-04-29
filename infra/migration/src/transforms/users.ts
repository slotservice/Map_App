import type { Migrator } from '../types.js';
import { legacyQuery, type LegacyUserRow } from '../lib/legacy-mysql.js';
import { getPrisma } from '../lib/target-prisma.js';
import { LEGACY_USER_TYPE_TO_ROLE, type UserRole } from '@map-app/shared';

/**
 * Map legacy `users` rows → new `users`.
 *
 * Keeps the bcrypt hash verbatim ($2y$ and $2b$ are interchangeable —
 * bcrypt-the-library accepts both). Sets `legacyId` for cross-reference
 * by the later transform phases. Splits `username` into firstName +
 * lastName by the first space (most legacy rows have full names like
 * "Donny McMillan"; if no space, lastName is empty).
 */
export const migrateUsers: Migrator = async (ctx) => {
  const prisma = getPrisma();
  const rows = await legacyQuery<LegacyUserRow>(
    'SELECT * FROM users WHERE del_flg = 0',
  );
  let written = 0;
  const warnings: string[] = [];

  for (const row of rows) {
    const role = LEGACY_USER_TYPE_TO_ROLE[row.type];
    if (!role) {
      warnings.push(`User #${row.id} has unknown type=${row.type}; defaulting to viewer`);
    }
    const finalRole: UserRole = role ?? 'viewer';

    const { firstName, lastName } = splitName(row.username, row.email);

    if (ctx.dryRun) {
      written++;
      continue;
    }

    await prisma.user.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        email: row.email.toLowerCase(),
        passwordHash: row.password,
        firstName,
        lastName,
        phone: row.phone,
        address: row.address,
        state: row.state,
        zip: row.zip,
        role: finalRole,
        status: row.status === 1 ? 'active' : 'blocked',
      },
      update: {
        email: row.email.toLowerCase(),
        firstName,
        lastName,
        phone: row.phone,
        address: row.address,
        state: row.state,
        zip: row.zip,
        role: finalRole,
        status: row.status === 1 ? 'active' : 'blocked',
      },
    });
    written++;
  }

  return { read: rows.length, written, warnings };
};

function splitName(username: string, email: string): { firstName: string; lastName: string } {
  const trimmed = (username ?? '').trim();
  if (!trimmed) {
    // Last-resort fallback — use the email local-part so the new admin
    // UI doesn't show empty rows.
    return { firstName: email.split('@')[0] ?? email, lastName: '' };
  }
  const i = trimmed.indexOf(' ');
  if (i < 0) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, i), lastName: trimmed.slice(i + 1) };
}
