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
const HOST = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
const PORT = Number(process.env.SMTP_PORT || 465);
const USER = (process.env.SMTP_USER || "").trim();

/**
 * Google shows an app password as four groups of four — "abcd efgh ijkl mnop"
 * — and people paste what they are shown. The password itself has no spaces,
 * so stripping whitespace turns the most likely cause of a 535 into a
 * non-event. Trimming also catches the newline a terminal adds when the value
 * was echoed into a dashboard field.
 */
const PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

/** Where the contact form goes. */
export const FEEDBACK_TO = process.env.FEEDBACK_TO || "casedeskadmin@gmail.com";

export const mailConfigured = Boolean(USER && PASS);

/**
 * Enough to tell one credential from another without revealing either.
 *
 * A Google app password is sixteen characters, so the length alone says
 * whether the value even looks like one — and it changes when the value does,
 * which is the only way to tell "the new password is wrong" apart from "the
 * deployment is still holding the old one". Never expose more than this: the
 * password itself must not reach a page, a log, or a database row.
 */
export const credentialShape = {
  user: USER,
  passwordLength: PASS.length,
  looksLikeAppPassword: PASS.length === 16,
};

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
