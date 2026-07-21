import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clara Inversiones",
  description: "Sistema responsivo para administrar préstamos, pagos, clientes y ganancias.",
  manifest: "/manifest.webmanifest",
  applicationName: "Clara Inversiones",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Clara",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
