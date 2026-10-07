import type {Answer,Chunk,Check,Document,Version,TestCase} from './types';
export function normalize(text:string):string;
export function retrieve(documents:Document[],question:string,role:string,version:Version,fault?:string):Chunk[];
export function localAnswer(chunks:Chunk[]):Answer;
export function verifyAnswer(answer:unknown,chunks:Chunk[]):Answer;
export function evaluate(answer:Answer|null,chunks:Chunk[],test:TestCase|null,role:string,fault?:string):Check[];
export function modelAnswer(version:Version,question:string,chunks:Chunk[],config:{provider?:string;apiKey?:string;model?:string}):Promise<{answer:Answer;chunks:Chunk[];provider:string;model:string;inputTokens:number;outputTokens:number;cooldownMs:number}>;
