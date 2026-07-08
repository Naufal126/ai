export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Sekarang kita tangkap 'history' (array), bukan cuma 'prompt' tunggal
    const { history, image } = req.body;
    
    // Pastikan API Key Gemini di Vercel sudah disetting!
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
        return res.status(500).json({ error: 'API Key Gemini belum disetting di Vercel!' });
    }

    if (!history || history.length === 0) {
        return res.status(400).json({ error: 'Riwayat obrolan (history) tidak ditemukan!' });
    }

    try {
        // Ambil pesan terakhir dari user di dalam array history sebagai prompt utama
        const lastUserTurn = history[history.length - 1];
        const promptAsli = lastUserTurn && lastUserTurn.parts ? lastUserTurn.parts[0].text : "";
        const teks = promptAsli ? promptAsli.toLowerCase() : "";
        
        // Logika deteksi apakah user minta generate gambar
        const adaKataGambar = teks.includes("gambar") || teks.includes("gambarin") || teks.includes("gambarkan") || teks.includes("foto") || teks.includes("lukisan");
        const adaKataPerintah = teks.includes("buat") || teks.includes("bikin") || teks.includes("generate") || teks.includes("minta") || teks.includes("tolong") || teks.includes("tampilkan");
        const perintahLangsung = teks.startsWith("gambar ") || teks.startsWith("foto ");

        // Kita hanya generate gambar kalau user TIDAK sedang mengirimkan gambar (bukan input multimodal)
        const mintaGambar = (perintahLangsung || (adaKataGambar && adaKataPerintah)) && !image;

        const dapatkanPromptBersih = (p) => {
            return p.replace(/(buatkan|buat|bikin|bikinkan|generate|gambarin|gambarkan|minta|tolong|tampilkan|gambar|foto|lukisan|ilustrasi|dong|bisa|ga|yang|jal)/gi, "")
                    .replace(/\s+/g, " ")
                    .trim();
        };

        if (mintaGambar) {
            const promptBersih = dapatkanPromptBersih(promptAsli);
            const promptFinal = promptBersih || "beautiful tropical fish, cinematic lighting, 4k resolution"; 

            // Encode prompt agar aman dimasukkan ke dalam URL
            const encodedPrompt = encodeURIComponent(promptFinal);

            // ==========================================
            // POLLINATIONS AI - FLUX MODEL
            // ==========================================
            const imageUrl = `https://image.pollinations.ai/p/${encodedPrompt}?model=flux&width=1024&height=1024&enhance=true`;

            return res.status(200).json({ 
                reply: `Ini dia gambarnya! Aku pakai model **Flux (via Pollinations)** yang super HD, gratis, dan anti-error saldo habis, Fal:`, 
                imageUrl: imageUrl 
            });

        } else {
            // ==========================================
            // LOGIKA CHAT TEXT GEMINI (DENGAN INGATAN/HISTORY)
            // ==========================================
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`;

            // Jika user melampirkan gambar untuk dianalisis, tempelkan datanya ke part pesan terakhir
            if (image && lastUserTurn && lastUserTurn.role === 'user') {
                lastUserTurn.parts.push({ 
                    inlineData: { 
                        mimeType: image.mimeType, 
                        data: image.base64Data 
                    } 
                });
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: "Namamu adalah Bibel Ai, sebuah AI asisten virtual. Penciptamu bernama Naufal. Tolong jawab semua pertanyaan dengan ramah." }]
                    },
                    // Kita langsung mengumpankan seluruh isi 'history' ke 'contents' agar Gemini ingat chat sebelumnya
                    contents: history
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
