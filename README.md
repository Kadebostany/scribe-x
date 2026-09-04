# scribeX

A fork of [ernestdefoe/scribe](https://github.com/ernestdefoe/scribe) — a true WYSIWYG
editor for Flarum 2, TipTap-based, with no Markdown anywhere in the stack.

> **This is a fork.** For the original project's design rationale, architecture
> writeup, and full feature set, see the upstream repo:
> **https://github.com/ernestdefoe/scribe**
>
> This README only covers what's *different* here.

## What's different in this fork

- **Text alignment** — left / center / right / justify, on paragraphs and
  headings.
- **Free-form colour** — text colour and highlight both accept any hex value,
  not just the swatch presets.
- **Spoiler blocks** — collapsible, with a title.
- **Info boxes** — a titled callout with configurable text/background/border
  colour.
- **Reply-gate blocks** — content that stays hidden until the reader has
  posted in the discussion.
- **Table styling** — reworked to look intentional out of the box, including
  legacy tables authored before this fork existed.
- **AdminCP toolbar builder fix** — dragging a feature into a second
  (wrapped) row of the toolbar now actually drops it there.

## Why fork instead of contribute upstream

Our main goal was to adapt the extension to our own forum's requirements without
touching the core extension files. We've kept this fork public because we think
the technical changes we've made could feed back into the upstream project too —
we follow the upstream repo ourselves for the real updates.

## Installation

Same as upstream — see [the original README](https://github.com/ernestdefoe/scribe#installation).

## Licence

MIT.
