import { PrismaClient } from '@prisma/client';

const prismaInstance = new PrismaClient();

const prisma = new Proxy(prismaInstance, {
  get(target, prop, receiver) {
    if (prop === 'auditLog') {
      return {
        create: async () => ({ id: 0 }),
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
        findUnique: async () => null,
        update: async () => ({ id: 0 }),
      };
    }
    if (prop === 'setting') {
      return {
        create: async () => ({ id: 0 }),
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
        findUnique: async () => null,
        update: async () => ({ id: 0 }),
      };
    }
    return Reflect.get(target, prop, receiver);
  }
}) as any;

export default prisma;
export { prisma };
