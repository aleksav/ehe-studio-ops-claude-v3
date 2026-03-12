import { PrismaClient, TaskType, ProjectStatus, BudgetType, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.taskRate.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.teamMember.deleteMany();

  // Create team members
  const alice = await prisma.teamMember.create({
    data: {
      full_name: 'Alice Chen',
      email: 'alice@ehe.ai',
      role_title: 'Lead Developer',
      preferred_task_type: TaskType.DEVELOPMENT_TESTING,
      is_active: true,
    },
  });

  const bob = await prisma.teamMember.create({
    data: {
      full_name: 'Bob Martinez',
      email: 'bob@ehe.ai',
      role_title: 'Designer',
      preferred_task_type: TaskType.DESIGN_DELIVERY_RESEARCH,
      is_active: true,
    },
  });

  const carol = await prisma.teamMember.create({
    data: {
      full_name: 'Carol Wright',
      email: 'carol@ehe.ai',
      role_title: 'Project Manager',
      preferred_task_type: TaskType.BUSINESS_SUPPORT,
      is_active: true,
    },
  });

  // Create user accounts (password: "password123")
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.create({
    data: { email: 'alice@ehe.ai', password_hash: passwordHash, team_member_id: alice.id },
  });
  await prisma.user.create({
    data: { email: 'bob@ehe.ai', password_hash: passwordHash, team_member_id: bob.id },
  });
  await prisma.user.create({
    data: { email: 'carol@ehe.ai', password_hash: passwordHash, team_member_id: carol.id },
  });

  // Create projects
  const project1 = await prisma.project.create({
    data: {
      name: 'Brand Refresh Campaign',
      description: 'Complete brand identity refresh including visual assets and guidelines',
      status: ProjectStatus.ACTIVE,
      start_date: new Date('2024-01-15'),
      end_date: new Date('2024-06-30'),
      budget_type: BudgetType.CAPPED,
      budget_amount: 50000,
      currency_code: 'GBP',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Mobile App MVP',
      description: 'First release of the client-facing mobile application',
      status: ProjectStatus.ACTIVE,
      start_date: new Date('2024-02-01'),
      end_date: new Date('2024-08-31'),
      budget_type: BudgetType.TRACKED_ONLY,
      budget_amount: 80000,
      currency_code: 'GBP',
    },
  });

  // Create milestones — each project gets 3 (past due, near, far)
  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - 14);
  const nearDate = new Date(today);
  nearDate.setDate(nearDate.getDate() + 7);
  const farDate = new Date(today);
  farDate.setDate(farDate.getDate() + 60);

  const p1m1 = await prisma.milestone.create({
    data: { project_id: project1.id, name: 'Brand Audit Complete', due_date: pastDate },
  });
  const p1m2 = await prisma.milestone.create({
    data: { project_id: project1.id, name: 'Visual Identity Delivery', due_date: nearDate },
  });
  const p1m3 = await prisma.milestone.create({
    data: { project_id: project1.id, name: 'Guidelines Published', due_date: farDate },
  });

  const p2m1 = await prisma.milestone.create({
    data: { project_id: project2.id, name: 'UX Wireframes Approved', due_date: pastDate },
  });
  const p2m2 = await prisma.milestone.create({
    data: { project_id: project2.id, name: 'Beta Release', due_date: nearDate },
  });
  const p2m3 = await prisma.milestone.create({
    data: { project_id: project2.id, name: 'App Store Submission', due_date: farDate },
  });

  // Create tasks with mixed statuses
  const task1 = await prisma.task.create({
    data: {
      project_id: project1.id,
      milestone_id: p1m1.id,
      description: 'Conduct competitor analysis',
      status: TaskStatus.DONE,
      started_at: new Date('2024-01-20'),
      completed_at: new Date('2024-02-05'),
    },
  });

  const task2 = await prisma.task.create({
    data: {
      project_id: project1.id,
      milestone_id: p1m1.id,
      description: 'Stakeholder interviews',
      status: TaskStatus.DONE,
      started_at: new Date('2024-01-22'),
      completed_at: new Date('2024-02-10'),
    },
  });

  const task3 = await prisma.task.create({
    data: {
      project_id: project1.id,
      milestone_id: p1m2.id,
      description: 'Design logo variations',
      status: TaskStatus.IN_PROGRESS,
      started_at: new Date('2024-03-01'),
    },
  });

  const task4 = await prisma.task.create({
    data: {
      project_id: project1.id,
      milestone_id: p1m2.id,
      description: 'Colour palette finalisation',
      status: TaskStatus.TODO,
    },
  });

  const task5 = await prisma.task.create({
    data: {
      project_id: project1.id,
      milestone_id: p1m3.id,
      description: 'Write brand guidelines document',
      status: TaskStatus.TODO,
    },
  });

  const task6 = await prisma.task.create({
    data: {
      project_id: project2.id,
      milestone_id: p2m1.id,
      description: 'User research sessions',
      status: TaskStatus.DONE,
      started_at: new Date('2024-02-05'),
      completed_at: new Date('2024-02-20'),
    },
  });

  const task7 = await prisma.task.create({
    data: {
      project_id: project2.id,
      milestone_id: p2m2.id,
      description: 'Build authentication flow',
      status: TaskStatus.IN_PROGRESS,
      started_at: new Date('2024-03-10'),
    },
  });

  const task8 = await prisma.task.create({
    data: {
      project_id: project2.id,
      milestone_id: p2m2.id,
      description: 'Implement dashboard screens',
      status: TaskStatus.TODO,
    },
  });

  const task9 = await prisma.task.create({
    data: {
      project_id: project2.id,
      milestone_id: p2m3.id,
      description: 'App store listing assets',
      status: TaskStatus.TODO,
    },
  });

  const task10 = await prisma.task.create({
    data: {
      project_id: project2.id,
      description: 'Set up CI/CD pipeline',
      status: TaskStatus.IN_PROGRESS,
      started_at: new Date('2024-03-05'),
    },
  });

  // Task assignments
  await prisma.taskAssignment.createMany({
    data: [
      { task_id: task1.id, team_member_id: carol.id },
      { task_id: task2.id, team_member_id: carol.id },
      { task_id: task2.id, team_member_id: bob.id },
      { task_id: task3.id, team_member_id: bob.id },
      { task_id: task4.id, team_member_id: bob.id },
      { task_id: task4.id, team_member_id: alice.id },
      { task_id: task5.id, team_member_id: carol.id },
      { task_id: task6.id, team_member_id: bob.id },
      { task_id: task7.id, team_member_id: alice.id },
      { task_id: task8.id, team_member_id: alice.id },
      { task_id: task8.id, team_member_id: bob.id },
      { task_id: task9.id, team_member_id: bob.id },
      { task_id: task10.id, team_member_id: alice.id },
    ],
  });

  // Task rates — gapless history for all four types from 2023-01-01
  const rateStartDate = new Date('2023-01-01');
  const rateMidDate = new Date('2024-01-01');
  const rateMidDateMinusOne = new Date('2023-12-31');

  const taskTypeRates: { type: TaskType; oldRate: number; newRate: number }[] = [
    { type: TaskType.ARCHITECTURE_ENGINEERING_DIRECTION, oldRate: 850, newRate: 900 },
    { type: TaskType.DESIGN_DELIVERY_RESEARCH, oldRate: 650, newRate: 700 },
    { type: TaskType.DEVELOPMENT_TESTING, oldRate: 750, newRate: 800 },
    { type: TaskType.BUSINESS_SUPPORT, oldRate: 500, newRate: 550 },
  ];

  for (const { type, oldRate, newRate } of taskTypeRates) {
    await prisma.taskRate.create({
      data: {
        task_type: type,
        day_rate: oldRate,
        currency_code: 'GBP',
        effective_from: rateStartDate,
        effective_to: rateMidDateMinusOne,
      },
    });
    await prisma.taskRate.create({
      data: {
        task_type: type,
        day_rate: newRate,
        currency_code: 'GBP',
        effective_from: rateMidDate,
        effective_to: null, // currently active
      },
    });
  }

  // Time entries — some recent entries for demo data
  const recentDate1 = new Date(today);
  recentDate1.setDate(recentDate1.getDate() - 1);
  const recentDate2 = new Date(today);
  recentDate2.setDate(recentDate2.getDate() - 2);
  const recentDate3 = new Date(today);
  recentDate3.setDate(recentDate3.getDate() - 3);

  await prisma.timeEntry.createMany({
    data: [
      {
        project_id: project1.id,
        team_member_id: bob.id,
        date: recentDate1,
        hours_worked: 6,
        task_type: TaskType.DESIGN_DELIVERY_RESEARCH,
        notes: 'Logo exploration sketches',
      },
      {
        project_id: project1.id,
        team_member_id: bob.id,
        date: recentDate2,
        hours_worked: 4,
        task_type: TaskType.DESIGN_DELIVERY_RESEARCH,
        notes: 'Moodboard refinement',
      },
      {
        project_id: project2.id,
        team_member_id: alice.id,
        date: recentDate1,
        hours_worked: 7,
        task_type: TaskType.DEVELOPMENT_TESTING,
        notes: 'Auth flow implementation',
      },
      {
        project_id: project2.id,
        team_member_id: alice.id,
        date: recentDate2,
        hours_worked: 8,
        task_type: TaskType.DEVELOPMENT_TESTING,
        notes: 'API endpoint scaffolding',
      },
      {
        project_id: project2.id,
        team_member_id: alice.id,
        date: recentDate3,
        hours_worked: 5,
        task_type: TaskType.ARCHITECTURE_ENGINEERING_DIRECTION,
        notes: 'Architecture review session',
      },
      {
        project_id: project1.id,
        team_member_id: carol.id,
        date: recentDate1,
        hours_worked: 3,
        task_type: TaskType.BUSINESS_SUPPORT,
        notes: 'Stakeholder alignment meeting',
      },
    ],
  });

  console.log('Seed complete.');
  console.log(`  Team members: ${[alice, bob, carol].length}`);
  console.log(`  Projects: 2`);
  console.log(`  Milestones: 6`);
  console.log(`  Tasks: 10`);
  console.log(`  Task rates: ${taskTypeRates.length * 2}`);
  console.log(`  Time entries: 6`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
