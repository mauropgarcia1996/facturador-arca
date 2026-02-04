import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARCA Facturador",
  description: "Facturador electronico para ARCA/AFIP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
