import { NextResponse } from "next/server";
import { getBudgetCategoryGroup, CATEGORIES } from "../../../lib/categorizer";

export async function POST(req) {
  try {
    const { description } = await req.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json({ category: "Lainnya" });
    }

    // 1. Lini Pertama: Gunakan mesin pencocokan kata kunci lokal Indonesia (Instan, 0 Quota)
    const localMatch = getBudgetCategoryGroup(description);
    if (localMatch && localMatch !== "Lainnya") {
      return NextResponse.json({ category: localMatch, source: "local" });
    }

    // 2. Lini Kedua: Fallback ke AI (Gemini) dengan prompt terarah jika kata kunci belum cocok
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ category: "Lainnya" });
    }

    const prompt = `Kamu adalah asisten keuangan cerdas di Indonesia.
Tentukan kategori pengeluaran yang paling tepat untuk keterangan transaksi berikut:
"${description}"

Daftar Kategori dan Cakupannya:
1. Makanan & Minuman: Makanan, minuman, cafe, restoran, resto, kuliner, jajanan, warung, fast food, delivery (Gacoan, Mixue, McD, KFC, Kopi Kenangan, Fore, Starbucks, Hokben, Richeese, bakso, sate, martabak, es teh, GoFood, GrabFood, ShopeeFood, Indomie, dsb).
2. Transportasi: Pengeluaran kendaraan, bensin, SPBU, Pertamina, Shell, ojek/taksi online (Gojek, Grab, Maxim), tol, parkir, kereta, KRL, MRT, tiket pesawat, servis/bengkel kendaraan, ganti oli, cuci kendaraan, dsb.
3. Belanja & Harian: Belanja harian, kebutuhan rumah tangga, pakaian, minimarket/supermarket (Indomaret, Alfamart, Superindo), laundry, perawatan diri/grooming (potong rambut, barbershop, salon, skincare, kosmetik, sabun, sampo), barang/jasa harian, servis elektronik/laptop, perabotan, ATK, gas LPG, air galon, dsb.
4. Tagihan & Pulsa: Pembayaran rutin, pulsa, kuota/paket data (Telkomsel, XL, Tri, Indosat), listrik PLN/token, air PDAM, wifi/internet (IndiHome, Biznet), BPJS, sewa kos/kontrakan, cicilan, langganan digital (Netflix, Spotify, Youtube, iCloud), top up e-wallet, dsb.
5. Kesehatan: Apotek, obat-obatan, dokter, klinik, rumah sakit, vitamin, suplemen, periksa gigi/mata/lab, fisioterapi, gym, fitness, dsb.
6. Hiburan & Rekreasi: Bioskop (XXI, CGV, Cinepolis), konser, rekreasi, wisata, hotel/villa, liburan, game/topup game (Steam, ML, FF, PlayStation), hobi, dsb.
7. Lainnya: Gunakan HANYA jika benar-benar tidak cocok sama sekali dengan 6 kategori di atas.

Jawab HANYA dengan nama salah satu kategori di atas secara tepat, tanpa penjelasan tambahan.`;

    // Coba model gemini-2.0-flash terlebih dahulu, lalu gemini-1.5-flash / gemini-2.5-flash
    const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];
    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 30,
              },
            }),
          }
        );

        if (!response.ok) {
          continue; // Lanjut ke model berikutnya jika quota/rate limit
        }

        const resJson = await response.json();
        const resultText = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (resultText) {
          const matched = CATEGORIES.find(
            (cat) => resultText.toLowerCase().includes(cat.toLowerCase())
          );
          if (matched) {
            return NextResponse.json({ category: matched, source: "ai" });
          }
        }
      } catch (err) {
        // Abaikan dan coba model berikutnya
      }
    }

    return NextResponse.json({ category: "Lainnya" });
  } catch (error) {
    console.error("Categorize API error:", error);
    return NextResponse.json({ category: "Lainnya" });
  }
}

