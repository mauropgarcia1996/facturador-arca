/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep pdfkit out of the route bundle so __dirname points at node_modules/.../js/data/*.afm
  serverExternalPackages: ['pdfkit', 'fontkit', 'linebreak'],
  outputFileTracingIncludes: {
    '/api/facturas/pdf': ['./node_modules/pdfkit/js/data/**/*'],
  },
}

module.exports = nextConfig
