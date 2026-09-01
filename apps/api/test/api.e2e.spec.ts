import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/api-response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 1 API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let foreignWorkspaceId: string;
  const auth = 'Bearer demo-token';

  beforeAll(async () => {
    process.env.DEMO_AUTH_ENABLED = 'true';
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    prisma = app.get(PrismaService);
    const foreign = await prisma.workspace.create({ data: { name: 'Isolation Test', slug: `isolation-${Date.now()}` } });
    foreignWorkspaceId = foreign.id;
  });

  afterAll(async () => {
    if (foreignWorkspaceId) await prisma.workspace.delete({ where: { id: foreignWorkspaceId } });
    await app.close();
  });

  it('rejects an unauthenticated protected request', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/leads').expect(401);
    expect(response.body).toMatchObject({ success: false, error: { code: 'AUTH_TOKEN_MISSING' } });
  });

  it('reports public database health', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({ success: true, data: { status: 'ok', database: 'connected' } });
  });

  it('rejects access to another workspace', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/companies')
      .set('Authorization', auth)
      .set('X-Workspace-Id', foreignWorkspaceId)
      .expect(403);
    expect(response.body).toMatchObject({ success: false, error: { code: 'WORKSPACE_ACCESS_DENIED' } });
  });

  it('returns paginated demo leads', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/leads?limit=5').set('Authorization', auth).expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(5);
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(12);
  });

  it('completes a workspace-scoped company/contact/lead CRUD cycle', async () => {
    const suffix = Date.now();
    const companyResponse = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', auth)
      .send({ name: 'E2E Studio', website: `https://e2e-${suffix}.example`, country: 'United Kingdom' })
      .expect(201);
    const companyId = companyResponse.body.data.id as string;

    const contactResponse = await request(app.getHttpServer())
      .post('/api/v1/contacts')
      .set('Authorization', auth)
      .send({ companyId, fullName: 'E2E Founder', role: 'Founder', email: `founder-${suffix}@example.com`, emailStatus: 'VERIFIED' })
      .expect(201);
    const contactId = contactResponse.body.data.id as string;

    const leadResponse = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', auth)
      .send({ companyId, contactId, title: 'E2E mobile partnership', primarySource: 'MANUAL', leadType: 'AGENCY_PARTNER', overallScore: 90 })
      .expect(201);
    const leadId = leadResponse.body.data.id as string;
    expect(leadResponse.body.data.temperature).toBe('HOT');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/leads/${leadId}`)
      .set('Authorization', auth)
      .send({ status: 'QUALIFIED', overallScore: 85 })
      .expect(200);
    expect(updated.body.data).toMatchObject({ status: 'QUALIFIED', temperature: 'STRONG', overallScore: 85 });

    await request(app.getHttpServer()).get(`/api/v1/leads/${leadId}`).set('Authorization', auth).expect(200);
    await request(app.getHttpServer()).delete(`/api/v1/leads/${leadId}`).set('Authorization', auth).expect(200);
    await request(app.getHttpServer()).delete(`/api/v1/contacts/${contactId}`).set('Authorization', auth).expect(200);
    await request(app.getHttpServer()).delete(`/api/v1/companies/${companyId}`).set('Authorization', auth).expect(200);
  });
});
