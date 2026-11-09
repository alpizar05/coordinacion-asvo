import postgres from 'postgres';

export const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
export const demo = process.env.NODE_ENV === 'development' && process.env.ASVO_DEMO === '1';
export const appUrl = () => new URL(process.env.APP_URL!).origin;
export const demoAdmin = 'local-admin';
export const demoCoordinator = 'local-coordination';
