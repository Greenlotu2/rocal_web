import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./context/UserContext"; // 🟢 IMPORTAMOS EL CONTEXTO

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ROCAL CONSTRUCTORA",
  description: "Plataforma de gestión y control de obras",
  icons: {
    icon: "/propuesta-1.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es" // 🟢 CAMBIADO A ESPAÑOL
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 🟢 ENVOLVEMOS TODA LA APLICACIÓN CON EL PROVEEDOR DE USUARIO */}
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}