import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listProjects,
  getProject,
  createProjectService,
  updateProjectService,
  archiveProjectService,
} from '../services/project.service';
import { z } from 'zod';
import { BudgetType, ProjectStatus } from '../generated/prisma/client';

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget_type: z.nativeEnum(BudgetType).optional(),
  budget_amount: z.number().optional(),
  currency_code: z.string().length(3).optional(),
  client_id: z.string().uuid().optional().nullable(),
  external_board_url: z.string().url().nullable().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  budget_type: z.nativeEnum(BudgetType).optional(),
  budget_amount: z.number().nullable().optional(),
  currency_code: z.string().length(3).optional(),
  client_id: z.string().uuid().optional().nullable(),
  external_board_url: z.string().url().nullable().optional(),
});

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const { status } = req.query;
    const projects = await listProjects(status && typeof status === 'string' ? status : undefined);
    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function get(req: AuthenticatedRequest, res: Response) {
  try {
    const project = await getProject(req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const project = await createProjectService(parsed.data, actorId);

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const project = await updateProjectService(req.params.id, parsed.data, actorId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function archive(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.user?.teamMemberId ?? null;
    const project = await archiveProjectService(req.params.id, actorId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
