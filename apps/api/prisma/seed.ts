import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PolicyService } from '../src/modules/policy/policy.service';
import { DemoSeedService } from '../src/modules/workspace/demo-seed.service';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'ledgerly123';

const USERS: Array<{ email: string; name: string; role: Role }> = [
  { email: 'admin@ledgerly.dev', name: 'Ava Admin', role: 'ADMIN' },
  { email: 'director@ledgerly.dev', name: 'Dev Director', role: 'MARKETING_DIRECTOR' },
  { email: 'finance@ledgerly.dev', name: 'Fiona Finance', role: 'FINANCE' },
  { email: 'executor@ledgerly.dev', name: 'Eli Executor', role: 'EXECUTOR' },
  { email: 'auditor@ledgerly.dev', name: 'Aria Auditor', role: 'AUDITOR' },
  { email: 'viewer@ledgerly.dev', name: 'Vik Viewer', role: 'VIEWER' },
];

async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password: passwordHash },
      create: { email: u.email, name: u.name, role: u.role, password: passwordHash },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${USERS.length} users (password: ${SEED_PASSWORD}).`);
}

/**
 * Metrics, policy, an engine run, and historical decisions go
 * through real Nest services (EngineService, ApprovalsService, ...), not
 * raw Prisma calls -- so this boots a throwaway Nest application context
 * (no HTTP listener) just to resolve them, the same services the live API
 * uses. That way "what a fresh demo looks like" can never drift from "what
 * the actual approve/execute/outcome code paths produce."
 */
async function seedDemoData(): Promise<void> {
  const appContext = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    await appContext.get(PolicyService).ensurePolicy('LIVE');
    await appContext.get(DemoSeedService).seedDemo();
    // eslint-disable-next-line no-console
    console.log('Seeded DEMO workspace: metrics, policy, engine run, historical decisions.');
  } finally {
    await appContext.close();
  }
}

async function main(): Promise<void> {
  await seedUsers();
  await seedDemoData();
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
