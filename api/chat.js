import OpenAI, { toFile } from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


/* =========================================================
   النماذج
========================================================= */

const TEXT_MODEL = "gpt-5.6-luna";
const IMAGE_MODEL = "gpt-image-2";


/* =========================================================
   تعليمات المستشار
========================================================= */

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

أسلوبك:
- طبيعي
- راقي
- ودود
- مختصر
- واضح
- عملي

تعامل مع العميل كمستشار مبيعات وتصميم محترف.

مهم جداً:

استخدم سياق المحادثة السابقة.

إذا قال العميل:
"غير اللون"
أو
"خل اليمين أطول"
أو
"خله مودرن"
أو
"بدل القماش"

فلا تتعامل معها كرسالة جديدة.

اربطها بالتصميم والطلب السابق.

لا تطلب من العميل إعادة معلومات سبق أن ذكرها.

لا تخترع:
- الأسعار
- المخزون
- توفر المنتجات
- أرقام الفواتير
- العروض
- معلومات غير مؤكدة

إذا كانت المعلومة غير معروفة قل ذلك بوضوح.

إذا كان التصميم من ابتكارك:
سمّه "تصور مقترح".

المقاسات التي تقترحها مبدئية وليست مخطط تصنيع.

يمكنك ابتكار:
- موديلات
- ألوان
- أقمشة
- توزيعات
- أشكال مجالس
- أفكار ديكور

إذا أرسل العميل صورة:
حلل الصورة.

إذا طلب إنشاء تصميم:
أنشئ تصوراً.

إذا طلب تعديل صورة:
عدّل الصورة المرفوعة.

إذا كان الطلب لا يحتاج صورة:
أجب نصياً.

إذا كانت المعلومات غير كافية لإنشاء تصميم دقيق:
اسأل سؤالاً واحداً أو سؤالين فقط عن أهم معلومة ناقصة.

لا تسأل عن تفاصيل غير مؤثرة.

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

إذا احتاج العميل إلى سعر أو توفر أو تنفيذ فعلي:
وجهه إلى التواصل مع الفرع أو واتساب.
`;


/* =========================================================
   التحقق من الصور
========================================================= */

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

    return Math.floor(parts[1].length * 0.75);
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


/* =========================================================
   تنظيف سجل المحادثة
========================================================= */

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
            content: item.content.slice(0, 3500)
        }))
        .slice(-14);
}


/* =========================================================
   تحليل طلب العميل
========================================================= */

async function analyzeCustomerRequest({
    message,
    history,
    hasImage
}) {

    const historyText = history
        .map(item =>
            `${item.role === "user" ? "العميل" : "المستشار"}: ${item.content}`
        )
        .join("\n");


    const analysisPrompt = `
أنت محلل طلبات متخصص في الأثاث والتصميم الداخلي.

مهمتك فهم طلب العميل بدقة قبل تنفيذ أي شيء.

المحادثة السابقة:

${historyText || "لا توجد محادثة سابقة."}

رسالة العميل الحالية:

${message || "العميل أرسل صورة فقط."}

هل توجد صورة مرفوعة؟
${hasImage ? "نعم" : "لا"}

حلل الطلب اعتماداً على:
1. الرسالة الحالية.
2. المحادثة السابقة.
3. الصورة إن وجدت.
4. المعلومات التي سبق أن ذكرها العميل.

لا تخترع أي معلومة غير موجودة.

إذا لم يذكر العميل شيئاً اتركه فارغاً.

حدد العملية المطلوبة:

- chat = إجابة نصية
- analyze_image = تحليل صورة
- generate_image = إنشاء تصميم جديد
- edit_image = تعديل الصورة المرفوعة
- clarify = يحتاج سؤالاً قبل التنفيذ

مهم جداً:

إذا كان العميل يطلب تصميم أثاث حتى لو لم يقل حرفياً "صمم"، فافهم المعنى.

مثلاً:
"أبغى مجلس 13 نفر حرف L"
هذا طلب تصميم.

"أبغى أشوف كيف بيطلع"
هذا طلب تصميم.

"سوي لي شكل"
هذا طلب تصميم.

"خل اللون أغمق"
إذا توجد صورة أو تصميم سابق فهذا تعديل.

إذا قال العميل شيئاً عاماً مثل:
"أبغى مجلس حلو"
ولا توجد معلومات كافية:
يمكنك اعتبار العملية clarify.

لا تعتبر كل سؤال عن الأثاث طلب إنشاء صورة.

مثلاً:
"كم نفر يناسب مجلس 5×4؟"
هذا chat.

استخرج المعلومات التالية:

- المكان
- نوع الأثاث
- نوع المجلس
- عدد الأشخاص
- الشكل
- الطول
- العرض
- الارتفاع
- مقاسات أخرى
- اللون
- لون الأرضية
- لون الجدران
- القماش
- الخامة
- النمط
- مودرن أو كلاسيك أو تركي أو أمريكي
- شكل L أو U أو مستقيم أو دائري
- عدد القطع
- الطاولات
- الإكسسوارات
- الأبواب
- النوافذ
- التلفزيون
- الميزانية إن ذكرت
- الفرع إن ذكر
- جاهز أو تفصيل
- التعديلات المطلوبة
- المعلومات الناقصة المهمة فقط

ثم أنشئ ملخصاً دقيقاً للتصميم.

لا تضف أي شيء لم يقله العميل إلا في خانة:
"اقتراحات"

إذا كان العميل طلب تصميم:
يمكن وضع اقتراحات بسيطة تساعد مولد الصورة، لكن لا تغير طلب العميل.

أخرج JSON فقط بهذا الشكل:

{
  "action": "chat|analyze_image|generate_image|edit_image|clarify",
  "confidence": 0,
  "place": "",
  "furniture": "",
  "room": "",
  "people": "",
  "shape": "",
  "dimensions": "",
  "length": "",
  "width": "",
  "height": "",
  "color": "",
  "floor_color": "",
  "wall_color": "",
  "fabric": "",
  "material": "",
  "style": "",
  "pieces": "",
  "tables": "",
  "accessories": "",
  "doors": "",
  "windows": "",
  "tv": "",
  "budget": "",
  "branch": "",
  "ready_or_custom": "",
  "requested_changes": "",
  "missing_important_information": [],
  "suggestions": [],
  "design_summary": "",
  "question": ""
}
`;


    const result =
        await client.responses.create({

            model: TEXT_MODEL,

            instructions: `
أنت نظام تحليل داخلي لطلبات العملاء.
أخرج JSON فقط.
لا تكتب أي شرح خارج JSON.
`,

            input: analysisPrompt,

            max_output_tokens: 1200
        });


    const raw =
        typeof result.output_text === "string"
            ? result.output_text.trim()
            : "";


    if (!raw) {
        throw new Error(
            "تعذر تحليل طلب العميل."
        );
    }


    /*
     * تنظيف JSON إذا أضاف النموذج علامات markdown
     */

    let cleaned = raw
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();


    /*
     * استخراج أول JSON
     */

    const firstBrace =
        cleaned.indexOf("{");

    const lastBrace =
        cleaned.lastIndexOf("}");


    if (
        firstBrace !== -1 &&
        lastBrace !== -1
    ) {

        cleaned =
            cleaned.slice(
                firstBrace,
                lastBrace + 1
            );
    }


    let analysis;

    try {

        analysis =
            JSON.parse(cleaned);

    } catch {

        /*
         * إذا فشل التحليل المنظم
         * نرجع لحالة آمنة
         */

        analysis = {

            action:
                hasImage
                    ? "analyze_image"
                    : "chat",

            confidence: 0,

            place: "",
            furniture: "",
            room: "",
            people: "",
            shape: "",
            dimensions: "",
            length: "",
            width: "",
            height: "",
            color: "",
            floor_color: "",
            wall_color: "",
            fabric: "",
            material: "",
            style: "",
            pieces: "",
            tables: "",
            accessories: "",
            doors: "",
            windows: "",
            tv: "",
            budget: "",
            branch: "",
            ready_or_custom: "",
            requested_changes: "",
            missing_important_information: [],
            suggestions: [],
            design_summary: "",
            question: ""
        };
    }


    return analysis;
}


/* =========================================================
   بناء مواصفات التصميم
========================================================= */

function buildDesignSpecification(analysis, message) {

    return `
مواصفات التصميم المطلوبة:

الطلب الأصلي:
${message || "غير محدد"}

نوع المكان:
${analysis.place || "غير محدد"}

نوع الأثاث:
${analysis.furniture || "غير محدد"}

الغرفة:
${analysis.room || "غير محدد"}

نوع المجلس:
${analysis.furniture || "غير محدد"}

عدد الأشخاص:
${analysis.people || "غير محدد"}

الشكل:
${analysis.shape || "غير محدد"}

المقاسات العامة:
${analysis.dimensions || "غير محددة"}

الطول:
${analysis.length || "غير محدد"}

العرض:
${analysis.width || "غير محدد"}

الارتفاع:
${analysis.height || "غير محدد"}

اللون:
${analysis.color || "غير محدد"}

لون الأرضية:
${analysis.floor_color || "غير محدد"}

لون الجدران:
${analysis.wall_color || "غير محدد"}

القماش:
${analysis.fabric || "غير محدد"}

الخامة:
${analysis.material || "غير محددة"}

الأسلوب:
${analysis.style || "غير محدد"}

عدد القطع:
${analysis.pieces || "غير محدد"}

الطاولات:
${analysis.tables || "غير محددة"}

الإكسسوارات:
${analysis.accessories || "غير محددة"}

الأبواب:
${analysis.doors || "غير محددة"}

النوافذ:
${analysis.windows || "غير محددة"}

التلفزيون:
${analysis.tv || "غير محدد"}

جاهز أو تفصيل:
${analysis.ready_or_custom || "غير محدد"}

التعديلات المطلوبة:
${analysis.requested_changes || "لا يوجد"}

ملخص التصميم:
${analysis.design_summary || "غير محدد"}

اقتراحات مسموحة:
${
    Array.isArray(analysis.suggestions)
        ? analysis.suggestions.join(" - ")
        : ""
}

مهم:

التزم بالمعلومات التي حددها العميل.

لا تغير:
- عدد الأشخاص
- الشكل
- المقاسات
- الألوان
- التوزيع
- نوع الأثاث

إلا إذا كان ذلك ضرورياً بصرياً أو طلب العميل ذلك.

إذا كانت بعض المعلومات غير محددة:
لا تخترع رقماً دقيقاً.

يمكنك استخدام تصميم داخلي متناسق لبقية التفاصيل غير المحددة.

هذه صورة "تصور مقترح" وليست إثباتاً لوجود المنتج أو توفره.
`;
}


/* =========================================================
   إنشاء تصميم جديد
========================================================= */

async function generateDesign(
    message,
    analysis
) {

    const designSpecification =
        buildDesignSpecification(
            analysis,
            message
        );


    const prompt = `
أنشئ تصوراً واقعياً جداً واحترافياً لتصميم أثاث داخلي فاخر.

${designSpecification}

قواعد الصورة:

- التزم بطلب العميل أولاً.
- اجعل التصميم قابلاً للتصور والتنفيذ بصرياً.
- حافظ على النسب المنطقية.
- إذا ذكر العميل عدد الأشخاص، اجعل عدد المقاعد مناسباً لذلك.
- إذا ذكر العميل شكل L أو U أو مستقيماً، التزم بالشكل.
- إذا ذكر العميل مقاسات، استخدمها كنسب تقريبية.
- إذا ذكر لوناً، اجعله واضحاً.
- إذا ذكر قماشاً، أظهر خامته بصرياً.
- إذا ذكر مودرن، اجعل التصميم مودرن.
- إذا ذكر كلاسيك، اجعله كلاسيك.
- إذا ذكر تركي، اجعله تركي.
- إذا ذكر أمريكي، اجعله أمريكي.
- إذا لم يحدد الأسلوب، اختر أسلوباً فاخراً ومتناسقاً.
- إضاءة داخلية واقعية.
- خامات واقعية.
- تفاصيل أثاث واضحة.
- منظور احترافي.
- بدون أشخاص.
- بدون شعارات.
- بدون علامات تجارية.
- بدون كتابة.
- بدون أرقام مكتوبة داخل الصورة.

هذه الصورة تصور مقترح وليست صورة لمنتج حقيقي مؤكد توفره لدى نجوم الإبداع.
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


/* =========================================================
   تعديل صورة
========================================================= */

async function editDesign(
    image,
    message,
    analysis
) {

    const designSpecification =
        buildDesignSpecification(
            analysis,
            message
        );


    const editPrompt = `
حرر الصورة المرفوعة نفسها.

${designSpecification}

طلب العميل الحالي:
${message}

قواعد التعديل:

1. حافظ على نفس الغرفة.

2. حافظ قدر الإمكان على:
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

3. عدّل فقط ما طلبه العميل.

4. إذا طلب تغيير اللون:
غيّر اللون المطلوب فقط.

5. إذا طلب تغيير القماش:
غيّر القماش المطلوب فقط.

6. إذا طلب تغيير الكنبات:
غيّر الكنبات فقط مع المحافظة على المكان.

7. إذا طلب تغيير الترتيب:
أعد ترتيب الأثاث بطريقة منطقية.

8. إذا طلب إضافة طاولة:
أضفها بشكل متناسق.

9. إذا طلب تعديل جهة معينة:
نفذ التعديل في الجهة المقصودة فقط.

10. لا تغير الأشياء التي لم يطلب العميل تغييرها.

11. لا تضف أشخاصاً.

12. لا تضف شعارات.

13. لا تضف كتابة.

14. لا تضف علامات تجارية.

15. اجعل النتيجة واقعية جداً.

16. حافظ على الإضاءة والمنظور.

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


/* =========================================================
   الرد النصي
========================================================= */

async function generateTextReply({
    message,
    history,
    image,
    analysis
}) {

    const input = [];


    for (const item of history) {

        input.push({
            role: item.role,
            content: item.content
        });
    }


    const analysisSummary = `
تحليل الطلب الداخلي:

نوع العملية:
${analysis.action}

المكان:
${analysis.place || "غير محدد"}

الأثاث:
${analysis.furniture || "غير محدد"}

عدد الأشخاص:
${analysis.people || "غير محدد"}

الشكل:
${analysis.shape || "غير محدد"}

المقاسات:
${analysis.dimensions || "غير محددة"}

اللون:
${analysis.color || "غير محدد"}

القماش:
${analysis.fabric || "غير محدد"}

الأسلوب:
${analysis.style || "غير محدد"}

المعلومات الناقصة المهمة:
${
    Array.isArray(
        analysis.missing_important_information
    )
        ? analysis.missing_important_information.join(" - ")
        : ""
}
`;


    if (image) {

        input.push({

            role: "user",

            content: [

                {
                    type: "input_text",

                    text:
                        `${message || "حلل هذه الصورة."}

${analysisSummary}`
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

            content:
                `${message}

${analysisSummary}`
        });
    }


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


    return reply;
}


/* =========================================================
   API
========================================================= */

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


        const body =
            req.body || {};


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


        /* =================================================
           فحص الصورة
        ================================================= */

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


        /* =================================================
           تحليل طلب العميل أولاً
        ================================================= */

        const analysis =
            await analyzeCustomerRequest({

                message,

                history,

                hasImage:
                    Boolean(image)
            });


        console.log(
            "AI REQUEST ANALYSIS:",
            JSON.stringify(
                analysis,
                null,
                2
            )
        );


        /* =================================================
           إذا كان يحتاج سؤالاً
        ================================================= */

        if (
            analysis.action === "clarify" &&
            analysis.question
        ) {

            return res.status(200).json({

                type: "text",

                mode: "clarify",

                reply:
                    analysis.question,

                analysis
            });
        }


        /* =================================================
           إنشاء تصميم
        ================================================= */

        if (
            analysis.action ===
            "generate_image"
        ) {

            const generatedImage =
                await generateDesign(
                    message,
                    analysis
                );


            return res.status(200).json({

                type: "image",

                mode: "generate",

                reply:
                    "هذا تصور مقترح بناءً على التفاصيل التي فهمتها من طلبك. إذا أردت، يمكنك أن تطلب تعديل اللون أو القماش أو التوزيع.",

                image:
                    generatedImage,

                analysis
            });
        }


        /* =================================================
           تعديل صورة
        ================================================= */

        if (
            analysis.action ===
            "edit_image"
        ) {

            if (!image) {

                /*
                 * في حالة قال العميل "عدل التصميم"
                 * لكن الصورة لم تصل من الواجهة
                 */

                return res.status(200).json({

                    type: "text",

                    mode: "clarify",

                    reply:
                        "أرسل لي صورة التصميم الذي تريد تعديله، وسأعدلها بناءً على طلبك.",

                    analysis
                });
            }


            const generatedImage =
                await editDesign(
                    image,
                    message,
                    analysis
                );


            return res.status(200).json({

                type: "image",

                mode: "edit",

                reply:
                    "تم تعديل التصور بناءً على طلبك. إذا أردت تغييراً آخر، اذكره مباشرة.",

                image:
                    generatedImage,

                analysis
            });
        }


        /* =================================================
           تحليل الصورة
        ================================================= */

        if (
            analysis.action ===
            "analyze_image"
        ) {

            const reply =
                await generateTextReply({

                    message,

                    history,

                    image,

                    analysis
                });


            return res.status(200).json({

                type: "text",

                mode: "image_analysis",

                reply,

                analysis
            });
        }


        /* =================================================
           محادثة عادية
        ================================================= */

        const reply =
            await generateTextReply({

                message,

                history,

                image,

                analysis
            });


        return res.status(200).json({

            type: "text",

            mode: "chat",

            reply,

            analysis
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
