import { z } from 'zod';
import { ProjectStatus, BudgetType, TaskStatus, TaskType } from '../types/index';

export const teamMemberSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  role_title: z.string().optional(),
  preferred_task_type: z.nativeEnum(TaskType).optional(),
  is_active: z.boolean().default(true),
});

export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNED),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget_type: z.nativeEnum(BudgetType).default(BudgetType.NONE),
  budget_amount: z.number().min(0).optional(),
  currency_code: z.string().length(3).default('GBP'),
});

export const milestoneSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, 'Milestone name is required'),
  due_date: z.string().optional(),
});

export const taskSchema = z.object({
  project_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional(),
  description: z.string().min(1, 'Task description is required'),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
});

export const taskAssignmentSchema = z.object({
  task_id: z.string().uuid(),
  team_member_id: z.string().uuid(),
});

export const timeEntrySchema = z.object({
  project_id: z.string().uuid(),
  team_member_id: z.string().uuid(),
  date: z.string().refine((val) => {
    const date = new Date(val);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date <= today;
  }, 'Date cannot be in the future'),
  hours_worked: z.number().positive('Hours must be greater than 0'),
  task_type: z.nativeEnum(TaskType),
  notes: z.string().optional(),
});

export const taskRateSchema = z.object({
  task_type: z.nativeEnum(TaskType),
  day_rate: z.number().positive('Day rate must be positive'),
  currency_code: z.string().length(3).default('GBP'),
  effective_from: z.string(),
  effective_to: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Full name is required'),
});
