
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'API Key belum disetting di Vercel!' });
    }

    try {
        // --- 1. DETEKSI APAKAH USER MINTA DIBUATKAN GAMBAR ---
        const teks = prompt ? prompt.toLowerCase() : "";
        
        const mintaGambar = teks.includes("buatkan gambar") || 
                            teks.includes("generate gambar") || 
                            teks.includes("bikin gambar") ||
                            teks.includes("gambarin") ||
                            teks.includes("buat gambar") ||
                            (teks.includes("gambar") && teks.includes("bisa")) || 
                            teks.startsWith("gambar ");

        if (mintaGambar) {
            // --- LOGIKA GENERATE GAMBAR GRATIS (VIA POLLINATIONS.AI) ---
            
            // Bersihkan prompt agar hanya tersisa objek yang mau digambar
            const promptBersih = prompt
                .replace(/buatkan gambar/gi, "")
                .replace(/generate gambar/gi, "")
                .replace(/bikin gambar/gi, "")
                .replace(/buat gambar/gi, "")
                .replace(/gambarin/gi, "")
                .replace(/gambar/gi, "") 
                .replace(/bisa ga/gi, "")
                .replace(/bisa/gi, "")
                .trim();

            // Gunakan API publik Pollinations yang 100% gratis dan tanpa API Key
            // encodeURIComponent digunakan agar spasi dan teks aman dimasukkan ke dalam link URL
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptBersih)}?width=1024&height=1024&nologo=true`;

            // Langsung kirim URL gambar tersebut ke frontend!
            return res.status(200).json({ 
                reply: "Ini gambar yang kamu minta, spesial dari Bibel:", 
                imageUrl: imageUrl 
            });

        } else {
            // --- LOGIKA CHAT & VISION (GEMINI FLASH LITE - TETAP GRATIS) ---
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

            const parts = [];
            
            if (prompt) {
                parts.push({ text: prompt });
            } else if (!prompt && image) {
                parts.push({ text: "Tolong jelaskan secara detail apa yang ada di dalam gambar ini." });
            }

            if (image) {
                parts.push({
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
                        parts: [{ 
                            text: "Namamu adalah Bibel Ai, sebuah AI asisten virtual. Penciptamu bernama Naufal. Jika pengguna memanggil namamu atau menyapamu (misalnya 'Halo Bibel', 'Hai', dll), sapalah mereka kembali dengan ramah dan perkenalkan dirimu sebagai Bibel. Namun, jika ada pengguna yang bertanya siapa yang menciptakanmu, siapa pembuatmu, atau hal terkait developer-mu, kamu WAJIB menjawab persis dengan kalimat ini dan tidak boleh diubah sedikitpun: 'Saya diciptakan oleh Naufal. Saya adalah model bahasa besar yang dikembangkan untuk membantu Anda menjawab pertanyaan, menulis, belajar, dan melakukan berbagai tugas lainnya.'" 
                        }]
                    },
                    contents: [{ parts: parts }]
                })
            });

            const data = await response.json();
            
            if (data.error) {
                return res.status(500).json({ error: data.error.message });
            }

            const replyText = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ reply: replyText });
        }
        
    } catch (error) {
        return res.status(500).json({ error: 'Terjadi kesalahan saat memproses.' });
    }
}
