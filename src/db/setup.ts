import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source-options';
import { seed } from './seed';

/**
 * Brings the database up to date: runs pending migrations, then seeds the game
 * content into empty tables. Runs before the server starts on every deploy.
 */
const setup = async () => {
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();

  try {
    const migrations = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      migrations.length > 0
        ? `Ran migrations: ${migrations.map((m) => m.name).join(', ')}`
        : 'Database schema is up to date',
    );

    const seeded = await seed(dataSource);
    console.log(
      seeded.length > 0
        ? `Seeded ${seeded.join(', ')}`
        : 'Game content already present',
    );
  } finally {
    await dataSource.destroy();
  }
};

setup().catch((err) => {
  console.error('Database setup failed:', err);
  process.exit(1);
});
