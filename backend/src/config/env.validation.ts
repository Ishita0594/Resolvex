type Environment = Record<string, string | undefined>;

export interface ValidatedEnvironment {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  DISPUTE_MERCHANT_RESPONSE_DAYS: number;
}

export function validateEnv(config: Environment): ValidatedEnvironment {
  const requiredKeys = ['DATABASE_URL', 'JWT_SECRET'];
  const missingKeys = requiredKeys.filter((key) => !config[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  }

  if (config.JWT_SECRET === 'replace_with_local_development_secret') {
    throw new Error('JWT_SECRET must be changed from the documented placeholder value');
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  const disputeMerchantResponseDays = Number(config.DISPUTE_MERCHANT_RESPONSE_DAYS ?? 7);
  if (!Number.isInteger(disputeMerchantResponseDays) || disputeMerchantResponseDays <= 0) {
    throw new Error('DISPUTE_MERCHANT_RESPONSE_DAYS must be a positive integer');
  }

  return {
    NODE_ENV: config.NODE_ENV ?? 'development',
    PORT: port,
    DATABASE_URL: config.DATABASE_URL as string,
    JWT_SECRET: config.JWT_SECRET as string,
    JWT_EXPIRES_IN: config.JWT_EXPIRES_IN ?? '1h',
    DISPUTE_MERCHANT_RESPONSE_DAYS: disputeMerchantResponseDays,
  };
}
