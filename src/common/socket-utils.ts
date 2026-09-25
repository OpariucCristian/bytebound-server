import { HttpException, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/** Reply to every client -> server socket event. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

/** An error whose message is safe to send to the client. */
export class SocketError extends Error {}

/** Validates a socket payload against a class-validator DTO. */
export const parsePayload = async <T extends object>(
  cls: new () => T,
  body: unknown,
): Promise<T> => {
  const dto = plainToInstance(cls, body ?? {});
  const errors = await validate(dto);
  if (errors.length > 0) {
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new SocketError(`Invalid payload: ${messages.join(', ')}`);
  }
  return dto;
};

/** The message to send back for an error, hiding unexpected ones. */
export const toSocketErrorMessage = (err: unknown, logger: Logger): string => {
  if (err instanceof HttpException || err instanceof SocketError) {
    return err.message;
  }
  logger.error('Unhandled socket error', err);
  return 'An unexpected error occurred';
};
