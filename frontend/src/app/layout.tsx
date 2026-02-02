// src/app/layout.tsx
import './globals.css';
import { SensitiveModeProvider } from '@/components/SensitiveMode';

export const metadata = {
  title: 'Zona Invest',
  description: 'Zona Invest Admin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SensitiveModeProvider>{children}</SensitiveModeProvider>
      </body>
    </html>
  );
}
