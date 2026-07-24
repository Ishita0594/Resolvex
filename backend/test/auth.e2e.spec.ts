import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '../src/users/user-role.enum';

type TestUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

describe('Auth endpoints', () => {
  let app: INestApplication;
  let users: TestUser[];
  let idSequence: number;

  beforeEach(async () => {
    process.env.DATABASE_URL =
      'postgresql://resolvex_dev:resolvex_dev_password@localhost:5432/resolvex_dev?schema=public';
    process.env.JWT_SECRET = 'test_jwt_secret_for_resolvex_phase_1';
    process.env.JWT_EXPIRES_IN = '1h';

    users = [];
    idSequence = 1;

    const prismaMock = {
      user: {
        findUnique: jest.fn(({ where }: { where: { email?: string; id?: string } }) => {
            if (where.email) {
              return users.find((user) => user.email === where.email) ?? null;
            }

            if (where.id) {
              return users.find((user) => user.id === where.id) ?? null;
            }

            return null;
          }),
        create: jest.fn(({ data }: { data: Omit<TestUser, 'id' | 'createdAt' | 'updatedAt'> }) => {
          const now = new Date();
          const user: TestUser = {
            id: `00000000-0000-4000-8000-${String(idSequence).padStart(12, '0')}`,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          idSequence += 1;
          users.push(user);
          return user;
        }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('registers a user without exposing passwordHash', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'ResolveX Member',
        email: 'member@resolvex.demo',
        password: 'CorrectPassword123!',
        role: UserRole.CARD_MEMBER,
      })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe('Bearer');
    expect(response.body.user).toMatchObject({
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(users[0].passwordHash).not.toBe('CorrectPassword123!');
  });

  it('rejects duplicate email registration', async () => {
    const payload = {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      password: 'CorrectPassword123!',
      role: UserRole.CARD_MEMBER,
    };

    await request(app.getHttpServer()).post('/api/auth/register').send(payload).expect(201);
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      path: '/api/auth/register',
    });
  });

  it('rejects invalid roles', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'ResolveX Member',
        email: 'member@resolvex.demo',
        password: 'CorrectPassword123!',
        role: 'FRAUD_REVIEWER',
      })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain(
      'role must be one of the following values: CARD_MEMBER, MERCHANT, ANALYST',
    );
  });

  it('logs in with correct credentials without exposing passwordHash', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'ResolveX Analyst',
        email: 'analyst@resolvex.demo',
        password: 'CorrectPassword123!',
        role: UserRole.ANALYST,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'analyst@resolvex.demo',
        password: 'CorrectPassword123!',
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe('Bearer');
    expect(response.body.user.email).toBe('analyst@resolvex.demo');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('rejects login with incorrect credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'ResolveX Merchant',
        email: 'merchant@resolvex.demo',
        password: 'CorrectPassword123!',
        role: UserRole.MERCHANT,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'merchant@resolvex.demo',
        password: 'WrongPassword123!',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      path: '/api/auth/login',
    });
  });

  it('rejects missing tokens on the protected profile endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/profile').expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      path: '/api/auth/profile',
    });
  });

  it('returns the authenticated profile without passwordHash', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'ResolveX Member',
        email: 'member@resolvex.demo',
        password: 'CorrectPassword123!',
        role: UserRole.CARD_MEMBER,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });
});
