import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clara Inversiones | Prestamos",
  description: "Sistema responsivo para administrar prestamos, pagos, clientes y ganancias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
