import type { Source } from "./types";
export const SCENARIOS = [
  {
    id: "architecture",
    title: "Auditer un runtime d’agent",
    description:
      "Architecture, reprise après interruption et validation humaine.",
    objective:
      "Évaluer les fondations d’un runtime d’agent et proposer les prochaines étapes d’industrialisation.",
  },
  {
    id: "security",
    title: "Inspecter les risques IA",
    description: "Injection de prompt, droits des outils et données sensibles.",
    objective:
      "Identifier les risques d’un assistant connecté aux données d’entreprise et proposer des contrôles concrets.",
  },
  {
    id: "repository",
    title: "Explorer un dépôt GitHub",
    description: "Lire un dépôt public et produire un état des lieux sourcé.",
    objective:
      "Comprendre le fonctionnement du projet, analyser le code collecté et proposer des améliorations concrètes, justifiées par des extraits.",
  },
  {
    id: "documents",
    title: "Analyser vos documents",
    description: "Un texte réel, des constats et leurs références.",
    objective:
      "Analyser ces documents, identifier les risques et proposer un plan de mise en œuvre.",
  },
] as const;
export function fixtureSources(scenario: string): Source[] {
  if (scenario === "security")
    return [
      {
        id: "S1",
        name: "assistant-spec.md",
        content:
          "# Assistant entreprise\nUn assistant recherche dans le CRM et rédige des réponses commerciales. Les documents externes peuvent contenir des instructions. Les réponses doivent citer leurs sources. Le contenu retrouvé ne doit jamais remplacer les instructions système.",
      },
      {
        id: "S2",
        name: "tools-policy.md",
        content:
          "# Outils\nLes recherches CRM utilisent un compte de service. Les droits par utilisateur ne sont pas encore propagés. Un outil send_email est prévu ; toute action externe nécessite une validation humaine. Aucun envoi automatique n’est activé dans ce prototype.",
      },
      {
        id: "S3",
        name: "evaluation-plan.md",
        content:
          "# Évaluation\nTester les demandes normales, les sources contradictoires et les tentatives d’injection. Journaliser les appels d’outils sans clés API ni données personnelles. Les tests de refus et les tests de droits restent à créer.",
      },
    ];
  return [
    {
      id: "S1",
      name: "runtime-design.md",
      content:
        "# Runtime\nLe runtime coordonne un plan, une collecte de sources, une analyse et une vérification. Un checkpoint est sauvegardé après chaque étape. Le curseur permet la reprise. Les étapes sont déclenchées par le client ; aucune file de tâches autonome n’est encore configurée.",
    },
    {
      id: "S2",
      name: "execution-policy.md",
      content:
        "# Exécution\nUn verrou à durée limitée protège les étapes. Chaque écriture compare la révision attendue. Les appels au modèle ne sont pas exactement-once : après une panne, une requête peut être répétée. Les actions externes nécessitent une validation humaine. Le prototype ne lance aucune commande système.",
    },
    {
      id: "S3",
      name: "observability.md",
      content:
        "# Observabilité\nLes traces enregistrent les entrées, sorties, durées et tokens mesurés. Chaque constat référence un document. La qualité sémantique n’est pas garantie par le simple contrôle des références. Une suite de tests métier et un système de supervision sont nécessaires avant industrialisation.",
    },
    {
      id: "S4",
      name: "package.json",
      content:
        '{"name":"example-agent-runtime","scripts":{"test":"node --test","build":"tsc"},"dependencies":{"zod":"^3.25.0"}}',
    },
  ];
}
