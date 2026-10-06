"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  Archive,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Code2,
  Download,
  FileText,
  GitBranch,
  History,
  Layers3,
  Loader2,
  Orbit,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { AgentAvatar, AVATAR_NAMES } from "./agent-avatar";
import { FindingsPanel } from "./findings-panel";
import {
  AGENTS,
  PHASES,
  STATUS_LABEL,
  type Run,
  type Source,
  type Trace,
  type Check as RuntimeCheck,
} from "@/lib/observatory/types";
import { SCENARIOS } from "@/lib/observatory/fixtures";
type Tab = "mission" | "traces" | "artifacts" | "compare" | "guide";
type Summary = Pick<
  Run,
  "id" | "title" | "status" | "cursor" | "mode" | "updatedAt" | "scenario"
>;
const NAV = [
  { id: "mission", label: "Observatoire", icon: Orbit },
  { id: "traces", label: "Journal d’exécution", icon: Terminal },
  { id: "artifacts", label: "Livrables", icon: Archive },
  { id: "compare", label: "Comparer", icon: GitBranch },
  { id: "guide", label: "Comment ça marche", icon: BookOpen },
] as const;
function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    cache: "no-store",
  });
  const data = (await res.json()) as {
    run: Run;
    runs: Summary[];
    liveEnabled: boolean;
    model: string;
    error?: string;
  };
  if (!res.ok)
    throw Object.assign(new Error(data.error || "Requête indisponible."), {
      status: res.status,
    });
  return data;
}
function duration(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
function ModeBadge({ mode }: { mode: Run["mode"] }) {
  return (
    <span className={`mode-badge ${mode}`}>
      <span />
      {mode === "demo" ? "DÉMO DÉTERMINISTE" : "IA CONNECTÉE"}
    </span>
  );
}
function Report({ text }: { text: string }) {
  return (
    <article className="report-paper">
      {text
        .split("\n")
        .map((line, i) =>
          line.startsWith("# ") ? (
            <h2 key={i}>{line.slice(2)}</h2>
          ) : line.startsWith("## ") ? (
            <h3 key={i}>{line.slice(3)}</h3>
          ) : line.startsWith("### ") ? (
            <h4 key={i}>{line.slice(4)}</h4>
          ) : line ? (
            <p key={i}>{line}</p>
          ) : (
            <div className="report-space" key={i} />
          ),
        )}
    </article>
  );
}
function MissionBriefing({
  run,
  auto,
  advancing,
}: {
  run: Run;
  auto: boolean;
  advancing: boolean;
}) {
  const phase = PHASES[Math.min(run.cursor, PHASES.length - 1)];
  const role = AGENTS.find((agent) => agent.id === phase.agent)!;
  const text =
    run.status === "completed"
      ? {
          title: "Le rapport est prêt.",
          detail:
            "Retrouvez le livrable et les preuves dans l’onglet Livrables.",
        }
      : run.status === "waiting"
        ? {
            title: "Votre accord est attendu.",
            detail:
              "Relisez les constats ci-dessous, puis autorisez la rédaction du rapport.",
          }
        : run.status === "failed"
          ? {
              title: `Étape interrompue : ${phase.name.toLocaleLowerCase("fr")}.`,
              detail:
                "Les étapes terminées restent sauvegardées. Reprendre réessaie cette étape, sans recommencer la mission.",
            }
          : run.status === "cancelled"
            ? {
                title: "Mission annulée.",
                detail:
                  "Ses sources et ses traces restent consultables. Réutilisez son contenu pour préparer une nouvelle exécution.",
              }
            : run.status === "paused"
              ? {
                  title: `En pause avant « ${phase.name} ».`,
                  detail: "Reprendre continuera depuis ce checkpoint.",
                }
              : {
                  title: `${advancing ? "En cours" : "Prochaine étape"} : ${phase.name.toLocaleLowerCase("fr")}.`,
                  detail: `${role.role} · ${phase.description} ${auto ? "L’enchaînement automatique nécessite cette page ouverte." : "Cliquez sur Étape suivante pour avancer."}`,
                };
  return (
    <div className={`mission-briefing ${run.status}`} role="status">
      <span className="briefing-icon">
        {run.status === "completed" ? (
          <CheckCheck size={19} />
        ) : run.status === "waiting" ? (
          <ShieldCheck size={19} />
        ) : (
          <Activity size={19} />
        )}
      </span>
      <div>
        <strong>{text.title}</strong>
        <p>{text.detail}</p>
      </div>
    </div>
  );
}
export default function Observatory() {
  const [tab, setTab] = useState<Tab>("mission");
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<Summary[]>([]);
  const [scenario, setScenario] = useState<Run["scenario"]>("architecture");
  const [objective, setObjective] = useState<string>(SCENARIOS[0].objective);
  const [repository, setRepository] = useState("hemvall/avatar-lab");
  const [documentText, setDocumentText] = useState("");
  const [mode, setMode] = useState<Run["mode"]>("demo");
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [model, setModel] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("planner");
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionLost, setConnectionLost] = useState(false);
  const [error, setError] = useState("");
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [replay, setReplay] = useState(-1);
  const [traceFilter, setTraceFilter] = useState("all");
  const [compareId, setCompareId] = useState("");
  const [compareRun, setCompareRun] = useState<Run | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const sourceTrigger = useRef<HTMLElement | null>(null);
  const inspectionRef = useRef<Run | null>(null);
  const selectedId = useRef<string | null>(null);
  const navigationVersion = useRef(0);
  const inFlight = useRef(new Set<string>());
  const mounted = useRef(true);
  function receive(next: Run) {
    if (selectedId.current !== next.id) return;
    setRun((prev) =>
      prev?.id === next.id && prev.revision >= next.revision ? prev : next,
    );
  }
  async function refreshHistory() {
    try {
      const data = await api("/api/runs");
      if (mounted.current) setHistory(data.runs);
    } catch {
      // Keep the last saved list on a transient network failure.
    }
  }
  async function openRun(id: string) {
    navigationVersion.current++;
    selectedId.current = id;
    setRun(null);
    setConnectionLost(false);
    setLoading(true);
    setError("");
    setReplay(-1);
    setSelectedTrace(null);
    try {
      const data = await api(`/api/runs/${id}`);
      if (selectedId.current !== id || !mounted.current) return;
      receive(data.run);
      setTab("mission");
      window.history.replaceState(null, "", `?run=${id}`);
    } catch (e) {
      if (selectedId.current === id) setError((e as Error).message);
    } finally {
      if (selectedId.current === id) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    let active = true;
    const initialNavigation = navigationVersion.current;
    (async () => {
      try {
        const [h, c] = await Promise.all([
          api("/api/runs"),
          api("/api/config"),
        ]);
        if (!active) return;
        setHistory(h.runs);
        setLiveEnabled(c.liveEnabled);
        setModel(c.model);
        try {
          const saved = localStorage.getItem("observatory-avatar-preferences");
          if (saved) {
            const prefs = JSON.parse(saved);
            if (prefs && typeof prefs === "object") {
              setAvatars(
                Object.fromEntries(
                  AGENTS.flatMap((agent) =>
                    AVATAR_NAMES.includes(prefs[agent.id])
                      ? [[agent.id, prefs[agent.id]]]
                      : [],
                  ),
                ),
              );
            }
          }
        } catch {
          // Optional device preferences must never prevent mission loading.
        }
        const query = new URLSearchParams(window.location.search).get("run");
        if (navigationVersion.current !== initialNavigation) return;
        const id =
          query && /^[0-9a-f-]{36}$/i.test(query) ? query : h.runs[0]?.id;
        if (id) {
          selectedId.current = id;
          const data = await api(`/api/runs/${id}`);
          if (active) receive(data.run);
        }
      } catch (e) {
        if (active && navigationVersion.current === initialNavigation)
          setError((e as Error).message);
      } finally {
        if (active && navigationVersion.current === initialNavigation)
          setLoading(false);
      }
    })();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!run) return;
    const id = run.id;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const data = await api(`/api/runs/${id}`);
        if (active) {
          receive(data.run);
          setConnectionLost(false);
        }
      } catch {
        if (active) setConnectionLost(true);
      }
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [run?.id]);
  useEffect(() => {
    if (
      !run ||
      !auto ||
      connectionLost ||
      run.status !== "running" ||
      inFlight.current.has(run.id)
    )
      return;
    const id = run.id;
    const timer = setTimeout(
      () => void advance(id),
      Math.max(1400, run.lockedUntil - Date.now() + 100),
    );
    return () => clearTimeout(timer);
  }, [
    run?.id,
    run?.revision,
    run?.status,
    run?.lockedUntil,
    auto,
    connectionLost,
  ]);
  useEffect(() => {
    if (!source) return;
    function close(e: KeyboardEvent) {
      if (e.key === "Escape") setSource(null);
      if (e.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
          "button,a[href],input,select,textarea",
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      sourceTrigger.current?.focus();
    };
  }, [source]);
  useEffect(() => {
    inspectionRef.current = run;
  }, [run]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "inspect_selected_mission",
            title: "Inspecter la mission sélectionnée",
            description:
              "Lire le statut, les constats, les contrôles et les dernières traces de la mission visible. Ne modifie aucune donnée.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Un objet vide est attendu.");
              const current = inspectionRef.current;
              return current
                ? {
                    id: current.id,
                    status: current.status,
                    cursor: current.cursor,
                    mode: current.mode,
                    findings: current.findings,
                    checks: current.checks,
                    traces: current.traces.slice(-3),
                  }
                : { selectedMission: null };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* unsupported proposed API */
    }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    if (!compareId) {
      setCompareRun(null);
      return;
    }
    let active = true;
    setCompareRun(null);
    api(`/api/runs/${compareId}`)
      .then((d) => {
        if (active) setCompareRun(d.run);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [compareId]);
  async function advance(id: string) {
    if (selectedId.current !== id || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setAdvancingId(id);
    try {
      const data = await api(`/api/runs/${id}`, { action: "advance" });
      receive(data.run);
      void refreshHistory();
    } catch (e) {
      if (
        selectedId.current === id &&
        (e as { status?: number }).status !== 409
      )
        setError((e as Error).message);
      try {
        receive((await api(`/api/runs/${id}`)).run);
      } catch {
        /* preserve checkpoint */
      }
    } finally {
      inFlight.current.delete(id);
      setAdvancingId((prev) => (prev === id ? null : prev));
    }
  }
  async function action(name: string) {
    if (!run) return;
    const id = run.id;
    setBusy(true);
    setError("");
    try {
      receive((await api(`/api/runs/${id}`, { action: name })).run);
      if (selectedId.current === id) setReplay(-1);
      void refreshHistory();
    } catch (e) {
      if (selectedId.current === id) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function launch() {
    if (busy) return;
    setBusy(true);
    const navigation = ++navigationVersion.current;
    setError("");
    try {
      const data = await api("/api/runs", {
        scenario,
        objective,
        repository,
        document: documentText,
        mode,
      });
      void refreshHistory();
      if (navigationVersion.current !== navigation) return;
      selectedId.current = data.run.id;
      setRun(data.run);
      setReplay(-1);
      setSelectedTrace(null);
      setAuto(true);
      setTab("mission");
      window.history.replaceState(null, "", `?run=${data.run.id}`);
    } catch (e) {
      if (navigationVersion.current === navigation)
        setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function newMission() {
    navigationVersion.current++;
    selectedId.current = null;
    setRun(null);
    setError("");
    setReplay(-1);
    setTab("mission");
    setLoading(false);
    setConnectionLost(false);
    setSelectedTrace(null);
    window.history.replaceState(null, "", window.location.pathname);
  }
  function duplicateMission() {
    if (!run) return;
    setScenario(run.scenario);
    setObjective(run.objective);
    setRepository(run.repository);
    setDocumentText(run.document);
    setMode(run.mode === "live" && !liveEnabled ? "demo" : run.mode);
    newMission();
  }
  function chooseScenario(id: Run["scenario"]) {
    setScenario(id);
    setObjective(SCENARIOS.find((s) => s.id === id)!.objective);
  }
  function customize(name: string) {
    const prefs = { ...avatars, [selectedAgent]: name };
    setAvatars(prefs);
    try {
      localStorage.setItem(
        "observatory-avatar-preferences",
        JSON.stringify(prefs),
      );
    } catch {
      // The current choice still works when browser storage is disabled.
    }
  }
  const advancing = run?.id === advancingId;
  const displayedSources = replay < 0 || replay >= 1 ? run?.sources || [] : [];
  const displayedFindings =
    replay < 0 || replay >= 2 ? run?.findings || [] : [];
  const displayedChecks =
    replay < 0
      ? run?.checks || []
      : (run?.traces
          .filter(
            (t) =>
              t.phase <= replay &&
              (t.tool === "evidence.check" || t.tool === "evaluation.run"),
          )
          .at(-1)?.output as RuntimeCheck[] | undefined) || [];
  const phaseIndex = replay >= 0 ? replay : (run?.cursor ?? 0);
  const activeAgent =
    run && run.status === "running"
      ? PHASES[Math.min(run.cursor, 6)].agent
      : null;
  const visibleTraces =
    run?.traces.filter((t) => replay < 0 || t.phase <= replay) || [];
  const agent = AGENTS.find((a) => a.id === selectedAgent)!;
  const trace =
    visibleTraces.find((t) => t.id === selectedTrace) ||
    visibleTraces.filter((t) => t.agent === selectedAgent).at(-1);
  const progress = run ? Math.round((run.cursor / 7) * 100) : 0;
  const filteredTraces = (run?.traces || []).filter(
    (t) => traceFilter === "all" || t.agent === traceFilter,
  );
  const sumDuration = (r: Run) =>
    r.traces.reduce((n, t) => n + t.durationMs, 0);
  function traceRow(t: Trace) {
    return (
      <button
        key={t.id}
        className={`trace-row ${selectedTrace === t.id ? "selected" : ""}`}
        onClick={() => {
          setSelectedTrace(t.id);
          setSelectedAgent(t.agent);
          setTab("mission");
          setReplay(-1);
        }}
      >
        <span className="trace-symbol">
          <Check size={14} />
        </span>
        <div>
          <code>{t.tool}</code>
          <p>{t.summary}</p>
        </div>
        <span className="trace-time">{duration(t.durationMs)}</span>
      </button>
    );
  }
  const customName = (id: string) =>
    avatars[id] || AGENTS.find((a) => a.id === id)!.avatar;
  return (
    <div className="observatory-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Accueil Agent Observatory">
          <span className="brand-mark">
            <Orbit size={24} />
          </span>
          <span>
            agent<span className="brand-secondary">observatory</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-swatch">L</span> Laboratoire personnel{" "}
          <ChevronDown size={14} />
        </div>
        <p className="nav-caption">ESPACE DE TRAVAIL</p>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              aria-current={tab === n.id ? "page" : undefined}
              onClick={() => setTab(n.id)}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "artifacts" && run?.report && (
                <span className="nav-count">1</span>
              )}
            </button>
          ))}
        </nav>
        <div className="history-heading">
          <span>MISSIONS RÉCENTES</span>
          <button onClick={newMission} aria-label="Nouvelle mission">
            <Plus size={16} />
          </button>
        </div>
        <div className="run-history">
          {history.length ? (
            history.slice(0, 8).map((h) => (
              <button
                key={h.id}
                onClick={() => void openRun(h.id)}
                className={run?.id === h.id ? "selected" : ""}
              >
                <span className={`history-state ${h.status}`} />
                <span>{h.title}</span>
              </button>
            ))
          ) : (
            <p className="empty-history">
              Votre première mission apparaîtra ici.
            </p>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="footer-symbol">
            <Layers3 size={20} />
          </div>
          <p>
            Un agent. Des preuves.
            <br />
            <span>Chaque étape devient visible.</span>
          </p>
          <a
            href="https://github.com/hemvall/avatar-lab"
            target="_blank"
            rel="noreferrer"
          >
            Personnages d’Avatar Lab
          </a>
          <a href="/api/source" target="_blank" rel="noreferrer">
            Code source · AGPL-3.0
          </a>
          <span className="version-label">OBSERVATORY / 0.1.0</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Laboratoire <span>/</span>{" "}
            <strong>{NAV.find((n) => n.id === tab)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <details className="history-menu">
              <summary aria-label="Choisir une mission sauvegardée">
                <History size={16} />
                <span>Missions</span>
              </summary>
              <div>
                {history.length ? (
                  history.map((h) => (
                    <button
                      key={h.id}
                      onClick={(e) => {
                        e.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        void openRun(h.id);
                      }}
                    >
                      <span>{h.title}</span>
                      <small>{STATUS_LABEL[h.status]}</small>
                    </button>
                  ))
                ) : (
                  <p>Aucune mission sauvegardée.</p>
                )}
              </div>
            </details>
            <span className="private-label">
              <ShieldCheck size={14} /> Espace privé
            </span>
            <button className="button secondary compact" onClick={newMission}>
              <Plus size={15} /> Nouvelle mission
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <Radio size={14} /> AGENT OBSERVATORY
              </div>
              <h1>
                {tab === "mission"
                  ? "Voir les agents à l’œuvre."
                  : tab === "traces"
                    ? "Rien ne reste dans l’ombre."
                    : tab === "artifacts"
                      ? "Du travail. Des résultats."
                      : tab === "compare"
                        ? "Comparer les exécutions."
                        : "Sous le capot."}
              </h1>
              <p>
                {tab === "mission"
                  ? "Suivez une mission, inspectez les preuves, gardez le contrôle."
                  : tab === "traces"
                    ? "Les appels d’outils, leurs entrées et leurs résultats, dans l’ordre."
                    : tab === "artifacts"
                      ? "Le rapport et les traces produits par votre mission."
                      : tab === "compare"
                        ? "Des mesures observées, sans score de qualité inventé."
                        : "Un runtime observable, des étapes bornées et une reprise explicite."}
              </p>
            </div>
            <div className="heading-number">
              LAB<span>001</span>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Fermer l’erreur">
                <X size={16} />
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-line" role="status">
              <Loader2 size={16} className="spin" /> Chargement des missions
              sauvegardées…
            </div>
          )}
          {connectionLost && run && (
            <div className="connection-banner" role="status">
              <Radio size={17} />
              Connexion interrompue. L’état affiché est le dernier état reçu ;
              l’actualisation reprend automatiquement.
            </div>
          )}
          {tab === "mission" && (
            <>
              <section className="mission-panel">
                <div className="section-title">
                  <span className="section-index">01</span>
                  <h2>{run ? "Mission active" : "Votre prochaine mission"}</h2>
                  <ModeBadge mode={run?.mode || mode} />
                </div>
                {run ? (
                  <>
                    <div className="active-mission">
                      <div>
                        <h3>{run.title}</h3>
                        <p>{run.objective}</p>
                      </div>
                      <span className={`status-tag ${run.status}`}>
                        {STATUS_LABEL[run.status]}
                      </span>
                    </div>
                    <div className="mission-controls">
                      <div className="mission-progress">
                        <div className="progress-bar">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <span>
                          {run.cursor}/7 étapes <strong>{progress}%</strong>
                        </span>
                      </div>
                      <div className="control-buttons">
                        {run.status === "running" && (
                          <>
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() => void action("pause")}
                            >
                              <Pause size={15} /> Pause
                            </button>
                            <button
                              className={`button subtle ${auto ? "on" : ""}`}
                              onClick={() => setAuto(!auto)}
                              aria-pressed={auto}
                            >
                              <Zap size={15} /> Auto{" "}
                              {auto ? "activé" : "désactivé"}
                            </button>
                            {!auto && (
                              <button
                                className="button primary"
                                disabled={advancing || busy}
                                onClick={() => void advance(run.id)}
                              >
                                <Play size={15} /> Étape suivante
                              </button>
                            )}
                          </>
                        )}
                        {(run.status === "paused" ||
                          run.status === "failed") && (
                          <button
                            className="button primary"
                            disabled={busy}
                            onClick={() => void action("resume")}
                          >
                            <Play size={15} /> Reprendre
                          </button>
                        )}
                        {run.status === "completed" && (
                          <button
                            className="button primary"
                            onClick={() => setTab("artifacts")}
                          >
                            <FileText size={15} /> Voir le rapport
                          </button>
                        )}
                        {[
                          "completed",
                          "cancelled",
                          "paused",
                          "failed",
                        ].includes(run.status) && (
                          <button
                            className="button secondary"
                            onClick={duplicateMission}
                            disabled={busy}
                          >
                            <RotateCcw size={15} /> Réutiliser la mission
                          </button>
                        )}
                        {!["completed", "cancelled"].includes(run.status) && (
                          <button
                            className="icon-button"
                            disabled={busy}
                            onClick={() => void action("cancel")}
                            aria-label="Annuler la mission"
                            title="Annuler la mission"
                          >
                            <Square size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <MissionBriefing
                      run={run}
                      auto={auto}
                      advancing={advancing}
                    />
                    {run.error && <p className="inline-error">{run.error}</p>}
                    {run.status === "waiting" && (
                      <div className="approval-banner">
                        <ShieldCheck size={23} />
                        <div>
                          <strong>
                            Le contrôle est terminé. À vous de décider.
                          </strong>
                          <p>
                            Inspectez les constats et leurs sources, puis
                            autorisez la rédaction du rapport.
                          </p>
                        </div>
                        <button
                          className="button secondary"
                          onClick={() => {
                            setReplay(-1);
                            requestAnimationFrame(() => {
                              const panel =
                                document.getElementById("mission-findings");
                              panel?.focus({ preventScroll: true });
                              panel?.scrollIntoView({
                                behavior: window.matchMedia(
                                  "(prefers-reduced-motion: reduce)",
                                ).matches
                                  ? "instant"
                                  : "smooth",
                                block: "start",
                              });
                            });
                          }}
                        >
                          <Search size={16} /> Relire les constats
                        </button>
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() => void action("approve")}
                        >
                          <Check size={16} /> Valider et poursuivre
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="scenario-picker">
                      {SCENARIOS.map((s) => (
                        <button
                          key={s.id}
                          className={scenario === s.id ? "selected" : ""}
                          onClick={() => chooseScenario(s.id)}
                        >
                          <span>
                            {s.id === "repository" ? (
                              <GitBranch size={17} />
                            ) : s.id === "security" ? (
                              <ShieldCheck size={17} />
                            ) : s.id === "documents" ? (
                              <FileText size={17} />
                            ) : (
                              <Layers3 size={17} />
                            )}
                          </span>
                          <strong>{s.title}</strong>
                          <p>{s.description}</p>
                        </button>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void launch();
                      }}
                    >
                      <div className="mission-form-row">
                        <label className="objective-label">
                          OBJECTIF
                          <input
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                            minLength={12}
                            maxLength={2000}
                            required
                            placeholder="Décrivez le résultat à produire"
                          />
                        </label>
                        <button
                          className="button primary launch-button"
                          disabled={busy || loading}
                        >
                          {busy ? (
                            <Loader2 size={17} className="spin" />
                          ) : (
                            <Play size={17} />
                          )}{" "}
                          Lancer la mission
                        </button>
                      </div>
                      {scenario === "repository" && (
                        <label className="extra-field">
                          Dépôt public GitHub
                          <input
                            value={repository}
                            onChange={(e) => setRepository(e.target.value)}
                            placeholder="propriétaire/dépôt"
                            required
                          />
                        </label>
                      )}
                      {scenario === "documents" && (
                        <label className="extra-field">
                          Document à analyser
                          <textarea
                            value={documentText}
                            onChange={(e) => setDocumentText(e.target.value)}
                            minLength={40}
                            maxLength={40000}
                            rows={5}
                            placeholder="Collez votre document, votre architecture ou votre spécification."
                            required
                          />
                        </label>
                      )}
                      <div className="form-footer">
                        <span>
                          <ShieldCheck size={13} /> Lecture seule · validation
                          avant le rapport
                        </span>
                        <label>
                          Exécution
                          <select
                            value={mode}
                            onChange={(e) =>
                              setMode(e.target.value as Run["mode"])
                            }
                          >
                            <option value="demo">
                              Démo déterministe · sans clé
                            </option>
                            <option value="live" disabled={!liveEnabled}>
                              IA réelle{" "}
                              {liveEnabled ? `· ${model}` : "· non configurée"}
                            </option>
                          </select>
                        </label>
                      </div>
                    </form>
                  </>
                )}
              </section>
              <div className="laboratory-layout">
                <div className="laboratory-main">
                  <section className="agent-stage">
                    <div className="stage-header">
                      <div>
                        <span className="section-index">02</span>
                        <h2>L’équipe en action</h2>
                      </div>
                      <span className="stage-state">
                        {replay >= 0 ? (
                          <>
                            <History size={13} /> RELECTURE / ÉTAPE {replay + 1}
                          </>
                        ) : advancing ? (
                          <>
                            <Loader2 size={13} className="spin" /> ÉTAPE EN
                            COURS
                          </>
                        ) : (
                          <>
                            <Activity size={13} />{" "}
                            {run ? "MISSION OBSERVÉE" : "PRÊTE À DÉMARRER"}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="stage-grid-background" aria-hidden="true" />
                    <div className="agent-grid">
                      {AGENTS.map((a, index) => {
                        const active =
                          replay >= 0
                            ? PHASES[Math.min(replay, 6)].agent === a.id
                            : activeAgent === a.id;
                        const done = run?.status === "completed" && replay < 0;
                        const paused =
                          (run?.status === "paused" ||
                            run?.status === "cancelled") &&
                          replay < 0;
                        const waiting =
                          run?.status === "waiting" &&
                          a.id === "reviewer" &&
                          replay < 0;
                        const anim = paused
                          ? "sleeping"
                          : done
                            ? "idle"
                            : waiting
                              ? "listening"
                              : active
                                ? a.animation
                                : "idle";
                        const name = customName(a.id);
                        return (
                          <button
                            key={a.id}
                            onClick={() => {
                              setSelectedAgent(a.id);
                              setSelectedTrace(null);
                            }}
                            className={`agent-station ${selectedAgent === a.id ? "selected" : ""} ${active ? "working" : ""}`}
                            style={
                              { "--agent-color": a.color } as CSSProperties
                            }
                            aria-pressed={selectedAgent === a.id}
                          >
                            <div className="station-number">
                              0{index + 1}
                              <span>
                                {active
                                  ? "ACTIF"
                                  : waiting
                                    ? "ATTENTE"
                                    : done
                                      ? "TERMINÉ"
                                      : "EN VEILLE"}
                              </span>
                            </div>
                            <div className="avatar-platform">
                              <div className="avatar-halo" />
                              <AgentAvatar
                                name={name}
                                animation={anim}
                                size={150}
                              />
                              <div className="platform-ring" />
                            </div>
                            <h3>{name}</h3>
                            <p>{a.role}</p>
                            <div className="station-tool">
                              <span className={active ? "active-dot" : ""} />
                              {active && run
                                ? PHASES[Math.min(phaseIndex, 6)].tool
                                : a.tools[0]}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mission-bus">
                      <span className="bus-node" />
                      <span>CONTEXTE PARTAGÉ</span>
                      <div />
                      <span>{displayedSources.length} sources</span>
                      <span>{displayedFindings.length} constats</span>
                      <span>{visibleTraces.length} traces</span>
                    </div>
                    <p className="stage-footnote">
                      Les personnages représentent les rôles du même pipeline.
                      Cliquez pour inspecter leur travail.
                    </p>
                  </section>
                  <section className="pipeline-panel">
                    <div className="section-title">
                      <span className="section-index">03</span>
                      <h2>Le chemin de la mission</h2>
                      <span className="checkpoint-label">
                        <Layers3 size={13} /> Checkpoint après chaque étape
                      </span>
                    </div>
                    <div className="pipeline">
                      {PHASES.map((p, i) => {
                        const completed =
                          run && (replay >= 0 ? replay + 1 : run.cursor) > i;
                        const current = run && phaseIndex === i;
                        return (
                          <button
                            key={p.name}
                            className={`${completed ? "done" : ""} ${current ? "current" : ""} ${i === 4 ? "gate" : ""}`}
                            onClick={() => {
                              setSelectedAgent(p.agent);
                              const t = run?.traces.find((t) => t.phase === i);
                              setSelectedTrace(t?.id || null);
                              if (t) setReplay(i);
                            }}
                            title={p.description}
                          >
                            <span>
                              {completed ? (
                                <Check size={14} />
                              ) : i === 4 ? (
                                <ShieldCheck size={14} />
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </span>
                            <strong>{p.name}</strong>
                          </button>
                        );
                      })}
                    </div>
                    {run && run.traces.length > 0 && (
                      <div className="replay-control">
                        <History size={15} />
                        <span>Relecture</span>
                        <input
                          aria-label="Relire une étape terminée"
                          type="range"
                          min={0}
                          max={Math.max(...run.traces.map((t) => t.phase))}
                          value={
                            replay >= 0
                              ? replay
                              : Math.max(...run.traces.map((t) => t.phase))
                          }
                          onChange={(e) => setReplay(Number(e.target.value))}
                        />
                        <button
                          onClick={() => {
                            setReplay(-1);
                            setSelectedTrace(null);
                          }}
                        >
                          Retour à la mission
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="activity-panel">
                    <div className="section-title">
                      <span className="section-index">04</span>
                      <h2>Dernières traces</h2>
                      <button
                        className="text-button"
                        onClick={() => setTab("traces")}
                      >
                        Tout voir <Terminal size={14} />
                      </button>
                    </div>
                    {visibleTraces.length ? (
                      visibleTraces.slice(-3).reverse().map(traceRow)
                    ) : (
                      <div className="empty-traces">
                        <Terminal size={21} />
                        <p>Chaque étape laissera une trace inspectable ici.</p>
                      </div>
                    )}
                  </section>
                  {displayedFindings.length > 0 && (
                    <FindingsPanel
                      key={run?.id}
                      findings={displayedFindings}
                      sources={displayedSources}
                      reviewing={run?.status === "waiting"}
                      onSource={(selected, trigger) => {
                        sourceTrigger.current = trigger;
                        setSource(selected);
                      }}
                    />
                  )}
                </div>
                <aside className="inspector">
                  <div className="inspector-header">
                    <span>INSPECTEUR</span>
                    <Code2 size={15} />
                  </div>
                  <div className="inspector-agent">
                    <span style={{ background: agent.color }} />
                    <div>
                      <strong>{customName(agent.id)}</strong>
                      <p>{agent.role}</p>
                    </div>
                    <select
                      aria-label="Personnage de ce rôle"
                      value={customName(agent.id)}
                      onChange={(e) => customize(e.target.value)}
                    >
                      {AVATAR_NAMES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="agent-description">{agent.description}</p>
                  <div className="inspector-tools">
                    {agent.tools.map((t) => (
                      <code key={t}>{t}</code>
                    ))}
                  </div>
                  <div className="inspector-divider" />
                  <div className="inspector-label">
                    {trace ? "TRACE SÉLECTIONNÉE" : "CE QUI SERA OBSERVABLE"}
                  </div>
                  {trace ? (
                    <>
                      <h3 className="trace-title">{trace.tool}</h3>
                      <p className="trace-summary">{trace.summary}</p>
                      <div className="trace-metadata">
                        <span>
                          <Clock3 size={13} />
                          {duration(trace.durationMs)}
                        </span>
                        <span>{trace.tokens.toLocaleString("fr")} tokens</span>
                      </div>
                      <details open>
                        <summary>Entrée de l’outil</summary>
                        <pre>{JSON.stringify(trace.input, null, 2)}</pre>
                      </details>
                      <details>
                        <summary>Sortie de l’outil</summary>
                        <pre>{JSON.stringify(trace.output, null, 2)}</pre>
                      </details>
                      <span className="checkpoint-saved">
                        <CheckCheck size={14} /> Étape sauvegardée
                      </span>
                    </>
                  ) : (
                    <div className="inspector-explanation">
                      <p>
                        <span>01</span> Les données transmises à l’outil.
                      </p>
                      <p>
                        <span>02</span> Le résultat réellement retourné.
                      </p>
                      <p>
                        <span>03</span> La durée et les tokens mesurés.
                      </p>
                      <p>
                        <span>04</span> Le checkpoint permettant la reprise.
                      </p>
                    </div>
                  )}
                  <div className="inspector-divider" />
                  <div className="inspector-label">
                    SOURCES DE LA MISSION <span>{displayedSources.length}</span>
                  </div>
                  <div className="source-list">
                    {displayedSources.map((s) => (
                      <button
                        key={s.id}
                        onClick={(e) => {
                          sourceTrigger.current = e.currentTarget;
                          setSource(s);
                        }}
                      >
                        <FileText size={14} />
                        <span>{s.name}</span>
                        <code>{s.id}</code>
                      </button>
                    ))}
                    {!displayedSources.length && (
                      <p>Les documents apparaîtront après la collecte.</p>
                    )}
                  </div>
                  {run && displayedChecks.length > 0 && (
                    <div className="checks-list">
                      <div className="inspector-label">
                        CONTRÔLES STRUCTURELS
                      </div>
                      {displayedChecks.map((c) => (
                        <div key={c.name} title={c.detail}>
                          <span
                            className={c.passed ? "check-pass" : "check-fail"}
                          >
                            {c.passed ? <Check size={13} /> : <X size={13} />}
                          </span>
                          <span>{c.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </aside>
              </div>
              <div className="metrics-strip">
                <div>
                  <Clock3 size={17} />
                  <span>
                    Temps des outils
                    <strong>{run ? duration(sumDuration(run)) : "—"}</strong>
                  </span>
                </div>
                <div>
                  <Layers3 size={17} />
                  <span>
                    Checkpoints<strong>{run?.traces.length || 0}</strong>
                  </span>
                </div>
                <div>
                  <Sparkles size={17} />
                  <span>
                    Tokens mesurés
                    <strong>
                      {run
                        ? (run.inputTokens + run.outputTokens).toLocaleString(
                            "fr",
                          )
                        : 0}
                    </strong>
                  </span>
                </div>
                <div>
                  <ShieldCheck size={17} />
                  <span>
                    Validation humaine
                    <strong>
                      {run?.traces.some((t) => t.tool === "human.approve")
                        ? "Accord enregistré"
                        : "Avant le rapport"}
                    </strong>
                  </span>
                </div>
              </div>
            </>
          )}
          {tab === "traces" && (
            <section className="full-panel">
              <div className="section-title">
                <h2>Journal de la mission</h2>
                <span>{run?.traces.length || 0} événements</span>
                <button
                  className="button secondary compact"
                  disabled={!run?.traces.length}
                  onClick={() =>
                    run &&
                    download(
                      "traces.json",
                      JSON.stringify(run.traces, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download size={14} /> Export JSON
                </button>
              </div>
              <div className="filter-bar">
                <button
                  className={traceFilter === "all" ? "selected" : ""}
                  onClick={() => setTraceFilter("all")}
                >
                  Tous les rôles
                </button>
                {AGENTS.map((a) => (
                  <button
                    className={traceFilter === a.id ? "selected" : ""}
                    key={a.id}
                    onClick={() => setTraceFilter(a.id)}
                  >
                    {a.role}
                  </button>
                ))}
              </div>
              {filteredTraces.length ? (
                filteredTraces.map(traceRow)
              ) : (
                <Empty
                  icon={Terminal}
                  title="Aucune trace à afficher"
                  text="Lancez une mission depuis l’observatoire pour inspecter ses étapes."
                />
              )}
              <p className="panel-note">
                Cliquez sur un événement pour ouvrir ses entrées et ses sorties
                dans l’inspecteur.
              </p>
            </section>
          )}
          {tab === "artifacts" && (
            <>
              {run?.report ? (
                <div className="artifact-layout">
                  <Report text={run.report} />
                  <aside className="artifact-actions">
                    <div className="artifact-file">
                      <FileText size={28} />
                      <h3>rapport.md</h3>
                      <p>
                        {run.report.length.toLocaleString("fr")} caractères ·{" "}
                        {run.sources.length} sources
                      </p>
                      <button
                        className="button primary"
                        onClick={() => download("rapport.md", run.report)}
                      >
                        <Download size={15} /> Télécharger
                      </button>
                    </div>
                    <div className="artifact-file">
                      <Terminal size={25} />
                      <h3>traces.json</h3>
                      <p>{run.traces.length} événements · entrées et sorties</p>
                      <button
                        className="button secondary"
                        onClick={() =>
                          download(
                            "traces.json",
                            JSON.stringify(run.traces, null, 2),
                            "application/json",
                          )
                        }
                      >
                        <Download size={15} /> Exporter les traces
                      </button>
                    </div>
                    <div className="artifact-file">
                      <Layers3 size={25} />
                      <h3>mission.json</h3>
                      <p>État complet et sources de la mission</p>
                      <button
                        className="button secondary"
                        onClick={() =>
                          download(
                            "mission.json",
                            JSON.stringify(run, null, 2),
                            "application/json",
                          )
                        }
                      >
                        <Download size={15} /> Exporter la mission
                      </button>
                    </div>
                  </aside>
                </div>
              ) : (
                <section className="full-panel">
                  <Empty
                    icon={Archive}
                    title="Le rapport attend sa mission"
                    text="Le livrable sera disponible après l’analyse, le contrôle des preuves et votre validation."
                  />
                  <button
                    className="button primary"
                    onClick={() => setTab("mission")}
                  >
                    <Orbit size={15} /> Ouvrir l’observatoire
                  </button>
                </section>
              )}
            </>
          )}
          {tab === "compare" && (
            <section className="full-panel">
              <div className="section-title">
                <h2>Deux missions, des mesures comparables</h2>
              </div>
              <label className="compare-picker">
                Comparer la mission actuelle avec
                <select
                  value={compareId}
                  onChange={(e) => setCompareId(e.target.value)}
                >
                  <option value="">Choisir une mission sauvegardée</option>
                  {history
                    .filter((h) => h.id !== run?.id)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title} · {STATUS_LABEL[h.status]}
                      </option>
                    ))}
                </select>
              </label>
              {run && compareRun ? (
                <>
                  <div className="comparison-heading">
                    <span>
                      {run.title}
                      <ModeBadge mode={run.mode} />
                    </span>
                    <span>
                      {compareRun.title}
                      <ModeBadge mode={compareRun.mode} />
                    </span>
                  </div>
                  <div className="table-scroll">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>Mesure</th>
                          <th>Mission actuelle</th>
                          <th>Mission comparée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            "État",
                            STATUS_LABEL[run.status],
                            STATUS_LABEL[compareRun.status],
                          ],
                          [
                            "Étapes",
                            `${run.cursor}/7`,
                            `${compareRun.cursor}/7`,
                          ],
                          [
                            "Temps des outils",
                            duration(sumDuration(run)),
                            duration(sumDuration(compareRun)),
                          ],
                          [
                            "Sources",
                            run.sources.length,
                            compareRun.sources.length,
                          ],
                          [
                            "Constats",
                            run.findings.length,
                            compareRun.findings.length,
                          ],
                          [
                            "Tokens",
                            run.inputTokens + run.outputTokens,
                            compareRun.inputTokens + compareRun.outputTokens,
                          ],
                          [
                            "Contrôles réussis",
                            `${run.checks.filter((c) => c.passed).length}/${run.checks.length}`,
                            `${compareRun.checks.filter((c) => c.passed).length}/${compareRun.checks.length}`,
                          ],
                          [
                            "Rapport disponible",
                            run.report ? "Oui" : "Non",
                            compareRun.report ? "Oui" : "Non",
                          ],
                        ].map((row) => (
                          <tr key={row[0]}>
                            {row.map((cell, i) => (
                              <td key={i}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="panel-note">
                    Les durées dépendent du réseau et du fournisseur. La
                    quantité de constats ne mesure pas leur qualité. Les
                    scénarios et périmètres peuvent différer.
                  </p>
                </>
              ) : (
                <Empty
                  icon={GitBranch}
                  title="Il faut deux exécutions pour comparer"
                  text="Lancez deux missions, puis sélectionnez celle à comparer. Les résultats sont conservés côté serveur."
                />
              )}
            </section>
          )}
          {tab === "guide" && (
            <div className="guide-grid">
              <section className="guide-intro">
                <span className="eyebrow">RUNTIME / EXPLIQUÉ</span>
                <h2>
                  Un agent devient utile
                  <br />
                  quand on peut le suivre.
                </h2>
                <p>
                  Observatory décompose une mission en étapes. Chaque rôle
                  utilise un outil précis, produit une sortie inspectable et
                  sauvegarde un checkpoint. Vous décidez quand la mission peut
                  continuer.
                </p>
                <div className="guide-avatars">
                  {AGENTS.map((a) => (
                    <AgentAvatar
                      key={a.id}
                      name={customName(a.id)}
                      size={94}
                      animation={a.animation}
                    />
                  ))}
                </div>
              </section>
              <section className="guide-card">
                <span className="guide-number">01 / EXÉCUTION</span>
                <h3>Un pas, une preuve, un checkpoint.</h3>
                <p>
                  Le serveur exécute une étape par requête. Le mode automatique
                  de la page enchaîne ces requêtes. Fermer l’onglet arrête cet
                  enchaînement ; une étape déjà lancée peut finir et être
                  sauvegardée.
                </p>
                <p>
                  En revenant, la mission repart du dernier checkpoint. Un
                  verrou temporaire et une comparaison de révision empêchent
                  deux requêtes de sauvegarder simultanément la même étape.
                </p>
                <code>
                  plan → sources → analyse → contrôle → accord → rapport →
                  évaluation
                </code>
              </section>
              <section className="guide-card">
                <span className="guide-number">02 / MODÈLES</span>
                <h3>Deux modes, clairement séparés.</h3>
                <p>
                  <strong>Démo déterministe :</strong> des règles documentaires
                  extraient des constats des sources. Aucun modèle n’est appelé,
                  aucun token n’est facturé. Les deux scénarios intégrés
                  utilisent des documents d’exemple.
                </p>
                <p>
                  <strong>IA connectée :</strong> un modèle analyse les sources
                  et renvoie des constats structurés. La clé API reste côté
                  serveur. Le modèle, ses tokens et ses erreurs apparaissent
                  dans la mission.
                </p>
                <span className="config-state">
                  {liveEnabled
                    ? `IA disponible · ${model}`
                    : "IA non configurée sur cette instance"}
                </span>
              </section>
              <section className="guide-card">
                <span className="guide-number">03 / CONTRÔLE</span>
                <h3>Vous gardez la décision.</h3>
                <p>
                  Après l’analyse, le contrôleur vérifie que chaque constat
                  référence une source existante. La mission attend votre accord
                  avant de rédiger le rapport. Vous pouvez la mettre en pause ou
                  l’annuler.
                </p>
                <p>
                  La présence d’une référence ne prouve pas qu’un constat est
                  correct. Le rapport conserve cette limite. Aucun code du dépôt
                  et aucune commande système ne sont exécutés.
                </p>
                <div className="guide-callout">
                  <ShieldCheck size={21} /> Des références vérifiées. Une
                  interprétation à relire.
                </div>
              </section>
              <section className="guide-card">
                <span className="guide-number">04 / ARCHITECTURE</span>
                <h3>Des rôles visibles. Un moteur commun.</h3>
                <p>
                  Les quatre personnages sont des rôles du pipeline, pas quatre
                  modèles autonomes en parallèle. Les avatars, leurs formes et
                  leurs animations viennent du fork synchronisé d’Avatar Lab.
                </p>
                <p>
                  React affiche l’état. Les routes serveur appellent les outils.
                  D1 conserve les missions, les traces et les checkpoints. La
                  collecte GitHub lit des blobs épinglés et limite le volume de
                  sources.
                </p>
                <a
                  href="https://github.com/hemvall/avatar-lab"
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer Avatar Lab
                </a>
              </section>
              <section className="guide-card wide">
                <span className="guide-number">05 / LIMITES DU PROTOTYPE</span>
                <h3>Ce qui reste à industrialiser.</h3>
                <p>
                  L’exécution automatique nécessite une page ouverte. Il n’y a
                  pas encore de file de tâches autonome ni de garantie «
                  exactement une fois » pour les appels au modèle. Une panne
                  après l’appel et avant le checkpoint peut entraîner un nouvel
                  appel à la reprise. Les contrôles de qualité sont structurels
                  ; une évaluation métier reste nécessaire.
                </p>
                <p>
                  Les clés se configurent avec <code>OPENAI_API_KEY</code> et{" "}
                  <code>OPENAI_MODEL</code>. Aucun coût estimé n’est affiché
                  sans tarif fournisseur configuré. L’historique présente les 50
                  dernières missions.
                </p>
              </section>
            </div>
          )}
          <footer className="main-footer">
            <span>
              <Orbit size={14} /> OBSERVATORY
            </span>
            <span>Le travail est visible. La décision reste humaine.</span>
            <button onClick={() => setTab("guide")}>
              Comprendre le runtime
            </button>
          </footer>
        </main>
      </div>
      {source && (
        <div className="modal-backdrop" onClick={() => setSource(null)}>
          <section
            ref={dialogRef}
            className="source-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Source ${source.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <code>{source.id}</code>
                <h2>{source.name}</h2>
              </div>
              <button
                autoFocus
                className="icon-button"
                aria-label="Fermer la source"
                onClick={() => setSource(null)}
              >
                <X size={20} />
              </button>
            </header>
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer">
                Voir le blob d’origine sur GitHub
              </a>
            )}
            {source.truncated && (
              <p className="panel-note">
                Extrait limité par le budget de collecte de cette mission.
              </p>
            )}
            <pre>{source.content}</pre>
            <footer>
              <span>
                {source.content.length.toLocaleString("fr")} caractères
              </span>
              <button
                className="button secondary compact"
                onClick={() =>
                  download(source.name.replaceAll("/", "-"), source.content)
                }
              >
                <Download size={14} /> Télécharger
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Orbit;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
