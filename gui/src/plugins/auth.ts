import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthPayload, UserRole } from '../shared/types/dns.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthPayload;
    user: AuthPayload;
  }
}

export default fp(async function (fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET || 'dns-smart-super-secret-key-change-me-please';

  fastify.register(jwt, {
    secret: secret,
    cookie: {
      cookieName: 'token',
      signed: false
    }
  });

  // Global Auth hook
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // Check Authorization header or cookies
      let token = '';
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if ((request as any).cookies && (request as any).cookies.token) {
        token = (request as any).cookies.token;
      }

      if (!token) {
        reply.code(401).send({ success: false, error: 'Authentication required' });
        return;
      }

      const decoded = fastify.jwt.verify<AuthPayload>(token);
      request.user = decoded;
    } catch (err) {
      reply.code(401).send({ success: false, error: 'Invalid or expired token' });
    }
  });

  // Role verification decorator
  fastify.decorate('requireRole', function (roles: UserRole[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      // Ensure user is authenticated first
      if (!request.user) {
        reply.code(401).send({ success: false, error: 'Authentication required' });
        return;
      }

      if (!roles.includes(request.user.role)) {
        reply.code(403).send({ success: false, error: 'Forbidden: Insufficient permissions' });
      }
    };
  });
});
