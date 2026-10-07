"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  FileText,
  GitBranch,
  History,
  Loader2,
  Orbit,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { AgentAvatar, AVATAR_NAMES } from "./agent-avatar";
import { FindingsPanel } from "./findings-panel";
import {
  AGENTS,
  PHASES,
  STATUS_LABEL,
  type Run,
  type Source,
} from "@/lib/observatory/types";
import { SCENARIOS } from "@/lib/observatory/fixtures";
const TechnicalView = lazy(() => import("./technical-observatory"));
type Summary = Pick<Run, "id" | "title" | "status" | "mode">;
type InputKind = "example" | "repository" | "documents";
const JOBS = [
  "Organise le travail",
  "Lit les documents",
  "Repère les points à vérifier",
  "Vérifie les références",
];
const TALK = [
  "Je prépare le plan.",
  "Je lis les documents.",
  "Je relève les points importants.",
  "Je vérifie les références.",
  "À toi de relire les constats !",
  "Je prépare ton rapport.",
  "Je vérifie le livrable.",
];
const NEXT = [
  "Je vais organiser l’analyse.",
  "Je vais lire les documents.",
  "Je vais relever les points importants.",
  "Je vais vérifier les références.",
  "J’attends ton accord.",
  "Je vais préparer ton rapport.",
  "Je vais vérifier le livrable.",
];
const STEP_NAMES = [
  "Préparation",
  "Lecture",
  "Analyse",
  "Vérification",
  "Votre accord",
  "Rapport",
  "Terminé",
];
async function request(path: string, body?: unknown) {
  const response = await fetch(path, {
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = (await response.json()) as {
    run: Run;
    runs: Summary[];
    liveEnabled: boolean;
    model: string;
    error?: string;
  };
  if (!response.ok)
    throw Object.assign(
      new Error(data.error || "Impossible de joindre le serveur. Réessayez."),
      { status: response.status },
    );
  return data;
}
function download(name: string, value: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function SourceReader({
  source,
  onClose,
}: {
  source: Source;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="so-source"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header>
        <div>
          <small>DOCUMENT UTILISÉ · {source.id}</small>
          <h2>{source.name}</h2>
        </div>
        <button
          className="so-icon"
          autoFocus
          onClick={onClose}
          aria-label="Fermer le document"
        >
          <X size={21} />
        </button>
      </header>
      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer">
          Ouvrir le document d’origine sur GitHub <ArrowRight size={15} />
        </a>
      )}
      {source.truncated && <p>Seul un extrait de ce document a été analysé.</p>}
      <pre>{source.content}</pre>
      <footer>
        {source.content.length.toLocaleString("fr")} caractères
        <button
          className="so-button quiet"
          onClick={() =>
            download(source.name.replaceAll("/", "-"), source.content)
          }
        >
          <Download size={15} /> Télécharger
        </button>
      </footer>
    </dialog>
  );
}
function Team({
  run,
  busy,
  selected,
  setSelected,
  avatars,
  onCustomize,
}: {
  run: Run | null;
  busy: boolean;
  selected: string;
  setSelected: (id: string) => void;
  avatars: Record<string, string>;
  onCustomize: (name: string) => void;
}) {
  const [greet, setGreet] = useState<string | null>(null);
  const greetingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (greetingTimer.current) clearTimeout(greetingTimer.current);
    },
    [],
  );
  const cursor = Math.min(run?.cursor || 0, 6);
  const current =
    run && ["running", "waiting", "failed"].includes(run.status)
      ? PHASES[cursor].agent
      : null;
  const completed = run?.status === "completed";
  const sleepy = run?.status === "paused" || run?.status === "cancelled";
  const title = !run
    ? "L’équipe attend ton premier contenu."
    : completed
      ? "Analyse terminée. À toi de jouer."
      : run.status === "waiting"
        ? "Une dernière décision t’appartient."
        : run.status === "paused"
          ? "Petite pause. On reprend quand tu veux."
          : run.status === "failed"
            ? "Une étape a rencontré un problème."
            : run.status === "cancelled"
              ? "Mission arrêtée. Les résultats sont conservés."
              : [
                  "On organise le travail.",
                  "On lit les documents.",
                  "On relève les points à vérifier.",
                  "On vérifie les références.",
                  "Ton accord est attendu.",
                  "On assemble ton rapport.",
                  "On vérifie le rapport.",
                ][cursor];
  function interact(id: string) {
    setSelected(id);
    setGreet(id);
    if (greetingTimer.current) clearTimeout(greetingTimer.current);
    greetingTimer.current = setTimeout(() => setGreet(null), 2000);
  }
  return (
    <section
      className="so-world"
      aria-label="Les quatre personnages et leur activité"
    >
      <div className="so-world-heading">
        <span>
          <span
            className={`so-live-dot ${run?.status === "running" ? "active" : ""}`}
          />{" "}
          L’ÉQUIPE
        </span>
        <small>Personnages d’Avatar Lab</small>
      </div>
      <h2 key={title} className="so-world-title">
        {title}
      </h2>
      <div className="so-world-stars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="so-team">
        {AGENTS.map((agent, index) => {
          const active = current === agent.id;
          const done =
            completed ||
            (Boolean(run?.traces.some((trace) => trace.agent === agent.id)) &&
              !active);
          const animation = sleepy
            ? "sleeping"
            : run?.status === "failed" && active
              ? "confused"
              : completed
                ? "happy"
                : run?.status === "waiting" && active
                  ? "listening"
                  : active
                    ? agent.animation
                    : greet === agent.id
                      ? "playful"
                      : index % 2
                        ? "curious"
                        : "idle";
          const speech = active
            ? run?.status === "failed"
              ? "On peut réessayer cette étape."
              : run?.status === "waiting"
                ? TALK[4]
                : busy
                  ? TALK[cursor]
                  : NEXT[cursor]
            : greet === agent.id
              ? "Prêt à t’aider !"
              : completed
                ? "C’est prêt !"
                : sleepy
                  ? "Zzz…"
                  : done
                    ? "Mon étape est sauvegardée."
                    : "À mon tour bientôt.";
          return (
            <button
              key={agent.id}
              className={`so-character ${active ? "is-working" : ""} ${completed ? "is-happy" : ""} ${sleepy ? "is-sleeping" : ""} ${selected === agent.id ? "is-selected" : ""}`}
              onClick={() => interact(agent.id)}
              aria-pressed={selected === agent.id}
              style={
                {
                  "--character-color": agent.color,
                  "--delay": `${index * -1.1}s`,
                } as CSSProperties
              }
            >
              <span
                className={`so-speech ${active || greet === agent.id || completed ? "show" : ""}`}
              >
                {speech}
              </span>
              <span className="so-character-scene">
                <span className="so-character-glow" />
                <span className="so-avatar-body">
                  <AgentAvatar
                    name={avatars[agent.id] || agent.avatar}
                    animation={animation}
                    lively
                    size={180}
                  />
                </span>
                <span className="so-shadow" />
                {active && run?.status === "running" && (
                  <span
                    className={`so-work-prop prop-${agent.id}`}
                    aria-hidden="true"
                  >
                    {agent.id === "researcher" ? (
                      <Search size={25} />
                    ) : agent.id === "reviewer" ? (
                      <ShieldCheck size={25} />
                    ) : (
                      <FileText size={25} />
                    )}
                    <i />
                    <i />
                  </span>
                )}
                {sleepy && (
                  <span className="so-zzz" aria-hidden="true">
                    z z z
                  </span>
                )}
              </span>
              <strong>{avatars[agent.id] || agent.avatar}</strong>
              <span className="so-job">{JOBS[index]}</span>
              <span className={`so-character-state ${active ? "active" : ""}`}>
                {active
                  ? run?.status === "waiting"
                    ? "Attend ton accord"
                    : run?.status === "failed"
                      ? "À reprendre"
                      : busy
                        ? "Travaille"
                        : "Se prépare"
                  : sleepy
                    ? "En pause"
                    : done
                      ? "Étape terminée"
                      : "Prêt"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="so-team-caption">
        <span>
          <Sparkles size={15} /> Clique sur un personnage pour le rencontrer.
        </span>
        <label>
          Son apparence{" "}
          <select
            aria-label="Choisir le personnage du rôle sélectionné"
            value={
              avatars[selected] ||
              AGENTS.find((agent) => agent.id === selected)!.avatar
            }
            onChange={(event) => onCustomize(event.target.value)}
          >
            {AVATAR_NAMES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
export default function Observatory() {
  const [technical, setTechnical] = useState(false);
  return technical ? (
    <>
      <div className="so-technical-return">
        <button onClick={() => setTechnical(false)}>
          <ArrowRight size={17} /> Revenir à la vue simple
        </button>
        <span>Vue technique : outils, traces et comparaison</span>
      </div>
      <Suspense
        fallback={<p className="so-loading">Chargement de la vue technique…</p>}
      >
        <TechnicalView />
      </Suspense>
    </>
  ) : (
    <Workspace onTechnical={() => setTechnical(true)} />
  );
}
function Workspace({ onTechnical }: { onTechnical: () => void }) {
  const [kind, setKind] = useState<InputKind>("example");
  const [example, setExample] = useState("architecture");
  const [repository, setRepository] = useState("hemvall/avatar-lab");
  const [documentText, setDocumentText] = useState("");
  const [objective, setObjective] = useState("");
  const [mode, setMode] = useState<Run["mode"]>("demo");
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [model, setModel] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<Summary[]>([]);
  const [selected, setSelected] = useState("planner");
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [stepping, setStepping] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const selectedId = useRef<string | null>(null);
  const navigation = useRef(0);
  const inFlight = useRef(new Set<string>());
  const inspection = useRef<Run | null>(null);
  const results = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!run || !window.matchMedia("(max-width: 760px)").matches) return;
    const frame = requestAnimationFrame(() =>
      stage.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [run?.id]);
  function receive(next: Run) {
    if (selectedId.current === next.id)
      setRun((previous) =>
        previous?.id === next.id && previous.revision >= next.revision
          ? previous
          : next,
      );
  }
  async function refreshHistory() {
    try {
      setHistory((await request("/api/runs")).runs);
    } catch {
      /* Last saved history remains visible. */
    }
  }
  useEffect(() => {
    let active = true;
    const initial = navigation.current;
    void (async () => {
      try {
        const [list, config] = await Promise.all([
          request("/api/runs"),
          request("/api/config"),
        ]);
        if (!active) return;
        setHistory(list.runs);
        setLiveEnabled(config.liveEnabled);
        setModel(config.model);
        try {
          const preferences = JSON.parse(
            localStorage.getItem("observatory-avatar-preferences") || "{}",
          );
          setAvatars(
            Object.fromEntries(
              AGENTS.flatMap((agent) =>
                AVATAR_NAMES.includes(preferences?.[agent.id])
                  ? [[agent.id, preferences[agent.id]]]
                  : [],
              ),
            ),
          );
        } catch {
          /* Optional preferences. */
        }
        const id = new URLSearchParams(window.location.search).get("run");
        if (
          id &&
          /^[0-9a-f-]{36}$/i.test(id) &&
          navigation.current === initial
        ) {
          selectedId.current = id;
          const response = await request(`/api/runs/${id}`);
          if (active && navigation.current === initial) receive(response.run);
        }
      } catch (exception) {
        if (active && navigation.current === initial)
          setError((exception as Error).message);
      } finally {
        if (active && navigation.current === initial) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!run) return;
    const id = run.id;
    let active = true;
    const timer = setInterval(() => {
      void request(`/api/runs/${id}`)
        .then((response) => {
          if (active) {
            receive(response.run);
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
  }, [run?.id]);
  useEffect(() => {
    if (
      !run ||
      run.status !== "running" ||
      offline ||
      inFlight.current.has(run.id)
    )
      return;
    const id = run.id;
    // Give each saved step time to be understood; this is UI pacing, not tool latency.
    const timer = setTimeout(
      () => void advance(id),
      Math.max(3600, run.lockedUntil - Date.now() + 100),
    );
    return () => clearTimeout(timer);
  }, [run?.id, run?.revision, run?.status, run?.lockedUntil, offline]);
  useEffect(() => {
    inspection.current = run;
  }, [run]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => unknown;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "inspect_selected_mission",
            description:
              "Lire la mission sélectionnée, ses constats et ses références. Ne modifie aucune donnée.",
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
              const value = inspection.current;
              return value
                ? {
                    id: value.id,
                    status: value.status,
                    findings: value.findings,
                    checks: value.checks,
                    traces: value.traces.slice(-3),
                  }
                : { selectedMission: null };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
    return () => lifecycle.abort();
  }, []);
  async function advance(id: string) {
    if (selectedId.current !== id || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setStepping(id);
    try {
      const response = await request(`/api/runs/${id}`, { action: "advance" });
      receive(response.run);
      void refreshHistory();
    } catch (exception) {
      if (
        selectedId.current === id &&
        (exception as { status?: number }).status !== 409
      )
        setError((exception as Error).message);
      try {
        receive((await request(`/api/runs/${id}`)).run);
      } catch {
        /* Polling retries. */
      }
    } finally {
      inFlight.current.delete(id);
      setStepping((previous) => (previous === id ? null : previous));
    }
  }
  async function act(action: string) {
    if (!run || busy) return;
    const id = run.id;
    setBusy(true);
    setError("");
    try {
      receive((await request(`/api/runs/${id}`, { action })).run);
      void refreshHistory();
    } catch (exception) {
      if (selectedId.current === id) setError((exception as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function launch() {
    if (busy || loading) return;
    const version = ++navigation.current;
    setBusy(true);
    setError("");
    setReportOpen(false);
    const scenario = kind === "example" ? example : kind;
    const preset = SCENARIOS.find((item) => item.id === scenario)!;
    try {
      const response = await request("/api/runs", {
        scenario,
        objective: objective.trim() || preset.objective,
        repository,
        document: documentText,
        mode,
      });
      void refreshHistory();
      if (navigation.current !== version) return;
      selectedId.current = response.run.id;
      setRun(response.run);
      setSelected("planner");
      setOffline(false);
      window.history.replaceState(null, "", `?run=${response.run.id}`);
    } catch (exception) {
      if (navigation.current === version)
        setError((exception as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    if (!id) return;
    const version = ++navigation.current;
    selectedId.current = id;
    setRun(null);
    setLoading(true);
    setError("");
    setReportOpen(false);
    setOffline(false);
    try {
      const response = await request(`/api/runs/${id}`);
      if (version === navigation.current) {
        receive(response.run);
        window.history.replaceState(null, "", `?run=${id}`);
      }
    } catch (exception) {
      if (version === navigation.current)
        setError((exception as Error).message);
    } finally {
      if (version === navigation.current) setLoading(false);
    }
  }
  function reset() {
    navigation.current++;
    selectedId.current = null;
    setRun(null);
    setLoading(false);
    setError("");
    setReportOpen(false);
    setOffline(false);
    window.history.replaceState(null, "", window.location.pathname);
  }
  function reuse() {
    if (!run) return;
    setKind(
      run.scenario === "repository" || run.scenario === "documents"
        ? run.scenario
        : "example",
    );
    setExample(run.scenario === "security" ? "security" : "architecture");
    setRepository(run.repository);
    setDocumentText(run.document);
    setObjective(run.objective);
    setMode(run.mode === "live" && !liveEnabled ? "demo" : run.mode);
    reset();
  }
  function customize(name: string) {
    const preferences = { ...avatars, [selected]: name };
    setAvatars(preferences);
    try {
      localStorage.setItem(
        "observatory-avatar-preferences",
        JSON.stringify(preferences),
      );
    } catch {
      /* Device preference only. */
    }
  }
  function showResults() {
    const element = results.current;
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  const running = run?.status === "running";
  const activeStep = Math.min(run?.cursor || 0, 6);
  return (
    <div className="simple-observatory">
      <header className="so-header">
        <a className="so-brand" href="/">
          <Orbit size={27} />
          <span>
            Agent <strong>Observatory</strong>
          </span>
        </a>
        <div className="so-header-actions">
          <label className="so-history">
            <History size={17} />
            <select
              aria-label="Ouvrir une analyse sauvegardée"
              value={run?.id || ""}
              onChange={(event) => void open(event.target.value)}
            >
              <option value="">Mes analyses</option>
              {history.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {STATUS_LABEL[item.status]}
                </option>
              ))}
            </select>
          </label>
          {run && (
            <button className="so-button quiet" onClick={reset}>
              <Plus size={16} /> Nouvelle analyse
            </button>
          )}
        </div>
      </header>
      <main className="so-main">
        <div className="so-intro">
          <span className="so-eyebrow">
            UN CONTENU. UNE ÉQUIPE. UN DIAGNOSTIC.
          </span>
          <h1>
            Comprends ce qui fonctionne.
            <br />
            <span>Repère ce qu’il faut améliorer.</span>
          </h1>
          <p>
            Donne un document technique ou un dépôt GitHub à l’équipe. Elle le
            lit, relève les points à vérifier et te prépare un rapport avec ses
            sources.
          </p>
        </div>
        <div className="so-journey" aria-label="Le parcours">
          <span className={!run ? "current" : "done"}>
            <b>{run ? <Check size={14} /> : "1"}</b>Choisis ton contenu
          </span>
          <ArrowRight size={17} />
          <span
            className={
              run && !["completed", "cancelled"].includes(run.status)
                ? "current"
                : run?.status === "completed"
                  ? "done"
                  : ""
            }
          >
            <b>2</b>Regarde l’équipe travailler
          </span>
          <ArrowRight size={17} />
          <span className={run?.status === "completed" ? "current" : ""}>
            <b>3</b>Lis ton diagnostic
          </span>
        </div>
        {error && (
          <div className="so-alert" role="alert">
            <span>{error}</span>
            <button
              className="so-icon"
              aria-label="Fermer le message"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {offline && (
          <p className="so-alert" role="status">
            Connexion interrompue. Le dernier état reçu reste visible ;
            l’actualisation reprend automatiquement.
          </p>
        )}
        <div className="so-workspace">
          <section className="so-task">
            {!run ? (
              <>
                <span className="so-eyebrow">01 / LE CONTENU</span>
                <h2>Que veux-tu analyser ?</h2>
                <p className="so-task-copy">
                  Commence par un exemple, ou apporte ton propre contenu.
                </p>
                <div
                  className="so-input-tabs"
                  role="group"
                  aria-label="Type de contenu"
                >
                  <button
                    aria-pressed={kind === "example"}
                    onClick={() => setKind("example")}
                  >
                    <Sparkles size={16} /> Exemple
                  </button>
                  <button
                    aria-pressed={kind === "repository"}
                    onClick={() => setKind("repository")}
                  >
                    <GitBranch size={16} /> GitHub
                  </button>
                  <button
                    aria-pressed={kind === "documents"}
                    onClick={() => setKind("documents")}
                  >
                    <FileText size={16} /> Texte
                  </button>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void launch();
                  }}
                >
                  {kind === "example" ? (
                    <div className="so-example-options">
                      {[
                        {
                          id: "architecture",
                          name: "Un projet d’agent IA",
                          text: "Peut-il reprendre après une panne ? Quelles sont ses limites ?",
                          icon: Orbit,
                        },
                        {
                          id: "security",
                          name: "Un assistant d’entreprise",
                          text: "Ses accès et ses actions sont-ils bien encadrés ?",
                          icon: ShieldCheck,
                        },
                      ].map((item) => (
                        <label
                          key={item.id}
                          className={example === item.id ? "chosen" : ""}
                        >
                          <input
                            type="radio"
                            name="example"
                            value={item.id}
                            checked={example === item.id}
                            onChange={() => setExample(item.id)}
                          />
                          <item.icon size={23} />
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.text}</small>
                          </span>
                          <Check size={16} className="so-choice-check" />
                        </label>
                      ))}
                      <p className="so-fixture-note">
                        Exemples fictifs fournis avec l’app. Aucun compte
                        requis.
                      </p>
                    </div>
                  ) : kind === "repository" ? (
                    <label className="so-field">
                      Lien du dépôt public
                      <input
                        value={repository}
                        onChange={(event) => setRepository(event.target.value)}
                        placeholder="https://github.com/proprietaire/projet"
                        maxLength={180}
                        required
                      />
                      <small>
                        L’équipe lit les documents et configurations. Elle
                        n’exécute pas le code.
                      </small>
                    </label>
                  ) : (
                    <label className="so-field">
                      Ton document
                      <textarea
                        rows={7}
                        value={documentText}
                        onChange={(event) =>
                          setDocumentText(event.target.value)
                        }
                        placeholder="Colle une spécification, une description d’architecture ou un document de projet…"
                        minLength={40}
                        maxLength={40000}
                        required
                      />
                      <small>
                        {documentText.length.toLocaleString("fr")} / 40 000
                        caractères · 40 minimum
                      </small>
                    </label>
                  )}
                  <details className="so-options">
                    <summary>
                      <Settings2 size={16} /> Adapter l’analyse{" "}
                      <ChevronDown size={15} />
                    </summary>
                    <label className="so-field">
                      Ce que tu veux vérifier
                      <input
                        value={objective}
                        onChange={(event) => setObjective(event.target.value)}
                        minLength={12}
                        maxLength={2000}
                        placeholder="Laisse vide pour utiliser l’objectif proposé"
                      />
                    </label>
                    <label className="so-field">
                      Mode d’analyse
                      <select
                        value={mode}
                        onChange={(event) =>
                          setMode(event.target.value as Run["mode"])
                        }
                      >
                        <option value="demo">Démo, sans modèle IA</option>
                        <option value="live" disabled={!liveEnabled}>
                          IA connectée{" "}
                          {liveEnabled ? `· ${model}` : "· non configurée"}
                        </option>
                      </select>
                    </label>
                  </details>
                  <button
                    className="so-button primary so-launch"
                    disabled={busy || loading}
                  >
                    {busy || loading ? (
                      <Loader2 size={19} className="spin" />
                    ) : (
                      <Play size={19} />
                    )}{" "}
                    {loading
                      ? "Chargement…"
                      : busy
                        ? "Lancement…"
                        : "Lancer l’analyse"}
                    <ArrowRight size={19} />
                  </button>
                  <p className="so-mode-note">
                    {mode === "demo"
                      ? "Mode démo : de vraies étapes et des règles documentaires, sans appel à un modèle IA."
                      : `Mode IA : l’analyse appelle ${model}. Les tokens utilisés sont enregistrés.`}
                  </p>
                </form>
              </>
            ) : (
              <>
                <span className="so-eyebrow">TON ANALYSE</span>
                <h2 className="so-run-title">
                  {run.scenario === "architecture"
                    ? "Un projet d’agent IA"
                    : run.scenario === "security"
                      ? "Un assistant d’entreprise"
                      : run.scenario === "repository"
                        ? run.repository
                        : "Ton document"}
                </h2>
                <p className="so-task-copy">{run.objective}</p>
                <span className={`so-status status-${run.status}`}>
                  {STATUS_LABEL[run.status]}
                </span>
                <ol className="so-steps">
                  {STEP_NAMES.map((name, index) => (
                    <li
                      key={name}
                      className={
                        index < run.cursor
                          ? "done"
                          : index === activeStep && run.status !== "completed"
                            ? "current"
                            : ""
                      }
                    >
                      <span>
                        {index < run.cursor ? <Check size={14} /> : index + 1}
                      </span>
                      <div>
                        <strong>{name}</strong>
                        {index === activeStep && running && (
                          <small>
                            {stepping === run.id
                              ? "En cours…"
                              : "Prochaine étape"}
                          </small>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                {run.error && <p className="so-inline-error">{run.error}</p>}
                <div className="so-run-buttons">
                  {running && (
                    <button
                      className="so-button quiet"
                      disabled={busy}
                      onClick={() => void act("pause")}
                    >
                      <Pause size={17} /> Mettre en pause
                    </button>
                  )}
                  {["paused", "failed"].includes(run.status) && (
                    <button
                      className="so-button primary"
                      disabled={busy}
                      onClick={() => void act("resume")}
                    >
                      <Play size={17} /> Reprendre
                    </button>
                  )}
                  {run.findings.length > 0 && (
                    <button className="so-button quiet" onClick={showResults}>
                      <FileText size={17} /> Voir les constats
                    </button>
                  )}
                  {!["completed", "cancelled"].includes(run.status) && (
                    <button
                      className="so-button stop"
                      disabled={busy}
                      onClick={() => void act("cancel")}
                    >
                      <Square size={14} /> Arrêter
                    </button>
                  )}
                  {["completed", "cancelled", "paused", "failed"].includes(
                    run.status,
                  ) && (
                    <button className="so-button quiet" onClick={reuse}>
                      <Plus size={16} /> Réutiliser ce contenu
                    </button>
                  )}
                </div>
                <p className="so-mode-note">
                  {run.mode === "demo"
                    ? "Démo sans modèle IA. Les constats proviennent de règles documentaires."
                    : `Analyse IA · ${run.model || model}`}{" "}
                  {running && "Garde cette page ouverte pendant l’analyse."}
                </p>
              </>
            )}
          </section>
          <div
            ref={stage}
            className={`so-stage-column ${run ? "has-mission" : ""}`}
          >
            <Team
              run={run}
              busy={stepping === run?.id}
              selected={selected}
              setSelected={setSelected}
              avatars={avatars}
              onCustomize={customize}
            />
            <div className="so-output-preview">
              {run?.traces.length ? (
                <>
                  <span className="so-output-icon">
                    <CheckCheck size={21} />
                  </span>
                  <div>
                    <small>DERNIÈRE ÉTAPE TERMINÉE</small>
                    <p key={run.traces.at(-1)!.id}>
                      {run.traces.at(-1)!.summary}
                    </p>
                  </div>
                  <span className="so-saved">Sauvegardé</span>
                </>
              ) : (
                <>
                  <span className="so-output-icon">
                    <FileText size={21} />
                  </span>
                  <div>
                    <small>CE QUE TU OBTIENS</small>
                    <p>
                      Des constats à relire, leurs documents d’origine et un
                      rapport téléchargeable.
                    </p>
                  </div>
                </>
              )}
            </div>
            <details className="so-explanation">
              <summary>
                <Orbit size={17} /> À quoi sert cette app ?{" "}
                <ChevronDown size={16} />
              </summary>
              <p>
                Agent Observatory rend une analyse documentaire facile à suivre.
                Par exemple : repérer les limites décrites dans un projet
                d’agent IA ou les accès à vérifier dans une spécification.
              </p>
              <p>
                Les personnages représentent quatre rôles d’un même processus :
                organiser, lire, analyser et vérifier. Ils montrent où en est le
                travail. Ils ne sont pas quatre modèles indépendants.
              </p>
              <p>
                En démo, des règles cherchent des mentions de reprise, de
                droits, de tests ou de validation. Le mode IA utilise un modèle
                configuré côté serveur. Tu relis les constats avant d’autoriser
                le rapport.
              </p>
            </details>
          </div>
        </div>
        {run && run.findings.length > 0 && (
          <section
            ref={results}
            className="so-results"
            tabIndex={-1}
            aria-labelledby="so-results-title"
          >
            <div className="so-results-heading">
              <div>
                <span className="so-eyebrow">03 / TON DIAGNOSTIC</span>
                <h2 id="so-results-title">Voilà ce que l’équipe a trouvé.</h2>
                <p>Ouvre les sources pour vérifier chaque constat.</p>
              </div>
              <span className="so-result-stamp">
                <ShieldCheck size={23} />
                {run.status === "completed" ? "Rapport disponible" : "À relire"}
              </span>
            </div>
            <FindingsPanel
              key={run.id}
              findings={run.findings}
              sources={run.sources}
              reviewing={run.status === "waiting"}
              onSource={(value) => setSource(value)}
            />
            {run.status === "waiting" && (
              <div className="so-approval">
                <AgentAvatar
                  name={avatars.reviewer || "Beebo"}
                  animation="listening"
                  lively
                  size={80}
                />
                <div>
                  <h3>Tu as relu les constats ?</h3>
                  <p>
                    Ton accord permet de les assembler dans le rapport final.
                  </p>
                </div>
                <button
                  className="so-button primary"
                  disabled={busy}
                  onClick={() => void act("approve")}
                >
                  <Check size={18} /> Créer le rapport
                </button>
              </div>
            )}
            {run.report && (
              <div className="so-report">
                <div className="so-report-heading">
                  <div>
                    <h3>Ton rapport est prêt.</h3>
                    <p>Garde une copie de l’analyse et des références.</p>
                  </div>
                  <button
                    className="so-button primary"
                    onClick={() => download("rapport.md", run.report)}
                  >
                    <Download size={17} /> Télécharger le rapport
                  </button>
                  <button
                    className="so-button quiet"
                    aria-expanded={reportOpen}
                    onClick={() => setReportOpen(!reportOpen)}
                  >
                    {reportOpen ? "Masquer" : "Lire ici"}
                    <ChevronDown size={16} />
                  </button>
                </div>
                {reportOpen && (
                  <article className="so-report-content">
                    {run.report
                      .split("\n")
                      .map((line, index) =>
                        line.startsWith("### ") ? (
                          <h4 key={index}>{line.slice(4)}</h4>
                        ) : line.startsWith("## ") ? (
                          <h3 key={index}>{line.slice(3)}</h3>
                        ) : line.startsWith("# ") ? (
                          <h2 key={index}>{line.slice(2)}</h2>
                        ) : line ? (
                          <p key={index}>{line}</p>
                        ) : (
                          <br key={index} />
                        ),
                      )}
                  </article>
                )}
              </div>
            )}
            <details className="so-explanation so-evidence">
              <summary>
                <FileText size={17} /> Documents, contrôles et détails de
                l’analyse <ChevronDown size={16} />
              </summary>
              <div className="so-source-buttons">
                {run.sources.map((item) => (
                  <button
                    key={item.id}
                    className="so-button quiet"
                    onClick={() => setSource(item)}
                  >
                    <FileText size={15} />
                    {item.id} · {item.name}
                  </button>
                ))}
              </div>
              {run.checks.map((item) => (
                <p key={item.name}>
                  <strong>
                    {item.passed ? "✓" : "✕"} {item.name}
                  </strong>
                  <br />
                  {item.detail}
                </p>
              ))}
              <p>
                {run.inputTokens + run.outputTokens} tokens mesurés ·{" "}
                {run.traces.length} étapes enregistrées
              </p>
              <div className="so-source-buttons">
                <button
                  className="so-button quiet"
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
                <button
                  className="so-button quiet"
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
            </details>
          </section>
        )}
      </main>
      <footer className="so-footer">
        <span>
          <Orbit size={16} /> Agent Observatory{" "}
          <small>Lecture seule. Une aide au diagnostic, à relire.</small>
        </span>
        <div>
          <button onClick={onTechnical}>
            Vue technique <Settings2 size={15} />
          </button>
          <a
            href="https://github.com/hemvall/Agent-Observatory"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a href="/api/source">Source · AGPL-3.0</a>
        </div>
      </footer>
      {source && (
        <SourceReader source={source} onClose={() => setSource(null)} />
      )}
    </div>
  );
}
