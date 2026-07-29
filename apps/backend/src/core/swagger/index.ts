import swaggerJsdoc from 'swagger-jsdoc';

// First real Swagger wiring in the codebase (TRD §9 requires OpenAPI docs at /api-docs; the
// dependency was installed in Feature 0 but never mounted). swagger-jsdoc regex-scans the
// `@swagger` JSDoc blocks directly on *.routes.ts files at process start — it works against the
// .ts source (no compilation needed to read comments), and since this repo doesn't strip src/
// out of the image in its current (non-multistage) Docker setup, the same glob resolves
// correctly whether running via ts-node-dev (dev) or `node dist/server.js` (the cwd is
// apps/backend either way, and src/ is still present alongside dist/).
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KarobarAI API',
      version: '0.0.0',
      description: 'REST API for KarobarAI. Every response uses the envelope: { success, data, error, timestamp } (TRD §9).',
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
