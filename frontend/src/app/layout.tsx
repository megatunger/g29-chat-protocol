"use client";

import "./globals.css";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { AuthenticationProvider } from "@/contexts/AuthenticationContext";
import { NewKeyProvider } from "@/contexts/NewKeyContext";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "@/constants/query-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-head",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${archivoBlack.variable} ${space.variable}`}>
        <div className="bg-[linear-gradient(to_right,#8080804D_1px,transparent_1px),linear-gradient(to_bottom,#80808090_1px,transparent_1px)] shadow-shadow [background-size:40px_40px] bg-secondary-background w-[100wh] h-[100vh] d-flex">
          <QueryClientProvider client={queryClient}>
            <NewKeyProvider>
              <AuthenticationProvider>
                <NetworkProvider>{children}</NetworkProvider>
              </AuthenticationProvider>
            </NewKeyProvider>
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </div>
      </body>
    </html>
  );
}
