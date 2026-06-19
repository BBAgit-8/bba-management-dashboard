/**
 * Prisma client singleton.
 *
 * In Next.js the module cache is cleared on every hot-reload in development,
 * which would create a new PrismaClient on each reload and exhaust the
 * connection pool. Attaching the instance to `globalThis` prevents that.
 */

import { PrismaClient } from '@/app/generated/prisma/client'

type GlobalWithPrisma = typeof globalThis & { __prisma?: PrismaClient }

function createClient() {
  return new PrismaClient()
}

const g = globalThis as GlobalWithPrisma

export const prisma: PrismaClient = g.__prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  g.__prisma = prisma
}
