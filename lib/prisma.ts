import { PrismaClient } from '@/app/generated/prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

type GlobalWithPrisma = typeof globalThis & { __prisma?: PrismaClient }

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter } as never)
}

const g = globalThis as GlobalWithPrisma

export const prisma: PrismaClient = g.__prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  g.__prisma = prisma
}
