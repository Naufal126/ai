export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const segmindApiKey = process.env.SEGMIND_API_KEY; 

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
            if (!segmindApiKey) {
                return res.status(500).json({ error: 'API Key Segmind belum dipasang di Vercel!' });
            }

            const promptBersih = dapatkanPromptBersih(prompt);
            const promptFinal = promptBersih || "beautiful tropical fish, cinematic lighting, 4k resolution"; 

            // --- JALUR MURNI SEGMIND (SDXL 1.0) ---
            try {
                // Pindah dari FLUX ke SDXL 1.0 yang lebih ramah akun gratisan
                const segmindEndpoint = "https://api.segmind.com/v1/sdxl1.0-txt2img";
                
                const segmindResponse = await fetch(segmindEndpoint, {
                    method: "POST",
                    headers: {
                        "x-api-key": segmindApiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        prompt: promptFinal,
                        negative_prompt: "ugly, blurry, poor quality, bad anatomy",
                        samples: 1,
                        scheduler: "Euler a", // Sampler standar SDXL
                        num_inference_steps: 25,
                        guidance_scale: 7,
                        seed: -1, // -1 artinya selalu acak
                        width: 1024,
                        height: 1024
                    })
                });

                if (!segmindResponse.ok) {
                    const errorText = await segmindResponse.text();
                    console.error("Detail Error Segmind:", errorText);
                    return res.status(500).json({ error: `Segmind gagal memproses (Status ${segmindResponse.status}). Error detail: ${errorText}` });
                }

                const arrayBuffer = await segmindResponse.arrayBuffer();
                const base64Image = Buffer.from(arrayBuffer).toString('base64');
                const dataUrlVal = `data:image/jpeg;base64,${base64Image}`;

                return res.status(200).json({ 
                    reply: "Ini gambar dari Segmind (SDXL) spesial buat kamu, Fal:", 
                    imageUrl: dataUrlVal 
                });

            } catch (segmindError) {
                console.error("Gagal fetch ke Segmind:", segmindError);
                return res.status(500).json({ error: `Koneksi ke Segmind terputus: ${segmindError.message}` });
            }

        } else {
            // --- LOGIKA CHAT TEXT GEMINI 1.5 FLASH ---
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
