import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const developmentOnlyFallbackPassword = 'ResolveXDemo123!';

const demoUsers = [
  {
    name: 'ResolveX Card Member',
    email: 'member@resolvex.demo',
    role: Role.CARD_MEMBER,
    password:
      process.env.RESOLVEX_DEMO_MEMBER_PASSWORD ??
      process.env.RESOLVEX_DEMO_PASSWORD ??
      developmentOnlyFallbackPassword,
  },
  {
    name: 'ResolveX Merchant',
    email: 'merchant@resolvex.demo',
    role: Role.MERCHANT,
    password:
      process.env.RESOLVEX_DEMO_MERCHANT_PASSWORD ??
      process.env.RESOLVEX_DEMO_PASSWORD ??
      developmentOnlyFallbackPassword,
  },
  {
    name: 'ResolveX Analyst',
    email: 'analyst@resolvex.demo',
    role: Role.ANALYST,
    password:
      process.env.RESOLVEX_DEMO_ANALYST_PASSWORD ??
      process.env.RESOLVEX_DEMO_PASSWORD ??
      developmentOnlyFallbackPassword,
  },
];

async function main() {
  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
      },
    });
  }

  console.log('Seeded ResolveX prototype users.');
  console.log(
    'Development-only fallback password is ResolveXDemo123! when no RESOLVEX_DEMO_* password is set.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
