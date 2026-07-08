export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, image } = req.body;
    
    // Pastikan API Key Gemini di Vercel sudah disetting!
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
        return res.status(500).json({ error: 'API Key Gemini belum disetting di Vercel!' });
    }

    try {
        const teks = prompt ? prompt.toLowerCase() : "";
        
        const adaKataGambar = teks.includes("gambar") || teks.includes("gambarin") || teks.includes("gambarkan") || teks.includes("foto") || teks.includes("lukisan");
        const adaKataPerintah = teks.includes("buat") || teks.includes("bikin") || teks.includes("generate") || teks.includes("minta") || teks.includes("tolong") || teks.includes("tampilkan");
        const perintahLangsung = teks.startsWith("gambar ") || teks.startsWith("foto ");

        const mintaGambar = (perintahLangsung || (adaKataGambar && adaKataPerintah)) && !image;

        const dapatkanPromptBersih = (p) => {
            return p.replace(/(buatkan|buat|bikin|bikinkan|generate|gambarin|gambarkan|minta|tolong|tampilkan|gambar|foto|lukisan|ilustrasi|dong|bisa|ga|yang|jal)/gi, "")
                    .replace(/\s+/g, " ")
                    .trim();
        };

        if (mintaGambar) {
            const promptBersih = dapatkanPromptBersih(prompt);
            const promptFinal = promptBersih || "beautiful tropical fish, cinematic lighting, 4k resolution"; 

            // Encode prompt agar aman dimasukkan ke dalam URL
            const encodedPrompt = encodeURIComponent(promptFinal);

            // ==========================================
            // POLLINATIONS AI - FLUX MODEL (GRATIS & TANPA API KEY)
            // ==========================================
            // Kita pakai model=flux agar kualitas gambarnya super HD mirip Leonardo
            const imageUrl = `https://image.pollinations.ai/p/${encodedPrompt}?model=flux&width=1024&height=1024&enhance=true`;

            // Pollinations tidak butuh fetch data gambar di backend, langsung balikin URL-nya aja!
            return res.status(200).json({ 
                reply: `Ini dia gambarnya! Aku pakai model **Flux (via Pollinations)** yang super HD, gratis, dan anti-error saldo habis, Fal:`, 
                imageUrl: imageUrl 
            });

        } else {
            // ==========================================
            // LOGIKA CHAT TEXT GEMINI 1.5 FLASH
            // ==========================================
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`;

            const parts = [];
            if (prompt) parts.push({ text: prompt });
            if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64Data } });

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: "Namamu adalah Bibel Ai, sebuah AI asisten virtual. Penciptamu bernama Naufal. Tolong jawab semua pertanyaan dengan ramah." }]
                    },
                    contents: [{ parts: parts }]
                })
            });

            const data = await response.json();
            if (data.error) return res.status(500).json({ error: data.error.message });

            const replyText = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ reply: replyText });
        }
        
    } catch (error) {
        const detailPenyebab = error.cause ? error.cause.message : "Tidak ada detail tambahan dari server";
        return res.status(500).json({ error: `Error: ${error.message} | Penyebab Asli: ${detailPenyebab}` });
    }
}
