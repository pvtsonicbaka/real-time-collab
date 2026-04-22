import sanitizeHtml from "sanitize-html";

// strip ALL html — for names, titles, labels, comment bodies
export const sanitizeText = (input: string): string =>
  sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();

// allow safe rich html — for document content (Tiptap output)
export const sanitizeContent = (input: string): string =>
  sanitizeHtml(input, {
    allowedTags: [
      "p", "br", "strong", "em", "s", "u", "h1", "h2", "h3",
      "ul", "ol", "li", "blockquote", "pre", "code", "span",
    ],
    allowedAttributes: {
      span: ["style", "data-comment-id", "data-comment-color", "class"],
      code: ["class"],
      pre: ["class"],
    },
    allowedStyles: {
      span: {
        background: [/.*/],
        "border-bottom": [/.*/],
        "border-radius": [/.*/],
        cursor: [/.*/],
      },
    },
  }).trim();
