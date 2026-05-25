import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { AuthPayload, ApiResponse } from '../shared/types/dns.js';

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as any;

    if (!username || !password) {
      reply.code(400).send({ success: false, error: 'Username and password are required' });
      return;
    }

    try {
      // Find user
      const user = fastify.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
      if (!user) {
        reply.code(401).send({ success: false, error: 'Invalid username or password' });
        return;
      }

      // Verify password
      const match = bcrypt.compareSync(password, user.password_hash);
      if (!match) {
        reply.code(401).send({ success: false, error: 'Invalid username or password' });
        return;
      }

      // Generate JWT
      const payload: AuthPayload = {
        userId: user.id,
        username: user.username,
        role: user.role
      };

      const token = fastify.jwt.sign(payload, { expiresIn: '8h' });

      // Return token
      reply.send({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        }
      });
    } catch (err) {
      fastify.log.error(err, 'Login error');
      reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // GET /api/auth/me (Get profile - Protected)
  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      success: true,
      data: request.user
    });
  });
}
