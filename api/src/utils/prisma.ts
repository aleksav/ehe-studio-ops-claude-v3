import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;

export type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
