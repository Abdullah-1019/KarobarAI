import { PrismaClient } from '@prisma/client';

// Single Prisma client instance (D1) — schema is model-free until the Database feature lands.
export const prisma = new PrismaClient();
