import type { NextConfig } from 'next';
const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    return [{source:'/convocatorias/:id',headers:[
      {key:'Referrer-Policy',value:'no-referrer'},
    ]},{source:'/resumen-salida/:path*',headers:[
      {key:'Cache-Control',value:'private, no-store'},
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'X-Robots-Tag',value:'noindex, nofollow'},
    ]},{source:'/privado/:path*',headers:[
      {key:'Cache-Control',value:'private, no-store'},
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'X-Robots-Tag',value:'noindex, nofollow'},
    ]}];
  },
};
export default config;
