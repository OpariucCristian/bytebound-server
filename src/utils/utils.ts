import type { Request } from 'express';

export const getUserIdFromToken = (req: Request): string | undefined => {
  const user = req.user as Record<string, unknown> | undefined;
  return typeof user?.sub === 'string' ? user.sub : undefined;
};

export const getUserNameFromToken = (req: Request): string | undefined => {
  const user = req.user as Record<string, unknown> | undefined;
  const userMetadata = user?.user_metadata as
    | Record<string, unknown>
    | undefined;
  return typeof userMetadata?.username === 'string'
    ? userMetadata.username
    : undefined;
};
