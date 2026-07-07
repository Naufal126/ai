export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const hfToken = process.env.HF_TOKEN; // API Key Hugging Face gratisan kamu

    if (!apiKey) {
        return res.status(500).json({ error: 'API Key Gemini belum disetting di Vercel!' });
    }

    try {
        const teks = prompt ? prompt.toLowerCase() : "";
        
        // Deteksi apakah user minta buat gambar
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
            if (!hfToken) {
                return res.status(500).json({ error: 'API Key HF_TOKEN belum disetting di Vercel!' });
            }

            const promptBersih = dapatkanPromptBersih(prompt);
            const promptFinal = promptBersih || "beautiful tropical fish, high resolution"; 

            // Kita tembak model Stable Diffusion XL lewat Hugging Face secara GRATIS
            const hfEndpoint = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
            
            const hfResponse = await fetch(hfEndpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${hfToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: promptFinal }),
            });

            if (!hfResponse.ok) {
                throw new Error("Hugging Face API sedang sibuk atau limit harian habis.");
            }

            // Mengubah response gambar mentah menjadi Base64 Data URL
            const arrayBuffer = await hfResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString('base64');
            const dataUrlVal = `data:image/jpeg;base64,${base64Image}`;

            return res.status(200).json({ 
                reply: "Ini gambar hasil generate dari Hugging Face, spesial buat kamu:", 
                imageUrl: dataUrlVal 
            });

        } else {
            // --- LOGIKA CHAT & VISION (GEMINI FLASH LITE) ---
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

            const parts = [];
            if (prompt) parts.push({ text: prompt });
            if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64Data } });

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ 
                            text: "Namamu adalah Bibel Ai, sebuah AI asisten virtual. Penciptamu bernama Naufal. Tolong jawab semua pertanyaan dengan ramah. PENTING: Kamu tidak bisa membuat gambar secara langsung." 
                        }]
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
        return res.status(500).json({ error: error.message || 'Terjadi kesalahan saat memproses.' });
    }
}
