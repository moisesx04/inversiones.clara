import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";

const formatMoney = (value: number) =>
  `RD$ ${new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { loan: { include: { client: true } } },
  });

  if (!payment?.paid) {
    return NextResponse.json({ error: "Recibo no encontrado." }, { status: 404 });
  }

  const interest = payment.paidInterest || 0;
  const capital = payment.paidCapital || 0;
  const total = interest + capital;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.09, 0.13, 0.2);
  const gray = rgb(0.39, 0.45, 0.55);
  const green = rgb(0.04, 0.55, 0.32);

  page.drawRectangle({ x: 42, y: 735, width: 511, height: 72, color: dark });
  page.drawText("CLARA INVERSIONES", { x: 65, y: 774, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Recibo de pago", { x: 65, y: 753, size: 11, font: regular, color: rgb(0.75, 0.84, 0.96) });
  page.drawText(`N.º ${payment.id.slice(0, 8).toUpperCase()}`, { x: 430, y: 774, size: 10, font: bold, color: rgb(1, 1, 1) });

  const label = (text: string, x: number, y: number) => page.drawText(text.toUpperCase(), { x, y, size: 8, font: bold, color: gray });
  const value = (text: string, x: number, y: number) => page.drawText(text, { x, y, size: 11, font: bold, color: dark, maxWidth: 220 });
  label("Cliente", 65, 700);
  value(payment.loan.client.name, 65, 681);
  label("Documento", 320, 700);
  value(payment.loan.client.document || "No indicado", 320, 681);
  label("Fecha y hora del pago", 65, 642);
  value(formatDateTime(payment.paidAt), 65, 623);
  label("Préstamo", 320, 642);
  value(payment.loan.id.slice(0, 8).toUpperCase(), 320, 623);

  page.drawRectangle({ x: 65, y: 555, width: 465, height: 34, color: rgb(0.95, 0.97, 0.99) });
  page.drawText("CONCEPTO", { x: 82, y: 567, size: 9, font: bold, color: gray });
  page.drawText("MONTO", { x: 450, y: 567, size: 9, font: bold, color: gray });
  [["Pago a réditos", interest], ["Abono a capital", capital]].forEach(([concept, amount], index) => {
    const y = 520 - index * 48;
    page.drawText(String(concept), { x: 82, y, size: 11, font: regular, color: dark });
    const formatted = formatMoney(Number(amount));
    page.drawText(formatted, { x: 512 - bold.widthOfTextAtSize(formatted, 11), y, size: 11, font: bold, color: dark });
    page.drawLine({ start: { x: 65, y: y - 16 }, end: { x: 530, y: y - 16 }, thickness: 0.7, color: rgb(0.85, 0.88, 0.92) });
  });

  page.drawRectangle({ x: 65, y: 370, width: 465, height: 62, color: rgb(0.91, 0.98, 0.95) });
  page.drawText("TOTAL PAGADO", { x: 82, y: 394, size: 13, font: bold, color: dark });
  const formattedTotal = formatMoney(total);
  page.drawText(formattedTotal, { x: 512 - bold.widthOfTextAtSize(formattedTotal, 16), y: 392, size: 16, font: bold, color: green });
  page.drawText("Pago recibido satisfactoriamente. Conserve este recibo como constancia.", { x: 105, y: 320, size: 10, font: regular, color: gray });
  page.drawText("Documento generado por Clara Inversiones", { x: 190, y: 72, size: 9, font: regular, color: gray });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recibo-${payment.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
