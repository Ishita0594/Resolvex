type Environment = Record<string, string | undefined>;

export interface ValidatedEnvironment {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  DISPUTE_MERCHANT_RESPONSE_DAYS: number;
  STORAGE_PROVIDER: 'local' | 's3';
  LOCAL_STORAGE_PATH: string;
  MAX_EVIDENCE_FILE_SIZE_BYTES: number;
  EVIDENCE_UPLOAD_URL_TTL_SECONDS: number;
  EVIDENCE_DOWNLOAD_URL_TTL_SECONDS: number;
  API_PUBLIC_BASE_URL?: string;
  FRONTEND_URL?: string;
  AWS_REGION?: string;
  AWS_S3_BUCKET?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
  AI_SERVICE_URL: string;
  AI_SERVICE_TIMEOUT_MS: number;
  AI_SERVICE_RETRY_ATTEMPTS: number;
  AI_SERVICE_RETRY_BACKOFF_MS: number;
  CORS_ALLOWED_ORIGINS: string[];
  RATE_LIMIT_WINDOW_MS: number;
  AUTH_RATE_LIMIT_MAX: number;
  UPLOAD_RATE_LIMIT_MAX: number;
  POLICY_AUTO_CONFIDENCE_THRESHOLD: number;
  POLICY_AUTO_DECISION_MARGIN_THRESHOLD: number;
  POLICY_CRITICAL_FACT_CONFIDENCE_THRESHOLD: number;
}

export function validateEnv(config: Environment): ValidatedEnvironment {
  const requiredKeys = ['DATABASE_URL', 'JWT_SECRET'];
  const missingKeys = requiredKeys.filter((key) => !config[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingKeys.join(', ')}`,
    );
  }

  if (config.JWT_SECRET === 'replace_with_local_development_secret') {
    throw new Error(
      'JWT_SECRET must be changed from the documented placeholder value',
    );
  }

  if ((config.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  const disputeMerchantResponseDays = Number(
    config.DISPUTE_MERCHANT_RESPONSE_DAYS ?? 7,
  );
  if (
    !Number.isInteger(disputeMerchantResponseDays) ||
    disputeMerchantResponseDays <= 0
  ) {
    throw new Error(
      'DISPUTE_MERCHANT_RESPONSE_DAYS must be a positive integer',
    );
  }

  const storageProvider = config.STORAGE_PROVIDER ?? 'local';
  if (storageProvider !== 'local' && storageProvider !== 's3') {
    throw new Error('STORAGE_PROVIDER must be either local or s3');
  }

  const maxEvidenceFileSizeBytes = Number(
    config.MAX_EVIDENCE_FILE_SIZE_BYTES ?? 10 * 1024 * 1024,
  );
  if (
    !Number.isInteger(maxEvidenceFileSizeBytes) ||
    maxEvidenceFileSizeBytes <= 0
  ) {
    throw new Error('MAX_EVIDENCE_FILE_SIZE_BYTES must be a positive integer');
  }

  const evidenceUploadUrlTtlSeconds = Number(
    config.EVIDENCE_UPLOAD_URL_TTL_SECONDS ?? 600,
  );
  if (
    !Number.isInteger(evidenceUploadUrlTtlSeconds) ||
    evidenceUploadUrlTtlSeconds <= 0
  ) {
    throw new Error(
      'EVIDENCE_UPLOAD_URL_TTL_SECONDS must be a positive integer',
    );
  }

  const evidenceDownloadUrlTtlSeconds = Number(
    config.EVIDENCE_DOWNLOAD_URL_TTL_SECONDS ?? 300,
  );
  if (
    !Number.isInteger(evidenceDownloadUrlTtlSeconds) ||
    evidenceDownloadUrlTtlSeconds <= 0
  ) {
    throw new Error(
      'EVIDENCE_DOWNLOAD_URL_TTL_SECONDS must be a positive integer',
    );
  }

  const aiServiceTimeoutMs = Number(config.AI_SERVICE_TIMEOUT_MS ?? 15000);
  if (!Number.isInteger(aiServiceTimeoutMs) || aiServiceTimeoutMs <= 0) {
    throw new Error('AI_SERVICE_TIMEOUT_MS must be a positive integer');
  }

  const aiServiceRetryAttempts = Number(config.AI_SERVICE_RETRY_ATTEMPTS ?? 2);
  if (
    !Number.isInteger(aiServiceRetryAttempts) ||
    aiServiceRetryAttempts < 0 ||
    aiServiceRetryAttempts > 5
  ) {
    throw new Error('AI_SERVICE_RETRY_ATTEMPTS must be an integer from 0 to 5');
  }

  const aiServiceRetryBackoffMs = Number(
    config.AI_SERVICE_RETRY_BACKOFF_MS ?? 150,
  );
  if (
    !Number.isInteger(aiServiceRetryBackoffMs) ||
    aiServiceRetryBackoffMs < 0 ||
    aiServiceRetryBackoffMs > 5000
  ) {
    throw new Error(
      'AI_SERVICE_RETRY_BACKOFF_MS must be an integer from 0 to 5000',
    );
  }

  const corsAllowedOrigins = parseCsv(
    config.CORS_ALLOWED_ORIGINS ?? config.FRONTEND_URL,
  );
  const rateLimitWindowMs = Number(config.RATE_LIMIT_WINDOW_MS ?? 60_000);
  if (!Number.isInteger(rateLimitWindowMs) || rateLimitWindowMs <= 0) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be a positive integer');
  }

  const authRateLimitMax = Number(config.AUTH_RATE_LIMIT_MAX ?? 100);
  if (!Number.isInteger(authRateLimitMax) || authRateLimitMax <= 0) {
    throw new Error('AUTH_RATE_LIMIT_MAX must be a positive integer');
  }

  const uploadRateLimitMax = Number(config.UPLOAD_RATE_LIMIT_MAX ?? 120);
  if (!Number.isInteger(uploadRateLimitMax) || uploadRateLimitMax <= 0) {
    throw new Error('UPLOAD_RATE_LIMIT_MAX must be a positive integer');
  }

  const policyAutoConfidenceThreshold = Number(
    config.POLICY_AUTO_CONFIDENCE_THRESHOLD ?? 85,
  );
  if (
    !Number.isInteger(policyAutoConfidenceThreshold) ||
    policyAutoConfidenceThreshold < 0 ||
    policyAutoConfidenceThreshold > 100
  ) {
    throw new Error(
      'POLICY_AUTO_CONFIDENCE_THRESHOLD must be an integer from 0 to 100',
    );
  }

  const policyAutoDecisionMarginThreshold = Number(
    config.POLICY_AUTO_DECISION_MARGIN_THRESHOLD ?? 20,
  );
  if (
    !Number.isInteger(policyAutoDecisionMarginThreshold) ||
    policyAutoDecisionMarginThreshold < 0 ||
    policyAutoDecisionMarginThreshold > 100
  ) {
    throw new Error(
      'POLICY_AUTO_DECISION_MARGIN_THRESHOLD must be an integer from 0 to 100',
    );
  }

  const policyCriticalFactConfidenceThreshold = Number(
    config.POLICY_CRITICAL_FACT_CONFIDENCE_THRESHOLD ?? 0.8,
  );
  if (
    Number.isNaN(policyCriticalFactConfidenceThreshold) ||
    policyCriticalFactConfidenceThreshold < 0 ||
    policyCriticalFactConfidenceThreshold > 1
  ) {
    throw new Error(
      'POLICY_CRITICAL_FACT_CONFIDENCE_THRESHOLD must be a number from 0 to 1',
    );
  }

  if (storageProvider === 's3') {
    const requiredS3Keys = [
      'AWS_REGION',
      'AWS_S3_BUCKET',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
    ];
    const missingS3Keys = requiredS3Keys.filter((key) =>
      key === 'AWS_S3_BUCKET'
        ? !config.AWS_S3_BUCKET && !config.S3_BUCKET_NAME
        : !config[key],
    );

    if (missingS3Keys.length > 0) {
      throw new Error(
        `Missing required S3 storage environment variables: ${missingS3Keys.join(', ')}`,
      );
    }
  }

  return {
    NODE_ENV: config.NODE_ENV ?? 'development',
    PORT: port,
    DATABASE_URL: config.DATABASE_URL as string,
    JWT_SECRET: config.JWT_SECRET as string,
    JWT_EXPIRES_IN: config.JWT_EXPIRES_IN ?? '1h',
    DISPUTE_MERCHANT_RESPONSE_DAYS: disputeMerchantResponseDays,
    STORAGE_PROVIDER: storageProvider,
    LOCAL_STORAGE_PATH: config.LOCAL_STORAGE_PATH ?? './storage/evidence',
    MAX_EVIDENCE_FILE_SIZE_BYTES: maxEvidenceFileSizeBytes,
    EVIDENCE_UPLOAD_URL_TTL_SECONDS: evidenceUploadUrlTtlSeconds,
    EVIDENCE_DOWNLOAD_URL_TTL_SECONDS: evidenceDownloadUrlTtlSeconds,
    API_PUBLIC_BASE_URL: config.API_PUBLIC_BASE_URL,
    FRONTEND_URL: config.FRONTEND_URL,
    AWS_REGION: config.AWS_REGION,
    AWS_S3_BUCKET: config.AWS_S3_BUCKET ?? config.S3_BUCKET_NAME,
    AWS_ACCESS_KEY_ID: config.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: config.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: config.AWS_SESSION_TOKEN,
    AI_SERVICE_URL: config.AI_SERVICE_URL ?? 'http://localhost:8000',
    AI_SERVICE_TIMEOUT_MS: aiServiceTimeoutMs,
    AI_SERVICE_RETRY_ATTEMPTS: aiServiceRetryAttempts,
    AI_SERVICE_RETRY_BACKOFF_MS: aiServiceRetryBackoffMs,
    CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
    RATE_LIMIT_WINDOW_MS: rateLimitWindowMs,
    AUTH_RATE_LIMIT_MAX: authRateLimitMax,
    UPLOAD_RATE_LIMIT_MAX: uploadRateLimitMax,
    POLICY_AUTO_CONFIDENCE_THRESHOLD: policyAutoConfidenceThreshold,
    POLICY_AUTO_DECISION_MARGIN_THRESHOLD: policyAutoDecisionMarginThreshold,
    POLICY_CRITICAL_FACT_CONFIDENCE_THRESHOLD:
      policyCriticalFactConfidenceThreshold,
  };
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
