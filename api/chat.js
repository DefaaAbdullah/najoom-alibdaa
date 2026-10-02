import OpenAI, { toFile } from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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

فاستخدمها في الردود اللاحقة دون طلبها منه مرة أخرى، إلا إذا أصبحت غير واضحة.

اسأل عند الحاجة عن:
- أبعاد الغرفة
- عدد الأشخاص
- شكل الغرفة
- الأبواب والنوافذ
- لون الأرضية
- لون الجدران
- الذوق المفضل
- الميزانية
- هل يريد جاهز أو تفصيل

مهم جداً:

لا تخترع أسعاراً.

لا تؤكد توفر منتج إلا إذا كانت المعلومة موجودة ومؤكدة.

لا تخترع مخزوناً.

لا تخترع أرقام فواتير.

لا تخترع عروضاً.

إذا كان التصميم من ابتكارك قل إنه:
"تصور مقترح"

المقاسات التي تقترحها مبدئية وليست مخطط تصنيع.

يمكنك ابتكار موديلات جديدة تماماً.

يمكنك اقتراح ألوان وأقمشة وتوزيعات.

إذا أرسل العميل صورة:
حلل المكان والأثاث الظاهر في الصورة.

إذا طلب العميل تعديل الصورة:
يمكن تنفيذ التعديل من خلال نظام الصور.

إذا طلب العميل إنشاء تصميم:
يمكن إنشاء تصور تصميمي من خلال نظام الصور.

لا تقل إن التصميم موجود في معرض نجوم الإبداع إلا إذا كانت المعلومة مؤكدة.

لا تقل إن منتجاً متوفراً إلا إذا كانت المعلومة مؤكدة.

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

إذا كان العميل يريد اقتراح تصميم:
اعطه اقتراحاً عملياً ومختصراً.

إذا كان العميل يرسل بياناته الشخصية أو تفاصيل التواصل:
تعامل معها فقط ضمن سياق طلبه الحالي ولا تخترع بيانات إضافية.
`;

function isValidImageData(image){
    if(typeof image !== "string"){
        return false;
    }

    return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(image);
}

function getBase64SizeInBytes(dataUrl){

    const base64 = dataUrl.split(",")[1];

    if(!base64){
        return 0;
    }

    return Math.floor(base64.length * 0.75);
}

async function dataUrlToFile(dataUrl){

    const match = dataUrl.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/
    );

    if(!match){
        throw new Error("صيغة الصورة غير صحيحة.");
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const buffer = Buffer.from(
        base64Data,
        "base64"
    );

    return await toFile(
        buffer,
        "najoom-reference.jpg",
        {
            type:mimeType
        }
    );
}

function cleanHistory(history){

    if(!Array.isArray(history)){
        return [];
    }

    return history
        .filter(item =>
            item &&
            (item.role === "user" ||
             item.role === "assistant") &&
            typeof item.content === "string"
        )
        .map(item => ({
            role:item.role,
            content:item.content.slice(0,3000)
        }))
        .slice(-12);
}

export default async function handler(req,res){

    if(req.method !== "POST"){

        return res.status(405).json({
            error:"Method Not Allowed"
        });
    }

    try{

        if(!process.env.OPENAI_API_KEY){

            return res.status(500).json({
                error:"مفتاح OpenAI غير موجود في Vercel."
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

        const generateImage =
            body.generateImage === true;

        const history =
            cleanHistory(body.history);

        if(!message && !image){

            return res.status(400).json({
                error:"أرسل رسالة أو صورة."
            });
        }

        if(message.length > 3000){

            return res.status(413).json({
                error:"الرسالة طويلة جداً."
            });
        }

        if(image){

            if(!isValidImageData(image)){

                return res.status(400).json({
                    error:"صيغة الصورة غير مدعومة."
                });
            }

            const imageSize =
                getBase64SizeInBytes(image);

            if(imageSize > 2 * 1024 * 1024){

                return res.status(413).json({
                    error:"حجم الصورة كبير جداً. الرجاء اختيار صورة أصغر."
                });
            }
        }

        /*
         * إنشاء صورة أو تعديل صورة
         */

        if(generateImage){

            if(image){

                const editPrompt = `
حرر الصورة المرفوعة نفسها.

طلب العميل:

${message || "حسّن تصميم الأثاث في الصورة."}

قواعد التعديل:

1. حافظ على نفس الغرفة.
2. حافظ قدر الإمكان على:
الجدران
الأرضيات
الأسقف
النوافذ
الأبواب
التلفزيون
الإضاءة
زاوية التصوير
المنظور
نسب المكان

3. غيّر فقط ما طلب العميل.

4. إذا طلب تغيير الكنبات:
غيّر الكنبات.

5. إذا طلب تغيير اللون:
غيّر لون العنصر المطلوب فقط.

6. إذا طلب تغيير القماش:
غيّر خامة وقماش الأثاث المطلوب.

7. إذا طلب إضافة طاولة:
أضفها بطريقة طبيعية.

8. لا تغير هندسة المكان إلا إذا طلب العميل ذلك.

9. لا تضف أشخاصاً.

10. لا تضف شعارات.

11. لا تضف كتابة داخل الصورة.

12. اجعل النتيجة واقعية جداً.

13. حافظ على الإضاءة والمنظور.

14. اجعل الأثاث مناسباً للتصميم الداخلي الفاخر.

هذه الصورة تصور تصميم مقترح وليست إثباتاً لوجود المنتج أو توفره لدى نجوم الإبداع.
`;

                const imageFile =
                    await dataUrlToFile(image);

                const response =
                    await client.images.edit({

                        model:"gpt-image-2",

                        image:imageFile,

                        prompt:editPrompt,

                        size:"1024x1024",

                        quality:"low"
                    });

                const imageData =
                    response.data?.[0]?.b64_json;

                if(!imageData){

                    throw new Error(
                        "لم يتم إنشاء الصورة المعدلة."
                    );
                }

                return res.status(200).json({

                    type:"image",

                    mode:"edit",

                    reply:
                        "تم إنشاء تصور معدل للصورة بناءً على طلبك. هذا تصور تصميمي وليس بالضرورة منتجاً موجوداً أو مطابقاً للتنفيذ النهائي.",

                    image:
                        `data:image/png;base64,${imageData}`
                });
            }

            const generatePrompt = `
أنشئ تصوراً واقعياً واحترافياً لتصميم أثاث داخلي فاخر.

طلب العميل:

${message}

المطلوب:

- مجلس أو غرفة معيشة فاخرة.
- توزيع منطقي.
- تصميم واقعي جداً.
- ألوان متناسقة.
- أقمشة راقية.
- خامات فاخرة.
- إضاءة داخلية جميلة.
- أثاث مريح.
- بدون أشخاص.
- بدون شعارات.
- بدون كتابة داخل الصورة.

يمكنك ابتكار تصميم جديد تماماً إذا لم يحدد العميل موديل معين.

هذه الصورة تصور تصميم مبدئي وليست صورة لمنتج حقيقي مؤكد توفره لدى نجوم الإبداع.
`;

            const response =
                await client.images.generate({

                    model:"gpt-image-2",

                    prompt:generatePrompt,

                    size:"1024x1024",

                    quality:"low"
                });

            const imageData =
                response.data?.[0]?.b64_json;

            if(!imageData){

                throw new Error(
                    "لم يتم إنشاء الصورة."
                );
            }

            return res.status(200).json({

                type:"image",

                mode:"generate",

                reply:
                    "هذا تصور تصميم مبدئي بناءً على طلبك. التصميم المقترح ليس بالضرورة منتجاً موجوداً لدى نجوم الإبداع.",

                image:
                    `data:image/png;base64,${imageData}`
            });
        }

        /*
         * المحادثة النصية / تحليل الصورة
         */

        let input = [];

        /*
         * نضيف المحادثة السابقة
         */

        for(const item of history){

            input.push({
                role:item.role,
                content:item.content
            });
        }

        /*
         * نضيف الرسالة الحالية
         */

        if(image){

            input.push({

                role:"user",

                content:[
                    {
                        type:"input_text",

                        text:
                            message ||
                            "حلل هذه الصورة واقترح توزيع أثاث مناسب للمكان."
                    },

                    {
                        type:"input_image",

                        image_url:image
                    }
                ]
            });

        }else{

            input.push({

                role:"user",

                content:message
            });
        }

        const result =
            await client.responses.create({

                model:"gpt-5.6-luna",

                instructions:
                    SYSTEM_INSTRUCTIONS,

                input:input,

                max_output_tokens:900
            });

        const reply =
            typeof result.output_text === "string"
                ? result.output_text.trim()
                : "";

        if(!reply){

            throw new Error(
                "Empty AI response"
            );
        }

        return res.status(200).json({

            type:"text",

            reply:reply
        });

    }catch(error){

        console.error(
            "AI ERROR:",
            error?.message || error
        );

        return res.status(500).json({

            error:
                "تعذر تشغيل المستشار حالياً. حاول مرة أخرى."
        });
    }
}
