export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, image } = req.body;
    
    // Pastikan API Key di Vercel sudah disetting!
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const hfApiKey = process.env.HUGGINGFACE_API_KEY ? process.env.HUGGINGFACE_API_KEY.trim() : null;

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
            if (!hfApiKey) {
                return res.status(500).json({ error: 'API Key Hugging Face belum disetting di Vercel!' });
            }

            const promptBersih = dapatkanPromptBersih(prompt);
            const promptFinal = promptBersih || "beautiful tropical fish, cinematic lighting, 4k resolution"; 

            // ==========================================
            // FETCH KE HUGGING FACE API (FLUX.1-SCHNELL)
            // ==========================================
            const hfResponse = await fetch('https://api.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: promptFinal,
                    options: { wait_for_model: true } // Memaksa server menunggu sampai model siap
                })
            });

            if (!hfResponse.ok) {
                const errorData = await hfResponse.json().catch(() => ({}));
                if (errorData.error && errorData.error.includes("is currently loading")) {
                    return res.status(503).json({ error: "AI Pembuat Gambar sedang pemanasan. Coba lagi dalam 20 detik ya, Fal!" });
                }
                throw new Error(errorData.error || "Gagal generate gambar dari Hugging Face.");
            }

            // Ubah respons gambar mentah (Blob/Buffer) ke format Base64 supaya bisa dibaca tag <img> di HTML
            const arrayBuffer = await hfResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString('base64');
            const imageUrl = `data:image/jpeg;base64,${base64Image}`;

            return res.status(200).json({ 
                reply: `Ini dia gambarnya! Aku pakai model **FLUX.1** kualitas HD tanpa mikirin saldo kredit habis, Fal:`, 
                imageUrl: imageUrl 
            });

        } else {
            // ==========================================
            // LOGIKA CHAT TEXT GEMINI 3.1 FLASH LITE
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
