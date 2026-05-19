import { AuthProvider } from "../components/Provider";
import "./globals.css";

export const metadata = {
  title: "frugalin.aja",
  description: "Aplikasi pencatatan keuangan pintar",
  icons: {
    icon: "/favico&PWAimg.png",
    shortcut: "/favico&PWAimg.png",
    apple: "/favico&PWAimg.png",
  },
};

export const viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: "no",
};

// Menambahkan tipe data React.ReactNode agar TypeScript tidak error
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}