import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";

const formatMoney = (value: number) =>
  `RD$ ${new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      client: true,
      payments: { orderBy: { number: "asc" }, take: 1 },
    },
  });

  if (!loan) {
    return NextResponse.json({ error: "Volante no encontrado." }, { status: 404 });
  }

  const firstPayment = loan.payments[0];
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.09, 0.13, 0.2);
  const blue = rgb(0.1, 0.35, 0.75);
  const gray = rgb(0.39, 0.45, 0.55);
  const fittedText = (text: string, x: number, y: number, maxWidth: number, preferredSize = 11) => {
    let size = preferredSize;
    while (size > 7 && bold.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
    page.drawText(text, { x, y, size, font: bold, color: dark, maxWidth });
  };

  page.drawRectangle({ x: 42, y: 735, width: 511, height: 72, color: dark });
  page.drawText("CLARA INVERSIONES", { x: 65, y: 774, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Volante de entrega de préstamo", { x: 65, y: 753, size: 11, font: regular, color: rgb(0.75, 0.84, 0.96) });
  page.drawText(`N.º ${loan.id.slice(0, 8).toUpperCase()}`, { x: 430, y: 774, size: 10, font: bold, color: rgb(1, 1, 1) });

  const label = (text: string, x: number, y: number) =>
    page.drawText(text.toUpperCase(), { x, y, size: 8, font: bold, color: gray });
  const value = (text: string, x: number, y: number, maxWidth = 210) =>
    fittedText(text, x, y, maxWidth);

  label("Cliente", 65, 700);
  value(loan.client.name, 65, 681, 215);
  label("Documento", 320, 700);
  value(loan.client.document || "No indicado", 320, 681, 205);
  label("Teléfono", 65, 646);
  value(loan.client.phone, 65, 627);
  label("Fecha del préstamo", 320, 646);
  value(formatDate(loan.startDate), 320, 627);

  page.drawRectangle({ x: 65, y: 565, width: 465, height: 34, color: rgb(0.95, 0.97, 0.99) });
  page.drawText("CONCEPTO", { x: 82, y: 577, size: 9, font: bold, color: gray });
  page.drawText("MONTO", { x: 450, y: 577, size: 9, font: bold, color: gray });

  const rows = [
    ["Capital acumulado", formatMoney(loan.principal)],
    ...(loan.reengagedCapital > 0 ? [["Incluido por reenganches", formatMoney(loan.reengagedCapital)]] : []),
    [`Réditos del primer período (${loan.interestRate}%)`, formatMoney(firstPayment?.amount || 0)],
    ["Frecuencia de pago", loan.frequency === "weekly" ? "Semanal" : loan.frequency === "biweekly" ? "Quincenal" : "Mensual"],
    ["Fecha del primer pago", firstPayment ? formatDate(firstPayment.dueDate) : "No indicada"],
  ];
  rows.forEach(([left, right], index) => {
    const y = 536 - index * 42;
    page.drawText(left, { x: 82, y, size: 10, font: regular, color: dark });
    const width = bold.widthOfTextAtSize(right, 10);
    page.drawText(right, { x: 512 - width, y, size: 10, font: bold, color: dark });
    page.drawLine({ start: { x: 65, y: y - 14 }, end: { x: 530, y: y - 14 }, thickness: 0.7, color: rgb(0.85, 0.88, 0.92) });
  });

  page.drawRectangle({ x: 65, y: 285, width: 465, height: 54, color: rgb(0.92, 0.96, 1) });
  page.drawText("Primer pago acordado", { x: 82, y: 305, size: 13, font: bold, color: dark });
  const firstAmount = formatMoney(firstPayment?.amount || 0);
  const amountWidth = bold.widthOfTextAtSize(firstAmount, 14);
  page.drawText(firstAmount, { x: 512 - amountWidth, y: 304, size: 14, font: bold, color: blue });

  page.drawText("El capital acumulado incluye los reenganches indicados. El reenganche está sumado", { x: 65, y: 245, size: 9, font: regular, color: gray });
  page.drawText("al préstamo y no constituye un préstamo separado.", { x: 65, y: 230, size: 9, font: regular, color: gray });
  page.drawText("Documento generado por Clara Inversiones", { x: 190, y: 72, size: 9, font: regular, color: gray });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="volante-${loan.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
