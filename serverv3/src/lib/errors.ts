import type { FastifyReply } from "fastify";

export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  const body: ApiErrorBody = {
    error: { code, message, ...(details && Object.keys(details).length ? { details } : {}) },
  };
  return reply.status(status).send(body);
}
