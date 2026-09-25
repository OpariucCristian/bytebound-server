import type { Request } from 'express';

export const getUserIdFromToken = (req: Request): string | undefined => {
  const user = req.user as Record<string, unknown> | undefined;
  return typeof user?.sub === 'string' ? user.sub : undefined;
};

/**
 * The player's display name: the `username` claim (a custom Clerk session
 * claim), falling back to Supabase-style `user_metadata.username`.
 */
export const getUserNameFromToken = (req: Request): string | undefined => {
  const user = req.user as Record<string, unknown> | undefined;
  if (typeof user?.username === 'string' && user.username) {
    return user.username;
  }
  const userMetadata = user?.user_metadata as
    | Record<string, unknown>
    | undefined;
  return typeof userMetadata?.username === 'string'
    ? userMetadata.username
    : undefined;
};

/** A shuffled copy of `items` (Fisher-Yates). */
export const shuffle = <T>(items: readonly T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
