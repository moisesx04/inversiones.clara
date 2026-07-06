import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clara Inversiones | Préstamos",
  description: "Sistema responsivo para administrar préstamos, pagos, clientes y ganancias.",
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
