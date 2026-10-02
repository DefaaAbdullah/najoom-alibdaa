import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req,res){

    if(req.method !== "POST"){

        return res.status(405).json({
            error:"Method Not Allowed"
        });
    }

    try{

        if(!process.env.OPENAI_API_KEY){

            return res.status(500).json({
                error:"مفتاح OpenAI غير موجود."
            });
        }

        const body = req.body || {};

        const text =
            typeof body.text === "string"
                ? body.text.trim()
                : "";

        if(!text){

            return res.status(400).json({
                error:"لا يوجد نص لتحويله إلى صوت."
            });
        }

        if(text.length > 4000){

            return res.status(413).json({
                error:"النص طويل جداً."
            });
        }

        const cleanText = text
            .replace(/[*#_`]/g,"")
            .replace(/\n+/g," ")
            .trim();

        const speech =
            await client.audio.speech.create({

                model:"gpt-4o-mini-tts",

                voice:"coral",

                input:cleanText,

                instructions:`
تحدث باللغة العربية السعودية.

اجعل الصوت:

- احترافي
- طبيعي
- راقٍ
- ودود
- هادئ
- واضح
- مناسب لمستشار مبيعات للمفروشات
- مناسب للعملاء في المملكة العربية السعودية

لا تتحدث بسرعة.

اجعل النطق واضحاً.

استخدم نبرة ترحيبية ومريحة.

لا تستخدم نبرة آلية.

اجعل المستمع يشعر أنه يتحدث مع مستشار حقيقي.
`,

                response_format:"mp3",

                speed:0.95
            });

        const buffer =
            Buffer.from(
                await speech.arrayBuffer()
            );

        res.setHeader(
            "Content-Type",
            "audio/mpeg"
        );

        res.setHeader(
            "Content-Length",
            buffer.length
        );

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        return res
            .status(200)
            .send(buffer);

    }catch(error){

        console.error(
            "SPEECH ERROR:",
            error?.message || error
        );

        return res.status(500).json({
            error:"تعذر إنشاء الصوت حالياً."
        });
    }
}
