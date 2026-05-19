"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res.error) {
        setError("Email atau Password salah!");
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      setError("Terjadi kesalahan server");
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
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="nama@email.com"
              className="w-full border border-gray-200 py-2.5 px-3.5 rounded-xl bg-gray-50 text-black focus:outline-none focus:border-green-500 focus:bg-white transition-all text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Password</label>
            <input
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="w-full border border-gray-200 py-2.5 px-3.5 rounded-xl bg-gray-50 text-black focus:outline-none focus:border-green-500 focus:bg-white transition-all text-sm"
            />
          </div>
          
          <button className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl shadow-md shadow-green-100 hover:bg-green-700 hover:-translate-y-0.5 transition-all duration-200 text-sm mt-2 cursor-pointer">
            Masuk Aplikasi
          </button>

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 w-full text-center text-sm py-2 px-3 rounded-xl mt-1 font-medium">
              ⚠️ {error}
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