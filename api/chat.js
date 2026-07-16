export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { history, image, modelMode } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!history || history.length === 0) {
        return res.status(400).json({ error: 'Riwayat obrolan (history) tidak ditemukan!' });
    }

    try {
        const lastUserTurn = history[history.length - 1];
        const promptAsli = lastUserTurn && lastUserTurn.parts ? lastUserTurn.parts[0].text : "";
        const teks = promptAsli ? promptAsli.toLowerCase() : "";
        
        // ==========================================
        // 1. GLOBAL LOGIC: GENERATE GAMBAR (BERLAKU DI PRO & FLASH)
        // ==========================================
        const adaKataGambar = teks.includes("gambar") || teks.includes("gambarin") || teks.includes("gambarkan") || teks.includes("foto") || teks.includes("lukisan") || teks.includes("ilustrasi");
        const adaKataPerintah = teks.includes("buat") || teks.includes("bikin") || teks.includes("generate") || teks.includes("minta") || teks.includes("tolong") || teks.includes("tampilkan");
        const perintahLangsung = teks.startsWith("gambar ") || teks.startsWith("foto ") || teks.startsWith("draw ");

        const mintaGambar = (perintahLangsung || (adaKataGambar && adaKataPerintah)) && !image;

        if (mintaGambar) {
            const dapatkanPromptBersih = (p) => {
                return p.replace(/(buatkan|buat|bikin|bikinkan|generate|gambarin|gambarkan|minta|tolong|tampilkan|gambar|foto|lukisan|ilustrasi|dong|bisa|ga|yang|jal|draw|please)/gi, "")
                        .replace(/\s+/g, " ")
                        .trim();
            };

            const promptBersih = dapatkanPromptBersih(promptAsli);
            const promptFinal = promptBersih || "beautiful digital art, cinematic lighting, 4k resolution"; 
            const encodedPrompt = encodeURIComponent(promptFinal);
            const imageUrl = `https://image.pollinations.ai/p/${encodedPrompt}?model=flux&width=1024&height=1024&enhance=true`;

            return res.status(200).json({ 
                reply: `Ini dia gambarnya! 🎨:`, 
                imageUrl: imageUrl 
            });
        }

        // ==========================================
        // 2. LOGIKA CHAT TEXT : BIBEL FLASH (POLLINATIONS TEXT)
        // ==========================================
        if (modelMode === 'flash') {
            // Karena API Text Pollinations mirip OpenAI, kita ubah format history-nya dulu
            const formattedMessages = [
                { role: 'system', content: 'Namamu adalah Bibel Flash, AI asisten virtual ciptaan Naufal. Jawablah dengan bahasa santai, ramah, dan ringkas.' }
            ];

            // Mapping history Gemini ke format yang bisa dibaca Pollinations Text
            history.forEach(turn => {
                formattedMessages.push({
                    role: turn.role === 'model' ? 'assistant' : 'user',
                    content: turn.parts[0].text
                });
            });

            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: formattedMessages })
            });

            if (!response.ok) throw new Error("Gagal terhubung ke server flash");
            
            // Pollinations me-return langsung teks jawabannya
            const replyText = await response.text(); 
            
            return res.status(200).json({ reply: replyText });
        }


        // ==========================================
        // 3. LOGIKA CHAT TEXT : BIBEL PRO (GEMINI)
        // ==========================================
        if (modelMode === 'pro') {
            if (!geminiApiKey) return res.status(500).json({ error: 'API Key Gemini belum disetting!' });

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`;
            let contentsForGemini = JSON.parse(JSON.stringify(history));

            if (image && image.base64Data && image.mimeType) {
                const totalTurns = contentsForGemini.length;
                if (contentsForGemini[totalTurns - 1].role === 'user') {
                    const cleanBase64 = image.base64Data.replace(/^data:image\/\w+;base64,/, "");
                    contentsForGemini[totalTurns - 1].parts.push({ 
                        inlineData: { mimeType: image.mimeType, data: cleanBase64 } 
                    });
                }
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: "Namamu adalah Bibel Pro, AI asisten virtual ciptaan Naufal. Jawab dengan ramah dan cerdas." }] },
                    contents: contentsForGemini
                })
            });

            const data = await response.json();
            if (data.error) return res.status(500).json({ error: data.error.message });

            const replyText = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ reply: replyText });
        }

        return res.status(400).json({ error: 'Mode AI tidak ditemukan!' });
        
    } catch (error) {
        return res.status(500).json({ error: `Error: ${error.message}` });
    }
}
