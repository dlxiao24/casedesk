"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { FEEDBACK_TO, sendMail } from "@/lib/mail";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("That does not look like an email address."),
  body: z
    .string()
    .trim()
    .min(10, "A few more words, so there is something to act on.")
    .max(4000, "That is longer than an email wants to be — trim it a little."),
});

/**
 * Anyone can write in, signed in or not, which means this is a form on the
 * open internet that causes mail to be sent. Two caps keep that from being
 * anybody's afternoon: five an hour from one address, and thirty an hour from
 * everyone. Neither stops a determined abuser rotating addresses; both stop
 * the accidental and the idle kind, which is the realistic threat to a club
 * tool.
 */
const PER_SENDER_HOURLY = 5;
const TOTAL_HOURLY = 30;

export async function sendFeedback(input: { email: string; body: string }) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "That did not go through." };
  }
  const { email, body } = parsed.data;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [fromSender, fromEveryone] = await Promise.all([
    db.feedbackMessage.count({ where: { fromEmail: email, createdAt: { gte: hourAgo } } }),
    db.feedbackMessage.count({ where: { createdAt: { gte: hourAgo } } }),
  ]);
  if (fromSender >= PER_SENDER_HOURLY || fromEveryone >= TOTAL_HOURLY) {
    return {
      ok: false as const,
      error: "That is a lot of messages in one hour. Try again a little later.",
    };
  }

  // Stored first, so a message survives a mail failure and can be read in the
  // database if the account behind SMTP ever stops working.
  const user = await currentUser();
  const saved = await db.feedbackMessage.create({
    data: { fromEmail: email, body, userId: user?.id ?? null },
  });

  const sent = await sendMail({
    to: FEEDBACK_TO,
    // The subject line the club asked for, verbatim.
    subject: `Casedesk feedback - ${email}`,
    text: body,
    replyTo: email,
  });

  await db.feedbackMessage.update({
    where: { id: saved.id },
    data: {
      sentAt: sent.ok ? new Date() : null,
      sendError: sent.ok ? null : sent.error,
    },
  });

  // Either way the message is safe, so either way this succeeded from the
  // sender's point of view. `delivered` is the honest detail.
  return { ok: true as const, delivered: sent.ok };
}
