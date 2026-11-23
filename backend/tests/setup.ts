import { beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { generateToken } from '../src/middleware/auth.js';
import { UserRole } from '../src/types/index.js';

export const app = createApp();

export let adminToken: string;
export let managerToken: string;
export let operatorToken: string;
export let auditorToken: string;

export let testAdmin: any;
export let testManager: any;
export let testOperator: any;
export let testAuditor: any;

beforeAll(async () => {
  // Ensure test users exist
  testAdmin = await prisma.user.upsert({
    where: { email: 'admin@stockpilot.io' },
    update: {},
    create: {
      email: 'admin@stockpilot.io',
      name: 'Admin User',
      passwordHash: 'dummy',
      role: UserRole.ADMIN,
    },
  });

  testManager = await prisma.user.upsert({
    where: { email: 'manager@stockpilot.io' },
    update: {},
    create: {
      email: 'manager@stockpilot.io',
      name: 'Manager User',
      passwordHash: 'dummy',
      role: UserRole.WAREHOUSE_MANAGER,
    },
  });

  testOperator = await prisma.user.upsert({
    where: { email: 'operator@stockpilot.io' },
    update: {},
    create: {
      email: 'operator@stockpilot.io',
      name: 'Operator User',
      passwordHash: 'dummy',
      role: UserRole.INVENTORY_OPERATOR,
    },
  });

  testAuditor = await prisma.user.upsert({
    where: { email: 'auditor@stockpilot.io' },
    update: {},
    create: {
      email: 'auditor@stockpilot.io',
      name: 'Auditor User',
      passwordHash: 'dummy',
      role: UserRole.AUDITOR,
    },
  });

  adminToken = generateToken(testAdmin);
  managerToken = generateToken(testManager);
  operatorToken = generateToken(testOperator);
  auditorToken = generateToken(testAuditor);
});

afterAll(async () => {
  await prisma.$disconnect();
});
