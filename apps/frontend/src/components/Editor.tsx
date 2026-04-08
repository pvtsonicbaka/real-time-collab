import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { useEffect } from "react";

interface Props {
  ydoc: Y.Doc;
  initialContent?: string;
  onChange: (content: string) => void;
}

export default function Editor({ ydoc, initialContent, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Collaboration.configure({ document: ydoc, field: "content" }),
    ],
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  // load MongoDB content into ydoc when it's the first user
  useEffect(() => {
    if (!editor || !initialContent) return;
    const fragment = ydoc.getXmlFragment("content");
    if (fragment.length === 0) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

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
};
