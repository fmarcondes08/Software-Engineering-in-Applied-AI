import type { UserSession } from '../domain/types.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: UserSession;
  }
}
