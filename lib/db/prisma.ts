import 'dotenv/config'
import path from 'path'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../../app/generated/prisma/client'

// libSQL needs an absolute path for local SQLite files
function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db'
  if (url.startsWith('file:') && !url.startsWith('file:///') && !url.startsWith('file://')) {
    const relativePath = url.slice('file:'.length)
    return `file:${path.resolve(process.cwd(), relativePath)}`
  }
  return url
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaLibSql({ url: resolveDbUrl() })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
