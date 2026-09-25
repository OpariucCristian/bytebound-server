import { join } from 'path';
import type { DataSourceOptions } from 'typeorm';

type Env = Record<string, string | undefined>;

/**
 * Postgres connection settings, shared by the app, the migration CLI and the
 * setup script.
 *
 * Uses DATABASE_URL (e.g. Neon's connection string) if set, otherwise the
 * individual DB_* variables. SSL is on unless DB_SSL=false (local databases).
 */
export const buildDataSourceOptions = (
  env: Env = process.env,
): DataSourceOptions => {
  const connection = env.DATABASE_URL
    ? { url: env.DATABASE_URL }
    : {
        host: env.DB_HOST,
        port: Number(env.DB_PORT ?? 5432),
        username: env.DB_USERNAME,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
      };

  return {
    type: 'postgres',
    ...connection,
    ssl: env.DB_SSL === 'false' ? false : true,
    // gen_random_uuid() rather than the uuid-ossp extension
    uuidExtension: 'pgcrypto',
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
  };
};
