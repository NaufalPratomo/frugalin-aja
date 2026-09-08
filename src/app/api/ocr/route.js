import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const data = await req.formData();
    const file = data.get("file");
    
    if (!file) {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "Gemini API key is not configured" }, { status: 500 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Extract transaction information from this receipt image. Return a JSON object with the following fields: 'amount' (integer, absolute subtotal/total amount paid in IDR, e.g. 200000000), 'date' (string, format YYYY-MM-DD, e.g. '2023-01-10'), 'description' (string, the name of the store or shop, e.g. 'Toko Abang'), and 'category' (string, must be one of: 'Makanan & Minuman', 'Belanja & Harian', 'Transportasi', 'Kesehatan', 'Hiburan & Rekreasi', 'Tagihan & Pulsa'). Choose the most appropriate category based on the store name and items bought."
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      let parsedError = errorText;
      try {
        const errJson = JSON.parse(errorText);
        parsedError = errJson.error?.message || errorText;
      } catch (_) {}
      return NextResponse.json({ message: `Gemini API Error: ${parsedError}` }, { status: response.status });
    }

    const resJson = await response.json();
    const resultText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      return NextResponse.json({ message: "Empty response from Gemini API" }, { status: 500 });
    }

    const parsedResult = JSON.parse(resultText.trim());
    if (parsedResult && parsedResult.amount !== undefined) {
      parsedResult.amount = Math.round(Number(parsedResult.amount)) || 0;
    }
    return NextResponse.json(parsedResult);
  } catch (error) {
    console.error("OCR API route error:", error);
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}
