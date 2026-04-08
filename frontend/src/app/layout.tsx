import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MiniAgil - Premium Agile Management',
  description: 'A modern, premium agile workflow management dashboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
