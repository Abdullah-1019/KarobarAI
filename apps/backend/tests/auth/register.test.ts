jest.mock('../../src/adapters/sms', () => ({ getSmsAdapter: jest.fn() }));

import request from 'supertest';

import { getSmsAdapter } from '../../src/adapters/sms';
import { prisma } from '../../src/core/prisma';
import { app } from '../../src/server';
import { resetDb, resetRedis } from '../helpers/reset';

const mockSendSms = jest.fn().mockResolvedValue(undefined);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  mockSendSms.mockClear();
  (getSmsAdapter as jest.Mock).mockReturnValue({ sendSms: mockSendSms });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/register', () => {
  it('mobile registration creates a PENDING_VERIFICATION user and dispatches an OTP', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      method: 'mobile',
      role: 'BUYER',
      phone: '0300-1234567',
      password: 'Sup3r$ecret!',
    });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ success: true, data: { status: 'PENDING_VERIFICATION' } });

    const user = await prisma.user.findFirst({ where: { deletedAt: null } });
    expect(user?.status).toBe('PENDING_VERIFICATION');
    expect(user?.role).toBe('BUYER');

    expect(mockSendSms).toHaveBeenCalledTimes(1);
    const [to, templateKey, vars] = mockSendSms.mock.calls[0];
    expect(to).toBe('+923001234567');
    expect(templateKey).toBe('otp_code');
    expect(vars.code).toMatch(/^\d{6}$/);
  });

  it('rejects a duplicate ACTIVE phone with 409 ACCOUNT_EXISTS', async () => {
    await request(app).post('/api/v1/auth/register').send({
      method: 'mobile',
      role: 'BUYER',
      phone: '03001234567',
      password: 'Sup3r$ecret!',
    });
    // Verify to flip it ACTIVE.
    const code = mockSendSms.mock.calls[0][2].code as string;
    await request(app).post('/api/v1/auth/otp/verify').send({ phone: '03001234567', code });

    const res = await request(app).post('/api/v1/auth/register').send({
      method: 'mobile',
      role: 'BUYER',
      phone: '03001234567',
      password: 'Sup3r$ecret!',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_EXISTS');
  });

  it('resends (does not error) on a duplicate PENDING_VERIFICATION phone', async () => {
    await request(app).post('/api/v1/auth/register').send({
      method: 'mobile',
      role: 'BUYER',
      phone: '03009999999',
      password: 'Sup3r$ecret!',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      method: 'mobile',
      role: 'BUYER',
      phone: '03009999999',
      password: 'Sup3r$ecret!',
    });

    expect(res.status).toBe(202);
    expect(mockSendSms).toHaveBeenCalledTimes(2);

    const count = await prisma.user.count();
    expect(count).toBe(1); // no duplicate row created
  });

  it('email registration is immediately ACTIVE with tokens issued, no OTP sent', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      method: 'email',
      role: 'SELLER',
      email: 'seller@example.com',
      password: 'Sup3r$ecret!',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.role).toBe('SELLER');
    expect(res.headers['set-cookie']?.[0]).toMatch(/karobarai_rt=/);
    expect(mockSendSms).not.toHaveBeenCalled();

    const seller = await prisma.sellerProfile.findFirst();
    expect(seller?.onboardingStep).toBe(0);
    expect(seller?.onboardingCompletedAt).toBeNull();
    expect(seller?.storeName).toMatch(/^Seller-/);
  });

  it('rejects a weak password with 400', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      method: 'email',
      role: 'BUYER',
      email: 'weak@example.com',
      password: 'weak',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown field (zod .strict()) with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        method: 'email',
        role: 'BUYER',
        email: 'strict@example.com',
        password: 'Sup3r$ecret!',
        notAllowed: true,
      });
    expect(res.status).toBe(400);
  });
});
