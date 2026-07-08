export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
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

            // --- SISTEM DETEKSI MODEL OTOMATIS ---
            let modelPilihan = "flux"; // Model default
            
            if (teks.includes("anime") || teks.includes("kartun jepang") || teks.includes("manga")) {
                modelPilihan = "anime";
            } else if (teks.includes("nyata") || teks.includes("realistis") || teks.includes("fotorealistik") || teks.includes("asli")) {
                modelPilihan = "realism";
            } else if (teks.includes("3d") || teks.includes("pixar") || teks.includes("disney")) {
                modelPilihan = "3d";
            } else if (teks.includes("gelap") || teks.includes("dark") || teks.includes("seram")) {
                modelPilihan = "any-dark";
            } else if (teks.includes("lukisan") || teks.includes("artistik")) {
                modelPilihan = "turbo";
            }

            // Menyisipkan model yang terpilih ke dalam URL Pollinations
            const urlGambar = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptFinal)}?width=1024&height=1024&nologo=true&model=${modelPilihan}`;
            
            return res.status(200).json({ 
                reply: `Ini dia gambarnya! Aku pakai model **${modelPilihan}** biar hasilnya nggak kaku dan sesuai gaya yang kamu minta, Fal:`, 
                imageUrl: urlGambar 
            });

        } else {
            // --- LOGIKA CHAT TEXT GEMINI 1.5 FLASH ---
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

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
        return res.status(500).json({ error: `Terjadi kesalahan internal: ${error.message}` });
    }
}
