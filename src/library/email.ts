import nodemailer from "nodemailer";
import { appEnv } from "../config/env";
import { logger } from "../config/logger";
import { ServiceUnavailableError } from "../errors/app-error";

type ProviderTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
};

type EmailTransportOptions = Parameters<typeof nodemailer.createTransport>[0];

const KNOWN_PROVIDER_CONFIG_BY_DOMAIN: Record<string, ProviderTransportConfig> = {
  "gmail.com": {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  },
  "googlemail.com": {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  },
  "hotmail.com": {
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
  },
  "live.com": {
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
  },
  "outlook.com": {
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
  },
  "yahoo.com": {
    host: "smtp.mail.yahoo.com",
    port: 465,
    secure: true,
  },
  "icloud.com": {
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
  },
  "mac.com": {
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
  },
  "me.com": {
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
  },
};

function buildEmailAuth() {
  return {
    pass: appEnv.EMAIL_PASS,
    user: appEnv.EMAIL_USER,
  };
}

function getEmailDomain() {
  return appEnv.EMAIL_USER.split("@")[1]?.toLowerCase() ?? "";
}

function getDerivedProviderTransportConfig() {
  return KNOWN_PROVIDER_CONFIG_BY_DOMAIN[getEmailDomain()] ?? null;
}

function buildEmailTransportOptions(): EmailTransportOptions {
  if (appEnv.SMTP_HOST) {
    const options = {
      auth: buildEmailAuth(),
      host: appEnv.SMTP_HOST,
      port: appEnv.SMTP_PORT ?? 587,
      secure: appEnv.SMTP_SECURE ?? false,
    };

    return options as EmailTransportOptions;
  }

  if (appEnv.EMAIL_SERVICE) {
    const options = {
      auth: buildEmailAuth(),
      service: appEnv.EMAIL_SERVICE,
    };

    return options as EmailTransportOptions;
  }

  const derivedProviderTransportConfig = getDerivedProviderTransportConfig();

  if (derivedProviderTransportConfig) {
    const options = {
      auth: buildEmailAuth(),
      ...derivedProviderTransportConfig,
    };

    return options as EmailTransportOptions;
  }

  const options = {
    auth: buildEmailAuth(),
    service: "gmail",
  };

  return options as EmailTransportOptions;
}

export function describeEmailTransportForLogs() {
  if (appEnv.SMTP_HOST) {
    return {
      authUser: appEnv.EMAIL_USER,
      host: appEnv.SMTP_HOST,
      port: appEnv.SMTP_PORT ?? 587,
      secure: appEnv.SMTP_SECURE ?? false,
      transport: "smtp-host",
    };
  }

  if (appEnv.EMAIL_SERVICE) {
    return {
      authUser: appEnv.EMAIL_USER,
      service: appEnv.EMAIL_SERVICE,
      transport: "service",
    };
  }

  const derivedProviderTransportConfig = getDerivedProviderTransportConfig();

  if (derivedProviderTransportConfig) {
    return {
      authUser: appEnv.EMAIL_USER,
      domain: getEmailDomain(),
      ...derivedProviderTransportConfig,
      transport: "derived-provider",
    };
  }

  return {
    authUser: appEnv.EMAIL_USER,
    service: "gmail",
    transport: "default-gmail",
  };
}

const transporter = nodemailer.createTransport(buildEmailTransportOptions());

interface SendEmailInput {
  html: string;
  subject: string;
  text?: string;
  to: string;
}

export async function sendEmail(input: SendEmailInput) {
  try {
    const info = await transporter.sendMail({
      from: appEnv.EMAIL_FROM || appEnv.EMAIL_USER,
      html: input.html,
      subject: input.subject,
      text: input.text,
      to: input.to,
    });

    logger.info({
      msg: "Email sent",
      messageId: info.messageId,
      subject: input.subject,
      to: input.to,
      transport: describeEmailTransportForLogs(),
    });
  } catch (error) {
    logger.error({
      msg: "Email delivery failed",
      error,
      subject: input.subject,
      to: input.to,
      transport: describeEmailTransportForLogs(),
    });

    throw new ServiceUnavailableError(
      "Email delivery is temporarily unavailable. Please try again in a moment.",
    );
  }
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
