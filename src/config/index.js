import dotenv from 'dotenv';
dotenv.config();

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'INTERNAL_API_SECRET',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
  // LLM_* no son required — tienen defaults para Ollama local
  // OPENAI_API_KEY eliminado — se usa LLM_API_KEY ahora
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
  llm: {
    provider:    process.env.LLM_PROVIDER    || 'ollama',
    baseURL:     process.env.LLM_BASE_URL    || 'http://host.docker.internal:11434/v1',
    apiKey:      process.env.LLM_API_KEY     || 'ollama',
    model:       process.env.LLM_MODEL       || 'llama3.1:8b',
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    maxTokens:   parseInt(process.env.LLM_MAX_TOKENS    || '1024'),
  },
  api: {
    internalSecret:   process.env.INTERNAL_API_SECRET,
    jwtSecret:        process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    port:             process.env.PORT || 3001
  },
  log: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

export default config;