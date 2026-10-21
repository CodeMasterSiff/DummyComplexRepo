export async function sendEmail(to: string, subject: string, body: string) {
  console.log(`[mail -> ${to}] ${subject}\n  ${body.replace(/\n/g, '\n  ')}`);
  return { id: `mail-${Date.now()}` };
}
