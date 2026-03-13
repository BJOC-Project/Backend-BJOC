import { Request, Response } from "express"
import { sendEmailCode, verifyEmailCode } from "./verification.service"

export async function sendCode(req: Request, res: Response) {

  const { method, value, resend  } = req.body

  try { 

    if (method === "email") {
      await sendEmailCode(value, resend)
    }

    res.json({
      success: true,
      message: "Verification code sent"
    })

  } catch (err) {

    res.status(500).json({
      success: false,
      message: "Failed to send code"
    })

  }

}

export function verifyCode(req: Request, res: Response) {

  const { method, value, code } = req.body

  let verified = false

  if (method === "email") {
    verified = verifyEmailCode(value, code)
  }

  res.json({
    success: verified
  })

}