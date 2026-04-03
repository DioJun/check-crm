const { PrismaClient } = require('@prisma/client');

// Singleton Prisma Client - CRITICAL for serverless
const global_prisma = globalThis;
const prisma = global_prisma.prisma_singleton || new PrismaClient({ errorFormat: 'pretty' });

// Always cache to avoid connection pool exhaustion
if (!global_prisma.prisma_singleton) {
  global_prisma.prisma_singleton = prisma;
}

module.exports = prisma;
