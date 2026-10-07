export type Mode = "demo" | "live";
export type RunStatus =
  "running" | "paused" | "waiting" | "completed" | "failed" | "cancelled";
export type Source = {
  id: string;
  name: string;
  content: string;
  url?: string;
  sha?: string;
  truncated?: boolean;
};
export type Finding = {
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  sourceIds: string[];
};
export type Check = { name: string; passed: boolean; detail: string };
export type Trace = {
  id: string;
  at: string;
  phase: number;
  agent: string;
  tool: string;
  summary: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  tokens: number;
};
export type Run = {
  id: string;
  title: string;
  objective: string;
  scenario: "architecture" | "security" | "repository" | "documents";
  mode: Mode;
  repository: string;
  document: string;
  status: RunStatus;
  cursor: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lockedUntil: number;
  sources: Source[];
  findings: Finding[];
  checks: Check[];
  traces: Trace[];
  report: string;
  inputTokens: number;
  outputTokens: number;
  model: string | null;
  provider?: "openai" | "groq";
  error: string | null;
};
export const PHASES = [
  {
    name: "Préparer",
    agent: "planner",
    tool: "mission.plan",
    description:
      "Définir le périmètre, les sources et les critères de réussite.",
  },
  {
    name: "Collecter",
    agent: "researcher",
    tool: "sources.read",
    description: "Lire les documents et conserver les preuves utilisées.",
  },
  {
    name: "Analyser",
    agent: "analyst",
    tool: "analysis.run",
    description: "Produire des constats reliés aux sources.",
  },
  {
    name: "Contrôler",
    agent: "reviewer",
    tool: "evidence.check",
    description: "Vérifier les références avant de continuer.",
  },
  {
    name: "Valider",
    agent: "reviewer",
    tool: "human.approve",
    description: "Attendre votre accord avant la rédaction finale.",
  },
  {
    name: "Rédiger",
    agent: "analyst",
    tool: "report.write",
    description: "Assembler un rapport téléchargeable à partir des constats.",
  },
  {
    name: "Évaluer",
    agent: "reviewer",
    tool: "evaluation.run",
    description:
      "Mesurer la couverture des preuves et la présence des livrables.",
  },
] as const;
export const AGENTS = [
  {
    id: "planner",
    name: "Strobi",
    role: "Architecte",
    color: "#879bff",
    avatar: "Strobi",
    description: "Cadre la mission et prépare le plan de travail.",
    tools: ["mission.plan"],
    animation: "thinking",
  },
  {
    id: "researcher",
    name: "Cactee",
    role: "Explorateur",
    color: "#97e1b5",
    avatar: "Cactee",
    description: "Collecte les sources et conserve leur provenance.",
    tools: ["sources.read", "github.read"],
    animation: "searching",
  },
  {
    id: "analyst",
    name: "Gemmy",
    role: "Analyste",
    color: "#c0a2ff",
    avatar: "Gemmy",
    description: "Analyse les preuves, puis rédige le livrable.",
    tools: ["analysis.run", "report.write"],
    animation: "working",
  },
  {
    id: "reviewer",
    name: "Beebo",
    role: "Contrôleur",
    color: "#ffb879",
    avatar: "Beebo",
    description: "Vérifie les références et attend votre validation.",
    tools: ["evidence.check", "human.approve", "evaluation.run"],
    animation: "listening",
  },
] as const;
export const STATUS_LABEL: Record<RunStatus, string> = {
  running: "En cours",
  paused: "En pause",
  waiting: "À valider",
  completed: "Terminée",
  failed: "Erreur",
  cancelled: "Annulée",
};
