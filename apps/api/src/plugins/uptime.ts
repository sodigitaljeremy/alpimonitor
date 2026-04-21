import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    startedAt: Date;
  }
}

// Captures the server's boot timestamp so routes can expose uptime without
// reading process.uptime() — which is per-process and doesn't survive a
// restart. Kept as its own plugin to make the intent clear.
export const uptimePlugin = fp(
  async (app) => {
    app.decorate('startedAt', new Date());
  },
  { name: 'uptime' }
);
