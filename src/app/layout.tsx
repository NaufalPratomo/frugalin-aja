import { AuthProvider } from "../components/Provider";
import "./globals.css";

export const metadata = {
  title: "frugalin.aja",
  description: "Aplikasi pencatatan keuangan pintar",
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