const { PrismaClient } = require('@prisma/client');

// Reuse the PrismaClient instance across serverless invocations to avoid
// exhausting the database connection pool (important on Vercel/serverless).
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
