import dotenv from 'dotenv';

dotenv.config();

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'OPENAI_API_KEY',
  'INTERNAL_API_SECRET',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const config = {
  db: {
    url: process.env.DATABASE_URL
  },
  redis: {
    url: process.env.REDIS_URL
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  api: {
    internalSecret: process.env.INTERNAL_API_SECRET,
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    port: process.env.PORT || 3001
  },
  log: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

export default config;
