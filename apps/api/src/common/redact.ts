const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|jwt[_-]?secret|password|DATABASE_URL|REDIS_URL)=([^&\s]+)/gi,
  /postgres(?:ql)?:\/\/[^\s"']+/gi,
  /redis:\/\/[^\s"']+/gi,
];

export function redactSensitive(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? "[REDACTED]" : redactSensitive(item),
      ]),
    );
  }
  return value;
}

export function redactString(value: string) {
  return SECRET_PATTERNS.reduce(
    (next, pattern) =>
      next.replace(pattern, (match, key) =>
        key ? `${key}=[REDACTED]` : "[REDACTED]",
      ),
    value,
  );
}

function isSensitiveKey(key: string) {
  return /(password|secret|token|apiKey|api_key|authorization|credentials|databaseUrl|redisUrl)/i.test(
    key,
  );
}
