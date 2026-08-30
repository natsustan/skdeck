# Skdeck

Skdeck imports complete Agent Skills from GitHub, pins immutable revisions in
named decks, and safely applies those decks to a project's `.agents/skills`.

```sh
npx skdeck
npx skdeck add https://github.com/owner/repo/tree/main/skills
npx skdeck use
npx skdeck remove
npx skdeck list
```

Requires Node.js 22 or newer and the system `git` command.

Skdeck never overwrites unmanaged skills or removes locally modified files.
