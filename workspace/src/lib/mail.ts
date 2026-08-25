import nodemailer from "nodemailer";

/**
 * Outbound mail, over whatever SMTP account the deployment is given.
 *
 * Gmail with an app password is the intended setup: free, no account to
 * maintain, and the same kind of credential Supabase Auth already uses for its
 * own mail. Nothing here is required for the app to run — when the credentials
 * are absent, sending reports a reason instead of throwing, and the caller
 * decides what to do about it.
 */
const HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const PORT = Number(process.env.SMTP_PORT || 465);
const USER = process.env.SMTP_USER || "";
const PASS = process.env.SMTP_PASS || "";

/** Where the contact form goes. */
export const FEEDBACK_TO = process.env.FEEDBACK_TO || "casedeskadmin@gmail.com";

export const mailConfigured = Boolean(USER && PASS);

export type MailResult = { ok: true } | { ok: false; error: string };

export async function sendMail({
  to,
  subject,
  text,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<MailResult> {
  if (!mailConfigured) {
    return { ok: false, error: "SMTP_USER and SMTP_PASS are not set on the server." };
  }

  try {
    const transport = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      // 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: PORT === 465,
      auth: { user: USER, pass: PASS },
    });

    await transport.sendMail({
      // Gmail rewrites From to the authenticated account anyway, so say so
      // rather than pretending the sender's own address sent it. replyTo is
      // what makes hitting reply go to the person who wrote in.
      from: `casedesk <${USER}>`,
      to,
      subject,
      text,
      replyTo,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown mail error." };
  }
}
