import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authUsers, config } from '../config.ts';
import type { Role, UserSession } from '../domain/types.ts';

const issuedServiceTokens = new Map<string, UserSession>();

export function getServiceUser(token: string | undefined) {
  if (!token) return undefined;
  return issuedServiceTokens.get(token);
}

function bearerToken(request: FastifyRequest) {
  return request.headers.authorization?.replace(/bearer /i, '');
}

function normalizePath(url: string) {
  const [path] = url.split('?');
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function requestData(request: FastifyRequest) {
  return {
    ...((request.query ?? {}) as Record<string, unknown>),
    ...((request.body ?? {}) as Record<string, unknown>),
  } as { username?: string; password?: string; adminSuperSecret?: string };
}

export async function registerAuth(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const publicRoutes = ['/v1/health', '/v1/auth/login', '/v1/auth/service-token'];
    if (publicRoutes.includes(normalizePath(request.url))) return;

    const serviceUser = getServiceUser(bearerToken(request));
    if (serviceUser) {
      request.user = serviceUser;
      return;
    }

    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const body = requestData(request);
    const user = authUsers.find(
      (candidate) =>
        candidate.username.toLowerCase() === body.username?.toLowerCase() &&
        candidate.password === body.password,
    );

    if (!user) return reply.code(401).send({ message: 'Invalid credentials' });

    const token = app.jwt.sign({ username: user.username, role: user.role });
    return reply.send({ token, role: user.role, username: user.username });
  });

  app.post('/v1/auth/service-token', async (request, reply) => {
    const body = requestData(request);
    if (body.adminSuperSecret !== config.adminSuperSecret) {
      return reply.code(401).send({ message: 'Invalid adminSuperSecret' });
    }

    const user = authUsers.find(
      (candidate) =>
        candidate.username.toLowerCase() === body.username?.toLowerCase() &&
        candidate.password === body.password,
    );

    if (!user) return reply.code(401).send({ message: 'Invalid credentials' });

    const serviceToken = randomUUID();
    issuedServiceTokens.set(serviceToken, { username: user.username, role: user.role });
    return reply.send({ serviceToken, role: user.role });
  });
}

export function requireRole(role: Role) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
    if ((request.user as UserSession).role === role) return;
    return reply.code(403).send({ message: 'Forbidden: insufficient permissions' });
  };
}
