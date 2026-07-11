import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { description } = await req.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json({ category: "Lainnya" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ category: "Lainnya" });
    }

    const prompt = `Kamu adalah asisten keuangan. Tentukan kategori pengeluaran yang paling tepat untuk keterangan transaksi berikut:

"${description}"

Pilih SATU kategori dari daftar berikut:
1. Makanan & Minuman
2. Transportasi
3. Belanja & Harian
4. Tagihan & Pulsa
5. Kesehatan
6. Hiburan & Rekreasi
7. Lainnya

Jawab HANYA dengan nama kategori yang dipilih, tanpa penjelasan tambahan.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 30,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini categorize error:", await response.text());
      return NextResponse.json({ category: "Lainnya" });
    }

    const resJson = await response.json();
    const resultText = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!resultText) {
      return NextResponse.json({ category: "Lainnya" });
    }

    // Validate that the AI returned one of the valid categories
    const validCategories = [
      "Makanan & Minuman",
      "Transportasi",
      "Belanja & Harian",
      "Tagihan & Pulsa",
      "Kesehatan",
      "Hiburan & Rekreasi",
      "Lainnya",
    ];

    const matched = validCategories.find(
      (cat) => resultText.toLowerCase().includes(cat.toLowerCase())
    );

    return NextResponse.json({ category: matched || "Lainnya" });
  } catch (error) {
    console.error("Categorize API error:", error);
    return NextResponse.json({ category: "Lainnya" });
  }
}
