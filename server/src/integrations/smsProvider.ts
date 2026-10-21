export async function sendSms(to: string, body: string) {
  // TODO: wire up the real SMS gateway
  console.log(`[sms -> ${to}] ${body}`);
  return { id: `sms-${Date.now()}`, accepted: true };
}
