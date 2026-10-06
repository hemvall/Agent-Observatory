import { providerConfig } from '@/lib/observatory/api';
export function GET() { const config=providerConfig(); return Response.json({liveEnabled:Boolean(config.apiKey),model:config.model||'gpt-4.1-mini'}); }
