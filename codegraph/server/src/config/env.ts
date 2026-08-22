import dotenv from 'dotenv';

dotenv.config();

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: integer(process.env.PORT, 5000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  fastApiUrl: process.env.FASTAPI_URL ?? 'http://localhost:8000',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
  githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:5000/auth/github/callback',
  redisUrl: process.env.REDIS_URL ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-5-mini',
});

export function validateEnvironment(): void {
  if (env.nodeEnv === 'production' && env.sessionSecret === 'dev-secret-change-me') {
    throw new Error('SESSION_SECRET must be configured in production');
  }
  if (env.nodeEnv === 'production' && !env.redisUrl) throw new Error('REDIS_URL must be configured in production');
}
