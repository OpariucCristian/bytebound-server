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
