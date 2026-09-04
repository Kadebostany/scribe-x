import app from 'flarum/common/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Tooltip from 'flarum/common/components/Tooltip';
import type { Editor } from '@tiptap/core';
import { buttonsFor, DEFAULT_TOOLBAR, type ScribeButton } from '../toolbarButtons';

export interface ScribeToolbarAttrs extends ComponentAttrs {
  editor?: Editor;
  /** The driver re-renders us; we are not in Flarum's redraw cycle. */
  onChange: () => void;
}

/** Colours offered by the swatch row. Deliberately few — a forum post is not a design tool. */
const SWATCHES = ['#d83e3e', '#e8590c', '#f08c00', '#2f9e44', '#1971c2', '#6741d9', '#868e96'];

/** Mark name + attribute each colour prompt writes to. */
const COLOR_PROMPT_TARGET = {
  color: { mark: 'scribeColor', clearKey: 'clear_colour' },
  highlight: { mark: 'highlight', clearKey: 'clear_highlight' },
} as const;

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Preset defaults for the Info prompt's three colour fields. */
const INFO_DEFAULTS = { font: '#1E2019', bg: '#B8D3D1', border: '#B8D3D1' };

export default class ScribeToolbar extends Component<ScribeToolbarAttrs> {
  prompt: 'link' | 'image' | 'color' | 'highlight' | 'spoiler' | 'info' | null = null;
  value = '';
  infoFont = INFO_DEFAULTS.font;
  infoBg = INFO_DEFAULTS.bg;
  infoBorder = INFO_DEFAULTS.border;
  /**
   * 🚨 Not a custom picker — just a text field the OS/browser's own emoji
   * keyboard (Win+. / Cmd+Ctrl+Space / mobile emoji key) can type into.
   * Building a picker here would duplicate pianotell-flamoji's, which isn't
   * wired into TipTap at all (see the forum-flarum-2-rc-upgrades follow-up).
   * Prepended into the title once, on Apply — not itself round-tripped back
   * out when reopening an existing info box for editing.
   */
  infoEmoji = '';

  view() {
    const editor = this.attrs.editor;
    if (!editor) return null;

    const configured = app.forum.attribute<string[] | null>('scribeToolbar') ?? DEFAULT_TOOLBAR;

    return (
      <div className="Scribe-toolbarWrap">
        <div
          className="Scribe-toolbar"
          role="toolbar"
          aria-label={app.translator.trans('ernestdefoe-scribe.forum.composer.toolbar_label')}
        >
          {buttonsFor(configured).map((b) => this.button(b, editor))}
        </div>
        {this.prompt && this.promptRow(editor)}
      </div>
    );
  }

  button(b: ScribeButton, editor: Editor) {
    const label = app.translator.trans(`ernestdefoe-scribe.lib.buttons.${b.label}`);
    const active = b.active?.(editor) ?? false;

    return (
      <Tooltip text={label}>
        {Button.component({
          className:
            'Button Button--icon Button--link Scribe-toolbarButton' + (active ? ' is-active' : ''),
          icon: b.icon,
          // The pressed state is what tells a screen-reader user the cursor is
          // inside bold text, which sighted users read off the highlight.
          'aria-pressed': active ? 'true' : 'false',
          'aria-label': label,
          'data-badge': b.badge,
          disabled: b.enabled ? !b.enabled(editor) : false,
          onclick: () => {
            if (b.prompt) {
              this.openPrompt(b.prompt, editor);
            } else {
              b.run?.(editor);
            }
            this.attrs.onChange();
          },
        })}
      </Tooltip>
    );
  }

  openPrompt(kind: NonNullable<ScribeButton['prompt']>, editor: Editor) {
    // Reopening the same prompt closes it, so the button toggles.
    this.prompt = this.prompt === kind ? null : kind;
    if (kind === 'link') this.value = editor.getAttributes('link').href ?? '';
    else if (kind === 'spoiler') this.value = editor.getAttributes('scribeSpoiler').label ?? '';
    else if (kind === 'info') {
      const attrs = editor.getAttributes('scribeInfo');
      this.value = attrs.label ?? '';
      this.infoEmoji = '';
      this.infoFont = attrs.font ?? INFO_DEFAULTS.font;
      this.infoBg = attrs.bg ?? INFO_DEFAULTS.bg;
      this.infoBorder = attrs.border ?? INFO_DEFAULTS.border;
    } else this.value = '';
  }

  /**
   * 🚨 These three buttons open a form instead of toggling, and until this
   * existed they were wired to a no-op — present, labelled, styled, and doing
   * nothing. A control that looks like a feature and silently does nothing is
   * worse than one that is missing.
   */
  promptRow(editor: Editor) {
    const kind = this.prompt!;
    const close = () => {
      this.prompt = null;
      this.value = '';
      editor.commands.focus();
      this.attrs.onChange();
    };

    if (kind === 'color' || kind === 'highlight') {
      const { mark, clearKey } = COLOR_PROMPT_TARGET[kind];
      const applyColor = (c: string) => {
        editor.chain().focus().setMark(mark, { color: c }).run();
        close();
      };
      const hexValid = HEX_PATTERN.test(this.value.trim());

      return (
        <div className="Scribe-prompt Scribe-prompt--color">
          {SWATCHES.map((c) => (
            <button
              type="button"
              className="Scribe-swatch"
              style={{ background: c }}
              aria-label={c}
              title={c}
              onclick={() => applyColor(c)}
            />
          ))}
          <input
            className="FormControl Scribe-promptInput Scribe-promptHex"
            type="text"
            placeholder="#f08c00"
            value={this.value}
            oninput={(e: any) => {
              this.value = e.target.value;
              // Re-render so the Apply button's disabled state (derived from
              // this.value) updates as the user types, not just on the next
              // unrelated redraw.
              this.attrs.onChange();
            }}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter' && HEX_PATTERN.test(this.value.trim())) {
                e.preventDefault();
                applyColor(this.value.trim());
              } else if (e.key === 'Escape') {
                close();
              }
            }}
          />
          {Button.component(
            {
              className: 'Button Button--primary Scribe-promptApply',
              disabled: !hexValid,
              onclick: () => applyColor(this.value.trim()),
            },
            app.translator.trans('ernestdefoe-scribe.forum.composer.apply')
          )}
          {Button.component(
            {
              className: 'Button Button--link Scribe-promptClear',
              onclick: () => {
                editor.chain().focus().unsetMark(mark).run();
                close();
              },
            },
            app.translator.trans(`ernestdefoe-scribe.forum.composer.${clearKey}`)
          )}
        </div>
      );
    }

    if (kind === 'spoiler') {
      const apply = () => {
        editor.chain().focus().wrapIn('scribeSpoiler', { label: this.value.trim() }).run();
        close();
      };

      return (
        <div className="Scribe-prompt">
          <input
            className="FormControl Scribe-promptInput"
            type="text"
            placeholder={app.translator.trans(
              'ernestdefoe-scribe.forum.composer.spoiler_title_placeholder'
            ) as string}
            value={this.value}
            oninput={(e: any) => {
              this.value = e.target.value;
            }}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              } else if (e.key === 'Escape') {
                close();
              }
            }}
            oncreate={(v: any) => v.dom.focus()}
          />
          {Button.component(
            { className: 'Button Button--primary Scribe-promptApply', onclick: apply },
            app.translator.trans('ernestdefoe-scribe.forum.composer.apply')
          )}
        </div>
      );
    }

    if (kind === 'info') {
      const apply = () => {
        const emoji = this.infoEmoji.trim();
        const label = emoji ? `${emoji} ${this.value.trim()}`.trim() : this.value.trim();
        editor
          .chain()
          .focus()
          .wrapIn('scribeInfo', {
            label,
            font: HEX_PATTERN.test(this.infoFont) ? this.infoFont : null,
            bg: HEX_PATTERN.test(this.infoBg) ? this.infoBg : null,
            border: HEX_PATTERN.test(this.infoBorder) ? this.infoBorder : null,
          })
          .run();
        close();
      };

      const field = (value: string, set: (v: string) => void, placeholder: string, label: string) => (
        <input
          className="FormControl Scribe-promptInput"
          type="text"
          aria-label={label}
          placeholder={placeholder}
          value={value}
          oninput={(e: any) => set(e.target.value)}
        />
      );

      return (
        <div className="Scribe-prompt Scribe-prompt--info">
          <input
            className="FormControl Scribe-promptInput Scribe-promptEmoji"
            type="text"
            aria-label="emoji"
            placeholder="🙂"
            value={this.infoEmoji}
            oninput={(e: any) => (this.infoEmoji = e.target.value)}
          />
          {field(this.value, (v) => (this.value = v),
            app.translator.trans('ernestdefoe-scribe.forum.composer.info_title_placeholder') as string,
            app.translator.trans('ernestdefoe-scribe.forum.composer.info_title_placeholder') as string)}
          {field(this.infoFont, (v) => (this.infoFont = v), INFO_DEFAULTS.font, 'font colour')}
          {field(this.infoBg, (v) => (this.infoBg = v), INFO_DEFAULTS.bg, 'background colour')}
          {field(this.infoBorder, (v) => (this.infoBorder = v), INFO_DEFAULTS.border, 'border colour')}
          {Button.component(
            { className: 'Button Button--primary Scribe-promptApply', onclick: apply },
            app.translator.trans('ernestdefoe-scribe.forum.composer.apply')
          )}
        </div>
      );
    }

    const placeholder = app.translator.trans(
      `ernestdefoe-scribe.forum.composer.${kind === 'link' ? 'link_placeholder' : 'image_placeholder'}`
    );

    const apply = () => {
      const url = this.value.trim();
      if (!url) return close();
      if (kind === 'link') {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      } else {
        editor.chain().focus().setImage({ src: url }).run();
      }
      close();
    };

    return (
      <div className="Scribe-prompt">
        <input
          className="FormControl Scribe-promptInput"
          type="url"
          placeholder={placeholder as string}
          value={this.value}
          oninput={(e: any) => {
            this.value = e.target.value;
          }}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            } else if (e.key === 'Escape') {
              close();
            }
          }}
          oncreate={(v: any) => v.dom.focus()}
        />
        {Button.component(
          { className: 'Button Button--primary Scribe-promptApply', onclick: apply },
          app.translator.trans('ernestdefoe-scribe.forum.composer.apply')
        )}
        {kind === 'link' &&
          editor.isActive('link') &&
          Button.component(
            {
              className: 'Button Button--link',
              onclick: () => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                close();
              },
            },
            app.translator.trans('ernestdefoe-scribe.forum.composer.remove_link')
          )}
      </div>
    );
  }
}
