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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "OpenRouter API key is not configured" }, { status: 500 });
    }

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
              content: [
                {
                  type: "text",
                  text: "Extract transaction information from this receipt image. Return a JSON object with the following fields: 'amount' (integer, absolute subtotal/total amount paid in IDR, e.g. 200000000), 'date' (string, format YYYY-MM-DD, e.g. '2023-01-10'), 'description' (string, the name of the store or shop, e.g. 'Toko Abang'), and 'category' (string, must be one of: 'Makanan & Minuman', 'Belanja & Harian', 'Transportasi', 'Kesehatan', 'Hiburan & Rekreasi', 'Tagihan & Pulsa'). Choose the most appropriate category based on the store name and items bought. Return ONLY the JSON, wrapped in markdown code blocks if needed."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API Error:", errorText);
      let parsedError = errorText;
      try {
        const errJson = JSON.parse(errorText);
        parsedError = errJson.error?.message || errorText;
      } catch (_) {}
      return NextResponse.json({ message: `OpenRouter API Error: ${parsedError}` }, { status: response.status });
    }

    const resJson = await response.json();
    const resultText = resJson.choices?.[0]?.message?.content;
    
    if (!resultText) {
      return NextResponse.json({ message: "Empty response from OpenRouter API" }, { status: 500 });
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
    console.error("OCR API route error:", error);
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}
