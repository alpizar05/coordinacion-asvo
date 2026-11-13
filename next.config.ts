import type { NextConfig } from 'next';
import {securityHeaders,privateHeaders,privateRequestLogPatterns} from './lib/security-headers.mjs';
const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  logging: { incomingRequests:{ignore:privateRequestLogPatterns},fetches:{fullUrl:false} },
  async headers() {
    return [
      {source:'/:path*',headers:securityHeaders(process.env)},
      ...['/coordinacion/:path*','/privado/:path*','/resumen-salida/:path*','/api/auth/:path*'].map(source=>({source,headers:privateHeaders})),
      {source:'/convocatorias/:id',has:[{type:'query' as const,key:'invitacion'}],headers:privateHeaders},
    ];
  },
};
export default config;
