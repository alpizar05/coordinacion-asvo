import 'server-only';
import {demoConfiguration,databaseConfiguration,applicationConfiguration,authConfiguration,graphConfiguration,cronConfiguration,rateConfiguration,localDemoHost,ConfigurationError,safeDiagnostic} from './runtime-config.mjs';
export const readDemoConfiguration=()=>demoConfiguration(process.env);
export const readDatabaseConfiguration=()=>databaseConfiguration(process.env);
export const readApplicationConfiguration=()=>applicationConfiguration(process.env);
export const readAuthConfiguration=()=>authConfiguration(process.env);
export const readGraphConfiguration=feature=>graphConfiguration(process.env,feature);
export const readCronConfiguration=()=>cronConfiguration(process.env);
export const readRateConfiguration=()=>rateConfiguration(process.env);
export function assertDemoHost(host){if(readDemoConfiguration().enabled&&!localDemoHost(host))throw new ConfigurationError('demo',[{key:'Host',code:'loopback_required'}]);}
export const logSafeFailure=(feature,error)=>console.error('[security]',JSON.stringify(safeDiagnostic(feature,error)));
