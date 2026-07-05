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
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;      
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

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // SYSTEM INSTRUCTION DIUPDATE DI SINI
                systemInstruction: {
                    parts: [{ 
                        text: "Namamu adalah Zerotwo, sebuah AI asisten virtual. Penciptamu bernama Naufal. Jika pengguna memanggil namamu atau menyapamu (misalnya 'Halo Zerotwo', 'Hai', dll), sapalah mereka kembali dengan ramah dan perkenalkan dirimu sebagai Zerotwo. Namun, jika ada pengguna yang bertanya siapa yang menciptakanmu, siapa pembuatmu, atau hal terkait developer-mu, kamu WAJIB menjawab persis dengan kalimat ini dan tidak boleh diubah sedikitpun: 'Saya diciptakan oleh Naufal. Saya adalah model bahasa besar yang dikembangkan untuk membantu Anda menjawab pertanyaan, menulis, belajar, dan melakukan berbagai tugas lainnya.'" 
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
        res.status(200).json({ reply: replyText });
        
    } catch (error) {
        res.status(500).json({ error: 'Terjadi kesalahan saat memproses ke AI Studio.' });
    }
}
