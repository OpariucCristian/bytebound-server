import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source-options';

// Used by the TypeORM CLI (see the migration:* scripts in package.json).
export default new DataSource(buildDataSourceOptions());
