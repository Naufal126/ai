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

            // --- JALUR MURNI GOOGLE IMAGEN ---
            try {
                // Menggunakan endpoint resmi Imagen dari Google Generative Language API
                const imagenEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-Ultra-Generate:predict?key=${apiKey}`;
                
                const imagenResponse = await fetch(imagenEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [
                            { prompt: promptFinal }
                        ],
                        parameters: {
                            sampleCount: 1,
                            outputOptions: {
                                mimeType: "image/jpeg"
                            }
                        }
                    })
                });

                if (!imagenResponse.ok) {
                    const errorData = await imagenResponse.text();
                    console.error("Detail Error Imagen:", errorData);
                    return res.status(500).json({ error: `Google Imagen menolak permintaanmu. Coba gunakan kata-kata yang lebih aman.` });
                }

                const data = await imagenResponse.json();
                
                // Mengambil hasil Base64 dari JSON response Google Imagen
                if (data.predictions && data.predictions.length > 0) {
                    const base64Image = data.predictions[0].bytesBase64Encoded;
                    const dataUrlVal = `data:image/jpeg;base64,${base64Image}`;

                    return res.status(200).json({ 
                        reply: "Ini hasil jepretan dari Google Imagen khusus buat kamu, Fal:", 
                        imageUrl: dataUrlVal 
                    });
                } else {
                    return res.status(500).json({ error: "Google Imagen tidak mengembalikan gambar apapun." });
                }

            } catch (imagenError) {
                console.error("Gagal fetch ke Google Imagen:", imagenError);
                return res.status(500).json({ error: `Koneksi ke server Google Imagen terputus: ${imagenError.message}` });
            }

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
