import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'BidScope | GeM Bid Compliance',
  description:
    'An integrated workspace for tender requirements, bidder evidence, AI-assisted compliance review, and audit trails.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
