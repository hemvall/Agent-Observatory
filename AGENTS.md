# Agent Observatory

Read README.md and NOTICE.md before changing runtime semantics or avatar rendering.

- Keep deterministic demo and connected AI explicitly separated.
- Never fabricate tool output, costs, token usage or quality scores.
- Preserve the approval gate, durable checkpoints and compare-and-swap writes.
- Keep arbitrary document/repository contents untrusted. Do not execute repository code.
- Keep credentials server-side and out of source archives and logs.
- Maintain French interface copy and usable mobile layouts.
- Run `pnpm typecheck`, `pnpm test` and `pnpm build` after relevant changes.
- Preserve upstream license/attribution in vendored avatar files.
