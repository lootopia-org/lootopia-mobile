import type { User } from '@/src/lib/auth-api';

/** Only plain player accounts may join/leave hunts as participants. */
export function isPlayerUser(user: User | null | undefined): boolean {
  return !user?.role || user.role === 'player';
}
