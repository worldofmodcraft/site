# worldofmodcraft/site

The static portal served at [worldofmodcraft.com](https://worldofmodcraft.com).

This repository holds the site generator, not the site's content. Every mod page, the browse
view and the search index are **generated** from two sources and from nothing else:

- `worldofmodcraft/registry` — the entry and page data for every published mod.
- The platform's own archived source tarballs — where each mod's README and screenshots are read
  from, never from the author's live repository (ADR-0059).

Nothing here is edited by hand to change what a page says. To change a mod's page, change that
mod's `page.json` in the registry.

## Status

The platform is in development. The site is being built as part of mission SITE-V1; until that
mission's first build is deployed, this repository does not yet serve anything.

## Where the project is decided

Design decisions, the task ledger and the operating doctrine live in
[worldofmodcraft/platform](https://github.com/worldofmodcraft/platform). Read the decision log
there before proposing changes here — this repository implements decisions, it does not make them.

## Licence

AGPL-3.0-or-later, per ADR-0049: the site generator is platform code, and platform code is
copyleft so that no closed World of Modcraft can exist.
