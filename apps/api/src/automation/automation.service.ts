import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { nextDailyRun, nextWeeklyRun, scheduledPeriod } from "@scrapo/shared";
import { AnalysisQueueService } from "../analysis/analysis-queue.service";
import { defaultSettings } from "../auth/workspace-context.service";
import { PaginatedResult } from "../common/paginated-result";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AutomationRunListDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from "./dto/automation.dto";

type RuleConfig = Record<string, unknown>;

@Injectable()
export class AutomationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AnalysisQueueService) private readonly queue: AnalysisQueueService,
  ) {}

  async dashboard(workspaceId: string) {
    await this.ensureDefaults(workspaceId);
    const settings = await this.settings(workspaceId);
    const rules = await this.prisma.automationRule.findMany({
      where: { workspaceId },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { type: "asc" },
    });
    return {
      automationPaused: settings.automationPaused,
      automationKillSwitch: settings.automationKillSwitch,
      timezone: settings.timezone,
      rules,
    };
  }

  async list(workspaceId: string) {
    await this.ensureDefaults(workspaceId);
    return this.prisma.automationRule.findMany({
      where: { workspaceId },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 3 } },
      orderBy: { type: "asc" },
    });
  }

  async get(workspaceId: string, id: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, workspaceId },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!rule)
      throw notFound(
        "AUTOMATION_RULE_NOT_FOUND",
        "Automation rule could not be found.",
      );
    return rule;
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateAutomationRuleDto,
  ) {
    const settings = await this.settings(workspaceId);
    const configuration = input.configuration ?? defaultConfig(input.type);
    const timezone = input.timezone ?? settings.timezone;
    const rule = await this.prisma.automationRule.create({
      data: {
        workspaceId,
        name: input.name,
        type: input.type,
        enabled: input.enabled ?? false,
        scheduleType: scheduleTypeFor(input.type),
        timezone,
        cronExpression:
          input.cronExpression ?? cronFor(input.type, configuration),
        schedule: input.cronExpression ?? cronFor(input.type, configuration),
        configuration: configuration as Prisma.InputJsonValue,
        config: configuration as Prisma.InputJsonValue,
        nextRunAt: input.enabled
          ? nextRunFor(input.type, configuration, timezone)
          : null,
      },
    });
    await this.audit(workspaceId, userId, "AUTOMATION_CREATED", rule.id, {
      type: rule.type,
    });
    return rule;
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateAutomationRuleDto,
  ) {
    const current = await this.get(workspaceId, id);
    const configuration = {
      ...record(current.configuration),
      ...record(input.configuration),
    };
    const timezone = input.timezone ?? current.timezone;
    const enabled = input.enabled ?? current.enabled;
    const updated = await this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        enabled,
        timezone,
        cronExpression:
          input.cronExpression ?? cronFor(current.type, configuration),
        schedule: input.cronExpression ?? cronFor(current.type, configuration),
        configuration: configuration as Prisma.InputJsonValue,
        config: configuration as Prisma.InputJsonValue,
        nextRunAt: enabled
          ? nextRunFor(current.type, configuration, timezone)
          : null,
      },
    });
    await this.audit(workspaceId, userId, "AUTOMATION_SCHEDULE_CHANGED", id, {
      previous: current.configuration,
      next: configuration,
    });
    return updated;
  }

  async delete(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    await this.prisma.automationRule.delete({ where: { id } });
    await this.audit(workspaceId, userId, "AUTOMATION_DELETED", id);
    return { id, deleted: true };
  }

  async enable(workspaceId: string, userId: string, id: string) {
    const rule = await this.get(workspaceId, id);
    const updated = await this.prisma.automationRule.update({
      where: { id },
      data: {
        enabled: true,
        nextRunAt: nextRunFor(
          rule.type,
          record(rule.configuration),
          rule.timezone,
        ),
      },
    });
    await this.audit(workspaceId, userId, "AUTOMATION_ENABLED", id);
    return updated;
  }

  async disable(workspaceId: string, userId: string, id: string) {
    const updated = await this.prisma.automationRule.updateMany({
      where: { id, workspaceId },
      data: { enabled: false, nextRunAt: null },
    });
    if (updated.count === 0)
      throw notFound(
        "AUTOMATION_RULE_NOT_FOUND",
        "Automation rule could not be found.",
      );
    await this.audit(workspaceId, userId, "AUTOMATION_DISABLED", id);
    return this.get(workspaceId, id);
  }

  async runNow(workspaceId: string, userId: string, id: string) {
    const rule = await this.get(workspaceId, id);
    return this.createRun(
      workspaceId,
      userId,
      rule.id,
      new Date(),
      `manual-${Date.now()}`,
      null,
    );
  }

  async skipNext(workspaceId: string, userId: string, id: string) {
    const rule = await this.get(workspaceId, id);
    const skipped =
      rule.nextRunAt ??
      nextRunFor(rule.type, record(rule.configuration), rule.timezone);
    const next = nextRunFor(
      rule.type,
      record(rule.configuration),
      rule.timezone,
      new Date(skipped.getTime() + 60_000),
    );
    const updated = await this.prisma.automationRule.update({
      where: { id },
      data: { skipNextAt: skipped, nextRunAt: next },
    });
    await this.audit(workspaceId, userId, "AUTOMATION_NEXT_RUN_SKIPPED", id, {
      skipped,
      next,
    });
    return updated;
  }

  async runs(workspaceId: string, query: AutomationRunListDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where: Prisma.AutomationRunWhereInput = {
      workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.automationRuleId
        ? { automationRuleId: query.automationRuleId }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.automationRun.findMany({
        where,
        include: { automationRule: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.automationRun.count({ where }),
    ]);
    return new PaginatedResult(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async runDetail(workspaceId: string, id: string) {
    const run = await this.prisma.automationRun.findFirst({
      where: { id, workspaceId },
      include: { automationRule: true, retries: true, previousRun: true },
    });
    if (!run)
      throw notFound(
        "AUTOMATION_RUN_NOT_FOUND",
        "Automation run could not be found.",
      );
    return run;
  }

  async retryRun(workspaceId: string, userId: string, id: string) {
    const run = await this.runDetail(workspaceId, id);
    await this.audit(workspaceId, userId, "AUTOMATION_RUN_RETRIED", id);
    return this.createRun(
      workspaceId,
      userId,
      run.automationRuleId,
      new Date(),
      `retry-${run.id}-${Date.now()}`,
      run.id,
    );
  }

  async pause(workspaceId: string, userId: string) {
    const settings = await this.prisma.userSettings.update({
      where: { workspaceId },
      data: { automationPaused: true },
    });
    await this.audit(workspaceId, userId, "AUTOMATION_PAUSED", settings.id);
    return settings;
  }

  async resume(workspaceId: string, userId: string) {
    const settings = await this.prisma.userSettings.update({
      where: { workspaceId },
      data: { automationPaused: false, automationKillSwitch: false },
    });
    await this.audit(workspaceId, userId, "AUTOMATION_RESUMED", settings.id);
    return settings;
  }

  async stopAll(workspaceId: string, userId: string) {
    const settings = await this.prisma.userSettings.update({
      where: { workspaceId },
      data: { automationPaused: true, automationKillSwitch: true },
    });
    await this.prisma.automationRule.updateMany({
      where: { workspaceId },
      data: { nextRunAt: null },
    });
    await this.audit(
      workspaceId,
      userId,
      "AUTOMATION_KILL_SWITCH_ENABLED",
      settings.id,
    );
    return settings;
  }

  async ensureDefaults(workspaceId: string) {
    const settings = await this.settings(workspaceId);
    const defaults = defaultRules(settings.timezone);
    for (const rule of defaults) {
      await this.prisma.automationRule.upsert({
        where: { workspaceId_type: { workspaceId, type: rule.type } },
        update: {},
        create: {
          workspaceId,
          ...rule,
          configuration: rule.configuration as Prisma.InputJsonValue,
          config: rule.configuration as Prisma.InputJsonValue,
          nextRunAt: rule.enabled
            ? nextRunFor(rule.type, rule.configuration, rule.timezone)
            : null,
        },
      });
    }
  }

  private async settings(workspaceId: string) {
    return this.prisma.userSettings.upsert({
      where: { workspaceId },
      update: {},
      create: { workspaceId, ...defaultSettings() },
    });
  }

  private async createRun(
    workspaceId: string,
    userId: string | null,
    automationRuleId: string,
    scheduledFor: Date,
    period: string,
    previousRunId: string | null,
  ) {
    const rule = await this.get(workspaceId, automationRuleId);
    const settings = await this.settings(workspaceId);
    if (settings.automationKillSwitch) {
      throw new BadRequestException({
        code: "AUTOMATION_KILL_SWITCH_ENABLED",
        message: "Global automation kill switch is enabled.",
      });
    }
    const existing = await this.prisma.automationRun.findUnique({
      where: {
        workspaceId_automationRuleId_scheduledPeriod: {
          workspaceId,
          automationRuleId,
          scheduledPeriod: period,
        },
      },
    });
    if (existing) return existing;
    const run = await this.prisma.automationRun.create({
      data: {
        workspaceId,
        automationRuleId,
        scheduledFor,
        scheduledPeriod: period,
        previousRunId,
        status: "SCHEDULED",
      },
    });
    if (run.status !== "SCHEDULED") return run;
    const queued = await this.queue.enqueue(workspaceId, "AUTOMATION_RUN", {
      automationRunId: run.id,
    });
    const updated = await this.prisma.automationRun.update({
      where: { id: run.id },
      data: { jobId: queued.jobId },
    });
    await this.audit(workspaceId, userId, "AUTOMATION_RUN_CREATED", run.id, {
      ruleType: rule.type,
      jobId: queued.jobId,
    });
    return updated;
  }

  private async audit(
    workspaceId: string,
    userId: string | null,
    action: string,
    entityId?: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action,
        entityType: "Automation",
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}

export function nextRunFor(
  type: string,
  config: RuleConfig,
  timezone: string,
  from = new Date(),
) {
  if (type === "GMAIL_REPLY_SYNC") {
    return new Date(
      from.getTime() +
        Number(
          config.intervalMinutes ??
            process.env.GMAIL_SYNC_INTERVAL_MINUTES ??
            30,
        ) *
          60_000,
    );
  }
  if (type === "FOLLOW_UP_SCAN" || type === "ANALYTICS_REFRESH") {
    return nextDailyRun({
      time: String(config.time ?? "09:00"),
      timezone,
      from,
    });
  }
  return nextWeeklyRun({
    dayOfWeek: Number(config.dayOfWeek ?? (type === "WEEKLY_REPORT" ? 5 : 1)),
    time: String(config.time ?? (type === "WEEKLY_REPORT" ? "17:00" : "08:00")),
    timezone,
    from,
  });
}

export function defaultRules(timezone: string) {
  return [
    {
      name: "Weekly Lead Hunt",
      type: "WEEKLY_LEAD_HUNT",
      enabled: false,
      schedule: "0 8 * * 1",
      scheduleType: "WEEKLY",
      timezone,
      cronExpression: "0 8 * * 1",
      configuration: defaultConfig("WEEKLY_LEAD_HUNT"),
    },
    {
      name: "Gmail Reply Sync",
      type: "GMAIL_REPLY_SYNC",
      enabled: true,
      schedule: "*/30 * * * *",
      scheduleType: "INTERVAL_MINUTES",
      timezone,
      cronExpression: "*/30 * * * *",
      configuration: defaultConfig("GMAIL_REPLY_SYNC"),
    },
    {
      name: "Follow-up Scan",
      type: "FOLLOW_UP_SCAN",
      enabled: true,
      schedule: "0 9 * * 1-5",
      scheduleType: "DAILY",
      timezone,
      cronExpression: "0 9 * * 1-5",
      configuration: defaultConfig("FOLLOW_UP_SCAN"),
    },
    {
      name: "Analytics Refresh",
      type: "ANALYTICS_REFRESH",
      enabled: true,
      schedule: "0 7 * * 1-5",
      scheduleType: "DAILY",
      timezone,
      cronExpression: "0 7 * * 1-5",
      configuration: defaultConfig("ANALYTICS_REFRESH"),
    },
    {
      name: "Weekly Report",
      type: "WEEKLY_REPORT",
      enabled: false,
      schedule: "0 17 * * 5",
      scheduleType: "WEEKLY",
      timezone,
      cronExpression: "0 17 * * 5",
      configuration: defaultConfig("WEEKLY_REPORT"),
    },
  ];
}

function defaultConfig(type: string): RuleConfig {
  if (type === "WEEKLY_LEAD_HUNT") {
    return {
      dayOfWeek: 1,
      time: "08:00",
      sources: ["WEB", "X"],
      countries: ["United Kingdom", "United Arab Emirates", "United States"],
      categories: ["WEB_AGENCY", "FLUTTER_REQUIREMENT"],
      maxQueries: 8,
      maxRawDiscoveries: 300,
      minimumScore: 82,
      shortlistLimit: 20,
      autoGenerateOutreachDrafts: true,
    };
  }
  if (type === "GMAIL_REPLY_SYNC") return { intervalMinutes: 30 };
  if (type === "WEEKLY_REPORT") return { dayOfWeek: 5, time: "17:00" };
  if (type === "FOLLOW_UP_SCAN") return { dayOfWeek: 1, time: "09:00" };
  return { dayOfWeek: 1, time: "07:00" };
}

function scheduleTypeFor(type: string) {
  if (type === "GMAIL_REPLY_SYNC") return "INTERVAL_MINUTES";
  if (type === "FOLLOW_UP_SCAN" || type === "ANALYTICS_REFRESH") return "DAILY";
  return "WEEKLY";
}

function cronFor(type: string, config: RuleConfig) {
  if (type === "GMAIL_REPLY_SYNC")
    return `*/${Number(config.intervalMinutes ?? 30)} * * * *`;
  const [hour = "8", minute = "0"] = String(config.time ?? "08:00").split(":");
  return `${Number(minute)} ${Number(hour)} * * ${Number(config.dayOfWeek ?? 1)}`;
}

function record(value: unknown): RuleConfig {
  return value && typeof value === "object" ? (value as RuleConfig) : {};
}

function notFound(code: string, message: string) {
  return new NotFoundException({ code, message });
}

export function periodFor(
  ruleType: string,
  scheduledFor: Date,
  timezone: string,
) {
  if (ruleType === "GMAIL_REPLY_SYNC") {
    return `${scheduledPeriod(scheduledFor, timezone)}-${scheduledFor.getUTCHours()}-${Math.floor(scheduledFor.getUTCMinutes() / 30)}`;
  }
  return scheduledPeriod(scheduledFor, timezone);
}
