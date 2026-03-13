export type VerificationRecord = {
  code: string
  expires: number
  createdAt: number
}

const store: Record<string, VerificationRecord> = {}

export function saveCode(key: string, code: string) {

  store[key] = {
    code,
    expires: Date.now() + 5 * 60 * 1000,
    createdAt: Date.now()
  }

}

export function getCode(key: string) {
  return store[key]
}

export function deleteCode(key: string) {
  delete store[key]
}