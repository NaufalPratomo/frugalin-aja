"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "../../components/Toast";
import SplashScreen from "../../components/SplashScreen";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return <SplashScreen />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setError("");
    setIsLoading(true);
    showToast("Menghubungkan ke server...", "info");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Email atau Password salah!");
        showToast("Gagal masuk. Periksa kembali email dan password Anda.", "error");
        setIsLoading(false);
        return;
      }

      showToast("Berhasil masuk! Menyiapkan dashboard...", "success");
      window.location.href = "/dashboard";
    } catch (error) {
      setError("Terjadi kesalahan server");
      showToast("Gagal terhubung ke server. Silakan coba lagi.", "error");
      setIsLoading(false);
    }
  };

  return (
    <div className="grid place-items-center h-screen bg-gradient-to-b from-green-50 to-white p-4">
      <div className="shadow-xl p-8 rounded-2xl bg-white border border-gray-100 w-full max-w-md transition-all">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Masuk ke <span className="text-green-600">frugalin.aja</span></h1>
          <p className="text-sm text-gray-500 mt-1">Selamat datang kembali! Yuk catat keuanganmu</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              type="email"
              required
              placeholder="nama@email.com"
              className="w-full border border-gray-200 py-2.5 px-3.5 rounded-xl bg-gray-50 text-black focus:outline-none focus:border-green-500 focus:bg-white transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              type="password"
              required
              placeholder="••••••••"
              className="w-full border border-gray-200 py-2.5 px-3.5 rounded-xl bg-gray-50 text-black focus:outline-none focus:border-green-500 focus:bg-white transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          
          <button 
            type="submit"
            disabled={isLoading}
            className={`font-bold px-6 py-3 rounded-xl shadow-md transition-all duration-200 text-sm mt-2 flex items-center justify-center gap-2 ${
              isLoading
                ? "bg-green-400 text-white cursor-not-allowed"
                : "bg-green-600 text-white shadow-green-100 hover:bg-green-700 hover:-translate-y-0.5 cursor-pointer"
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Memproses masuk...</span>
              </>
            ) : (
              "Masuk Aplikasi"
            )}
          </button>

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 w-full text-center text-sm py-2 px-3 rounded-xl mt-1 font-medium">
              {error}
            </div>
          )}

          <div className="text-sm mt-4 text-center text-gray-500">
            Belum punya akun?{" "}
            <Link className="underline font-semibold text-green-600 hover:text-green-700" href="/register">
              Daftar sekarang
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}