import nodemailer from "nodemailer"
import { saveCode, getCode, deleteCode } from "./verification.store"

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/* =========================
   EMAIL VERIFICATION
========================= */

export async function sendEmailCode(email: string, resend = false) {

  const existing = getCode(email)

  if (existing && !resend) {

    const elapsed = Date.now() - existing.createdAt

    if (elapsed < 60000) {

      throw new Error("Please wait before requesting another code")

    }

  }

  let code = existing?.code

  if (!code || !resend) {

    code = generateCode()

    saveCode(email, code)

  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  })

  await transporter.sendMail({
    to: email,
    subject: "BJOC Verification Code",
    text: `Your BJOC verification code is: ${code}`
  })

}


/* =========================
   SMS DEMO VERIFICATION
========================= */

export async function sendSMSCode(phone: string) {

  const code = generateCode()

  saveCode(phone, code)

  const formatted = phone.replace(/^0/, "63")

  console.log("================================")
  console.log(" BJOC SMS DEMO ")
  console.log("Sending OTP to:", formatted)
  console.log("Verification Code:", code)
  console.log("================================")

}


/* =========================
   VERIFY EMAIL
========================= */

export function verifyEmailCode(email: string, code: string) {

  const record = getCode(email)

  if (!record) return false

  if (record.expires < Date.now()) return false

  if (record.code !== code) return false

  deleteCode(email)

  return true

}


/* =========================
   VERIFY PHONE
========================= */

export function verifyPhoneCode(phone: string, code: string) {

  const record = getCode(phone)

  if (!record) return false

  if (record.expires < Date.now()) return false

  if (record.code !== code) return false

  deleteCode(phone)

  return true

}