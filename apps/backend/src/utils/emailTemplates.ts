const base = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; }
    .logo { font-size: 18px; font-weight: 700; color: #2563eb; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
    .body { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
    .quote { background: #f1f5f9; border-left: 3px solid #2563eb; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #0f172a; margin-bottom: 24px; }
    .btn { display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
    .footer { font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">CollabDocs</div>
    ${content}
    <div class="footer">You're receiving this because you're a member of CollabDocs.</div>
  </div>
</body>
</html>`;

// sanitize user content before injecting into HTML — prevents XSS in emails
const esc = (str: string) =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\r?\n/g, " "); // strip newlines to prevent log injection too

export const commentEmail = (opts: {
  ownerName: string;
  commenterName: string;
  docTitle: string;
  commentBody: string;
  docUrl: string;
}) => ({
  subject: `💬 ${opts.commenterName} commented on "${opts.docTitle}"`,
  html: base(`
    <div class="title">New comment on your document</div>
    <div class="body">Hi ${esc(opts.ownerName)}, <strong>${esc(opts.commenterName)}</strong> left a comment on <strong>${esc(opts.docTitle)}</strong>:</div>
    <div class="quote">${esc(opts.commentBody)}</div>
    <a href="${esc(opts.docUrl)}" class="btn">View Comment →</a>
  `),
});

export const accessApprovedEmail = (opts: {
  userName: string;
  ownerName: string;
  docTitle: string;
  role: string;
  docUrl: string;
}) => ({
  subject: `✅ You've been approved to "${opts.docTitle}"`,
  html: base(`
    <div class="title">Access approved!</div>
    <div class="body">Hi ${esc(opts.userName)}, <strong>${esc(opts.ownerName)}</strong> approved your request to join <strong>${esc(opts.docTitle)}</strong> as <strong>${esc(opts.role)}</strong>.</div>
    <a href="${esc(opts.docUrl)}" class="btn">Open Document →</a>
  `),
});

export const accessRequestEmail = (opts: {
  ownerName: string;
  requesterName: string;
  docTitle: string;
  role: string;
  docUrl: string;
}) => ({
  subject: `🔐 ${opts.requesterName} wants to join "${opts.docTitle}"`,
  html: base(`
    <div class="title">New access request</div>
    <div class="body">Hi ${esc(opts.ownerName)}, <strong>${esc(opts.requesterName)}</strong> is requesting <strong>${esc(opts.role)}</strong> access to <strong>${esc(opts.docTitle)}</strong>.</div>
    <a href="${esc(opts.docUrl)}" class="btn">Review Request →</a>
  `),
});

export const inviteEmail = (opts: {
  inviteeName: string;
  ownerName: string;
  docTitle: string;
  role: string;
  inviteUrl: string;
}) => ({
  subject: `📩 ${opts.ownerName} invited you to "${opts.docTitle}"`,
  html: base(`
    <div class="title">You've been invited!</div>
    <div class="body">Hi ${esc(opts.inviteeName)}, <strong>${esc(opts.ownerName)}</strong> has invited you to collaborate on <strong>${esc(opts.docTitle)}</strong> as <strong>${esc(opts.role)}</strong>.</div>
    <a href="${esc(opts.inviteUrl)}" class="btn">Accept Invite →</a>
  `),
});
