import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD_KEY = "admin_password";

/** Obtiene la contraseña actual desde DB o variable de entorno como fallback */
async function getCurrentPassword(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: PASSWORD_KEY } });
    if (setting) return setting.value;
  } catch {
    // DB not available, fall through
  }
  return process.env.ADMIN_PASSWORD || process.env.CLARA_PASSWORD || "admin123";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ ok: false, error: "Faltan datos." }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ ok: false, error: "La clave debe tener al menos 6 caracteres." }, { status: 400 });
  }

  const saved = await getCurrentPassword();

  if (currentPassword !== saved) {
    return NextResponse.json({ ok: false, error: "Clave actual incorrecta." }, { status: 401 });
  }

  // Guarda la nueva contraseña en la base de datos
  await prisma.setting.upsert({
    where: { key: PASSWORD_KEY },
    update: { value: newPassword },
    create: { key: PASSWORD_KEY, value: newPassword },
  });

  return NextResponse.json({ ok: true });
}
