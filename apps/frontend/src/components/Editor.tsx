import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import * as Y from "yjs";
import { useEffect, useRef } from "react";
import type { RemoteCursor } from "../pages/EditorPage";

interface Props {
  ydoc: Y.Doc;
  initialContent?: string;
  onChange: (content: string) => void;
  onCursorMove: (position: number) => void;
  remoteCursors: RemoteCursor[];
  onlineUsers: { socketId: string; name: string; color: string }[];
}

const cursorPluginKey = new PluginKey("remoteCursors");

// plugin reads from a ref so it always has latest cursors
function buildCursorPlugin(cursorsRef: React.MutableRefObject<RemoteCursor[]>) {
  return new Plugin({
    key: cursorPluginKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        const docSize = state.doc.content.size;

        cursorsRef.current.forEach((cursor) => {
          const pos = Math.min(Math.max(cursor.position, 0), docSize - 1);
          if (pos < 1) return;

          const widget = Decoration.widget(pos, () => {
            const wrapper = document.createElement("span");
            wrapper.style.position = "relative";
            wrapper.style.display = "inline-block";
            wrapper.style.width = "2px";
            wrapper.style.height = "1.2em";
            wrapper.style.verticalAlign = "text-bottom";
            wrapper.style.cursor = "default";

            // cursor line
            const line = document.createElement("span");
            line.style.position = "absolute";
            line.style.top = "0";
            line.style.left = "0";
            line.style.width = "2px";
            line.style.height = "100%";
            line.style.background = cursor.color;
            line.style.display = "block";
            line.style.animation = "cursorBlink 1.2s step-end infinite";

            // name badge
            const badge = document.createElement("span");
            badge.textContent = cursor.name;
            badge.style.position = "absolute";
            badge.style.bottom = "110%";
            badge.style.left = "0";
            badge.style.background = cursor.color;
            badge.style.color = "#fff";
            badge.style.fontSize = "11px";
            badge.style.fontWeight = "600";
            badge.style.padding = "2px 6px";
            badge.style.borderRadius = "4px";
            badge.style.whiteSpace = "nowrap";
            badge.style.pointerEvents = "none";
            badge.style.zIndex = "100";
            badge.style.opacity = "1";
            badge.style.transition = "none";
            badge.style.lineHeight = "1.4";

            wrapper.appendChild(line);
            wrapper.appendChild(badge);
            return wrapper;
          }, { side: 1 });

          decorations.push(widget);
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

export default function Editor({ ydoc, initialContent, onChange, onCursorMove, remoteCursors, onlineUsers }: Props) {
  // ref so plugin always reads latest cursors without reinitializing
  const cursorsRef = useRef<RemoteCursor[]>(remoteCursors);

  // keep ref in sync with prop
  useEffect(() => {
    cursorsRef.current = remoteCursors;
  }, [remoteCursors]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Collaboration.configure({ document: ydoc, field: "content" }),
      Extension.create({
        name: "remoteCursors",
        addProseMirrorPlugins: () => [buildCursorPlugin(cursorsRef)],
      }),
    ],
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onSelectionUpdate: ({ editor }) => onCursorMove(editor.state.selection.anchor),
    immediatelyRender: false,
  });

  // load MongoDB content on first join
  useEffect(() => {
    if (!editor || !initialContent) return;
    const fragment = ydoc.getXmlFragment("content");
    if (fragment.length === 0) editor.commands.setContent(initialContent);
  }, [editor, initialContent]);

  // force redraw decorations when cursors change
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.view.state.tr.setMeta("cursorUpdate", true));
  }, [remoteCursors]);

  if (!editor) return null;

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <button style={{ ...styles.toolBtn, fontWeight: "bold", background: editor.isActive("bold") ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button style={{ ...styles.toolBtn, fontStyle: "italic", background: editor.isActive("italic") ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button style={{ ...styles.toolBtn, textDecoration: "line-through", background: editor.isActive("strike") ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleStrike().run()}>S</button>
        <div style={styles.divider} />
        <button style={{ ...styles.toolBtn, background: editor.isActive("heading", { level: 1 }) ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button style={{ ...styles.toolBtn, background: editor.isActive("heading", { level: 2 }) ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <div style={styles.divider} />
        <button style={{ ...styles.toolBtn, background: editor.isActive("bulletList") ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button style={{ ...styles.toolBtn, background: editor.isActive("orderedList") ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <div style={styles.divider} />
        <button style={{ ...styles.toolBtn, background: editor.isActive("blockquote") ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleBlockquote().run()}>" Quote</button>
        <button style={{ ...styles.toolBtn, background: editor.isActive("codeBlock") ? "var(--accent-bg)" : "transparent" }} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"</>"}</button>

        {/* Online users in toolbar — shows everyone including yourself */}
        {onlineUsers.length > 0 && (
          <div style={styles.collaborators}>
            {onlineUsers.map((u) => (
              <div key={u.socketId} title={u.name} style={{ ...styles.collaboratorDot, background: u.color }}>
                {u.name[0].toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
      <EditorContent editor={editor} style={styles.editor} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", background: "var(--bg)" },
  toolbar: { display: "flex", alignItems: "center", gap: "4px", padding: "8px 12px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" },
  toolBtn: { padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "14px", color: "var(--text-h)" },
  divider: { width: "1px", height: "20px", background: "var(--border)", margin: "0 4px" },
  editor: { padding: "24px", minHeight: "500px", fontSize: "16px", lineHeight: "1.7", color: "var(--text-h)" },
  collaborators: { marginLeft: "auto", display: "flex", gap: "4px", alignItems: "center" },
  collaboratorDot: { width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#fff" },
};
