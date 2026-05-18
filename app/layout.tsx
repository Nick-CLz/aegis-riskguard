import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aegis-RiskGuard',
  description: '2LoD operational risk agent with deep-prompt-inspection firewall'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-aegis-midnight text-aegis-sand min-h-screen">{children}</body>
    </html>
  );
}
