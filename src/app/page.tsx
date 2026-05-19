import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col justify-center items-center text-center p-6">
      <div className="max-w-3xl space-y-8">
        {/* Badge */}
        <div className="inline-block px-4 py-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm mb-4">
          Aplikasi Pencatat Keuangan
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight">
          Kendalikan Keuanganmu dengan <span className="text-green-600">frugalin.aja</span>
        </h1>
        
        {/* Deskripsi */}
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
          Catat pengeluaran harian, pantau saldo dari berbagai rekening bank, uang tunai, hingga pemasukanmu dalam satu tempat.
        </p>
        
        {/* Tombol Aksi */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
          <Link 
            href="/register" 
            className="w-full sm:w-auto px-8 py-3 bg-green-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 hover:-translate-y-1 transition-all duration-200"
          >
            Mulai Sekarang
          </Link>
          <Link 
            href="/login" 
            className="w-full sm:w-auto px-8 py-3 bg-white text-gray-800 border border-gray-200 text-lg font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-all duration-200"
          >
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}