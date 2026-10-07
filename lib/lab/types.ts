export type Document = {
  id: string;
  title: string;
  text: string;
  access: "public" | "internal";
};
export type Version = {
  id: string;
  name: string;
  prompt: string;
  model: string;
  topK: number;
  minimumScore: number;
  maxTokens: number;
  avatars: Record<string, string>;
  createdAt: string;
};
export type TestCase = {
  id: string;
  name: string;
  question: string;
  role: "public" | "internal";
  fault: "none" | "empty_context" | "tool_failure" | "injection";
  expectedContains: string[];
  forbiddenContains: string[];
  expectedSources: string[];
  expectAbstain: boolean | null;
};
export type Project = {
  id: string;
  name: string;
  goal: string;
  documents: Document[];
  versions: Version[];
  tests: TestCase[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type Chunk = {
  id: string;
  documentId: string;
  title: string;
  text: string;
  access: "public" | "internal";
  score: number;
  startLine: number;
};
export type Answer = {
  answer: string;
  abstained: boolean;
  citations: { chunkId: string; quote: string }[];
};
export type Check = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};
export type Event = {
  id: string;
  phase: number;
  agent: string;
  tool: string;
  summary: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  tokens: number;
  at: string;
};
export type Job = {
  id: string;
  versionId: string;
  caseId: string | null;
  question: string;
  role: "public" | "internal";
  fault: TestCase["fault"];
  phase: number;
  status: "queued" | "running" | "completed" | "failed";
  chunks: Chunk[];
  answer: Answer | null;
  checks: Check[];
  events: Event[];
  error: string | null;
  retries: number;
  nextAttemptAt: number;
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};
export type Experiment = {
  id: string;
  projectId: string;
  snapshot: Project;
  mode: "live" | "local";
  kind: "playground" | "evaluation";
  jobs: Job[];
  cursor: number;
  status: "running" | "paused" | "completed" | "cancelled";
  revision: number;
  lockedUntil: number;
  nextAllowedAt: number;
  createdAt: string;
  updatedAt: string;
};
