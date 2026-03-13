import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listClients,
  getClient,
  createClientService,
  updateClientService,
  deleteClientService,
} from '../services/client.service';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const createClientSchema = z.object({
  name: z.string().min(1).max(255),
  contact_name: z.string().max(255).optional(),
  contact_email: z
    .string()
    .email()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contact_name: z
    .string()
    .max(255)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  contact_email: z
    .string()
    .email()
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
});

export async function list(_req: AuthenticatedRequest, res: Response) {
  try {
    const clients = await listClients();
    res.json(clients);
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function get(req: AuthenticatedRequest, res: Response) {
  try {
    const client = await getClient(req.params.id);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const client = await createClientService(parsed.data, actorId);
    res.status(201).json(client);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A client with that name already exists' });
      return;
    }
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const client = await updateClientService(req.params.id, parsed.data, actorId);

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json(client);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A client with that name already exists' });
      return;
    }
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.user?.teamMemberId ?? null;
    const client = await deleteClientService(req.params.id, actorId);

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json(client);
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
