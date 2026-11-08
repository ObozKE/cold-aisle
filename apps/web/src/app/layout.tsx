import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { AuthRoleProvider } from '../context/AuthRoleContext';

export const metadata: Metadata = {
  title: 'Data Hall Cooling & Power Telemetry Twin | ColdAisle DCIM',
  description: 'Carrier-grade Data Center Infrastructure Management and Telemetry Twin',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-noc-bg font-sans text-slate-100 antialiased">
        <AuthRoleProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
        </AuthRoleProvider>
      </body>
    </html>
  );
}
