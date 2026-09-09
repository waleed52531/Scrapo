import { ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ActionStatus, LeadSource } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";
import { ApiResponseInterceptor } from "../src/common/api-response.interceptor";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Phase 1 API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let foreignWorkspaceId: string;
  const auth = "Bearer demo-token";

  beforeAll(async () => {
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NODE_ENV = "test";
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    prisma = app.get(PrismaService);
    const foreign = await prisma.workspace.create({
      data: { name: "Isolation Test", slug: `isolation-${Date.now()}` },
    });
    foreignWorkspaceId = foreign.id;
  });

  afterAll(async () => {
    if (foreignWorkspaceId)
      await prisma.workspace.delete({ where: { id: foreignWorkspaceId } });
    await app.close();
  });

  it("rejects an unauthenticated protected request", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/leads")
      .expect(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "AUTH_TOKEN_MISSING" },
    });
  });

  it("reports public database health", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ok", database: "connected" },
    });
  });

  it("reports protected system health without exposing secrets", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/system/health")
      .set("Authorization", auth)
      .expect(200);
    expect(response.body.data).toMatchObject({
      service: "system",
      components: {
        api: { status: "HEALTHY" },
        database: { status: "HEALTHY" },
      },
      providers: expect.any(Object),
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "GMAIL_TOKEN_ENCRYPTION_KEY",
    );
  });

  it("rejects access to another workspace", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/companies")
      .set("Authorization", auth)
      .set("X-Workspace-Id", foreignWorkspaceId)
      .expect(403);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "WORKSPACE_ACCESS_DENIED" },
    });
  });

  it("does not leak another workspace lead by direct object reference", async () => {
    const foreignLead = await prisma.lead.create({
      data: {
        workspaceId: foreignWorkspaceId,
        title: "Foreign workspace lead",
        primarySource: "MANUAL",
        leadType: "MANUAL",
      },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/leads/${foreignLead.id}`)
      .set("Authorization", auth)
      .expect(404);
  });

  it("returns paginated demo leads", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/leads?limit=5")
      .set("Authorization", auth)
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(5);
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(12);
  });

  it("completes a workspace-scoped company/contact/lead CRUD cycle", async () => {
    const suffix = Date.now();
    const companyResponse = await request(app.getHttpServer())
      .post("/api/v1/companies")
      .set("Authorization", auth)
      .send({
        name: "E2E Studio",
        website: `https://e2e-${suffix}.example`,
        country: "United Kingdom",
      })
      .expect(201);
    const companyId = companyResponse.body.data.id as string;

    const contactResponse = await request(app.getHttpServer())
      .post("/api/v1/contacts")
      .set("Authorization", auth)
      .send({
        companyId,
        fullName: "E2E Founder",
        role: "Founder",
        email: `founder-${suffix}@example.com`,
        emailStatus: "VERIFIED",
      })
      .expect(201);
    const contactId = contactResponse.body.data.id as string;

    const leadResponse = await request(app.getHttpServer())
      .post("/api/v1/leads")
      .set("Authorization", auth)
      .send({
        companyId,
        contactId,
        title: "E2E mobile partnership",
        primarySource: "MANUAL",
        leadType: "AGENCY_PARTNER",
        overallScore: 90,
      })
      .expect(201);
    const leadId = leadResponse.body.data.id as string;
    expect(leadResponse.body.data.temperature).toBe("HOT");

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/leads/${leadId}`)
      .set("Authorization", auth)
      .send({ status: "QUALIFIED", overallScore: 85 })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      status: "QUALIFIED",
      temperature: "STRONG",
      overallScore: 85,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}`)
      .set("Authorization", auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/leads/${leadId}`)
      .set("Authorization", auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/contacts/${contactId}`)
      .set("Authorization", auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}`)
      .set("Authorization", auth)
      .expect(200);
  });

  it("returns AI configuration status without exposing secrets", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/settings/ai")
      .set("Authorization", auth)
      .expect(200);
    expect(response.body.data).toMatchObject({
      provider: "OpenAI",
      configured: expect.any(Boolean),
    });
    expect(response.body.data).not.toHaveProperty("apiKey");
  });

  it("validates scoring settings total 100", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/settings/scoring")
      .set("Authorization", auth)
      .send({
        buyingIntent: 25,
        mobileRelevance: 20,
        agencyFit: 15,
        decisionMakerQuality: 10,
        contactability: 10,
        recency: 10,
        companyQuality: 5,
        countryPriority: 4,
      })
      .expect(400);

    const response = await request(app.getHttpServer())
      .patch("/api/v1/settings/scoring")
      .set("Authorization", auth)
      .send({
        buyingIntent: 25,
        mobileRelevance: 20,
        agencyFit: 15,
        decisionMakerQuality: 10,
        contactability: 10,
        recency: 10,
        companyQuality: 5,
        countryPriority: 5,
      })
      .expect(200);
    expect(response.body.data.scoring).toMatchObject({
      buyingIntent: 25,
      countryPriority: 5,
    });
  });

  it("blocks private/internal website analysis URLs", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/analysis/website")
      .set("Authorization", auth)
      .send({ url: "http://127.0.0.1" })
      .expect(400);
    expect(response.body.error.code).toBe("BLOCKED_PRIVATE_URL");

    const ipv6 = await request(app.getHttpServer())
      .post("/api/v1/analysis/website")
      .set("Authorization", auth)
      .send({ url: "http://[::1]" })
      .expect(400);
    expect(ipv6.body.error.code).toBe("BLOCKED_PRIVATE_URL");
  });

  it("prevents duplicate outreach sends with an idempotency key", async () => {
    const suffix = Date.now();
    await request(app.getHttpServer())
      .post("/api/v1/integrations/gmail/connect")
      .set("Authorization", auth)
      .expect(201);

    const companyResponse = await request(app.getHttpServer())
      .post("/api/v1/companies")
      .set("Authorization", auth)
      .send({
        name: "Idempotency Studio",
        website: `https://idempotency-${suffix}.example`,
        country: "United States",
      })
      .expect(201);
    const companyId = companyResponse.body.data.id as string;

    const contactResponse = await request(app.getHttpServer())
      .post("/api/v1/contacts")
      .set("Authorization", auth)
      .send({
        companyId,
        fullName: "Idempotency Founder",
        role: "Founder",
        email: `idempotency-${suffix}@example.com`,
        emailStatus: "VERIFIED",
        decisionMakerScore: 90,
      })
      .expect(201);
    const contactId = contactResponse.body.data.id as string;

    const leadResponse = await request(app.getHttpServer())
      .post("/api/v1/leads")
      .set("Authorization", auth)
      .send({
        companyId,
        contactId,
        title: "Idempotency mobile partnership",
        primarySource: "MANUAL",
        leadType: "AGENCY_PARTNER",
        status: "QUALIFIED",
        overallScore: 94,
        analysisConfidence: 90,
      })
      .expect(201);
    const leadId = leadResponse.body.data.id as string;

    const generated = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/outreach/generate`)
      .set("Authorization", auth)
      .send({})
      .expect(201);
    const outreachId = generated.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/outreach/${outreachId}/approve`)
      .set("Authorization", auth)
      .expect(201);

    const idempotencyKey = `e2e-send-${suffix}`;
    const firstSend = await request(app.getHttpServer())
      .post(`/api/v1/outreach/${outreachId}/send`)
      .set("Authorization", auth)
      .set("Idempotency-Key", idempotencyKey)
      .send({})
      .expect(201);

    const secondSend = await request(app.getHttpServer())
      .post(`/api/v1/outreach/${outreachId}/send`)
      .set("Authorization", auth)
      .set("Idempotency-Key", idempotencyKey)
      .send({})
      .expect(201);

    expect(secondSend.body.data.id).toBe(firstSend.body.data.id);
    const sends = await prisma.outreachMessage.count({
      where: { workspaceId: firstSend.body.data.workspaceId, idempotencyKey },
    });
    expect(sends).toBe(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/leads/${leadId}`)
      .set("Authorization", auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/contacts/${contactId}`)
      .set("Authorization", auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}`)
      .set("Authorization", auth)
      .expect(200);
  });

  it("queues lead analysis and preserves manual score override history", async () => {
    const suffix = Date.now();
    const leadResponse = await request(app.getHttpServer())
      .post("/api/v1/leads")
      .set("Authorization", auth)
      .send({
        title: "Need Flutter help immediately",
        primarySource: "MANUAL",
        leadType: "ACTIVE_REQUIREMENT",
        sourceContent:
          "Looking for a Flutter developer to finish our Firebase application this month.",
        publishedAt: new Date().toISOString(),
        overallScore: 72,
      })
      .expect(201);
    const leadId = leadResponse.body.data.id as string;

    const queued = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/analyze`)
      .set("Authorization", auth)
      .send({})
      .expect(202);
    expect(queued.body.data).toMatchObject({
      status: "QUEUED",
      jobId: expect.any(String),
    });

    const override = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/score-override`)
      .set("Authorization", auth)
      .send({ score: 88, reason: `Manual e2e override ${suffix}` })
      .expect(201);
    expect(override.body.data).toMatchObject({
      overallScore: 88,
      temperature: "STRONG",
      scoreOverrideScore: 88,
    });

    const scores = await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}/scores`)
      .set("Authorization", auth)
      .expect(200);
    expect(
      scores.body.data.some(
        (score: { isManualOverride: boolean; overrideScore: number }) =>
          score.isManualOverride && score.overrideScore === 88,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/leads/${leadId}`)
      .set("Authorization", auth)
      .expect(200);
  });

  it("exposes Phase 4 social integration health without enabling automation", async () => {
    const x = await request(app.getHttpServer())
      .get("/api/v1/integrations/x/health")
      .set("Authorization", auth)
      .expect(200);
    expect(x.body.data).toMatchObject({
      provider: expect.any(String),
      status: expect.any(String),
    });

    const reddit = await request(app.getHttpServer())
      .get("/api/v1/integrations/reddit/health")
      .set("Authorization", auth)
      .expect(200);
    expect(["APPROVAL_REQUIRED", "CONFIGURED", "ACTIVE"]).toContain(
      reddit.body.data.status,
    );

    const telegram = await request(app.getHttpServer())
      .get("/api/v1/integrations/telegram/health")
      .set("Authorization", auth)
      .expect(200);
    expect(telegram.body.data).toMatchObject({
      provider: expect.any(String),
      status: expect.any(String),
    });
  });

  it("manages Telegram sources as configured sources only", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/telegram/sources")
      .set("Authorization", auth)
      .send({
        name: "E2E Telegram Source",
        username: `e2e_source_${Date.now()}`,
        type: "CHANNEL",
        keywords: ["flutter", "firebase"],
      })
      .expect(201);
    const id = created.body.data.id as string;

    const listed = await request(app.getHttpServer())
      .get("/api/v1/telegram/sources")
      .set("Authorization", auth)
      .expect(200);
    expect(
      listed.body.data.some((source: { id: string }) => source.id === id),
    ).toBe(true);

    const synced = await request(app.getHttpServer())
      .post(`/api/v1/telegram/sources/${id}/sync`)
      .set("Authorization", auth)
      .expect(201);
    expect(["SYNCED", "ACCESS_ERROR"]).toContain(synced.body.data.status);

    await request(app.getHttpServer())
      .patch(`/api/v1/telegram/sources/${id}`)
      .set("Authorization", auth)
      .send({ enabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/telegram/sources/${id}`)
      .set("Authorization", auth)
      .expect(200);
  });

  it("lists social profiles and updates manual action queue items", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/settings")
      .set("Authorization", auth)
      .expect(200);
    const demoUser = await prisma.user.findUniqueOrThrow({
      where: { externalAuthId: "00000000-0000-0000-0000-000000000001" },
      include: { memberships: true },
    });
    const workspaceId = demoUser.memberships[0]!.workspaceId;
    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        fullName: "E2E X Founder",
        role: "Founder",
        profileUrl: "https://x.com/e2e_founder",
        xUrl: "https://x.com/e2e_founder",
      },
    });
    const profile = await prisma.socialProfile.create({
      data: {
        workspaceId,
        contactId: contact.id,
        platform: LeadSource.X,
        externalId: `e2e-x-${Date.now()}`,
        username: "e2e_founder",
        displayName: "E2E X Founder",
        profileUrl: "https://x.com/e2e_founder",
      },
    });
    const lead = await prisma.lead.create({
      data: {
        workspaceId,
        contactId: contact.id,
        primarySource: LeadSource.X,
        leadType: "ACTIVE_REQUIREMENT",
        title: "E2E social lead",
        overallScore: 91,
        status: "QUALIFIED",
      },
    });
    const action = await prisma.actionItem.create({
      data: {
        workspaceId,
        leadId: lead.id,
        contactId: contact.id,
        platform: LeadSource.X,
        actionType: "X_REPLY",
        type: "X_REPLY",
        title: "Manual X reply",
        suggestedText: "Manual reply only.",
        status: ActionStatus.PENDING,
      },
    });

    const profiles = await request(app.getHttpServer())
      .get("/api/v1/social-profiles?platform=X")
      .set("Authorization", auth)
      .expect(200);
    expect(
      profiles.body.data.some((item: { id: string }) => item.id === profile.id),
    ).toBe(true);

    const queue = await request(app.getHttpServer())
      .get("/api/v1/action-queue")
      .set("Authorization", auth)
      .expect(200);
    expect(
      queue.body.data.some((item: { id: string }) => item.id === action.id),
    ).toBe(true);

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/action-queue/${action.id}`)
      .set("Authorization", auth)
      .send({ status: "COMPLETED" })
      .expect(200);
    expect(patched.body.data).toMatchObject({
      id: action.id,
      status: "COMPLETED",
    });

    await prisma.actionItem.delete({ where: { id: action.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.socialProfile.delete({ where: { id: profile.id } });
    await prisma.contact.delete({ where: { id: contact.id } });
  });

  it("exposes Phase 6 automation, ranking feedback, reports, recommendations, and notifications", async () => {
    const automation = await request(app.getHttpServer())
      .get("/api/v1/automation/status")
      .set("Authorization", auth)
      .expect(200);
    expect(automation.body.data.rules.length).toBeGreaterThanOrEqual(5);
    expect(automation.body.data).toMatchObject({
      automationPaused: expect.any(Boolean),
      automationKillSwitch: expect.any(Boolean),
    });

    const analyticsRule = automation.body.data.rules.find(
      (rule: { type: string }) => rule.type === "ANALYTICS_REFRESH",
    ) as { id: string };
    const manualRun = await request(app.getHttpServer())
      .post(`/api/v1/automation/${analyticsRule.id}/run`)
      .set("Authorization", auth)
      .expect(201);
    expect(manualRun.body.data).toMatchObject({
      status: "SCHEDULED",
      automationRuleId: analyticsRule.id,
    });

    const runs = await request(app.getHttpServer())
      .get("/api/v1/automation-runs?limit=5")
      .set("Authorization", auth)
      .expect(200);
    expect(runs.body.data.length).toBeGreaterThanOrEqual(1);

    const leads = await request(app.getHttpServer())
      .get("/api/v1/leads?limit=1")
      .set("Authorization", auth)
      .expect(200);
    const leadId = leads.body.data[0].id as string;
    const feedback = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/feedback`)
      .set("Authorization", auth)
      .send({ rating: "LIKE", reason: "E2E ranking feedback" })
      .expect(201);
    expect(feedback.body.data).toMatchObject({
      leadId,
      rating: "LIKE",
    });

    await request(app.getHttpServer())
      .post("/api/v1/optimization/recommendations/generate")
      .set("Authorization", auth)
      .expect(201);
    const recommendations = await request(app.getHttpServer())
      .get("/api/v1/optimization/recommendations")
      .set("Authorization", auth)
      .expect(200);
    expect(Array.isArray(recommendations.body.data)).toBe(true);

    const report = await request(app.getHttpServer())
      .post("/api/v1/reports/weekly/generate")
      .set("Authorization", auth)
      .expect(200);
    expect(report.body.data).toHaveProperty("metrics");

    const notifications = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", auth)
      .expect(200);
    expect(Array.isArray(notifications.body.data)).toBe(true);
    await request(app.getHttpServer())
      .post("/api/v1/notifications/read-all")
      .set("Authorization", auth)
      .expect(200);
  });
});
