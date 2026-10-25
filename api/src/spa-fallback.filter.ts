import { type ArgumentsHost, Catch, type ExceptionFilter, NotFoundException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type {} from '@fastify/static'; // ajoute reply.sendFile

/**
 * L'API sert aussi l'application web compilée. Toute adresse inconnue hors de
 * /api renvoie index.html, et le routeur React prend le relais.
 */
@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  constructor(private readonly webEnabled: boolean) {}

  catch(exception: NotFoundException, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    if (this.webEnabled && request.method === 'GET' && !request.url.startsWith('/api')) {
      void reply.type('text/html').sendFile('index.html');
      return;
    }
    void reply.status(404).send(exception.getResponse());
  }
}
