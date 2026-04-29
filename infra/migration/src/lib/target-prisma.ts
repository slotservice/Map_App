import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (prisma) return prisma;
  prisma = new PrismaClient({
    log: process.env.MIGRATION_VERBOSE ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
  return prisma;
}

export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
