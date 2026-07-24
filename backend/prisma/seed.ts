import { PrismaClient, Prisma, Role } from '@prisma/client';
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
  {
    name: 'ResolveX Second Card Member',
    email: 'member.two@resolvex.demo',
    role: Role.CARD_MEMBER,
    password:
      process.env.RESOLVEX_DEMO_MEMBER_PASSWORD ??
      process.env.RESOLVEX_DEMO_PASSWORD ??
      developmentOnlyFallbackPassword,
  },
];

async function main() {
  const seededUsers = new Map<string, { id: string }>();

  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    const seededUser = await prisma.user.upsert({
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

    seededUsers.set(user.email, seededUser);
  }

  const cardMember = seededUsers.get('member@resolvex.demo');
  const secondCardMember = seededUsers.get('member.two@resolvex.demo');
  const merchant = seededUsers.get('merchant@resolvex.demo');

  if (!cardMember || !secondCardMember || !merchant) {
    throw new Error('Could not seed transactions because demo users were not created.');
  }

  const transactions = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      cardMemberId: cardMember.id,
      merchantId: merchant.id,
      merchantName: 'Northstar Electronics',
      amount: new Prisma.Decimal('249.99'),
      currency: 'USD',
      transactionDate: new Date('2026-06-08T14:22:00.000Z'),
      status: 'POSTED',
      maskedCardLast4: '4242',
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      cardMemberId: cardMember.id,
      merchantId: merchant.id,
      merchantName: 'Harbor Home Goods',
      amount: new Prisma.Decimal('89.50'),
      currency: 'USD',
      transactionDate: new Date('2026-06-12T09:15:00.000Z'),
      status: 'POSTED',
      maskedCardLast4: '4242',
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      cardMemberId: cardMember.id,
      merchantId: merchant.id,
      merchantName: 'Metro Travel Desk',
      amount: new Prisma.Decimal('612.40'),
      currency: 'USD',
      transactionDate: new Date('2026-06-18T17:45:00.000Z'),
      status: 'REFUND_PENDING',
      maskedCardLast4: '1881',
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      cardMemberId: secondCardMember.id,
      merchantId: merchant.id,
      merchantName: 'Luma Fitness Studio',
      amount: new Prisma.Decimal('120.00'),
      currency: 'USD',
      transactionDate: new Date('2026-06-21T11:30:00.000Z'),
      status: 'REFUND_REQUESTED',
      maskedCardLast4: '9900',
    },
    {
      id: '10000000-0000-4000-8000-000000000005',
      cardMemberId: secondCardMember.id,
      merchantId: merchant.id,
      merchantName: 'Evergreen Event Tickets',
      amount: new Prisma.Decimal('310.75'),
      currency: 'USD',
      transactionDate: new Date('2026-06-25T20:05:00.000Z'),
      status: 'CANCELLATION_REQUESTED',
      maskedCardLast4: '9900',
    },
    {
      id: '10000000-0000-4000-8000-000000000006',
      cardMemberId: cardMember.id,
      merchantId: merchant.id,
      merchantName: 'BluePeak Learning',
      amount: new Prisma.Decimal('199.00'),
      currency: 'USD',
      transactionDate: new Date('2026-07-02T08:10:00.000Z'),
      status: 'CANCELLED_SERVICE',
      maskedCardLast4: '1881',
    },
  ];

  for (const transaction of transactions) {
    await prisma.transaction.upsert({
      where: { id: transaction.id },
      update: transaction,
      create: transaction,
    });
  }

  console.log('Seeded ResolveX prototype users and transactions.');
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
