"use client";
import { useEffect, useRef, useState } from "react";
import {
  Orbit,
  Plus,
  FlaskConical,
  Layers3,
  Play,
  Pause,
  Square,
  GitCompareArrows,
  FileText,
  Folder,
  Download,
  Check,
  ChevronRight,
  X,
  Loader2,
  LockKeyhole,
  TriangleAlert,
  Search,
  Settings2,
  Copy,
  Trash2,
  Save,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { AgentAvatar, AVATAR_NAMES } from "@/components/agent-avatar";
import type {
  Project,
  Version,
  Experiment,
  Job,
  TestCase,
  Chunk,
} from "@/lib/lab/types";
type Summary = {
  id: string;
  name: string;
  updatedAt: string;
  documents: number;
  versions: number;
  tests: number;
};
type History = {
  id: string;
  status: Experiment["status"];
  kind: Experiment["kind"];
  mode: Experiment["mode"];
  createdAt: string;
  jobs: number;
  finished: number;
};
type Tab = "build" | "play" | "evaluate" | "compare";
const ROLES = [
  {
    id: "planner",
    name: "Mission",
    animation: "thinking",
    tool: "mission.plan",
    description: "Fixe la question et la version utilisée.",
  },
  {
    id: "researcher",
    name: "Recherche",
    animation: "searching",
    tool: "knowledge.search",
    description: "Recherche les passages autorisés dans tes documents.",
  },
  {
    id: "analyst",
    name: "Réponse",
    animation: "working",
    tool: "model.answer",
    description:
      "Génère une réponse étayée, ou extrait les passages en mode local.",
  },
  {
    id: "reviewer",
    name: "Contrôles",
    animation: "listening",
    tool: "criteria.evaluate",
    description: "Vérifie les citations et les critères de tes tests.",
  },
];
const TABS = [
  { id: "build" as const, label: "Atelier", icon: Layers3 },
  { id: "play" as const, label: "Tester", icon: Play },
  { id: "evaluate" as const, label: "Évaluer", icon: FlaskConical },
  { id: "compare" as const, label: "Comparer", icon: GitCompareArrows },
];
const faultNames = {
  none: "Conditions normales",
  empty_context: "Aucun passage disponible",
  tool_failure: "Panne de recherche simulée",
  injection: "Injection dans le contexte",
};
async function api(path: string, body?: unknown, method = "POST") {
  const res = await fetch(path, {
    cache: "no-store",
    ...(body
      ? {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = (await res.json()) as {
    projects: Summary[];
    project: Project;
    experiment: Experiment;
    experiments: History[];
    liveEnabled: boolean;
    provider: string;
    model: string;
    error?: string;
  };
  if (!res.ok)
    throw Object.assign(
      new Error(data.error || "Le serveur est indisponible."),
      { status: res.status },
    );
  return data;
}
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Inspect({
  title,
  value,
  onClose,
}: {
  title: string;
  value: unknown;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="wl-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="wl-icon"
          autoFocus
          onClick={onClose}
          aria-label="Fermer"
        >
          <X size={20} />
        </button>
      </header>
      <pre>
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </dialog>
  );
}
function Agents({
  version,
  job,
  busy,
  paused,
  onAgent,
}: {
  version: Version;
  job?: Job;
  busy: boolean;
  paused: boolean;
  onAgent: (id: string) => void;
}) {
  return (
    <div className="wl-agents" aria-label="Les agents du workflow">
      {ROLES.map((role, i) => {
        const active = job?.phase === i && job.status === "running",
          done = job?.phase !== undefined && job.phase > i;
        const animation = paused
          ? "sleeping"
          : job?.status === "failed" && job.phase === i
            ? "confused"
            : job?.status === "completed"
              ? "happy"
              : active && busy
                ? role.animation
                : "idle";
        return (
          <button
            className={`wl-agent ${active && busy ? "working" : ""} ${done ? "done" : ""}`}
            key={role.id}
            onClick={() => onAgent(role.id)}
          >
            <div className="wl-character">
              <AgentAvatar
                name={
                  version.avatars[role.id] ||
                  ["Strobi", "Cactee", "Gemmy", "Beebo"][i]
                }
                animation={animation}
                size={112}
                lively
              />
            </div>
            <strong>{role.name}</strong>
            <span>
              {paused
                ? "En pause"
                : job?.status === "failed" && job.phase === i
                  ? "Interrompu"
                  : done
                    ? "Étape enregistrée"
                    : active && busy
                      ? "En activité"
                      : role.id === "analyst" &&
                          job?.nextAttemptAt &&
                          job.nextAttemptAt > Date.now()
                        ? "Attente du quota"
                        : "Disponible"}
            </span>
            {i < 3 && <ChevronRight className="wl-link" size={20} />}
          </button>
        );
      })}
    </div>
  );
}
function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return until > now ? (
    <p className="wl-wait" role="timer">
      <Loader2 size={16} className="spin" />
      Quota : prochaine tentative dans {Math.ceil((until - now) / 1000)} s.
    </p>
  ) : null;
}
function Outcome({
  job,
  onInspect,
  onTest,
}: {
  job: Job;
  onInspect: (title: string, value: unknown) => void;
  onTest: () => void;
}) {
  return (
    <section className="wl-outcome" id="wl-play-result" tabIndex={-1}>
      <div className="wl-section-head">
        <h2>
          {job.status === "failed"
            ? "Exécution interrompue"
            : job.answer
              ? "Réponse obtenue"
              : "L’exécution est en cours"}
        </h2>
        {job.answer && (
          <span className="wl-tag">
            {job.provider === "local"
              ? "Extraction sans IA"
              : job.provider === "aucun"
                ? "Aucun modèle appelé"
                : `${job.provider} · ${job.model}`}
          </span>
        )}
      </div>
      {job.error ? (
        <p className="wl-error">{job.error}</p>
      ) : job.answer ? (
        <>
          <p className="wl-answer">{job.answer.answer}</p>
          <div className="wl-citations">
            {job.answer.citations.map((cite, i) => {
              const chunk = job.chunks.find((c) => c.id === cite.chunkId);
              return (
                <button
                  key={i}
                  onClick={() =>
                    onInspect(chunk?.title || "Preuve", {
                      source: chunk?.title,
                      ligne: chunk?.startLine,
                      extrait: cite.quote,
                      passage: chunk?.text,
                    })
                  }
                >
                  <FileText size={14} />
                  {chunk?.title || cite.chunkId}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="wl-muted">
          Les sorties de chaque étape apparaissent dans le journal ci-dessous.
        </p>
      )}
      {job.checks.length > 0 && (
        <div className="wl-checks">
          {job.checks.map((c) => (
            <span
              key={c.id}
              className={c.passed ? "pass" : "fail"}
              title={c.detail}
            >
              {c.passed ? <Check size={15} /> : <X size={15} />} {c.label}
              <small>{c.detail}</small>
            </span>
          ))}
        </div>
      )}
      <div className="wl-outcome-foot">
        <span>
          {job.inputTokens + job.outputTokens} tokens mesurés ·{" "}
          {(job.durationMs / 1000).toFixed(1)} s d’exécution des outils
        </span>
        {["failed", "completed"].includes(job.status) && (
          <button className="wl-btn quiet" onClick={onTest}>
            <Plus size={15} /> Transformer en test
          </button>
        )}
      </div>
      <details className="wl-trace">
        <summary>Journal d’exécution · {job.events.length} événements</summary>
        {job.events.map((event) => (
          <button key={event.id} onClick={() => onInspect(event.tool, event)}>
            <Check size={15} />
            <strong>{event.tool}</strong>
            <span>{event.summary}</span>
          </button>
        ))}
        {!job.events.length && <p>Aucune étape exécutée.</p>}
      </details>
    </section>
  );
}
function TestEditor({
  initial,
  documents,
  onSave,
  onClose,
  error,
}: {
  initial: TestCase;
  error: string;
  documents: Project["documents"];
  onSave: (t: TestCase) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial),
    [words, setWords] = useState(initial.expectedContains.join("; ")),
    [forbidden, setForbidden] = useState(initial.forbiddenContains.join("; "));
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="wl-dialog wl-test-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>Définir un test</h2>
        <button className="wl-icon" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
      </header>
      {error && (
        <p className="wl-error" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...value,
            expectedContains: words
              .split(";")
              .map((x) => x.trim())
              .filter(Boolean),
            forbiddenContains: forbidden
              .split(";")
              .map((x) => x.trim())
              .filter(Boolean),
          });
        }}
      >
        <label>
          Nom
          <input
            value={value.name}
            required
            maxLength={100}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
          />
        </label>
        <label>
          Question
          <textarea
            value={value.question}
            required
            minLength={5}
            maxLength={1000}
            rows={3}
            onChange={(e) => setValue({ ...value, question: e.target.value })}
          />
        </label>
        <div className="wl-two">
          <label>
            Accès simulé
            <select
              value={value.role}
              onChange={(e) =>
                setValue({ ...value, role: e.target.value as TestCase["role"] })
              }
            >
              <option value="public">Public</option>
              <option value="internal">Interne</option>
            </select>
          </label>
          <label>
            Scénario
            <select
              value={value.fault}
              onChange={(e) =>
                setValue({
                  ...value,
                  fault: e.target.value as TestCase["fault"],
                })
              }
            >
              {Object.entries(faultNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Comportement attendu
          <select
            value={
              value.expectAbstain === null
                ? "any"
                : value.expectAbstain
                  ? "abstain"
                  : "answer"
            }
            onChange={(e) =>
              setValue({
                ...value,
                expectAbstain:
                  e.target.value === "any"
                    ? null
                    : e.target.value === "abstain",
              })
            }
          >
            <option value="answer">Répondre avec des preuves</option>
            <option value="abstain">Signaler qu’il ne peut pas répondre</option>
            <option value="any">Vérifier uniquement mes autres critères</option>
          </select>
        </label>
        <label>
          Expressions à retrouver
          <input
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="30 jours; 7 jours"
            maxLength={1200}
          />
          <small>
            Sépare les expressions par un point-virgule. Ce sont des contrôles
            textuels, pas un jugement sémantique.
          </small>
        </label>
        <label>
          Expressions interdites
          <input
            value={forbidden}
            onChange={(e) => setForbidden(e.target.value)}
            placeholder="information confidentielle"
            maxLength={1200}
          />
        </label>
        <fieldset>
          <legend>Sources qui doivent être citées</legend>
          {documents.map((doc) => (
            <label className="wl-checkbox" key={doc.id}>
              <input
                type="checkbox"
                checked={value.expectedSources.includes(doc.id)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    expectedSources: e.target.checked
                      ? [...value.expectedSources, doc.id]
                      : value.expectedSources.filter((id) => id !== doc.id),
                  })
                }
              />
              {doc.title}
            </label>
          ))}
        </fieldset>
        <button className="wl-btn primary">
          <Save size={16} /> Enregistrer le test
        </button>
      </form>
    </dialog>
  );
}
export default function WorkLab() {
  const [projects, setProjects] = useState<Summary[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [draft, setDraft] = useState<Project | null>(null),
    [versionId, setVersionId] = useState(""),
    [versionDraft, setVersionDraft] = useState<Version | null>(null),
    [tab, setTab] = useState<Tab>("build"),
    [selectedAgent, setSelectedAgent] = useState("analyst"),
    [docId, setDocId] = useState(""),
    [history, setHistory] = useState<History[]>([]),
    [exp, setExp] = useState<Experiment | null>(null),
    [jobId, setJobId] = useState(""),
    [mode, setMode] = useState<"live" | "local">("local"),
    [config, setConfig] = useState<{
      liveEnabled: boolean;
      provider: string;
      model: string;
    }>({ liveEnabled: false, provider: "groq", model: "" }),
    [question, setQuestion] = useState(
      "Quel est le délai de résiliation du contrat ?",
    ),
    [role, setRole] = useState<"public" | "internal">("public"),
    [fault, setFault] = useState<TestCase["fault"]>("none"),
    [caseIds, setCaseIds] = useState<string[]>([]),
    [compareA, setCompareA] = useState(""),
    [compareB, setCompareB] = useState(""),
    [busy, setBusy] = useState(false),
    [stepping, setStepping] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [offline, setOffline] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [newName, setNewName] = useState(""),
    [showCreate, setShowCreate] = useState(false),
    [inspect, setInspect] = useState<{ title: string; value: unknown } | null>(
      null,
    ),
    [testEditor, setTestEditor] = useState<TestCase | null>(null);
  const selectedProject = useRef<string | null>(null),
    selectedExperiment = useRef<string | null>(null),
    navigation = useRef(0),
    inFlight = useRef(new Set<string>());
  const savedVersion =
    project?.versions.find((v) => v.id === versionId) ||
    project?.versions.at(-1);
  const projectDirty =
      !!project && !!draft && JSON.stringify(project) !== JSON.stringify(draft),
    versionDirty =
      !!savedVersion &&
      !!versionDraft &&
      JSON.stringify(savedVersion) !== JSON.stringify(versionDraft),
    dirty = projectDirty || versionDirty;
  const currentJob =
    exp?.jobs.find((j) => j.id === jobId) ||
    exp?.jobs[exp.cursor] ||
    exp?.jobs.at(-1);
  const shownVersion =
    exp?.snapshot.versions.find((v) => v.id === currentJob?.versionId) ||
    savedVersion;
  function receive(e: Experiment) {
    if (selectedExperiment.current === e.id)
      setExp((old) =>
        old?.id === e.id && old.revision >= e.revision ? old : e,
      );
  }
  async function refreshProjects() {
    setProjects((await api("/api/lab/projects")).projects);
  }
  async function refreshHistory(id: string) {
    const data = await api("/api/lab/experiments?project=" + id);
    if (selectedProject.current === id) setHistory(data.experiments);
  }
  function adopt(p: Project) {
    setProject(p);
    setDraft(structuredClone(p));
    const v = p.versions.at(-1)!;
    setVersionId(v.id);
    setVersionDraft(structuredClone(v));
    setDocId(p.documents[0]?.id || "");
    setCaseIds(p.tests.slice(0, 12).map((t) => t.id));
    setCompareA(p.versions[0].id);
    setCompareB(p.versions.length > 1 ? v.id : "");
  }
  async function openProject(id: string, initial = false) {
    if (dirty && !initial) {
      setError(
        "Enregistre ou abandonne tes modifications avant de changer de projet.",
      );
      return;
    }
    const stamp = ++navigation.current;
    selectedProject.current = id;
    selectedExperiment.current = null;
    setExp(null);
    setJobId("");
    setLoading(true);
    setError("");
    setOffline(false);
    try {
      const { project: p } = await api("/api/lab/projects/" + id);
      if (stamp !== navigation.current) return;
      adopt(p);
      setTab("build");
      window.history.replaceState(null, "", "?project=" + id);
      await refreshHistory(id);
    } catch (e) {
      if (stamp === navigation.current) setError((e as Error).message);
    } finally {
      if (stamp === navigation.current) setLoading(false);
    }
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [list, c] = await Promise.all([
          api("/api/lab/projects"),
          api("/api/config"),
        ]);
        if (!alive) return;
        setProjects(list.projects);
        setConfig(c);
        setMode(c.liveEnabled ? "live" : "local");
        const id =
          new URLSearchParams(location.search).get("project") ||
          list.projects[0]?.id;
        if (id) await openProject(id, true);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!exp || !["running", "paused"].includes(exp.status)) return;
    const id = exp.id;
    let active = true;
    const timer = setInterval(() => {
      void api("/api/lab/experiments/" + id)
        .then((data) => {
          if (active) {
            receive(data.experiment);
            setOffline(false);
          }
        })
        .catch(() => {
          if (active) setOffline(true);
        });
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [exp?.id, exp?.status]);
  useEffect(() => {
    if (
      !exp ||
      exp.status !== "running" ||
      offline ||
      inFlight.current.has(exp.id)
    )
      return;
    const job = exp.jobs[exp.cursor];
    if (!job) return;
    const until =
      job.phase === 2 ? Math.max(job.nextAttemptAt, exp.nextAllowedAt) : 0;
    const timer = setTimeout(
      () => void action("advance", exp.id),
      Math.max(
        1000,
        exp.lockedUntil - Date.now() + 100,
        until - Date.now() + 100,
      ),
    );
    return () => clearTimeout(timer);
  }, [
    exp?.id,
    exp?.revision,
    exp?.status,
    exp?.lockedUntil,
    exp?.nextAllowedAt,
    offline,
  ]);
  useEffect(() => {
    if (
      tab === "play" &&
      exp?.kind === "playground" &&
      exp.status === "completed"
    ) {
      const frame = requestAnimationFrame(() => {
        const result = document.getElementById("wl-play-result");
        result?.focus({ preventScroll: true });
        if (window.matchMedia("(max-width:760px)").matches)
          result?.scrollIntoView({ block: "start", behavior: "instant" });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [exp?.id, exp?.status, tab]);
  async function action(name: string, id = exp?.id) {
    if (
      !id ||
      selectedExperiment.current !== id ||
      (name === "advance" && inFlight.current.has(id))
    )
      return;
    if (name === "advance") {
      inFlight.current.add(id);
      setStepping(id);
    } else setBusy(true);
    try {
      const data = await api("/api/lab/experiments/" + id, { action: name });
      receive(data.experiment);
      if (selectedProject.current)
        void refreshHistory(selectedProject.current).catch(() => {});
    } catch (e) {
      if (selectedExperiment.current === id) {
        if ((e as { status?: number }).status !== 409)
          setError((e as Error).message);
        try {
          receive((await api("/api/lab/experiments/" + id)).experiment);
        } catch {
          setOffline(true);
        }
      }
    } finally {
      if (name === "advance") {
        inFlight.current.delete(id);
        setStepping((previous) => (previous === id ? null : previous));
      } else setBusy(false);
    }
  }
  async function create(template = false) {
    if (dirty) {
      setError(
        "Enregistre ou abandonne tes modifications avant de créer un projet.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { project: p } = await api("/api/lab/projects", {
        name: template
          ? "Assistant contrats"
          : newName.trim() || "Nouveau projet",
        template,
      });
      await refreshProjects();
      setShowCreate(false);
      setNewName("");
      await openProject(p.id, true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(next = draft, forceVersion = false) {
    if (!project || !next || !versionDraft) return;
    setBusy(true);
    setError("");
    try {
      const version =
        versionDirty || forceVersion
          ? {
              ...versionDraft,
              id: crypto.randomUUID(),
              name: "V" + (project.versions.length + 1),
              createdAt: new Date().toISOString(),
            }
          : null;
      const body = {
        ...next,
        revision: project.revision,
        versions: version ? [...project.versions, version] : project.versions,
      };
      const { project: p } = await api(
        "/api/lab/projects/" + project.id,
        body,
        "PUT",
      );
      if (selectedProject.current !== p.id) return;
      setProject(p);
      setDraft(structuredClone(p));
      if (version) {
        setVersionId(version.id);
        setVersionDraft(structuredClone(version));
        setCompareB(version.id);
      }
      setCaseIds(p.tests.slice(0, 12).map((t: TestCase) => t.id));
      setNotice(
        version
          ? `${version.name} enregistrée. Les versions précédentes restent figées.`
          : "Projet sauvegardé.",
      );
      await refreshProjects();
      return p;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start(kind: "playground" | "evaluation", compare = false) {
    if (!project || dirty) {
      setError("Enregistre les modifications avant de lancer une expérience.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const versions = compare ? [compareA, compareB] : [versionId];
      const { experiment: e } = await api("/api/lab/experiments", {
        projectId: project.id,
        versionIds: versions,
        mode,
        kind,
        question,
        role,
        fault,
        caseIds: kind === "evaluation" ? caseIds : [],
      });
      if (e.projectId !== selectedProject.current) return;
      selectedExperiment.current = e.id;
      setExp(e);
      setJobId("");
      await refreshHistory(project.id);
      if (compare) setTab("compare");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openExperiment(id: string) {
    const stamp = ++navigation.current;
    setBusy(true);
    setError("");
    try {
      const { experiment: e } = await api("/api/lab/experiments/" + id);
      if (
        stamp !== navigation.current ||
        e.projectId !== selectedProject.current
      )
        return;
      selectedExperiment.current = id;
      setMode(e.mode);
      if (e.kind === "playground") {
        const job = e.jobs[0];
        setQuestion(job.question);
        setRole(job.role);
        setFault(job.fault);
      }
      setExp(e);
      setJobId("");
      setTab(
        e.kind === "playground"
          ? "play"
          : new Set(e.jobs.map((j: Job) => j.versionId)).size > 1
            ? "compare"
            : "evaluate",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function selectVersion(id: string) {
    if (versionDirty) {
      setError(
        "Enregistre ou abandonne la configuration modifiée avant de changer de version.",
      );
      return;
    }
    const v = project?.versions.find((x) => x.id === id);
    if (v) {
      setVersionId(id);
      setVersionDraft(structuredClone(v));
    }
  }
  function changeDocument(change: Partial<Project["documents"][number]>) {
    if (!draft) return;
    setDraft({
      ...draft,
      documents: draft.documents.map((d) =>
        d.id === docId ? { ...d, ...change } : d,
      ),
    });
  }
  function addDocument(title = "Nouveau document", text = "") {
    if (!draft) return;
    const id = crypto.randomUUID();
    setDraft({
      ...draft,
      documents: [...draft.documents, { id, title, text, access: "public" }],
    });
    setDocId(id);
  }
  function blankTest(job?: Job): TestCase {
    return {
      id: crypto.randomUUID(),
      name: job ? "Cas à corriger" : "Nouveau test",
      question: job?.question || "",
      role: job?.role || "public",
      fault: job?.fault || "none",
      expectedContains: [],
      forbiddenContains: [],
      expectedSources: [],
      expectAbstain: false,
    };
  }
  async function saveTest(test: TestCase) {
    if (!draft) return;
    const next = {
      ...draft,
      tests: draft.tests.some((t) => t.id === test.id)
        ? draft.tests.map((t) => (t.id === test.id ? test : t))
        : [...draft.tests, test],
    };
    const p = await save(next);
    if (p) {
      setTestEditor(null);
      setTab("evaluate");
    }
  }
  const selectedDocument = draft?.documents.find((d) => d.id === docId);
  const models =
    config.provider === "groq"
      ? ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]
      : ["gpt-4.1-mini"];
  return (
    <div className="work-lab">
      <aside className="wl-sidebar">
        <a className="wl-brand" href="/">
          <Orbit size={24} />
          <span>
            Agent Observatory<small>WORK LAB</small>
          </span>
        </a>
        <button
          className="wl-btn primary"
          disabled={busy}
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={17} /> Nouveau projet
        </button>
        {showCreate && (
          <form
            className="wl-create"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <input
              aria-label="Nom du projet"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom du projet"
              maxLength={100}
            />
            <button className="wl-btn quiet" disabled={busy}>
              Créer
            </button>
          </form>
        )}
        <label className="wl-search">
          <Search size={15} />
          <input
            aria-label="Rechercher un projet"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <nav className="wl-projects" aria-label="Projets">
          {projects
            .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
            .map((p) => (
              <button
                key={p.id}
                aria-current={p.id === project?.id ? "page" : undefined}
                onClick={() => void openProject(p.id)}
              >
                <Folder size={17} />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.versions} version{p.versions > 1 ? "s" : ""} · {p.tests}{" "}
                    tests
                  </small>
                </span>
              </button>
            ))}
        </nav>
        <div className="wl-side-bottom">
          <a href="/analyses">
            <FileText size={16} /> Analyses précédentes
          </a>
          <a
            href="https://github.com/hemvall/Agent-Observatory"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} /> Code du projet
          </a>
          <a href="/api/source">Source AGPL-3.0</a>
        </div>
      </aside>
      <main className="wl-main">
        {error && (
          <div className="wl-banner error" role="alert">
            <TriangleAlert size={18} />
            <span>{error}</span>
            <button
              className="wl-icon"
              aria-label="Fermer"
              onClick={() => setError("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {notice && (
          <div className="wl-banner" role="status">
            <Check size={17} />
            <span>{notice}</span>
            <button
              className="wl-icon"
              aria-label="Fermer"
              onClick={() => setNotice("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {offline && (
          <p className="wl-banner error">
            Connexion interrompue. L’exécution reprendra après reconnexion.
          </p>
        )}
        {loading ? (
          <div className="wl-empty">
            <Loader2 className="spin" size={25} />
            <p>Ouverture du Lab…</p>
          </div>
        ) : !project || !draft || !versionDraft ? (
          <section className="wl-welcome">
            <span className="wl-tag">AI WORK LAB</span>
            <h1>
              Construis ton assistant.
              <br />
              Vérifie son comportement.
            </h1>
            <p>
              Configure ses documents et ses agents, inspecte ses réponses, puis
              compare tes versions sur les mêmes tests.
            </p>
            <div className="wl-starters">
              <button onClick={() => void create(true)} disabled={busy}>
                <div className="wl-starter-avatars">
                  <AgentAvatar
                    name="Cactee"
                    size={90}
                    lively
                    animation="curious"
                  />
                  <AgentAvatar name="Gemmy" size={90} lively animation="idle" />
                </div>
                <h2>Essayer l’assistant de contrats</h2>
                <p>
                  3 documents fictifs, 3 tests et une version prête à explorer.
                </p>
                <span>
                  Ouvrir l’exemple <ChevronRight size={16} />
                </span>
              </button>
              <button onClick={() => setShowCreate(true)}>
                <Plus size={35} />
                <h2>Partir de ton besoin</h2>
                <p>Ajoute tes documents et définis les réponses attendues.</p>
                <span>
                  Créer un projet <ChevronRight size={16} />
                </span>
              </button>
            </div>
            <small>
              Sans clé, la lecture locale extrait les passages. Avec Groq
              configuré côté serveur, le modèle rédige les réponses.
            </small>
          </section>
        ) : (
          <>
            <header className="wl-header">
              <div>
                <div className="wl-breadcrumb">
                  Projets <ChevronRight size={14} />
                  {project.name}
                </div>
                <h1>{project.name}</h1>
              </div>
              <div className="wl-header-actions">
                <select
                  aria-label="Version active"
                  value={versionId}
                  onChange={(e) => selectVersion(e.target.value)}
                >
                  {project.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {dirty && (
                  <>
                    <button
                      className="wl-btn quiet"
                      onClick={() => {
                        setDraft(structuredClone(project));
                        setVersionDraft(structuredClone(savedVersion!));
                      }}
                    >
                      Abandonner
                    </button>
                    <button
                      className="wl-btn primary"
                      disabled={busy}
                      onClick={() => void save()}
                    >
                      <Save size={16} />
                      {versionDirty
                        ? `Enregistrer V${project.versions.length + 1}`
                        : "Enregistrer"}
                    </button>
                  </>
                )}
                <a
                  className={`wl-btn quiet ${dirty ? "disabled" : ""}`}
                  href={
                    dirty
                      ? undefined
                      : `/api/lab/projects/${project.id}/export?version=${versionId}`
                  }
                  aria-disabled={dirty}
                >
                  <Download size={16} /> Exporter l’assistant
                </a>
              </div>
            </header>
            <nav className="wl-tabs" aria-label="Espace de travail">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  aria-current={tab === t.id ? "page" : undefined}
                  onClick={() => setTab(t.id)}
                >
                  <t.icon size={17} />
                  {t.label}
                </button>
              ))}
            </nav>
            {dirty && (
              <p className="wl-draft-notice">
                Modifications non enregistrées. Les expériences utilisent
                uniquement la dernière configuration sauvegardée.
              </p>
            )}
            {tab === "build" ? (
              <div className="wl-builder">
                <section className="wl-card wl-corpus">
                  <div className="wl-section-head">
                    <h2>
                      <FileText size={18} /> Documents
                    </h2>
                    <button
                      className="wl-icon"
                      disabled={draft.documents.length >= 12}
                      onClick={() => addDocument()}
                      aria-label="Ajouter un document"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="wl-document-list">
                    {draft.documents.map((d) => (
                      <button
                        key={d.id}
                        className={d.id === docId ? "selected" : ""}
                        onClick={() => setDocId(d.id)}
                      >
                        {d.access === "internal" ? (
                          <LockKeyhole size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                        <span>{d.title}</span>
                      </button>
                    ))}
                  </div>
                  {selectedDocument ? (
                    <>
                      <label>
                        Titre
                        <input
                          value={selectedDocument.title}
                          maxLength={150}
                          onChange={(e) =>
                            changeDocument({ title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Accès
                        <select
                          value={selectedDocument.access}
                          onChange={(e) =>
                            changeDocument({
                              access: e.target.value as "public" | "internal",
                            })
                          }
                        >
                          <option value="public">Public</option>
                          <option value="internal">Interne</option>
                        </select>
                      </label>
                      <label>
                        Contenu
                        <textarea
                          rows={11}
                          value={selectedDocument.text}
                          maxLength={20000}
                          onChange={(e) =>
                            changeDocument({ text: e.target.value })
                          }
                          placeholder="Colle le texte qui servira de référence à l’assistant."
                        />
                      </label>
                      <div className="wl-corpus-foot">
                        <small>
                          {draft.documents
                            .reduce((n, d) => n + d.text.length, 0)
                            .toLocaleString("fr")}{" "}
                          / 60 000 caractères
                        </small>
                        <button
                          className="wl-icon"
                          aria-label="Supprimer ce document"
                          onClick={() => {
                            if (
                              draft.tests.some((t) =>
                                t.expectedSources.includes(docId),
                              )
                            ) {
                              setError(
                                "Ce document est utilisé comme preuve attendue dans un test. Modifie ce critère avant de le supprimer.",
                              );
                              return;
                            }
                            setDraft({
                              ...draft,
                              documents: draft.documents.filter(
                                (d) => d.id !== docId,
                              ),
                            });
                            setDocId(
                              draft.documents.find((d) => d.id !== docId)?.id ||
                                "",
                            );
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="wl-small-empty">
                      <FileText size={30} />
                      <p>Ajoute les textes que ton assistant devra utiliser.</p>
                    </div>
                  )}
                  <label className="wl-import">
                    <Plus size={15} /> Importer un texte .txt ou .md
                    <input
                      type="file"
                      accept=".txt,.md"
                      disabled={draft.documents.length >= 12}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 60000) {
                          setError("Le fichier doit faire moins de 60 Ko.");
                          return;
                        }
                        const text = await file.text();
                        if (text.length > 20000) {
                          setError(
                            "Un document est limité à 20 000 caractères.",
                          );
                          return;
                        }
                        addDocument(file.name, text);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <small>
                    Les accès sont des rôles de test. La recherche filtre les
                    documents avant de les envoyer au modèle.
                  </small>
                </section>
                <div className="wl-configuration">
                  <section className="wl-card">
                    <div className="wl-section-head">
                      <h2>
                        <Layers3 size={18} /> Ton workflow documentaire
                      </h2>
                      <span className="wl-tag">4 étapes</span>
                    </div>
                    <Agents
                      version={versionDraft}
                      busy={false}
                      paused={false}
                      onAgent={setSelectedAgent}
                    />
                    <div className="wl-agent-editor">
                      <div>
                        <strong>
                          {ROLES.find((a) => a.id === selectedAgent)?.name}
                        </strong>
                        <p>
                          {
                            ROLES.find((a) => a.id === selectedAgent)
                              ?.description
                          }
                        </p>
                      </div>
                      <label>
                        Personnage
                        <select
                          value={versionDraft.avatars[selectedAgent]}
                          onChange={(e) =>
                            setVersionDraft({
                              ...versionDraft,
                              avatars: {
                                ...versionDraft.avatars,
                                [selectedAgent]: e.target.value,
                              },
                            })
                          }
                        >
                          {AVATAR_NAMES.map((name) => (
                            <option key={name}>{name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>
                  <section className="wl-card">
                    <div className="wl-section-head">
                      <h2>
                        <Settings2 size={18} /> Configuration de{" "}
                        {savedVersion?.name}
                      </h2>
                      <span className="wl-tag">Version figée</span>
                    </div>
                    <label>
                      Consignes de réponse
                      <textarea
                        rows={4}
                        value={versionDraft.prompt}
                        maxLength={2000}
                        onChange={(e) =>
                          setVersionDraft({
                            ...versionDraft,
                            prompt: e.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="wl-two">
                      <label>
                        Modèle
                        <select
                          value={versionDraft.model}
                          onChange={(e) =>
                            setVersionDraft({
                              ...versionDraft,
                              model: e.target.value,
                            })
                          }
                        >
                          <option value="">Modèle du serveur</option>
                          {models.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Passages récupérés
                        <select
                          value={versionDraft.topK}
                          onChange={(e) =>
                            setVersionDraft({
                              ...versionDraft,
                              topK: Number(e.target.value),
                            })
                          }
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} passage{n > 1 ? "s" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <details className="wl-advanced">
                      <summary>Limites et réglages de recherche</summary>
                      <div className="wl-two">
                        <label>
                          Seuil de correspondance
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.05}
                            value={versionDraft.minimumScore}
                            onChange={(e) =>
                              setVersionDraft({
                                ...versionDraft,
                                minimumScore: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Tokens de sortie maximum
                          <input
                            type="number"
                            min={400}
                            max={1800}
                            step={100}
                            value={versionDraft.maxTokens}
                            onChange={(e) =>
                              setVersionDraft({
                                ...versionDraft,
                                maxTokens: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </div>
                      <p>
                        Recherche lexicale, sans embeddings. Le modèle doit
                        citer des extraits exacts ; sans contexte autorisé, le
                        workflow s’abstient sans appel IA.
                      </p>
                    </details>
                    <div className="wl-config-actions">
                      <button
                        className="wl-btn primary"
                        disabled={busy || !dirty}
                        onClick={() => void save()}
                      >
                        <Save size={16} /> Enregistrer{" "}
                        {versionDirty
                          ? `V${project.versions.length + 1}`
                          : "le projet"}
                      </button>
                      <button
                        className="wl-btn quiet"
                        disabled={
                          busy || dirty || project.versions.length >= 12
                        }
                        onClick={() => void save(draft, true)}
                      >
                        <Copy size={16} /> Dupliquer {savedVersion?.name}
                      </button>
                      <button
                        className="wl-btn quiet"
                        onClick={() => setTab("play")}
                      >
                        Tester la version <ChevronRight size={16} />
                      </button>
                    </div>
                  </section>
                  <section className="wl-card wl-project-settings">
                    <label>
                      Nom du projet
                      <input
                        value={draft.name}
                        maxLength={100}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Objectif
                      <textarea
                        rows={2}
                        value={draft.goal}
                        maxLength={1000}
                        onChange={(e) =>
                          setDraft({ ...draft, goal: e.target.value })
                        }
                        placeholder="Ce que l’assistant doit permettre de faire"
                      />
                    </label>
                  </section>
                </div>
              </div>
            ) : (
              <>
                <div className="wl-run-toolbar">
                  <label>
                    Exécution
                    <select
                      value={mode}
                      onChange={(e) =>
                        setMode(e.target.value as "live" | "local")
                      }
                    >
                      <option value="local">Lecture locale · sans IA</option>
                      <option value="live" disabled={!config.liveEnabled}>
                        IA · {config.provider === "groq" ? "Groq" : "OpenAI"}
                        {!config.liveEnabled ? " non configuré" : ""}
                      </option>
                    </select>
                  </label>
                  <label>
                    Expériences sauvegardées
                    <select
                      value={exp?.id || ""}
                      onChange={(e) =>
                        e.target.value && void openExperiment(e.target.value)
                      }
                    >
                      <option value="">Choisir une expérience</option>
                      {history.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.kind === "evaluation" ? "Évaluation" : "Question"}{" "}
                          ·{" "}
                          {new Date(h.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {h.finished}/{h.jobs} ·{" "}
                          {h.mode === "local" ? "sans IA" : "IA"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {exp && ["running", "paused"].includes(exp.status) && (
                    <div className="wl-run-actions">
                      <button
                        className="wl-btn quiet"
                        disabled={busy}
                        onClick={() =>
                          void action(
                            exp.status === "paused" ? "resume" : "pause",
                          )
                        }
                      >
                        {exp.status === "paused" ? (
                          <Play size={16} />
                        ) : (
                          <Pause size={16} />
                        )}{" "}
                        {exp.status === "paused" ? "Reprendre" : "Pause"}
                      </button>
                      <button
                        className="wl-icon"
                        disabled={busy}
                        aria-label="Arrêter l’expérience"
                        onClick={() => void action("cancel")}
                      >
                        <Square size={16} />
                      </button>
                      <span>
                        {Math.min(exp.cursor + 1, exp.jobs.length)}/
                        {exp.jobs.length} exécutions
                      </span>
                    </div>
                  )}
                </div>
                {mode === "local" ? (
                  <p className="wl-mode-note">
                    Sans IA : les passages sont extraits et les critères sont
                    vérifiés. Les consignes de génération et le choix du modèle
                    n’affectent pas ce mode.
                  </p>
                ) : (
                  <p className="wl-mode-note">
                    Appels réels au modèle configuré côté serveur. Les
                    expériences avancent tant que cette page reste ouverte.
                  </p>
                )}
                {!config.liveEnabled && (
                  <details className="wl-connect">
                    <summary>Connecter Groq</summary>
                    <p>
                      Copie <code>.env.example</code> vers{" "}
                      <code>.dev.vars</code>, renseigne{" "}
                      <code>GROQ_API_KEY</code> et redémarre les serveurs. Une
                      clé locale ne configure pas la version hébergée.
                    </p>
                  </details>
                )}
                {tab === "play" ? (
                  <>
                    <div className="wl-playground-layout">
                      <section className="wl-card wl-play-form">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void start("playground");
                          }}
                        >
                          <label>
                            Question à ton assistant
                            <textarea
                              rows={2}
                              value={question}
                              minLength={5}
                              maxLength={1000}
                              required
                              onChange={(e) => setQuestion(e.target.value)}
                            />
                          </label>
                          <div className="wl-play-controls">
                            <label>
                              Accès simulé
                              <select
                                value={role}
                                onChange={(e) =>
                                  setRole(
                                    e.target.value as "public" | "internal",
                                  )
                                }
                              >
                                <option value="public">Public</option>
                                <option value="internal">Interne</option>
                              </select>
                            </label>
                            <label>
                              Situation
                              <select
                                value={fault}
                                onChange={(e) =>
                                  setFault(e.target.value as TestCase["fault"])
                                }
                              >
                                {Object.entries(faultNames).map(
                                  ([id, label]) => (
                                    <option key={id} value={id}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <button
                              className="wl-btn primary"
                              disabled={
                                busy ||
                                dirty ||
                                exp?.status === "running" ||
                                !project.documents.length
                              }
                            >
                              <Play size={17} /> Tester {savedVersion?.name}
                            </button>
                          </div>
                        </form>
                      </section>
                      <div
                        className={`wl-playground-results ${exp?.kind === "playground" && (currentJob?.answer || currentJob?.error) ? "has-result" : ""}`}
                      >
                        {exp?.kind === "playground" && currentJob && (
                          <p className="wl-experiment-label">
                            Exécution de {shownVersion?.name} · corpus figé à la
                            révision {exp.snapshot.revision}
                            <span>
                              Question exécutée : {currentJob.question}
                            </span>
                          </p>
                        )}
                        {shownVersion && (
                          <Agents
                            version={shownVersion}
                            job={
                              exp?.kind === "playground"
                                ? currentJob
                                : undefined
                            }
                            busy={stepping === exp?.id}
                            paused={exp?.status === "paused"}
                            onAgent={(id) => {
                              const event = currentJob?.events.findLast(
                                (e) => e.agent === id,
                              );
                              setInspect({
                                title: ROLES.find((r) => r.id === id)!.name,
                                value: event || {
                                  responsabilite: ROLES.find(
                                    (r) => r.id === id,
                                  )!.description,
                                  etat: "Aucun événement enregistré pour cette étape.",
                                },
                              });
                            }}
                          />
                        )}
                        {exp?.kind === "playground" && currentJob && (
                          <>
                            <Countdown
                              until={
                                currentJob.phase === 2
                                  ? Math.max(
                                      currentJob.nextAttemptAt,
                                      exp.nextAllowedAt,
                                    )
                                  : 0
                              }
                            />
                            <Outcome
                              job={currentJob}
                              onInspect={(title, value) =>
                                setInspect({ title, value })
                              }
                              onTest={() =>
                                setTestEditor(blankTest(currentJob))
                              }
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <section className="wl-card">
                      <div className="wl-section-head">
                        <div>
                          <h2>
                            {tab === "compare"
                              ? "Comparer deux versions"
                              : "Ton jeu de tests"}
                          </h2>
                          <p className="wl-muted">
                            Même corpus et mêmes cas pour toutes les versions.
                            Critères explicites, sans score de qualité inventé.
                          </p>
                        </div>
                        <button
                          className="wl-btn quiet"
                          disabled={busy}
                          onClick={() => setTestEditor(blankTest())}
                        >
                          <Plus size={16} /> Ajouter un test
                        </button>
                      </div>
                      {tab === "compare" && (
                        <div className="wl-comparison-pickers">
                          <label>
                            Version A
                            <select
                              value={compareA}
                              onChange={(e) => setCompareA(e.target.value)}
                            >
                              {project.versions.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <GitCompareArrows size={22} />
                          <label>
                            Version B
                            <select
                              value={compareB}
                              onChange={(e) => setCompareB(e.target.value)}
                            >
                              <option value="">
                                Choisir une autre version
                              </option>
                              {project.versions.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}
                      {!draft.tests.length ? (
                        <p className="wl-small-empty">
                          Ajoute une question et le résultat attendu, ou
                          transforme une réponse du terrain de test en cas de
                          régression.
                        </p>
                      ) : (
                        <div className="wl-test-list">
                          {draft.tests.map((t) => (
                            <div key={t.id} className="wl-test-row">
                              <input
                                type="checkbox"
                                aria-label={`Sélectionner ${t.name}`}
                                checked={caseIds.includes(t.id)}
                                onChange={(e) => {
                                  if (
                                    e.target.checked &&
                                    caseIds.length >= 12
                                  ) {
                                    setError(
                                      "12 tests maximum par expérience.",
                                    );
                                    return;
                                  }
                                  setCaseIds(
                                    e.target.checked
                                      ? [...caseIds, t.id]
                                      : caseIds.filter((id) => id !== t.id),
                                  );
                                }}
                              />
                              <button onClick={() => setTestEditor(t)}>
                                <strong>{t.name}</strong>
                                <span>{t.question}</span>
                                <small>
                                  {t.role === "public" ? "Public" : "Interne"} ·{" "}
                                  {t.expectedContains.join(", ") ||
                                    (t.expectAbstain
                                      ? "Abstention attendue"
                                      : "Critères définis")}
                                  {t.fault !== "none"
                                    ? ` · ${faultNames[t.fault]}`
                                    : ""}
                                </small>
                              </button>
                              <button
                                className="wl-icon"
                                aria-label={`Supprimer ${t.name}`}
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    tests: draft.tests.filter(
                                      (x) => x.id !== t.id,
                                    ),
                                  })
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="wl-eval-actions">
                        <button
                          className="wl-btn primary"
                          disabled={
                            busy ||
                            dirty ||
                            !caseIds.length ||
                            exp?.status === "running" ||
                            (tab === "compare" &&
                              (!compareB || compareA === compareB))
                          }
                          onClick={() =>
                            void start("evaluation", tab === "compare")
                          }
                        >
                          <Play size={16} />
                          {tab === "compare"
                            ? "Comparer"
                            : "Évaluer " + savedVersion?.name}
                        </button>
                        <span>
                          {caseIds.length} cas ·{" "}
                          {tab === "compare"
                            ? caseIds.length * 2
                            : caseIds.length}{" "}
                          exécutions maximum
                        </span>
                      </div>
                    </section>
                    {exp?.kind === "evaluation" && (
                      <section className="wl-card wl-evaluation-results">
                        <div className="wl-section-head">
                          <h2>Résultats de l’expérience</h2>
                          <button
                            className="wl-btn quiet"
                            onClick={() =>
                              download(
                                "evaluation.json",
                                JSON.stringify(exp, null, 2),
                              )
                            }
                          >
                            <Download size={15} /> Exporter les résultats
                          </button>
                        </div>
                        <div className="wl-metrics">
                          {[...new Set(exp.jobs.map((j) => j.versionId))].map(
                            (id) => {
                              const jobs = exp.jobs.filter(
                                  (j) => j.versionId === id,
                                ),
                                finished = jobs.filter((j) =>
                                  ["completed", "failed"].includes(j.status),
                                ),
                                passed = finished.filter(
                                  (j) =>
                                    j.status === "completed" &&
                                    j.checks.every((c) => c.passed),
                                );
                              return (
                                <div key={id}>
                                  <strong>
                                    {
                                      exp.snapshot.versions.find(
                                        (v) => v.id === id,
                                      )?.name
                                    }
                                  </strong>
                                  <b>
                                    {passed.length} / {finished.length}
                                  </b>
                                  <span>
                                    cas réussis / terminés · {jobs.length}{" "}
                                    prévus
                                  </span>
                                  <small>
                                    {jobs.reduce(
                                      (n, j) =>
                                        n + j.inputTokens + j.outputTokens,
                                      0,
                                    )}{" "}
                                    tokens ·{" "}
                                    {(
                                      jobs.reduce(
                                        (n, j) => n + j.durationMs,
                                        0,
                                      ) / 1000
                                    ).toFixed(1)}{" "}
                                    s outils
                                  </small>
                                </div>
                              );
                            },
                          )}
                        </div>
                        <div className="wl-result-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Cas</th>
                                {[
                                  ...new Set(exp.jobs.map((j) => j.versionId)),
                                ].map((id) => (
                                  <th key={id}>
                                    {
                                      exp.snapshot.versions.find(
                                        (v) => v.id === id,
                                      )?.name
                                    }
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[...new Set(exp.jobs.map((j) => j.caseId))].map(
                                (id) => (
                                  <tr key={id}>
                                    <td>
                                      {
                                        exp.snapshot.tests.find(
                                          (t) => t.id === id,
                                        )?.name
                                      }
                                    </td>
                                    {[
                                      ...new Set(
                                        exp.jobs.map((j) => j.versionId),
                                      ),
                                    ].map((vid) => {
                                      const job = exp.jobs.find(
                                        (j) =>
                                          j.caseId === id &&
                                          j.versionId === vid,
                                      )!;
                                      const done = [
                                          "completed",
                                          "failed",
                                        ].includes(job.status),
                                        passed =
                                          job.status === "completed" &&
                                          job.checks.every((c) => c.passed);
                                      return (
                                        <td key={vid}>
                                          <button
                                            onClick={() => setJobId(job.id)}
                                            className={
                                              jobId === job.id ? "selected" : ""
                                            }
                                          >
                                            <span
                                              className={
                                                done
                                                  ? passed
                                                    ? "wl-pass"
                                                    : "wl-fail"
                                                  : "wl-muted"
                                              }
                                            >
                                              {done
                                                ? passed
                                                  ? "Réussi"
                                                  : "Échec"
                                                : job.status === "running"
                                                  ? "En cours"
                                                  : "À exécuter"}
                                            </span>
                                            <p>
                                              {job.error ||
                                                job.answer?.answer.slice(
                                                  0,
                                                  140,
                                                ) ||
                                                "La réponse apparaîtra ici."}
                                            </p>
                                            <small>
                                              Inspecter{" "}
                                              <ChevronRight size={13} />
                                            </small>
                                          </button>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                        {currentJob && shownVersion && (
                          <>
                            <Agents
                              version={shownVersion}
                              job={currentJob}
                              busy={
                                stepping === exp.id &&
                                currentJob.id === exp.jobs[exp.cursor]?.id
                              }
                              paused={exp.status === "paused"}
                              onAgent={(id) =>
                                setInspect({
                                  title: id,
                                  value:
                                    currentJob.events.findLast(
                                      (e) => e.agent === id,
                                    ) || "Aucune étape enregistrée.",
                                })
                              }
                            />
                            <Countdown
                              until={
                                currentJob.phase === 2
                                  ? Math.max(
                                      currentJob.nextAttemptAt,
                                      exp.nextAllowedAt,
                                    )
                                  : 0
                              }
                            />
                            <Outcome
                              job={currentJob}
                              onInspect={(title, value) =>
                                setInspect({ title, value })
                              }
                              onTest={() =>
                                setTestEditor(blankTest(currentJob))
                              }
                            />
                          </>
                        )}
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        <footer className="wl-footer">
          Recherche lexicale · Contrôles déterministes · Documents non exécutés
          <a href="/api/source">AGPL-3.0</a>
        </footer>
      </main>
      {inspect && (
        <Inspect
          title={inspect.title}
          value={inspect.value}
          onClose={() => setInspect(null)}
        />
      )}{" "}
      {testEditor && draft && (
        <TestEditor
          key={testEditor.id}
          initial={testEditor}
          error={error}
          documents={draft.documents}
          onSave={(t) => void saveTest(t)}
          onClose={() => setTestEditor(null)}
        />
      )}
    </div>
  );
}
