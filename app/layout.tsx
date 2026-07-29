import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turtle City",
  description:
    "Explore Turtle City, a New York-inspired world built for turtles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
