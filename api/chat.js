import OpenAI, { toFile } from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const TEXT_MODEL = "gpt-5.6-luna";
const IMAGE_MODEL = "gpt-image-2";

const SYSTEM_INSTRUCTIONS = `
أنت "مستشار نجوم الإبداع للمفروشات والكنبات".

أنت مستشار متخصص في:
- المجالس
- الكنبات
- غرف المعيشة
- غرف الطعام
- الطاولات
- توزيع الأثاث
- الألوان
- الأقمشة
- المقاسات
- التصميم الداخلي

تحدث باللغة العربية.

اجعل أسلوبك:
- طبيعي
- راقي
- ودود
- مختصر
- واضح
- مفيد للعميل

تعامل مع العميل كأنك مستشار مبيعات وتصميم محترف.

استخدم سياق المحادثة السابقة عندما يكون موجوداً.
لا تتعامل مع كل رسالة وكأنها محادثة جديدة.

إذا ذكر العميل معلومة سابقة مثل:
- أبعاد الغرفة
- عدد الأشخاص
- اللون
- نوع المجلس
- الميزانية
- الفرع
- جاهز أو تفصيل

فاستخدمها في الردود اللاحقة.

لا تخترع أسعاراً.
لا تؤكد توفر منتج إلا إذا كانت المعلومة مؤكدة.
لا تخترع مخزوناً.
لا تخترع أرقام فواتير.
لا تخترع عروضاً.

إذا كان التصميم من ابتكارك قل:
"تصور مقترح"

المقاسات التي تقترحها مبدئية وليست مخطط تصنيع.

يمكنك ابتكار موديلات جديدة.
يمكنك اقتراح ألوان وأقمشة وتوزيعات.

إذا أرسل العميل صورة:
حلل المكان والأثاث الظاهر في الصورة.

إذا طلب العميل إنشاء تصميم:
يجب إنشاء تصور صورة.

إذا طلب العميل تعديل صورة:
يجب تعديل الصورة المرفوعة.

إذا لم يطلب العميل صورة أو تصميماً:
أجب نصياً فقط.

لا تقل إن التصميم موجود في معرض نجوم الإبداع إلا إذا كانت المعلومة مؤكدة.

واتساب نجوم الإبداع:
0551496121

الفروع:
الرياض - حي نمار
الدمام - شارع الملك عبد العزيز
تبوك
الأحساء

التصنيفات:
صناعة سعودية
كلاسيك
مودرن
تركي
أمريكي

إذا احتاج العميل إلى تنفيذ فعلي أو سعر أو توفر:
وجهه إلى التواصل مع الفرع أو واتساب.

إذا كانت رسالة العميل قصيرة وغامضة:
اسأله سؤالاً واحداً أو سؤالين واضحين فقط.

لا تجعل الردود طويلة بلا حاجة.
`;


/* =========================
   أدوات مساعدة
========================= */

function isValidImageData(image) {

    if (typeof image !== "string") {
        return false;
    }

    return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(image);
}


function getBase64SizeInBytes(dataUrl) {

    const parts = dataUrl.split(",");

    if (parts.length !== 2) {
        return 0;
    }

    const base64 = parts[1];

    return Math.floor(base64.length * 0.75);
}


async function dataUrlToFile(dataUrl) {

    const match = dataUrl.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/
    );

    if (!match) {
        throw new Error("صيغة الصورة غير صحيحة.");
    }

    const mimeType = match[1];

    const extension =
        mimeType.includes("png")
            ? "png"
            : mimeType.includes("webp")
                ? "webp"
                : "jpg";

    const buffer = Buffer.from(
        match[2],
        "base64"
    );

    return await toFile(
        buffer,
        `najoom-reference.${extension}`,
        {
            type: mimeType
        }
    );
}


function cleanHistory(history) {

    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .filter(item =>
            item &&
            (
                item.role === "user" ||
                item.role === "assistant"
            ) &&
            typeof item.content === "string"
        )
        .map(item => ({
            role: item.role,
            content: item.content.slice(0, 3000)
        }))
        .slice(-12);
}


/* =========================
   تحديد هل العميل يريد صورة
========================= */

function shouldGenerateImage(message, hasImage) {

    if (!message) {
        return false;
    }

    const text = message
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();


    /*
     * إذا أرسل صورة وقال عدل / غير / أضف...
     */

    if (hasImage) {

        const editWords = [
            "عدل",
            "عدّل",
            "تعديل",
            "غير",
            "غيّر",
            "تغيير",
            "بدل",
            "بدّل",
            "استبدل",
            "أضف",
            "اضف",
            "احذف",
            "شيل",
            "غير اللون",
            "غير القماش",
            "غير الكنبة",
            "غير المجلس",
            "غير الترتيب",
            "خله",
            "خليها",
            "اجعلها"
        ];

        if (
            editWords.some(word =>
                text.includes(word)
            )
        ) {
            return true;
        }
    }


    /*
     * طلب إنشاء تصميم
     */

    const designWords = [
        "صمم",
        "صمّم",
        "تصميم",
        "تصور",
        "تصوّر",
        "صورة",
        "اعمل لي صورة",
        "اعمل صورة",
        "سوي لي صورة",
        "سوي صورة",
        "سو لي صورة",
        "سو صورة",
        "ارسم",
        "أرسم",
        "ورني",
        "ورني شكل",
        "أبغى شكل",
        "ابغى شكل",
        "أريد شكل",
        "اريد شكل",
        "أبغى تصميم",
        "ابغى تصميم",
        "أريد تصميم",
        "اريد تصميم",
        "مجلس بهذا الشكل",
        "كنبة بهذا الشكل",
        "كنبات بهذا الشكل",
        "رتب لي",
        "رتبها لي",
        "وزع لي",
        "وزعها لي",
        "تخيل لي",
        "تخيلها"
    ];


    if (
        designWords.some(word =>
            text.includes(word)
        )
    ) {
        return true;
    }


    return false;
}


/* =========================
   إنشاء صورة جديدة
========================= */

async function generateDesign(message) {

    const prompt = `
أنشئ تصوراً واقعياً واحترافياً لتصميم أثاث داخلي فاخر.

طلب العميل:

${message}

المطلوب:

- تصميم واقعي جداً.
- مجلس أو غرفة معيشة حسب طلب العميل.
- توزيع أثاث منطقي.
- تناسق ممتاز بين الألوان.
- أقمشة راقية.
- خامات فاخرة.
- أثاث مريح.
- تصميم داخلي سعودي فاخر عند ملاءمة الطلب.
- الحفاظ على التفاصيل التي ذكرها العميل.
- إذا ذكر العميل مقاسات، استخدمها كمرجع بصري تقريبي.
- إذا لم يذكر تفاصيل كافية، ابتكر تصوراً مناسباً ومتناسقاً.
- بدون أشخاص.
- بدون شعارات.
- بدون كتابة داخل الصورة.
- بدون علامات تجارية.
- إضاءة داخلية واقعية.
- منظور طبيعي.
- جودة تصوير داخلي احترافية.

مهم:

هذه الصورة "تصور مقترح" وليست صورة لمنتج حقيقي مؤكد توفره لدى نجوم الإبداع.

لا تضع أي نص أو أرقام أو شعارات داخل الصورة.
`;

    const response =
        await client.images.generate({
            model: IMAGE_MODEL,
            prompt,
            size: "1024x1024",
            quality: "low"
        });

    const imageData =
        response.data?.[0]?.b64_json;

    if (!imageData) {
        throw new Error(
            "لم يتم استلام الصورة من نظام الصور."
        );
    }

    return `data:image/png;base64,${imageData}`;
}


/* =========================
   تعديل الصورة المرفوعة
========================= */

async function editDesign(image, message) {

    const editPrompt = `
حرر الصورة المرفوعة نفسها بناءً على طلب العميل.

طلب العميل:

${message}

قواعد مهمة:

1. حافظ على نفس الغرفة قدر الإمكان.

2. حافظ على:
- الجدران
- الأرضيات
- الأسقف
- النوافذ
- الأبواب
- التلفزيون
- الإضاءة
- زاوية التصوير
- المنظور
- نسب المكان

3. غيّر فقط الأشياء التي طلب العميل تغييرها.

4. إذا طلب تغيير الكنبات:
غيّر الكنبات فقط.

5. إذا طلب تغيير اللون:
غيّر اللون المطلوب فقط.

6. إذا طلب تغيير القماش:
غيّر القماش والخامة المطلوبة.

7. إذا طلب إضافة طاولة:
أضفها بشكل طبيعي ومتناسب.

8. إذا طلب تغيير الترتيب:
أعد توزيع الأثاث مع المحافظة على هندسة المكان.

9. لا تضف أشخاصاً.

10. لا تضف شعارات.

11. لا تضف كتابة داخل الصورة.

12. اجعل الصورة واقعية جداً.

13. حافظ على الإضاءة والمنظور.

14. اجعل الأثاث مناسباً للتصميم الداخلي الفاخر.

هذه الصورة تصور تصميم مقترح وليست إثباتاً لوجود المنتج أو توفره لدى نجوم الإبداع.
`;


    const imageFile =
        await dataUrlToFile(image);


    const response =
        await client.images.edit({

            model: IMAGE_MODEL,

            image: imageFile,

            prompt: editPrompt,

            size: "1024x1024",

            quality: "low"
        });


    const imageData =
        response.data?.[0]?.b64_json;


    if (!imageData) {

        throw new Error(
            "لم يتم إنشاء الصورة المعدلة."
        );
    }


    return `data:image/png;base64,${imageData}`;
}


/* =========================
   تشغيل API
========================= */

export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method Not Allowed"
        });
    }


    try {

        if (!process.env.OPENAI_API_KEY) {

            return res.status(500).json({
                error:
                    "مفتاح OpenAI غير موجود في Vercel."
            });
        }


        const body = req.body || {};


        const message =
            typeof body.message === "string"
                ? body.message.trim()
                : "";


        const image =
            typeof body.image === "string"
                ? body.image
                : null;


        const history =
            cleanHistory(body.history);


        if (!message && !image) {

            return res.status(400).json({
                error:
                    "أرسل رسالة أو صورة."
            });
        }


        if (message.length > 3000) {

            return res.status(413).json({
                error:
                    "الرسالة طويلة جداً."
            });
        }


        /* =========================
           فحص الصورة
        ========================= */

        if (image) {

            if (!isValidImageData(image)) {

                return res.status(400).json({
                    error:
                        "صيغة الصورة غير مدعومة."
                });
            }


            const imageSize =
                getBase64SizeInBytes(image);


            if (
                imageSize >
                2 * 1024 * 1024
            ) {

                return res.status(413).json({
                    error:
                        "حجم الصورة كبير جداً. الرجاء اختيار صورة أصغر."
                });
            }
        }


        /* =========================
           الذكاء التلقائي
        ========================= */

        const wantsImage =
            shouldGenerateImage(
                message,
                Boolean(image)
            );


        /* =========================
           إنشاء / تعديل صورة
        ========================= */

        if (wantsImage) {


            /*
             * تعديل صورة موجودة
             */

            if (image) {

                const generatedImage =
                    await editDesign(
                        image,
                        message
                    );


                return res.status(200).json({

                    type: "image",

                    mode: "edit",

                    reply:
                        "تم إنشاء تصور معدل للصورة بناءً على طلبك. هذا تصور تصميمي وليس بالضرورة منتجاً موجوداً أو مطابقاً للتنفيذ النهائي.",

                    image:
                        generatedImage
                });
            }


            /*
             * إنشاء صورة جديدة
             */

            const generatedImage =
                await generateDesign(
                    message
                );


            return res.status(200).json({

                type: "image",

                mode: "generate",

                reply:
                    "هذا تصور تصميم مبدئي بناءً على طلبك. يمكنك أن تطلب مني تعديل اللون أو القماش أو توزيع الأثاث.",

                image:
                    generatedImage
            });
        }


        /* =========================
           المحادثة النصية
        ========================= */

        const input = [];


        /*
         * المحادثة السابقة
         */

        for (const item of history) {

            input.push({
                role: item.role,
                content: item.content
            });
        }


        /*
         * الرسالة الحالية
         */

        if (image) {

            input.push({

                role: "user",

                content: [

                    {
                        type: "input_text",

                        text:
                            message ||
                            "حلل هذه الصورة واقترح توزيع أثاث مناسب للمكان."
                    },

                    {
                        type: "input_image",

                        image_url: image
                    }

                ]
            });

        } else {

            input.push({

                role: "user",

                content: message
            });
        }


        /*
         * تشغيل المستشار
         */

        const result =
            await client.responses.create({

                model: TEXT_MODEL,

                instructions:
                    SYSTEM_INSTRUCTIONS,

                input,

                max_output_tokens: 900
            });


        const reply =
            typeof result.output_text === "string"
                ? result.output_text.trim()
                : "";


        if (!reply) {

            throw new Error(
                "Empty AI response"
            );
        }


        return res.status(200).json({

            type: "text",

            reply
        });


    } catch (error) {

        console.error(
            "AI ERROR:",
            error?.message || error
        );


        return res.status(500).json({

            error:
                error?.message ||
                "تعذر تشغيل المستشار حالياً. حاول مرة أخرى."
        });
    }
}
