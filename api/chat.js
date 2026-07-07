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
        const teks = prompt ? prompt.toLowerCase() : "";
        
        // --- 1. DETEKSI GAMBAR YANG LEBIH LUAS & FLEKSIBEL ---
        // Cek apakah ada indikasi kata benda gambar
        const adaKataGambar = teks.includes("gambar") || teks.includes("gambarin") || teks.includes("gambarkan") || teks.includes("foto") || teks.includes("lukisan");
        // Cek apakah ada indikasi kata perintah
        const adaKataPerintah = teks.includes("buat") || teks.includes("bikin") || teks.includes("generate") || teks.includes("minta") || teks.includes("tolong") || teks.includes("tampilkan") || teks.includes("carikan");
        
        // Cek perintah langsung tanpa basa-basi (contoh: "gambar ikan mas")
        const perintahLangsung = teks.startsWith("gambar ") || teks.startsWith("foto ") || teks.startsWith("lukis ");

        // AI hanya akan generate gambar BARU jika user tidak sedang mengunggah file gambar (fitur vision)
        const mintaGambar = (perintahLangsung || (adaKataGambar && adaKataPerintah)) && !image;

        // Fungsi pembantu untuk membersihkan prompt agar hasilnya maksimal & akurat di Pollinations.ai
        const dapatkanPromptBersih = (p) => {
            return p.replace(/(buatkan|buat|bikin|bikinkan|generate|gambarin|gambarkan|minta|tolong|tampilkan|carikan|gambar|foto|lukisan|ilustrasi|dong|bisa|ga|yang|jal|tolongin)/gi, "")
                    .replace(/\s+/g, " ") // Merapikan spasi ganda menjadi satu spasi
                    .trim();
        };

        if (mintaGambar) {
            // --- LOGIKA GENERATE GAMBAR GRATIS (VIA POLLINATIONS.AI) ---
            const promptBersih = dapatkanPromptBersih(prompt);
            
            // Jaga-jaga jika setelah dibersihkan teksnya kosong, kita beri default objek
            const promptFinal = promptBersih || "goldfish"; 
            
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptFinal)}?width=1024&height=1024&nologo=true`;

            return res.status(200).json({ 
                reply: "Ini gambar yang kamu minta, spesial dari Bibel:", 
                imageUrl: imageUrl 
            });

        } else {
            // --- LOGIKA CHAT & VISION (GEMINI FLASH LITE) ---
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
                            text: "Namamu adalah Bibel Ai, sebuah AI asisten virtual. Penciptamu bernama Naufal. Jika pengguna memanggil namamu atau menyapamu (misalnya 'Halo Bibel', 'Hai', dll), sapalah mereka kembali dengan ramah dan perkenalkan dirimu sebagai Bibel. Namun, jika ada pengguna yang bertanya siapa yang menciptakanmu, siapa pembuatmu, atau hal terkait developer-mu, kamu WAJIB menjawab persis dengan kalimat ini dan tidak boleh diubah sedikitpun: 'Saya diciptakan oleh Naufal. Saya adalah model bahasa besar yang dikembangkan untuk membantu Anda menjawab pertanyaan, menulis, belajar, dan melakukan berbagai tugas lainnya.' PENTING: Kamu tidak bisa membuat gambar. Jika user meminta gambar dan lolos ke sini, arahkan mereka untuk menggunakan kata kunci perintah yang lebih jelas." 
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

            // --- 🛡️ SISTEM PENGAMAN ANTI-BOCOR (FALLBACK SAFETY) 🛡️ ---
            if (replyText.includes("dalle.text2im") || replyText.includes("action_input") || replyText.includes("action")) {
                const promptBersih = dapatkanPromptBersih(prompt);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptBersih || "fish")纵?width=1024&height=1024&nologo=true`;
                
                return res.status(200).json({ 
                    reply: "Ini gambar yang kamu minta, spesial dari Bibel:", 
                    imageUrl: imageUrl 
                });
            }

            return res.status(200).json({ reply: replyText });
        }
        
    } catch (error) {
        return res.status(500).json({ error: 'Terjadi kesalahan saat memproses.' });
    }
}
