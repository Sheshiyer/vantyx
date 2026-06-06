import type { Env } from "./env";

export type EmailResult = { sent: boolean; reason?: string };

/**
 * Send a transactional email. Provider-agnostic: uses Resend when RESEND_API_KEY + EMAIL_FROM are
 * set, otherwise a no-op (callers fall back to surfacing the link directly). Swap the fetch body for
 * any HTTP email API (Postmark, SES, MailChannels…) to change providers — the call sites don't change.
 */
export async function sendEmail(
  env: Env,
  msg: { to: string; subject: string; html: string; text: string },
): Promise<EmailResult> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { sent: false, reason: "no_provider" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) return { sent: false, reason: `provider_${res.status}` };
    return { sent: true };
  } catch {
    return { sent: false, reason: "provider_error" };
  }
}

/** Absolute origin for links in emails: PUBLIC_BASE_URL if set, else the request origin. */
export function linkBase(request: Request, env: Env): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function inviteEmail(activateUrl: string, tenantName: string) {
  return {
    subject: `You're invited to edit ${tenantName} on Vantyx`,
    text: `You've been invited to manage the ${tenantName} 360° tour.\n\nActivate your account:\n${activateUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>You've been invited to manage the <strong>${esc(tenantName)}</strong> 360° tour.</p>
<p><a href="${esc(activateUrl)}">Activate your account →</a></p>
<p style="color:#888;font-size:13px">This link expires in 24 hours.</p>`,
  };
}

export function resetEmail(resetUrl: string, tenantName: string) {
  return {
    subject: `Reset your ${tenantName} password on Vantyx`,
    text: `Reset your password for ${tenantName}:\n${resetUrl}\n\nIf you didn't request this, ignore this email. The link expires in 1 hour.`,
    html: `<p>Reset your password for <strong>${esc(tenantName)}</strong>.</p>
<p><a href="${esc(resetUrl)}">Choose a new password →</a></p>
<p style="color:#888;font-size:13px">If you didn't request this, ignore this email. The link expires in 1 hour.</p>`,
  };
}
