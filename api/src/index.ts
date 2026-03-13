import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import teamMemberRoutes from './routes/team-member.routes';
import projectRoutes from './routes/project.routes';
import milestoneRoutes from './routes/milestone.routes';
import taskRoutes from './routes/task.routes';
import taskAssignmentRoutes from './routes/task-assignment.routes';
import taskRateRoutes from './routes/task-rate.routes';
import timeEntryRoutes from './routes/time-entry.routes';
import clientRoutes from './routes/client.routes';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/team-members', teamMemberRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/milestones', milestoneRoutes);
app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/tasks', taskAssignmentRoutes);
app.use('/api/task-rates', taskRateRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/clients', clientRoutes);

app.listen(PORT, () => {
  console.log(`EHEStudio Ops API running on port ${PORT}`);
});

export default app;
