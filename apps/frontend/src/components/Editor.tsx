import { useEditor, EditorContent } from "@tiptap/react";
import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import * as Y from "yjs";
import { useEffect, useRef, memo } from "react";
import type { RemoteCursor } from "../pages/EditorPage";

interface Props {
  ydoc: Y.Doc;
  initialContent?: string;
  onChange: (content: string) => void;
  onCursorMove: (position: number) => void;
  onSelectionChange?: (from: number, to: number, text: string) => void;
  onCommentClick?: (commentId: string) => void;
  remoteCursors: RemoteCursor[];
  onlineUsers: { socketId: string; name: string; color: string }[];
  activeCommentId?: string | null;
  readOnly?: boolean;
  onContentLoaded?: () => void;
}

const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: el => el.getAttribute("data-comment-id"),
        renderHTML: attrs => ({ "data-comment-id": attrs.commentId }),
      },
      color: {
        default: "#6366f1",
        parseHTML: el => el.getAttribute("data-comment-color") || "#6366f1",
        renderHTML: attrs => ({ "data-comment-color": attrs.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ mark }) {
    const color = mark.attrs.color || "#6366f1";
    const hex = color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) || 99;
    const g = parseInt(hex.slice(2, 4), 16) || 102;
    const b = parseInt(hex.slice(4, 6), 16) || 241;
    return [
      "span",
      mergeAttributes(
        { "data-comment-id": mark.attrs.commentId, "data-comment-color": color },
        {
          class: "comment-mark",
          style: `--cr:${r};--cg:${g};--cb:${b};background:rgba(${r},${g},${b},0.2);border-bottom:2px solid rgba(${r},${g},${b},0.6);`,
        }
      ),
      0,
    ];
  },
});

const cursorPluginKey = new PluginKey("remoteCursors");
function buildCursorPlugin(cursorsRef: React.MutableRefObject<RemoteCursor[]>) {
  return new Plugin({
    key: cursorPluginKey,
    state: {
      init() { return DecorationSet.empty; },
      apply(tr, old, _oldState, newState) {
        // only recompute when explicitly triggered or doc changed
        if (!tr.getMeta(cursorPluginKey) && !tr.docChanged) return old;
        const decorations: Decoration[] = [];
        const docSize = newState.doc.content.size;
        cursorsRef.current.forEach((cursor) => {
          const pos = Math.min(Math.max(cursor.position, 0), docSize - 1);
          if (pos < 1) return;
          const widget = Decoration.widget(pos, () => {
            const wrapper = document.createElement("span");
            wrapper.style.cssText = "position:relative;display:inline-block;width:2px;height:1.2em;vertical-align:text-bottom;cursor:default;";
            const line = document.createElement("span");
            line.style.cssText = `position:absolute;top:0;left:0;width:2px;height:100%;background:${cursor.color};display:block;animation:cursorBlink 1.2s step-end infinite;`;
            const badge = document.createElement("span");
            badge.textContent = cursor.name;
            badge.style.cssText = `position:absolute;bottom:110%;left:0;background:${cursor.color};color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;white-space:nowrap;pointer-events:none;z-index:100;line-height:1.4;`;
            wrapper.appendChild(line);
            wrapper.appendChild(badge);
            return wrapper;
          }, { side: 1 });
          decorations.push(widget);
        });
        return DecorationSet.create(newState.doc, decorations);
      },
    },
    props: {
      decorations(state) { return this.getState(state) ?? DecorationSet.empty; },
    },
  });
}

const activeCommentKey = new PluginKey("activeComment");
function buildActiveCommentPlugin(activeIdRef: React.MutableRefObject<string | null | undefined>) {
  return new Plugin({
    key: activeCommentKey,
    state: {
      init() { return { activeId: null as string | null | undefined, decorations: DecorationSet.empty }; },
      apply(tr, prev, _oldState, newState) {
        const activeId = activeIdRef.current;
        // only recompute if activeId changed or doc changed
        if (activeId === prev.activeId && !tr.docChanged) return prev;
        if (!activeId) return { activeId, decorations: DecorationSet.empty };
        const decorations: Decoration[] = [];
        newState.doc.descendants((node, pos) => {
          node.marks.forEach(mark => {
            if (mark.type.name === "comment" && mark.attrs.commentId === activeId) {
              const color = mark.attrs.color || "#6366f1";
              const hex = color.replace("#", "");
              const r = parseInt(hex.slice(0, 2), 16) || 99;
              const g = parseInt(hex.slice(2, 4), 16) || 102;
              const b = parseInt(hex.slice(4, 6), 16) || 241;
              decorations.push(Decoration.inline(pos, pos + node.nodeSize, {
                style: `background:rgba(${r},${g},${b},0.4);border-bottom:2px solid rgba(${r},${g},${b},1);border-radius:2px;`,
              }));
            }
          });
        });
        return { activeId, decorations: DecorationSet.create(newState.doc, decorations) };
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}

export default memo(function Editor({
  ydoc, initialContent, onChange, onCursorMove, onSelectionChange, onCommentClick,
  remoteCursors, onlineUsers, activeCommentId, readOnly = false, onContentLoaded,
}: Props) {
  const cursorsRef = useRef<RemoteCursor[]>(remoteCursors);
  const activeIdRef = useRef<string | null | undefined>(activeCommentId);

  useEffect(() => { cursorsRef.current = remoteCursors; }, [remoteCursors]);
  useEffect(() => { activeIdRef.current = activeCommentId; }, [activeCommentId]);

  const rafRef = useRef<number>(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Collaboration.configure({ document: ydoc, field: "content" }),
      CommentMark,
      Extension.create({
        name: "remoteCursors",
        addProseMirrorPlugins: () => [buildCursorPlugin(cursorsRef)],
      }),
      Extension.create({
        name: "activeComment",
        addProseMirrorPlugins: () => [buildActiveCommentPlugin(activeIdRef)],
      }),
    ],
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (!readOnly) onCursorMove(editor.state.selection.anchor);
      if (onSelectionChange) {
        const text = from !== to ? editor.state.doc.textBetween(from, to, " ") : "";
        onSelectionChange(from, to, text);
      }
    },
    editorProps: {
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement;
        const el = target.closest("[data-comment-id]");
        const commentId = el?.getAttribute("data-comment-id");
        if (commentId && onCommentClick) {
          onCommentClick(commentId);
          return true;
        }
        return false;
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // update cursor decorations via rAF to avoid flicker on yjs updates
  useEffect(() => {
    cursorsRef.current = remoteCursors;
    if (!editor) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (editor && !editor.isDestroyed) {
        editor.view.dispatch(editor.view.state.tr.setMeta(cursorPluginKey, { update: true }));
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [remoteCursors, editor]);

  useEffect(() => {
    if (!editor || !initialContent) return;
    const fragment = ydoc.getXmlFragment("content");
    if (fragment.length === 0) {
      editor.commands.setContent(initialContent);
      onContentLoaded?.();
    }
  }, [editor, initialContent]);

  useEffect(() => {
    if (!editor) return;
    // trigger plugin to recompute active decoration
    editor.view.dispatch(editor.view.state.tr.setMeta(activeCommentKey, true));
    if (!activeCommentId) return;
    let foundFrom = 0;
    let foundTo = 0;
    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (node.marks.some(m => m.type.name === "comment" && m.attrs.commentId === activeCommentId)) {
        foundFrom = pos;
        foundTo = pos + node.nodeSize;
        found = true;
        return false;
      }
    });
    if (found) {
      editor.commands.setTextSelection({ from: foundFrom, to: foundTo });
      editor.commands.scrollIntoView();
    }
  }, [activeCommentId, editor]);

  useEffect(() => {
    if (!editor) return;
    (window as any).__editorRef = editor;
    return () => { delete (window as any).__editorRef; };
  }, [editor]);

  if (!editor) return null;

  return (
    <div style={styles.wrapper}>
      {!readOnly && (
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
      )}
      {readOnly && onlineUsers.length > 0 && (
        <div style={{ ...styles.toolbar, justifyContent: "flex-end" }}>
          <div style={styles.collaborators}>
            {onlineUsers.map((u) => (
              <div key={u.socketId} title={u.name} style={{ ...styles.collaboratorDot, background: u.color }}>
                {u.name[0].toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}
      <EditorContent editor={editor} style={styles.editor} />
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  wrapper: { border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", background: "var(--bg)" },
  toolbar: { display: "flex", alignItems: "center", gap: "4px", padding: "8px 12px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" },
  toolBtn: { padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "14px", color: "var(--text-h)" },
  divider: { width: "1px", height: "20px", background: "var(--border)", margin: "0 4px" },
  editor: { padding: "24px", minHeight: "500px", fontSize: "16px", lineHeight: "1.7", color: "var(--text-h)" },
  collaborators: { marginLeft: "auto", display: "flex", gap: "4px", alignItems: "center" },
  collaboratorDot: { width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#fff" },
};
