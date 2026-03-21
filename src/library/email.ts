import nodemailer from "nodemailer";
import { appEnv } from "../config/env";
import { logger } from "../config/logger";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: appEnv.EMAIL_USER,
    pass: appEnv.EMAIL_PASS,
  },
});

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput) {
  await transporter.sendMail({
    from: appEnv.EMAIL_FROM || appEnv.EMAIL_USER,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

export async function sendWelcomeEmail(email: string, firstName: string) {
  try {
    await sendEmail({
      to: email,
      subject: `Welcome to ${appEnv.APP_NAME}`,
      text: `Hi ${firstName}, your account is ready.`,
      html: `<p>Hi ${firstName},</p><p>Your account is ready for ${appEnv.APP_NAME}.</p>`,
    });
  } catch (error) {
    logger.warn({ error, email }, "Welcome email failed");
  }
}
