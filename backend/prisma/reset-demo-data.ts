import { PrismaClient } from '@prisma/client';
import {
  demoScenarioCaseIds,
  demoScenarioTransactionIds,
  disconnectSeedPrisma,
  seedDemoData,
} from './seed';

const prisma = new PrismaClient();

async function resetDemoData() {
  await prisma.timelineEvent.deleteMany({
    where: { caseId: { in: demoScenarioCaseIds } },
  });
  await prisma.disputeCase.deleteMany({
    where: { id: { in: demoScenarioCaseIds } },
  });
  await prisma.transaction.deleteMany({
    where: { id: { in: demoScenarioTransactionIds } },
  });
  await prisma.$disconnect();

  await seedDemoData();
  await disconnectSeedPrisma();
}

resetDemoData()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
