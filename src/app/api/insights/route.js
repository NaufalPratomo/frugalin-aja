import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import dbConnect from "../../../lib/mongodb";
import Transaction from "../../../lib/models/Transaction";
import Account from "../../../lib/models/Account";
import User from "../../../lib/models/User";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await dbConnect();

    // 1. Dapatkan data limit user
    const user = await User.findById(session.user.id);
    const monthlyLimit = user?.monthlyLimit || 0;

    // 2. Dapatkan rekening aktif
    const accounts = await Account.find({ userId: session.user.id });
    const totalNetWorth = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // 3. Dapatkan transaksi terakhir (misal 50 transaksi terbaru)
    const transactions = await Transaction.find({ userId: session.user.id })
      .sort({ date: -1 })
      .limit(50);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "OpenRouter API key is not configured" }, { status: 500 });
    }

    // 4. Siapkan payload data untuk dikirim ke AI
    const accountsSummary = accounts.map(a => `${a.name} (${a.type}): Rp ${a.balance}`).join(", ");
    const transactionsSummary = transactions.map(t => `${t.date.toISOString().split('T')[0]} - ${t.type} - Rp ${t.amount} - Kategori: ${t.category} - Ket: ${t.description}`).join("\n");

    const promptText = `
Anda adalah konsultan keuangan pribadi AI yang cerdas untuk aplikasi "Frugalin Aja".
Analisis data keuangan pengguna berikut dan berikan wawasan (insights) keuangan taktis dalam Bahasa Indonesia.

Informasi Pengguna:
- Total Aset Bersih (Net Worth): Rp ${totalNetWorth}
- Rekening: [${accountsSummary}]
- Limit Pengeluaran Bulanan: Rp ${monthlyLimit}

Transaksi Terbaru (maksimal 50 terakhir):
${transactionsSummary || "(Belum ada transaksi)"}

Tugas Anda:
Analisis pola pengeluaran untuk mendeteksi pemborosan (misal pengeluaran makanan terlalu tinggi, banyak transaksi kecil berulang, atau pengeluaran melebihi limit/income) dan berikan saran finansial yang konkret.

Kembalikan jawaban dalam format JSON mentah (raw JSON) dengan struktur persis seperti di bawah ini, tanpa markdown block lain di luar JSON:
{
  "financialScore": 85, // Angka integer dari 0-100 yang menilai kesehatan keuangan pengguna berdasarkan rasio pengeluaran terhadap aset/limit
  "insights": [
    {
      "title": "Judul Wawasan singkat dan menarik",
      "type": "WARNING", // Harus bernilai salah satu dari: "SUCCESS" (untuk pencapaian baik), "WARNING" (untuk indikasi pemborosan/perhatian), atau "INFO" (untuk wawasan umum)
      "description": "Deskripsi wawasan lengkap dengan nominal spesifik jika ada, penjelasan mengapa ini pemborosan, dan saran aksi konkret untuk mengatasinya."
    }
  ]
}

Berikan minimal 2 dan maksimal 3 item wawasan (insights) dalam array. Gunakan bahasa yang ramah, sopan, namun taktis dan solutif.
`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Frugalin Aja"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: promptText
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter Insights API Error:", errorText);
      return NextResponse.json({ message: `OpenRouter API Error: ${errorText}` }, { status: response.status });
    }

    const resJson = await response.json();
    const resultText = resJson.choices?.[0]?.message?.content;
    
    if (!resultText) {
      return NextResponse.json({ message: "Empty response from AI" }, { status: 500 });
    }

    let cleanText = resultText.trim();
    if (cleanText.includes("```")) {
      const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        cleanText = match[1];
      }
    }

    const parsedResult = JSON.parse(cleanText.trim());
    return NextResponse.json(parsedResult);
  } catch (error) {
    console.error("Insights API Route Error:", error);
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}
