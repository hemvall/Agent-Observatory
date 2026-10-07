"use client";

import { useState } from "react";
import { FileText, Search, ShieldCheck } from "lucide-react";
import type { Finding, Source } from "@/lib/observatory/types";

const SEVERITIES = {
  critical: "Critique",
  warning: "À vérifier",
  info: "Information",
} as const;

export function FindingsPanel({
  findings,
  sources,
  reviewing,
  onSource,
}: {
  findings: Finding[];
  sources: Source[];
  reviewing: boolean;
  onSource: (source: Source, trigger: HTMLElement) => void;
}) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const matching = [...findings]
    .sort(
      (a, b) =>
        ["critical", "warning", "info"].indexOf(a.severity) -
        ["critical", "warning", "info"].indexOf(b.severity),
    )
    .filter(
      (finding) =>
        (severity === "all" || finding.severity === severity) &&
        `${finding.title} ${finding.detail}`
          .toLocaleLowerCase("fr")
          .includes(query.trim().toLocaleLowerCase("fr")),
    );
  return (
    <section
      className="findings-panel"
      id="mission-findings"
      tabIndex={-1}
      aria-labelledby="findings-title"
    >
      <div className="section-title">
        <span className="section-index">05</span>
        <h2 id="findings-title">Les priorités et leurs preuves</h2>
        <span className="findings-count">{findings.length} constats</span>
      </div>
      <p className="findings-intro">
        {reviewing
          ? "Avant de valider, relisez les constats et ouvrez les documents cités."
          : "Chaque constat est relié aux documents utilisés pendant l’analyse."}{" "}
        Une référence existante ne garantit pas que l’interprétation est
        correcte.
      </p>
      <div className="findings-toolbar">
        <label className="findings-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Rechercher dans les constats"
            type="search"
            placeholder="Rechercher un constat…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filtrer les constats par niveau"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
        >
          <option value="all">Tous les niveaux</option>
          {Object.entries(SEVERITIES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="findings-results" aria-live="polite">
        {matching.length ? (
          matching.map((finding, index) => (
            <article
              className={`finding-card ${finding.severity}`}
              key={`${finding.title}-${index}`}
            >
              <header>
                <span className={`finding-level ${finding.severity}`}>
                  {SEVERITIES[finding.severity]}
                </span>
                <span className="finding-ref-count">
                  {finding.sourceIds.length} références
                </span>
              </header>
              <h3>{finding.title}</h3>
              <p>{finding.detail}</p>
              {finding.action && (
                <div className="finding-action">
                  <strong>Action recommandée</strong>
                  <p>{finding.action}</p>
                </div>
              )}
              {finding.evidence?.map((proof, index) => (
                <details className="finding-proof" key={index}>
                  <summary>
                    Preuve ·{" "}
                    {sources.find((s) => s.id === proof.sourceId)?.name ||
                      proof.sourceId}{" "}
                    : ligne {proof.line}
                  </summary>
                  <pre>{proof.quote}</pre>
                </details>
              ))}
              <div className="finding-evidence">
                {finding.sourceIds.map((id) => {
                  const source = sources.find((item) => item.id === id);
                  return source ? (
                    <button
                      key={id}
                      onClick={(event) => onSource(source, event.currentTarget)}
                      title={`Lire ${source.name}`}
                    >
                      <FileText size={15} aria-hidden="true" />
                      <code>{id}</code>
                      <span>{source.name}</span>
                    </button>
                  ) : (
                    <span className="inline-error" key={id}>
                      Référence {id} indisponible
                    </span>
                  );
                })}
              </div>
            </article>
          ))
        ) : (
          <div className="findings-empty">
            <Search size={22} aria-hidden="true" />
            <p>Aucun constat ne correspond à ces filtres.</p>
            <button
              className="text-button"
              onClick={() => {
                setQuery("");
                setSeverity("all");
              }}
            >
              Afficher tous les constats
            </button>
          </div>
        )}
      </div>
      <p className="findings-note">
        <ShieldCheck size={15} aria-hidden="true" /> Lecture du code et des
        documents. Aucun code ni test du dépôt n’a été exécuté.
      </p>
    </section>
  );
}
