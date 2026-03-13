export type VerificationMethod = "email" | "phone";

export type SendCodeDTO = {
  method: VerificationMethod;
  value: string;
};

export type VerifyCodeDTO = {
  method: VerificationMethod;
  value: string;
  code: string;
};

export type VerificationRecord = {
  code: string;
  expires: number;
};