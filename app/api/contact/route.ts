import { Resend } from "resend";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactBody {
  name: string;
  email: string;
  message: string;
}

function isValidBody(body: unknown): body is ContactBody {
  if (typeof body !== "object" || body === null) return false;
  const { name, email, message } = body as Record<string, unknown>;
  return (
    typeof name === "string" &&
    name.trim() !== "" &&
    typeof email === "string" &&
    EMAIL_RE.test(email.trim()) &&
    typeof message === "string" &&
    message.trim() !== ""
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isValidBody(body)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const { name, email, message } = body;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "anvaloso1@gmail.com",
    replyTo: email,
    subject: `Nuevo mensaje de contacto de ${name}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\n${message}`,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
