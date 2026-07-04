import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { StoreState } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "db.json");

const fallback: StoreState = {
  clients: [],
  loans: [],
  payments: [],
};

export async function GET() {
  try {
    const raw = await readFile(dataFile, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(fallback);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StoreState;
    if (!Array.isArray(body.clients) || !Array.isArray(body.loans) || !Array.isArray(body.payments)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFile, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
