import { HuntJoinError, type HuntJoinErrorCode } from '@/src/state/HuntsContext';

export function huntJoinErrorMessage(
  error: unknown,
  t: (key: string) => string
): string {
  if (error instanceof HuntJoinError) {
    switch (error.code) {
      case 'NOT_AUTHENTICATED':
        return t('hunts:shared.errors.notAuthenticated');
      case 'PLAYER_ONLY':
        return t('hunts:shared.errors.playerOnlyJoin');
      case 'JOIN_FAILED':
        return error.message || t('hunts:shared.errors.joinFailed');
      case 'LEAVE_FAILED':
        return error.message || t('hunts:shared.errors.leaveFailed');
      default:
        break;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return t('hunts:shared.errors.joinFailed');
}

export function isHuntJoinErrorCode(error: unknown, code: HuntJoinErrorCode): boolean {
  return error instanceof HuntJoinError && error.code === code;
}
