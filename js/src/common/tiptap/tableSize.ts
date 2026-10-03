import { TableRow } from '@tiptap/extension-table';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { isInTable, selectedRect } from '@tiptap/pm/tables';

/**
 * Row height, by drag and by number.
 *
 * prosemirror-tables ships column resizing only, so rows get their own small
 * plugin here. The height is a MINIMUM, never a fixed size — a `<tr>` height
 * in CSS can't shrink a row below its content, which is exactly what we want:
 * this is for adding air to a small table, not for clipping text.
 *
 * 🚨 Stored as `data-row-height`, not `height`. The server reads it through
 * Vocabulary::SOURCE_ATTRIBUTES, which maps by attribute NAME across every
 * tag — a generic `height` alias would one day collide with IMG's own.
 */

import { MIN_TABLE_SIZE, MAX_TABLE_SIZE } from '../toolbarButtons';

/** How close (px) to a row's bottom edge the pointer must be to grab it. */
const HANDLE = 5;

const key = new PluginKey<number>('scribeRowResize');

const clampSize = (n: number) => Math.max(MIN_TABLE_SIZE, Math.min(MAX_TABLE_SIZE, Math.round(n)));

export const ScribeTableRow = TableRow.extend({
  addAttributes() {
    return {
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => parseInt(el.getAttribute('data-row-height') ?? '', 10) || null,
        renderHTML: (attrs: Record<string, any>) =>
          attrs.height ? { 'data-row-height': attrs.height, style: `height: ${attrs.height}px` } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    return [rowResizing()];
  },

  /*
   * 🚨 Commands + storage, not plain exported helpers. The toolbar lives in
   * the main forum bundle and TipTap is lazy-loaded (forum/tiptap/boot); a
   * direct import from here dragged all of TipTap/ProseMirror into forum.js.
   * Going through the editor instance keeps the toolbar import-free.
   */
  addCommands() {
    return {
      setRowHeight:
        (height: number | null) =>
        ({ state, dispatch }) =>
          setRowHeight(state, height, dispatch),
      setColumnWidth:
        (width: number | null) =>
        ({ state, dispatch }) =>
          setColumnWidth(state, width, dispatch),
    };
  },

  addStorage() {
    return { rowHeight: currentRowHeight, columnWidth: currentColumnWidth };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    scribeTableSize: {
      /** `null` clears it back to the natural, content-driven size. */
      setRowHeight: (height: number | null) => ReturnType;
      setColumnWidth: (width: number | null) => ReturnType;
    };
  }
}

type Dispatch = ((tr: Transaction) => void) | undefined;

/** Position of the tableRow node whose <tr> is `tr`, or -1. */
function rowPosFromDOM(view: EditorView, tr: Element): number {
  const $pos = view.state.doc.resolve(view.posAtDOM(tr, 0));
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'tableRow') return $pos.before(d);
  }
  return -1;
}

/** The <tr> whose bottom edge the pointer is on, if any. */
function rowEdgeAt(view: EditorView, e: MouseEvent): HTMLTableRowElement | null {
  const tr = (e.target as Element | null)?.closest?.('tr');
  if (!tr || !view.dom.contains(tr)) return null;
  const bottom = tr.getBoundingClientRect().bottom;
  return bottom - e.clientY <= HANDLE && bottom - e.clientY >= -1 ? tr : null;
}

function setHover(view: EditorView, pos: number) {
  if (key.getState(view.state) !== pos) view.dispatch(view.state.tr.setMeta(key, pos));
}

function rowResizing() {
  return new Plugin<number>({
    key,
    state: {
      init: () => -1,
      apply: (tr: Transaction, prev: number) => {
        const meta = tr.getMeta(key);
        if (meta !== undefined) return meta;
        return prev === -1 || !tr.docChanged ? prev : tr.mapping.map(prev);
      },
    },
    props: {
      attributes: (state: EditorState): Record<string, string> =>
        key.getState(state)! > -1 ? { class: 'row-resize-cursor' } : {},

      decorations(state: EditorState) {
        const pos = key.getState(state)!;
        const node = pos > -1 ? state.doc.nodeAt(pos) : null;
        if (!node || node.type.name !== 'tableRow') return null;
        return DecorationSet.create(state.doc, [
          Decoration.node(pos, pos + node.nodeSize, { class: 'Scribe-rowResizeHover' }),
        ]);
      },

      handleDOMEvents: {
        mousemove(view, e) {
          if (!view.editable || (e as MouseEvent).buttons) return false;
          const tr = rowEdgeAt(view, e as MouseEvent);
          setHover(view, tr ? rowPosFromDOM(view, tr) : -1);
          return false;
        },

        mouseleave(view) {
          setHover(view, -1);
          return false;
        },

        mousedown(view, event) {
          const e = event as MouseEvent;
          if (!view.editable || e.button !== 0) return false;
          const tr = rowEdgeAt(view, e);
          if (!tr) return false;
          const pos = rowPosFromDOM(view, tr);
          if (pos < 0) return false;

          e.preventDefault();
          const startY = e.clientY;
          const startHeight = tr.getBoundingClientRect().height;
          let height = startHeight;

          // Live preview straight on the DOM; the document only changes once,
          // on release, so the whole drag is a single undo step.
          const move = (m: MouseEvent) => {
            height = clampSize(startHeight + m.clientY - startY);
            tr.style.height = `${height}px`;
          };
          const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            const node = view.state.doc.nodeAt(pos);
            if (node && height !== startHeight) {
              view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, height }));
            }
            setHover(view, -1);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
          return true;
        },
      },
    },
  });
}

/** Position of the row holding the selection's first cell, or -1. */
function currentRowPos(state: EditorState): number {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'tableRow') return $from.before(d);
  }
  return -1;
}

function currentRowHeight(state: EditorState): number | null {
  const pos = currentRowPos(state);
  return pos > -1 ? state.doc.nodeAt(pos)?.attrs.height ?? null : null;
}

function setRowHeight(state: EditorState, height: number | null, dispatch: Dispatch): boolean {
  const pos = currentRowPos(state);
  const node = pos > -1 ? state.doc.nodeAt(pos) : null;
  if (!node) return false;
  dispatch?.(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, height: height && clampSize(height) }));
  return true;
}

/**
 * Width of the selection's left-most column, from the same `colwidth` the
 * column drag writes — so a typed width and a dragged one are the same data.
 */
function currentColumnWidth(state: EditorState): number | null {
  if (!isInTable(state)) return null;
  const { map, table, left } = selectedRect(state);
  const cellPos = map.map[left];
  const cell = table.nodeAt(cellPos);
  return cell?.attrs.colwidth?.[left - map.colCount(cellPos)] || null;
}

/** Writes `colwidth` on every cell in the column, the way columnResizing does. */
function setColumnWidth(state: EditorState, width: number | null, dispatch: Dispatch): boolean {
  if (!isInTable(state)) return false;
  if (!dispatch) return true;
  const { map, table, tableStart, left } = selectedRect(state);
  const tr = state.tr;
  const seen = new Set<number>();

  for (let row = 0; row < map.height; row++) {
    const cellPos = map.map[row * map.width + left];
    if (seen.has(cellPos)) continue; // a rowspan cell appears once per row it covers
    seen.add(cellPos);

    const cell = table.nodeAt(cellPos)!;
    const index = left - map.colCount(cellPos);
    const colwidth: number[] = cell.attrs.colwidth
      ? cell.attrs.colwidth.slice()
      : new Array(cell.attrs.colspan).fill(0);
    colwidth[index] = width ? clampSize(width) : 0;
    const cleared = colwidth.every((w) => !w);
    tr.setNodeMarkup(tableStart + cellPos, undefined, { ...cell.attrs, colwidth: cleared ? null : colwidth });
  }

  dispatch(tr);
  return true;
}
