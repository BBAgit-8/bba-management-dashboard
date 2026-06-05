/**
 * Prisma client singleton.
 *
 * In Next.js the module cache is cleared on every hot-reload in development,
 * which would create a new PrismaClient on each reload and exhaust the
 * connection pool.  Attaching the instance to `globalThis` prevents that.
 *
 * In production the module is loaded once, so the global guard is a no-op.
 */

import { PrismaClient } from '@/app/generated/prisma/client'

type GlobalWithPrisma = typeof globalThis & { __prisma?: PrismaClient }

function createClient() {
  // Prisma 7 with Prisma Postgres requires accelerateUrl to be passed explicitly
  // at runtime — prisma.config.ts only covers CLI operations (generate, migrate).
  return new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL!,
  })
}

const g = globalThis as GlobalWithPrisma

export const prisma: PrismaClient = g.__prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  g.__prisma = prisma
}
