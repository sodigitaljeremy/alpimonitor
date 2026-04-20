import { buildServer } from './server.js';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  const server = await buildServer();

  try {
    await server.listen({ host: HOST, port: PORT });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
