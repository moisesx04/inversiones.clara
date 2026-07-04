import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { StoreState } from "@/lib/types";

export async function GET() {
  try {
    const [clients, loans, payments] = await Promise.all([
      prisma.client.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.loan.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.payment.findMany({ orderBy: { number: "asc" } }),
    ]);

    const state: StoreState = {
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        document: c.document,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
      })),
      loans: loans.map((l) => ({
        id: l.id,
        clientId: l.clientId,
        principal: l.principal,
        interestRate: l.interestRate,
        total: l.total,
        installments: l.installments,
        frequency: l.frequency as "weekly" | "biweekly" | "monthly",
        startDate: l.startDate,
        createdAt: l.createdAt.toISOString(),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        loanId: p.loanId,
        number: p.number,
        dueDate: p.dueDate,
        amount: p.amount,
        paid: p.paid,
        paidAt: p.paidAt,
      })),
    };

    return NextResponse.json(state);
  } catch (error) {
    console.error("[GET /api/loans]", error);
    return NextResponse.json({ clients: [], loans: [], payments: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StoreState;

    if (
      !Array.isArray(body.clients) ||
      !Array.isArray(body.loans) ||
      !Array.isArray(body.payments)
    ) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // ── Sync clients ──────────────────────────────────────────
    const existingClients = await prisma.client.findMany({ select: { id: true } });
    const existingClientIds = new Set(existingClients.map((c) => c.id));
    const incomingClientIds = new Set(body.clients.map((c) => c.id));

    // Delete removed clients
    for (const id of existingClientIds) {
      if (!incomingClientIds.has(id)) {
        await prisma.client.delete({ where: { id } }).catch(() => null);
      }
    }

    // Upsert clients
    for (const c of body.clients) {
      await prisma.client.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          name: c.name,
          phone: c.phone,
          document: c.document,
          notes: c.notes,
          createdAt: new Date(c.createdAt),
        },
        update: {
          name: c.name,
          phone: c.phone,
          document: c.document,
          notes: c.notes,
        },
      });
    }

    // ── Sync loans ────────────────────────────────────────────
    const existingLoans = await prisma.loan.findMany({ select: { id: true } });
    const existingLoanIds = new Set(existingLoans.map((l) => l.id));
    const incomingLoanIds = new Set(body.loans.map((l) => l.id));

    for (const id of existingLoanIds) {
      if (!incomingLoanIds.has(id)) {
        await prisma.loan.delete({ where: { id } }).catch(() => null);
      }
    }

    for (const l of body.loans) {
      await prisma.loan.upsert({
        where: { id: l.id },
        create: {
          id: l.id,
          clientId: l.clientId,
          principal: l.principal,
          interestRate: l.interestRate,
          total: l.total,
          installments: l.installments,
          frequency: l.frequency,
          startDate: l.startDate,
          createdAt: new Date(l.createdAt),
        },
        update: {
          principal: l.principal,
          interestRate: l.interestRate,
          total: l.total,
          installments: l.installments,
          frequency: l.frequency,
          startDate: l.startDate,
        },
      });
    }

    // ── Sync payments ─────────────────────────────────────────
    const existingPayments = await prisma.payment.findMany({ select: { id: true } });
    const existingPaymentIds = new Set(existingPayments.map((p) => p.id));
    const incomingPaymentIds = new Set(body.payments.map((p) => p.id));

    for (const id of existingPaymentIds) {
      if (!incomingPaymentIds.has(id)) {
        await prisma.payment.delete({ where: { id } }).catch(() => null);
      }
    }

    for (const p of body.payments) {
      await prisma.payment.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          loanId: p.loanId,
          number: p.number,
          dueDate: p.dueDate,
          amount: p.amount,
          paid: p.paid,
          paidAt: p.paidAt,
        },
        update: {
          paid: p.paid,
          paidAt: p.paidAt,
          amount: p.amount,
          dueDate: p.dueDate,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/loans]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
