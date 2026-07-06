import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { StoreState } from "@/lib/types";

export async function GET() {
  try {
    const [clients, loans, payments, sans, sanClients, sanPayments] = await Promise.all([
      prisma.client.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.loan.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.payment.findMany({ orderBy: { number: "asc" } }),
      prisma.sanGroup.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.sanClient.findMany({ orderBy: { turnNumber: "asc" } }),
      prisma.sanPayment.findMany({ orderBy: { roundNumber: "asc" } }),
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
      sans: sans.map(s => ({ ...s, frequency: s.frequency as "weekly" | "biweekly" | "monthly", status: s.status as "active" | "completed" | "cancelled", createdAt: s.createdAt.toISOString() })),
      sanClients: sanClients.map(sc => ({ ...sc, status: sc.status as "active" | "withdrawn" })),
      sanPayments: sanPayments.map(sp => ({ ...sp })),
    };

    return NextResponse.json(state);
  } catch (error) {
    console.error("[GET /api/loans]", error);
    return NextResponse.json({ clients: [], loans: [], payments: [], sans: [], sanClients: [], sanPayments: [] });
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

    // ── Sync SAN Groups ─────────────────────────────────────────
    const existingSans = await prisma.sanGroup.findMany({ select: { id: true } });
    const existingSanIds = new Set(existingSans.map((p) => p.id));
    const incomingSanIds = new Set((body.sans || []).map((p) => p.id));
    for (const id of existingSanIds) if (!incomingSanIds.has(id)) await prisma.sanGroup.delete({ where: { id } }).catch(() => null);
    for (const s of body.sans || []) {
      await prisma.sanGroup.upsert({
        where: { id: s.id },
        create: { id: s.id, name: s.name, quotaAmount: s.quotaAmount, frequency: s.frequency, startDate: s.startDate, participantCount: s.participantCount, status: s.status, createdAt: new Date(s.createdAt) },
        update: { name: s.name, quotaAmount: s.quotaAmount, frequency: s.frequency, startDate: s.startDate, participantCount: s.participantCount, status: s.status },
      });
    }

    // ── Sync SAN Clients ────────────────────────────────────────
    const existingSanClients = await prisma.sanClient.findMany({ select: { id: true } });
    const existingSanClientIds = new Set(existingSanClients.map((p) => p.id));
    const incomingSanClientIds = new Set((body.sanClients || []).map((p) => p.id));
    for (const id of existingSanClientIds) if (!incomingSanClientIds.has(id)) await prisma.sanClient.delete({ where: { id } }).catch(() => null);
    for (const sc of body.sanClients || []) {
      await prisma.sanClient.upsert({
        where: { id: sc.id },
        create: { id: sc.id, sanId: sc.sanId, name: sc.name, phone: sc.phone, document: sc.document, turnNumber: sc.turnNumber, status: sc.status, notes: sc.notes },
        update: { name: sc.name, phone: sc.phone, document: sc.document, turnNumber: sc.turnNumber, status: sc.status, notes: sc.notes },
      });
    }

    // ── Sync SAN Payments ───────────────────────────────────────
    const existingSanPayments = await prisma.sanPayment.findMany({ select: { id: true } });
    const existingSanPaymentIds = new Set(existingSanPayments.map((p) => p.id));
    const incomingSanPaymentIds = new Set((body.sanPayments || []).map((p) => p.id));
    for (const id of existingSanPaymentIds) if (!incomingSanPaymentIds.has(id)) await prisma.sanPayment.delete({ where: { id } }).catch(() => null);
    for (const sp of body.sanPayments || []) {
      await prisma.sanPayment.upsert({
        where: { id: sp.id },
        create: { id: sp.id, sanId: sp.sanId, sanClientId: sp.sanClientId, roundNumber: sp.roundNumber, amount: sp.amount, paidAt: sp.paidAt },
        update: { roundNumber: sp.roundNumber, amount: sp.amount, paidAt: sp.paidAt },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/loans]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
