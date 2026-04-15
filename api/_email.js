import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'noreply@timbudget.app';
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

export async function sendInviteEmail(to, name, rawToken) {
  const link = `${APP_URL}?token=${rawToken}&type=invite`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You've been invited to Tim's Budget",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">Welcome to Tim's Budget</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>You've been invited to access Tim's Budget. Click the button below to set your password and get started.</p>
        <p style="margin:28px 0">
          <a href="${link}" style="background:#4f7ef7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
            Set your password
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 7 days. If you weren't expecting this invite, you can safely ignore this email.</p>
        <p style="color:#6b7280;font-size:12px;word-break:break-all">Or copy this link: ${link}</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to, rawToken) {
  const link = `${APP_URL}?token=${rawToken}&type=reset`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Tim's Budget password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">Password reset</h2>
        <p>We received a request to reset your Tim's Budget password. Click the button below to choose a new one.</p>
        <p style="margin:28px 0">
          <a href="${link}" style="background:#4f7ef7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
            Reset password
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
        <p style="color:#6b7280;font-size:12px;word-break:break-all">Or copy this link: ${link}</p>
      </div>
    `,
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
