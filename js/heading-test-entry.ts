import { Editor } from '@tiptap/core';
import { buildExtensions } from './src/common/tiptap/extensions';

(window as any).runHeadingTest = () => {
  const el = document.createElement('div');
  document.body.appendChild(el);

  const editor = new Editor({
    element: el,
    extensions: buildExtensions('placeholder'),
    content: '<p>Line one</p><p>Line two</p><p>Line three</p>',
  });

  // Put the cursor inside "Line two" (the middle paragraph), no selection.
  const doc = editor.state.doc;
  let line2From = -1;
  doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent === 'Line two') {
      line2From = pos + 1;
    }
  });

  editor.commands.setTextSelection(line2From);
  const before = editor.getHTML();

  editor.chain().focus().toggleHeading({ level: 2 }).run();
  const afterHeading = editor.getHTML();

  // Now simulate "editing" line two by inserting a character.
  editor.commands.insertContent('X');
  const afterEdit = editor.getHTML();

  return { before, afterHeading, afterEdit };
};
