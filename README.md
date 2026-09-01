# Scribe

A true WYSIWYG editor for Flarum 2 — TipTap, with **no Markdown anywhere in the stack**.

Both `flarum/markdown` and `fof/rich-text` can be uninstalled. Existing posts keep
rendering exactly as they did, with no migration and no rewritten rows.

## Why this exists

Every WYSIWYG editor for Flarum so far has been a rich editor sitting *on top of*
Markdown: the document is serialised to Markdown on submit and re-parsed on load.
That is why `flarum/markdown` is a hard dependency of `fof/rich-text`, and why
Markdown syntax keeps leaking into a supposedly what-you-see-is-what-you-get
experience — type `**bold**` and it turns bold, paste code with underscores and it
turns italic.

Scribe removes the Markdown layer entirely. TipTap already speaks HTML natively,
so dropping Markdown makes the pipeline *simpler*, not harder.

## How existing posts survive

Flarum stores posts as s9e TextFormatter XML, not as source text. The tag
vocabulary in that XML — `STRONG`, `EM`, `H2`, `LIST`, `LI`, `C` … — belongs to
s9e, not to Markdown. Markdown was only ever one parser feeding those tags.

Scribe emits the same vocabulary from HTML, and supplies templates for the tags
`flarum/markdown` used to own. So a post written in 2024 with Markdown and a post
written today in Scribe are the same shape in the database and share one render
path.

Uninstalling `flarum/markdown` without this would silently flatten every post you
have: the text survives, every heading, bold, list and code span does not.

## Beyond Markdown

Because posts no longer have to be expressible in Markdown, Scribe adds what
Markdown could not represent:

- **Tables** — s9e's Litedown has no table syntax at all, so on a Markdown forum a
  table renders as a paragraph full of pipes.
- **Text colour**, underline and highlight.

## Licence

MIT.
