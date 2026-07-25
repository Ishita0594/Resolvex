import {
  CaseStatus,
  EvidenceProcessingStatus,
  MerchantResponseStatus,
  Prisma,
  PrismaClient,
  ReasonCode,
  Role,
} from '@prisma/client';
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

type PrototypePolicyRuleSeed = {
  ruleId: string;
  reasonCode: ReasonCode;
  title: string;
  description: string;
  severity: 'MEDIUM' | 'HIGH';
};

type DemoScenarioSeed = {
  transaction: {
    id: string;
    merchantName: string;
    amount: Prisma.Decimal;
    currency: string;
    transactionDate: Date;
    status: string;
    maskedCardLast4: string;
  };
  case: {
    id: string;
    reasonCode: ReasonCode;
    cardMemberStatement: string;
    merchantStatement?: string;
    status: CaseStatus;
  };
  evidence: Array<{
    id: string;
    submittedByRole: Role;
    evidenceType: string;
    fileName: string;
    facts: Array<{
      factType: string;
      factValue: string;
      normalizedValue?: string;
      confidence?: number;
      verifiedByUser?: boolean;
    }>;
  }>;
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
    acceptedEvidenceTypes: [
      'dispatch_record',
      'shipping_manifest',
      'fulfillment_record',
    ],
    weight: 20,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    requirementKey: 'delivery_confirmation',
    requirementName: 'Delivery confirmation',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides carrier delivery confirmation or tracking proof.',
    acceptedEvidenceTypes: [
      'delivery_confirmation',
      'tracking_record',
      'carrier_proof',
      'non_delivery_statement',
    ],
    weight: 25,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    requirementKey: 'recipient_confirmation',
    requirementName: 'Recipient confirmation',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides recipient signature, pickup confirmation, or receipt acknowledgement.',
    acceptedEvidenceTypes: [
      'signature',
      'pickup_confirmation',
      'receipt_acknowledgement',
      'recipient_dispute',
    ],
    weight: 20,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    requirementKey: 'verified_delivery_location',
    requirementName: 'Verified delivery location',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides evidence linking delivery to the expected location.',
    acceptedEvidenceTypes: [
      'address_match',
      'geolocation_record',
      'delivery_photo',
      'location_dispute',
    ],
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
    acceptedEvidenceTypes: [
      'refund_initiation_record',
      'refund_request_log',
      'processor_record',
      'refund_promise',
    ],
    weight: 20,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'refund_reference',
    requirementName: 'Refund reference',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides a refund reference, authorization, or processor trace.',
    acceptedEvidenceTypes: [
      'refund_reference',
      'authorization_code',
      'processor_trace',
    ],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'refund_amount',
    requirementName: 'Refund amount',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the refund amount and currency.',
    acceptedEvidenceTypes: [
      'refund_amount',
      'refund_receipt',
      'processor_record',
      'refund_amount_dispute',
    ],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'refund_processing_date',
    requirementName: 'Refund processing date',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the date the refund was processed or submitted.',
    acceptedEvidenceTypes: [
      'processing_date',
      'refund_receipt',
      'processor_record',
      'refund_date_dispute',
    ],
    weight: 15,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    requirementKey: 'completed_refund_transaction',
    requirementName: 'Completed refund transaction',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides completed refund transaction evidence where available.',
    acceptedEvidenceTypes: [
      'completed_refund_transaction',
      'settlement_record',
      'processor_record',
    ],
    weight: 20,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'cancellation_request',
    requirementName: 'Cancellation request',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the card member cancellation request or cancellation contact record.',
    acceptedEvidenceTypes: [
      'cancellation_request',
      'support_ticket',
      'email',
      'cancellation_proof',
    ],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'cancellation_date',
    requirementName: 'Cancellation date',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the date cancellation was requested or confirmed.',
    acceptedEvidenceTypes: [
      'cancellation_date',
      'support_ticket',
      'system_log',
    ],
    weight: 15,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'accepted_cancellation_policy',
    requirementName: 'Accepted cancellation policy',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides the cancellation policy accepted at purchase or booking.',
    acceptedEvidenceTypes: [
      'terms_acceptance',
      'policy_snapshot',
      'checkout_record',
    ],
    weight: 20,
    isMandatory: true,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'service_delivery_record',
    requirementName: 'Service delivery record',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides delivery, attendance, booking, or service fulfillment evidence.',
    acceptedEvidenceTypes: [
      'service_delivery_record',
      'attendance_record',
      'booking_record',
    ],
    weight: 20,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'cancellation_confirmation',
    requirementName: 'Cancellation confirmation',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides cancellation confirmation sent to or received from the card member.',
    acceptedEvidenceTypes: [
      'cancellation_confirmation',
      'email',
      'support_ticket',
    ],
    weight: 15,
    isMandatory: false,
  },
  {
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    requirementKey: 'refund_confirmation',
    requirementName: 'Refund confirmation',
    description:
      'Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides refund confirmation if the cancellation produced a refund.',
    acceptedEvidenceTypes: [
      'refund_confirmation',
      'refund_reference',
      'processor_record',
    ],
    weight: 15,
    isMandatory: false,
  },
];

const prototypePolicyRules: PrototypePolicyRuleSeed[] = [
  {
    ruleId: 'PX-GNR-001',
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    title: 'Dispatch is insufficient alone',
    description:
      'Prototype assumption: dispatch alone does not prove delivery.',
    severity: 'MEDIUM',
  },
  {
    ruleId: 'PX-GNR-002',
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    title: 'Verified delivery supports merchant',
    description:
      'Prototype assumption: verified delivery confirmation with recipient or location confirmation supports the merchant.',
    severity: 'HIGH',
  },
  {
    ruleId: 'PX-GNR-003',
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    title: 'Missing delivery proof supports card member',
    description:
      'Prototype assumption: missing delivery proof combined with consistent non-delivery evidence supports the card member.',
    severity: 'HIGH',
  },
  {
    ruleId: 'PX-GNR-004',
    reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
    title: 'Delivery identity contradiction requires review',
    description:
      'Prototype assumption: conflicting delivery location or recipient evidence requires human review.',
    severity: 'HIGH',
  },
  {
    ruleId: 'PX-REF-001',
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    title: 'Refund promise without completion supports card member',
    description:
      'Prototype assumption: a refund promise without a completed refund record supports the card member.',
    severity: 'HIGH',
  },
  {
    ruleId: 'PX-REF-002',
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    title: 'Completed refund supports merchant',
    description:
      'Prototype assumption: a matching completed refund transaction supports the merchant.',
    severity: 'HIGH',
  },
  {
    ruleId: 'PX-REF-003',
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    title: 'Refund contradiction requires review',
    description:
      'Prototype assumption: amount, date, or reference contradictions require human review.',
    severity: 'HIGH',
  },
  {
    ruleId: 'PX-CAN-001',
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    title: 'Valid timely cancellation supports card member',
    description:
      'Prototype assumption: timely valid cancellation plus no service delivery and no refund supports the card member.',
    severity: 'HIGH',
  },
  {
    ruleId: 'PX-CAN-002',
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    title: 'Late policy-bound cancellation supports merchant',
    description:
      'Prototype assumption: late cancellation after a clearly accepted cancellation policy may support the merchant.',
    severity: 'HIGH',
  },
  {
    ruleId: 'PX-CAN-003',
    reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
    title: 'Unclear cancellation timing requires review',
    description:
      'Prototype assumption: unclear timing or unclear policy acceptance requires human review.',
    severity: 'HIGH',
  },
];

export const demoScenarioTransactionIds = [
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000004',
];

export const demoScenarioCaseIds = [
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004',
];

const demoScenarios: DemoScenarioSeed[] = [
  {
    transaction: {
      id: demoScenarioTransactionIds[0],
      merchantName: 'Scenario A Merchant',
      amount: new Prisma.Decimal('129.99'),
      currency: 'USD',
      transactionDate: new Date('2026-07-01T10:00:00.000Z'),
      status: 'POSTED',
      maskedCardLast4: '4242',
    },
    case: {
      id: demoScenarioCaseIds[0],
      reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
      cardMemberStatement:
        'Scenario A: goods were not received; invoice and dispatch exist, but there is no delivery confirmation.',
      merchantStatement:
        'Merchant can show invoice and dispatch only; delivery confirmation is missing.',
      status: CaseStatus.UNDER_EVALUATION,
    },
    evidence: [
      {
        id: '92000000-0000-4000-8000-000000000001',
        submittedByRole: Role.MERCHANT,
        evidenceType: 'invoice',
        fileName: 'scenario-a-invoice.pdf',
        facts: [
          {
            factType: 'ORDER_ID',
            factValue: 'SCENARIO-A-ORDER',
            confidence: 0.95,
          },
        ],
      },
      {
        id: '92000000-0000-4000-8000-000000000002',
        submittedByRole: Role.MERCHANT,
        evidenceType: 'dispatch_record',
        fileName: 'scenario-a-dispatch.pdf',
        facts: [
          {
            factType: 'DISPATCHED',
            factValue: 'true',
            normalizedValue: 'true',
            confidence: 0.95,
          },
        ],
      },
      {
        id: '92000000-0000-4000-8000-000000000003',
        submittedByRole: Role.CARD_MEMBER,
        evidenceType: 'non_delivery_statement',
        fileName: 'scenario-a-non-delivery.pdf',
        facts: [
          {
            factType: 'NON_DELIVERY_STATEMENT',
            factValue: 'true',
            normalizedValue: 'true',
            confidence: 0.96,
            verifiedByUser: true,
          },
        ],
      },
    ],
  },
  {
    transaction: {
      id: demoScenarioTransactionIds[1],
      merchantName: 'Scenario B Merchant',
      amount: new Prisma.Decimal('219.00'),
      currency: 'USD',
      transactionDate: new Date('2026-07-02T10:00:00.000Z'),
      status: 'POSTED',
      maskedCardLast4: '4242',
    },
    case: {
      id: demoScenarioCaseIds[1],
      reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
      cardMemberStatement:
        'Scenario B: card member claims goods were not received, but merchant has signed delivery evidence.',
      merchantStatement:
        'Signed delivery confirmation matches the expected recipient and delivery location.',
      status: CaseStatus.UNDER_EVALUATION,
    },
    evidence: [
      {
        id: '92000000-0000-4000-8000-000000000004',
        submittedByRole: Role.MERCHANT,
        evidenceType: 'delivery_confirmation',
        fileName: 'scenario-b-signed-delivery.pdf',
        facts: [
          {
            factType: 'DELIVERY_CONFIRMED',
            factValue: 'true',
            normalizedValue: 'true',
            confidence: 0.97,
          },
          {
            factType: 'RECIPIENT_CONFIRMED',
            factValue: 'true',
            normalizedValue: 'true',
            confidence: 0.96,
          },
          {
            factType: 'DELIVERY_LOCATION_MATCH',
            factValue: 'true',
            normalizedValue: 'true',
            confidence: 0.96,
          },
          {
            factType: 'RECIPIENT_NAME',
            factValue: 'ResolveX Card Member',
            confidence: 0.96,
          },
          {
            factType: 'DELIVERY_LOCATION',
            factValue: '123 Demo Lane',
            confidence: 0.96,
          },
        ],
      },
    ],
  },
  {
    transaction: {
      id: demoScenarioTransactionIds[2],
      merchantName: 'Scenario C Merchant',
      amount: new Prisma.Decimal('89.75'),
      currency: 'USD',
      transactionDate: new Date('2026-07-03T10:00:00.000Z'),
      status: 'POSTED',
      maskedCardLast4: '4242',
    },
    case: {
      id: demoScenarioCaseIds[2],
      reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
      cardMemberStatement:
        'Scenario C: delivery location conflicts with recipient evidence and confidence is below threshold.',
      merchantStatement:
        'Merchant delivery evidence conflicts with the card member location evidence.',
      status: CaseStatus.UNDER_EVALUATION,
    },
    evidence: [
      {
        id: '92000000-0000-4000-8000-000000000005',
        submittedByRole: Role.MERCHANT,
        evidenceType: 'delivery_confirmation',
        fileName: 'scenario-c-delivery.pdf',
        facts: [
          {
            factType: 'DELIVERY_CONFIRMED',
            factValue: 'true',
            normalizedValue: 'true',
            confidence: 0.62,
          },
          {
            factType: 'DELIVERY_LOCATION',
            factValue: 'Front desk',
            confidence: 0.62,
          },
        ],
      },
      {
        id: '92000000-0000-4000-8000-000000000006',
        submittedByRole: Role.CARD_MEMBER,
        evidenceType: 'location_dispute',
        fileName: 'scenario-c-location-dispute.pdf',
        facts: [
          {
            factType: 'DELIVERY_LOCATION',
            factValue: 'Parcel locker',
            confidence: 0.67,
          },
        ],
      },
    ],
  },
  {
    transaction: {
      id: demoScenarioTransactionIds[3],
      merchantName: 'Scenario D Merchant',
      amount: new Prisma.Decimal('310.50'),
      currency: 'USD',
      transactionDate: new Date('2026-07-04T10:00:00.000Z'),
      status: 'REFUND_PROMISED',
      maskedCardLast4: '4242',
    },
    case: {
      id: demoScenarioCaseIds[3],
      reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
      cardMemberStatement:
        'Scenario D: merchant promised a refund, but no completed refund transaction exists.',
      merchantStatement:
        'Merchant communication promised a refund; processor completion is absent.',
      status: CaseStatus.UNDER_EVALUATION,
    },
    evidence: [
      {
        id: '92000000-0000-4000-8000-000000000007',
        submittedByRole: Role.CARD_MEMBER,
        evidenceType: 'refund_promise',
        fileName: 'scenario-d-refund-promise.pdf',
        facts: [
          {
            factType: 'REFUND_PROMISED',
            factValue: 'true',
            normalizedValue: 'true',
            confidence: 0.95,
          },
          {
            factType: 'REFUND_AMOUNT',
            factValue: '310.50',
            normalizedValue: '310.50',
            confidence: 0.93,
          },
        ],
      },
    ],
  },
];

export async function seedDemoData() {
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
    throw new Error(
      'Could not seed transactions because demo users were not created.',
    );
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

  for (const rule of prototypePolicyRules) {
    await prisma.policyRule.upsert({
      where: {
        ruleId_policyVersion: {
          ruleId: rule.ruleId,
          policyVersion: prototypePolicyVersion,
        },
      },
      update: {
        reasonCode: rule.reasonCode,
        title: rule.title,
        description: rule.description,
        prototypeAssumption: true,
        severity: rule.severity,
        active: true,
      },
      create: {
        ...rule,
        prototypeAssumption: true,
        policyVersion: prototypePolicyVersion,
        active: true,
      },
    });
  }

  await prisma.timelineEvent.deleteMany({
    where: { caseId: { in: demoScenarioCaseIds } },
  });
  await prisma.disputeCase.deleteMany({
    where: { id: { in: demoScenarioCaseIds } },
  });
  await prisma.transaction.deleteMany({
    where: { id: { in: demoScenarioTransactionIds } },
  });

  for (const scenario of demoScenarios) {
    await prisma.transaction.create({
      data: {
        ...scenario.transaction,
        cardMemberId: cardMember.id,
        merchantId: merchant.id,
      },
    });

    const disputeCase = await prisma.disputeCase.create({
      data: {
        id: scenario.case.id,
        transactionId: scenario.transaction.id,
        cardMemberId: cardMember.id,
        merchantId: merchant.id,
        reasonCode: scenario.case.reasonCode,
        cardMemberStatement: scenario.case.cardMemberStatement,
        merchantStatement: scenario.case.merchantStatement ?? null,
        merchantResponseDate: new Date('2026-07-10T12:00:00.000Z'),
        merchantResponseStatus: MerchantResponseStatus.SUBMITTED,
        status: scenario.case.status,
        responseDeadline: new Date('2026-07-31T00:00:00.000Z'),
      },
    });

    for (const evidence of scenario.evidence) {
      await prisma.evidenceItem.create({
        data: {
          id: evidence.id,
          caseId: disputeCase.id,
          submittedByUserId:
            evidence.submittedByRole === Role.MERCHANT
              ? merchant.id
              : cardMember.id,
          submittedByRole: evidence.submittedByRole,
          evidenceType: evidence.evidenceType,
          fileName: evidence.fileName,
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          storageKey: [
            'demo-evidence',
            disputeCase.id,
            evidence.id,
            evidence.fileName,
          ].join('/'),
          fileHash: '0'.repeat(64),
          processingStatus: EvidenceProcessingStatus.PROCESSED,
          extractionConfidence:
            evidence.facts.reduce(
              (sum, fact) => sum + (fact.confidence ?? 0.9),
              0,
            ) / evidence.facts.length,
          extractedFacts: {
            create: evidence.facts.map((fact) => ({
              factType: fact.factType,
              factValue: fact.factValue,
              normalizedValue: fact.normalizedValue ?? null,
              confidence: fact.confidence ?? 0.9,
              sourcePage: 1,
              verifiedByUser: fact.verifiedByUser ?? false,
              correctedByUser: false,
            })),
          },
        },
      });
    }

    await prisma.timelineEvent.create({
      data: {
        caseId: disputeCase.id,
        eventType: 'DEMO_SCENARIO_SEEDED',
        description: `Seeded stable judging scenario ${scenario.transaction.merchantName}.`,
        performedBy: null,
        metadata: {
          scenarioCaseId: disputeCase.id,
          reasonCode: scenario.case.reasonCode,
        },
      },
    });
  }

  console.log(
    'Seeded ResolveX prototype users, transactions, policy requirements, policy rules, and stable demo scenarios.',
  );
  console.log(
    'Development-only fallback password is ResolveXDemo123! when no RESOLVEX_DEMO_* password is set.',
  );
}

export async function disconnectSeedPrisma() {
  await prisma.$disconnect();
}

if (require.main === module) {
  seedDemoData()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
