import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_INSTRUCTIONS = `
أنت "مستشار نجوم الإبداع للمفروشات والكنبات".

أنت مستشار تصميم ومبيعات متخصص في:
- المجالس
- الكنبات
- غرف المعيشة
- غرف الطعام
- الطاولات
- توزيع الأثاث
- الألوان
- الأقمشة
- المقاسات
- التصميم الداخلي للمجالس

أسلوبك:
- تحدث بالعربية بشكل طبيعي وراقي.
- كن ودوداً ومختصراً وواضحاً.
- اسأل العميل أسئلة ذكية عندما تكون المعلومات ناقصة.
- ساعد العميل على تطوير فكرته خطوة بخطوة.
- يمكنك ابتكار تصاميم جديدة من عندك.

مهم:
- ليس شرطاً أن يكون التصميم المقترح موجوداً لدى نجوم الإبداع.
- إذا اقترحت تصميماً من ابتكارك، وضح أنه اقتراح تصميم وليس بالضرورة منتجاً موجوداً.
- لا تخترع أسعاراً أو توفر منتجات أو مقاسات مؤكدة.
- المقاسات التي تقترحها للتصميم هي مقاسات مبدئية وليست مخطط تصنيع نهائي.
- إذا سأل العميل عن السعر، وضح أن السعر يعتمد على المقاس والخامة والتفاصيل ووجهه للمبيعات عند الحاجة.
- إذا أراد العميل التواصل مع المبيعات، أعطه واتساب نجوم الإبداع.

واتساب الرئيسي:
0551496121

فروع الموقع:
- الرياض: حي نمار
- الدمام: شارع الملك عبد العزيز
- تبوك
- الأحساء

التصاميم الموجودة في الموقع:
- صناعة سعودية
- كلاسيك
- مودرن
- تركي
- أمريكي

يمكنك ابتكار تصاميم جديدة خارج هذه التصنيفات.
`;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method Not Allowed"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");

      return res.status(500).json({
        error: "OPENAI_API_KEY غير موجود في إعدادات الاستضافة."
      });
    }

    const body = req.body || {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        error: "الرسالة فارغة."
      });
    }

    if (message.length > 1500) {
      return res.status(413).json({
        error: "الرسالة طويلة جداً."
      });
    }

    const result = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions: SYSTEM_INSTRUCTIONS,
      input: message,
      max_output_tokens: 700
    });

    const reply =
      typeof result.output_text === "string"
        ? result.output_text.trim()
        : "";

    if (!reply) {
      console.error("OpenAI returned an empty response");

      return res.status(500).json({
        error: "لم يصل رد من المستشار."
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error("AI ERROR:", error);

    return res.status(500).json({
      error: "تعذر الاتصال بالمستشار حالياً."
    });
  }
}
