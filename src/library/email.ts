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

export async function sendWelcomeEmail(
  email: string,
  firstName: string,
) {
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

export async function sendEmailChangeVerificationEmail(
  email: string,
  firstName: string,
  code: string,
) {
  await sendEmail({
    to: email,
    subject: `${appEnv.APP_NAME} email verification code`,
    text: `Hi ${firstName}, your verification code is ${code}. This code expires in 10 minutes.`,
    html: [
      `<p>Hi ${firstName},</p>`,
      "<p>Use the verification code below to confirm your email change.</p>",
      `<p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p>`,
      "<p>This code expires in 10 minutes.</p>",
    ].join(""),
  });
}
