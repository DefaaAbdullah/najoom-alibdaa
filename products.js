const SUPABASE_URL = "https://kpgfdhxwcormlqfkpoye.supabase.co";

const SUPABASE_KEY =
"sb_publishable_VYD0M_I_yrW-DlQUYhtvGQ_lUQcHwXG";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* =========================
   نوع المنتج
========================= */

function getProductType(product){

    if(product.product_type){
        return product.product_type;
    }

    /*
      دعم المنتجات القديمة التي لم يكن لديها product_type
    */

    const c = String(product.category || "").toLowerCase();

    if(/طعام|dining/.test(c)){
        return "dining_table";
    }

    if(/كرسي|chairs|chair/.test(c)){
        return "chair";
    }

    if(/بوفيه|buffet/.test(c)){
        return "buffet";
    }

    if(/طاول|table/.test(c)){
        return "table";
    }

    return "sofa";
}


/* =========================
   العرض
========================= */

function isOffer(product){

    return (
        product.offer_type === "special" ||
        product.offer_type === "discount"
    );
}


/* =========================
   جديد
========================= */

function isNew(product){

    return product.is_new === true;
}


/* =========================
   مميز
========================= */

function isFeatured(product){

    return product.is_featured === true;
}


/* =========================
   صور المنتج
========================= */

function getImages(product){

    const images = [];

    if(product.main_image_url){
        images.push(product.main_image_url);
    }

    if(Array.isArray(product.extra_image_urls)){
        images.push(...product.extra_image_urls);
    }

    return [...new Set(images)];
}


/* =========================
   WhatsApp
========================= */

function whatsappNumber(product){

    return (
        product.whatsapp ||
        "966551496121"
    );
}


/* =========================
   إنشاء البطاقة
========================= */

function productCard(product){

    const images = getImages(product);

    const mainImage =
        images[0] ||
        "https://placehold.co/800x600/071522/e4c57e?text=نجوم+الإبداع";

    const offerBadge =
        isOffer(product)
        ? `<span class="badge special">${
            product.offer_type === "discount"
            ? "خصم"
            : "عرض خاص"
        }</span>`
        : "";

    const newBadge =
        isNew(product)
        ? `<span class="badge">جديد</span>`
        : "";

    const featuredBadge =
        isFeatured(product)
        ? `<span class="badge">مميز</span>`
        : "";

    const wa =
        String(whatsappNumber(product))
        .replace(/\D/g,"");

    const message =
        encodeURIComponent(
            `السلام عليكم، أريد الاستفسار عن ${product.name}`
        );

    return `
        <article class="product-card">

            <div class="product-image">

                <img
                    src="${mainImage}"
                    alt="${product.name || "منتج نجوم الإبداع"}"
                    loading="lazy"
                >

                <div class="badges">
                    ${offerBadge}
                    ${newBadge}
                    ${featuredBadge}
                </div>

            </div>

            <div class="product-body">

                <h3>${product.name || "موديل"}</h3>

                <p>
                    ${product.description || "موديل فاخر من نجوم الإبداع للمفروشات والكنبات"}
                </p>

                <div class="product-actions">

                    <button
                        class="btn btn-outline"
                        onclick='openProductViewer(${JSON.stringify(product)})'
                    >
                        عرض الصور
                    </button>

                    <a
                        class="btn"
                        target="_blank"
                        href="https://wa.me/${wa}?text=${message}"
                    >
                        واتساب
                    </a>

                </div>

            </div>

        </article>
    `;
}


/* =========================
   Viewer
========================= */

function openProductViewer(product){

    const images = getImages(product);

    if(!images.length){
        return;
    }

    let current = 0;

    const overlay = document.createElement("div");

    overlay.className = "lightbox active";

    overlay.innerHTML = `
        <button
            class="lightbox-close"
            onclick="this.parentElement.remove()"
        >
            ×
        </button>

        <button
            id="prevImage"
            style="
                position:absolute;
                right:20px;
                top:50%;
                transform:translateY(-50%);
                background:#e4c57e;
                color:#071522;
                border:0;
                border-radius:50%;
                width:45px;
                height:45px;
                font-size:25px;
            "
        >
            ‹
        </button>

        <img
            id="viewerImage"
            src="${images[0]}"
            alt="${product.name || ""}"
        >

        <button
            id="nextImage"
            style="
                position:absolute;
                left:20px;
                top:50%;
                transform:translateY(-50%);
                background:#e4c57e;
                color:#071522;
                border:0;
                border-radius:50%;
                width:45px;
                height:45px;
                font-size:25px;
            "
        >
            ›
        </button>
    `;

    document.body.appendChild(overlay);

    const image =
        overlay.querySelector("#viewerImage");

    overlay.querySelector("#prevImage").onclick =
    () => {

        current =
            (current - 1 + images.length)
            % images.length;

        image.src = images[current];
    };

    overlay.querySelector("#nextImage").onclick =
    () => {

        current =
            (current + 1)
            % images.length;

        image.src = images[current];
    };

    overlay.addEventListener("click", e => {

        if(e.target === overlay){
            overlay.remove();
        }

    });
}


/* =========================
   تحميل المنتجات
========================= */

async function loadProducts(){

    const grid =
        document.querySelector("#productsGrid");

    if(!grid){
        return;
    }

    grid.innerHTML =
        `<div class="empty">جاري تحميل المنتجات...</div>`;

    const { data, error } =
        await db
        .from("tables")
        .select("*")
        .eq("published", true)
        .order("sort_order", {
            ascending:true
        })
        .order("created_at", {
            ascending:false
        });

    if(error){

        console.error(error);

        grid.innerHTML = `
            <div class="empty">
                حدث خطأ أثناء تحميل المنتجات
            </div>
        `;

        return;
    }

    window.allProducts = data || [];

    renderProducts(window.allProducts);
}


/* =========================
   عرض المنتجات
========================= */

function renderProducts(products){

    const grid =
        document.querySelector("#productsGrid");

    if(!grid){
        return;
    }

    if(!products.length){

        grid.innerHTML =
            `<div class="empty">لا توجد منتجات حالياً</div>`;

        return;
    }

    grid.innerHTML =
        products
        .map(productCard)
        .join("");
}


/* =========================
   تفعيل الصفحة
========================= */

document.addEventListener("DOMContentLoaded", async () => {

    const type =
        document.body.dataset.productType;

    const search =
        document.querySelector("#productSearch");

    const filters =
        document.querySelectorAll("[data-filter]");

    await loadProducts();

    /*
      فلترة النوع حسب الصفحة
    */

    if(type){

        let filtered;

        if(type === "sofa"){

            filtered =
                window.allProducts.filter(
                    p => getProductType(p) === "sofa"
                );

        }

        else if(type === "table"){

            filtered =
                window.allProducts.filter(
                    p => getProductType(p) === "table"
                );

        }

        else if(type === "dining"){

            filtered =
                window.allProducts.filter(
                    p =>
                    [
                        "dining_table",
                        "chair",
                        "buffet"
                    ].includes(getProductType(p))
                );

        }

        else{

            filtered = window.allProducts;
        }

        window.currentProducts = filtered;

        renderProducts(filtered);
    }

    else{

        window.currentProducts =
            window.allProducts;
    }


    /*
      البحث
    */

    if(search){

        search.addEventListener("input", () => {

            const value =
                search.value
                .trim()
                .toLowerCase();

            let source =
                window.currentProducts ||
                window.allProducts ||
                [];

            if(!value){

                renderProducts(source);

                return;
            }

            const result =
                source.filter(p => {

                    return (
                        String(p.name || "")
                        .toLowerCase()
                        .includes(value)
                        ||
                        String(p.description || "")
                        .toLowerCase()
                        .includes(value)
                        ||
                        String(p.category || "")
                        .toLowerCase()
                        .includes(value)
                    );

                });

            renderProducts(result);

        });
    }


    /*
      الفلاتر
    */

    filters.forEach(button => {

        button.addEventListener("click", () => {

            filters.forEach(b =>
                b.classList.remove("active")
            );

            button.classList.add("active");

            const filter =
                button.dataset.filter;

            let products =
                window.currentProducts ||
                [];

            if(filter === "all"){

                renderProducts(products);
                return;

            }

            if(filter === "offers"){

                renderProducts(
                    products.filter(isOffer)
                );

                return;
            }

            if(filter === "new"){

                renderProducts(
                    products.filter(isNew)
                );

                return;
            }

            if(filter === "featured"){

                renderProducts(
                    products.filter(isFeatured)
                );

                return;
            }

        });

    });

});
