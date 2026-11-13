import 'server-only';
import {readDemoConfiguration,readDatabaseConfiguration,readApplicationConfiguration} from './server-config.mjs';
import postgres from 'postgres';

export const demo = readDemoConfiguration().enabled;
export const sql = postgres(readDatabaseConfiguration().url!, { max: 4 });
export const appUrl = () => readApplicationConfiguration().origin!;
export const demoAdmin = 'local-admin';
export const demoCoordinator = 'local-coordination';
