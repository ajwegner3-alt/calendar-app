import nodemailer from "nodemailer";
import type { EmailClient, EmailClientConfig, EmailOptions, EmailResult } from "../types";
import { stripHtml } from "../utils";

export function createGmailClient(config: EmailClientConfig): EmailClient {
  const user = config.user;
  const appPassword = config.appPassword;

  if (!user || !appPassword) {
    throw new Error(
      "[email-sender] Gmail provider requires `user` and `appPassword`. " +
        "Set them in config or via GMAIL_USER and GMAIL_APP_PASSWORD env vars."
    );
  }

  const fromName = config.fromName || "Notification";
  const defaultFrom = config.defaultFrom || `${fromName} <${user}>`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: appPassword },
  });

  return {
    provider: "gmail",

    async send(options: EmailOptions): Promise<EmailResult> {
      try {
        const info = await transporter.sendMail({
          from: options.from || defaultFrom,
          to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || stripHtml(options.html),
          replyTo: options.replyTo,
          cc: options.cc
            ? Array.isArray(options.cc)
              ? options.cc.join(", ")
              : options.cc
            : undefined,
          bcc: options.bcc
            ? Array.isArray(options.bcc)
              ? options.bcc.join(", ")
              : options.bcc
            : undefined,
          attachments: options.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        });

        return { success: true, messageId: info.messageId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown Gmail SMTP error";
        return { success: false, error: msg };
      }
    },
  };
}
