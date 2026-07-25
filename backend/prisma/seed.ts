import { PrismaClient, Prisma, ReasonCode, Role } from '@prisma/client';
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

type PrototypePolicyRequirementSeed = {
  reasonCode: ReasonCode;
  requirementKey: string;
  requirementName: string;
  description: string;
  acceptedEvidenceTypes: string[];
  weight: number;
  isMandatory: boolean;
};

const prototypePolicyVersion = 'prototype-v1';

const prototypePolicyRequirements: PrototypePolicyRequirementSeed[] = [
  {
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    requirementKey: 'invoice',
    requirementName: 'Invoice or order record',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the invoice or order record for the disputed goods.',
    acceptedEvidenceTypes: ['invoice', 'order_record', 'receipt'],
    weight: 20,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    requirementKey: 'dispatch_record',
    requirementName: 'Dispatch record',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides a dispatch, shipment, or fulfillment record.',
    acceptedEvidenceTypes: ['dispatch_record', 'shipping_manifest', 'fulfillment_record'],
    weight: 20,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    requirementKey: 'delivery_confirmation',
    requirementName: 'Delivery confirmation',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides carrier delivery confirmation or tracking proof.',
    acceptedEvidenceTypes: ['delivery_confirmation', 'tracking_record', 'carrier_proof'],
    weight: 25,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    requirementKey: 'recipient_confirmation',
    requirementName: 'Recipient confirmation',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides recipient signature, pickup confirmation, or receipt acknowledgement.',
    acceptedEvidenceTypes: ['signature', 'pickup_confirmation', 'receipt_acknowledgement'],
    weight: 20,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    requirementKey: 'verified_delivery_location',
    requirementName: 'Verified delivery location',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides evidence linking delivery to the expected location.',
    acceptedEvidenceTypes: ['address_match', 'geolocation_record', 'delivery_photo'],
    weight: 15,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'purchase_record',
    requirementName: 'Purchase record',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the original purchase record.',
    acceptedEvidenceTypes: ['purchase_record', 'receipt', 'invoice'],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'refund_initiation_record',
    requirementName: 'Refund initiation record',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides evidence that a refund was initiated.',
    acceptedEvidenceTypes: ['refund_initiation_record', 'refund_request_log', 'processor_record'],
    weight: 20,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'refund_reference',
    requirementName: 'Refund reference',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides a refund reference, authorization, or processor trace.',
    acceptedEvidenceTypes: ['refund_reference', 'authorization_code', 'processor_trace'],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'refund_amount',
    requirementName: 'Refund amount',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the refund amount and currency.',
    acceptedEvidenceTypes: ['refund_amount', 'refund_receipt', 'processor_record'],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'refund_processing_date',
    requirementName: 'Refund processing date',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the date the refund was processed or submitted.',
    acceptedEvidenceTypes: ['processing_date', 'refund_receipt', 'processor_record'],
    weight: 15,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'completed_refund_transaction',
    requirementName: 'Completed refund transaction',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides completed refund transaction evidence where available.',
    acceptedEvidenceTypes: ['completed_refund_transaction', 'settlement_record', 'processor_record'],
    weight: 20,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'cancellation_request',
    requirementName: 'Cancellation request',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the card member cancellation request or cancellation contact record.',
    acceptedEvidenceTypes: ['cancellation_request', 'support_ticket', 'email'],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'cancellation_date',
    requirementName: 'Cancellation date',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the date cancellation was requested or confirmed.',
    acceptedEvidenceTypes: ['cancellation_date', 'support_ticket', 'system_log'],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'accepted_cancellation_policy',
    requirementName: 'Accepted cancellation policy',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the cancellation policy accepted at purchase or booking.',
    acceptedEvidenceTypes: ['terms_acceptance', 'policy_snapshot', 'checkout_record'],
    weight: 20,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'service_delivery_record',
    requirementName: 'Service delivery record',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides delivery, attendance, booking, or service fulfillment evidence.',
    acceptedEvidenceTypes: ['service_delivery_record', 'attendance_record', 'booking_record'],
    weight: 20,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'cancellation_confirmation',
    requirementName: 'Cancellation confirmation',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides cancellation confirmation sent to or received from the card member.',
    acceptedEvidenceTypes: ['cancellation_confirmation', 'email', 'support_ticket'],
    weight: 15,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'refund_confirmation',
    requirementName: 'Refund confirmation',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides refund confirmation if the cancellation produced a refund.',
    acceptedEvidenceTypes: ['refund_confirmation', 'refund_reference', 'processor_record'],
    weight: 15,
    isMandatory: false,
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

  for (const requirement of prototypePolicyRequirements) {
    await prisma.policyRequirement.upsert({
      where: {
        reasonCode_requirementKey_policyVersion: {
          reasonCode: requirement.reasonCode,
          requirementKey: requirement.requirementKey,
          policyVersion: prototypePolicyVersion,
        },
      },
      update: {
        requirementName: requirement.requirementName,
        description: requirement.description,
        acceptedEvidenceTypes: requirement.acceptedEvidenceTypes,
        weight: requirement.weight,
        isMandatory: requirement.isMandatory,
        active: true,
      },
      create: {
        ...requirement,
        policyVersion: prototypePolicyVersion,
        active: true,
      },
    });
  }

  console.log('Seeded ResolveX prototype users, transactions, and policy requirements.');
  console.log('Development-only fallback password is ResolveXDemo123! when no RESOLVEX_DEMO_* password is set.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
