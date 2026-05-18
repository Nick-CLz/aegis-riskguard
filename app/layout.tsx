import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aegis-RiskGuard | 2LoD AI Risk Agent',
  description:
    'Autonomous 2nd Line of Defence operational risk agent for regulated banks. Compares policy documents against RCSA registers, detects control gaps — with every Gemini call inspected by a deep-prompt-inspection firewall and every decision HMAC-signed for regulators.',
  keywords: [
    'AI risk management', 'RCSA', 'operational risk', '2LoD', 'GRC', 'Gemini',
    'EU DORA', 'EU AI Act', 'Basel III', 'prompt injection', 'audit log', 'fintech'
  ],
  openGraph: {
    title: '🦞 Aegis-RiskGuard — The trust layer for autonomous risk operations',
    description:
      'AI agent that compares policies against RCSA registers in seconds. Every Gemini call inspected by a Lobster Trap firewall. Every decision auditable by a regulator.',
    type: 'website',
    url: 'https://github.com/Nick-CLz/aegis-riskguard',
  },
  twitter: {
    card: 'summary_large_image',
    title: '🦞 Aegis-RiskGuard | 2LoD AI Risk Agent',
    description: 'Gap detection for regulated banks. Gemini + Lobster Trap firewall + HMAC audit log.',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-aegis-midnight text-aegis-sand min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
