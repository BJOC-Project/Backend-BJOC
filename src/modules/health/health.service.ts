export function healthGetStatus() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
}
