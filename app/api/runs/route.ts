import { createInput, createRun, RuntimeError } from '@/lib/observatory/engine';
import { errorResponse, providerConfig, readPayload } from '@/lib/observatory/api';
import { listRuns, saveNewRun } from '@/lib/observatory/store';
export async function GET() { try{return Response.json({runs:await listRuns()},{headers:{'Cache-Control':'no-store'}});}catch(error){return errorResponse(error);} }
export async function POST(request: Request) {
  try { const parsed=createInput.safeParse(await readPayload(request));
    if(!parsed.success) throw new RuntimeError('Vérifiez la mission et le contenu des documents.');
    const run=createRun(parsed.data,Boolean(providerConfig().apiKey));await saveNewRun(run);return Response.json({run},{status:201});
  }catch(error){return errorResponse(error);}
}
