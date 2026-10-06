# Third-party attribution

Agent Observatory includes source and avatar definitions from Bible Strong Avatar Lab by Stéphane Montlouis-Calixte and contributors.

- Original: https://github.com/smontlouis/bible-strong-avatar-lab
- User fork: https://github.com/hemvall/avatar-lab
- Upstream integrated: `79fe9ba06e4874b11394b8e8a3f2c493c9d197ba`
- Synchronized fork: `a5f5a76f22d72507ef12664acb96f35714753bec`
- License: AGPL-3.0-only; full license included in `LICENSE`.

`vendor/avatar-core` and `vendor/avatar-react` preserve upstream source. The React renderer is adapted to apply the fork's shaded body gradient and preserve it during animated frame updates. `lib/avatars/bodyShading.ts` preserves the synchronized fork's gradient calculation. `lib/avatars/catalog.json` contains the 14 character definitions exported with the fork's own validated export API.

The rest of the application implements a new mission runtime and interface under the same license. Names of third-party characters are retained from the supplied library; no affiliation with their respective brands is claimed.
