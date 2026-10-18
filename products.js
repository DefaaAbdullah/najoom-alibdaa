const SUPABASE_URL =
    "https://kpgfdhxwcormlqfkpoye.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_VYD0M_I_yrW-DlQUYhtvGQ_lUQcHwXG";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* =====================================
   إعدادات المنتجات
===================================== */

const PAGE_SIZE = 16;

let currentPage = 0;
let totalProducts = 0;
let isLoading = false;
let hasMore = false;
let activeFilter = "all";
let searchValue = "";
let requestNumber = 0;

window.allProducts = [];
window.visibleProducts = [];

/* =====================================
   أدوات الواجهة
===================================== */

function getGrid() {
    return document.querySelector("#productsGrid");
}

function getPagination() {
    const grid = getGrid();

    if (!grid) return null;

    let area = document.querySelector("#productsPagination");

    if (!area) {
        area = document.createElement("div");
        area.id = "productsPagination";

        area.style.cssText = `
            display:flex;
            flex-direction:column;
            align-items:center;
            gap:12px;
            margin:30px auto;
            width:100%;
        `;

        grid.insertAdjacentElement("afterend", area);
    }

    return area;
}

function showMessage(message) {
    const grid = getGrid();

    if (!grid) return;

    grid.replaceChildren();

    const box = document.createElement("div");
    box.className = "empty";
    box.textContent = message;

    grid.appendChild(box);
}

/* =====================================
   حماية النصوص
===================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

/* =====================================
   نوع المنتج
===================================== */

function getProductType(product) {
    if (product.product_type) {
        return product.product_type;
    }

    const category = String(
        product.category || ""
    ).toLowerCase();

    if (/طعام|dining/.test(category)) {
        return "dining_table";
    }

    if (/كرسي|chairs|chair/.test(category)) {
        return "chair";
    }

    if (/بوفيه|buffet/.test(category)) {
        return "buffet";
    }

    if (/طاول|table/.test(category)) {
        return "table";
    }

    return "sofa";
}

/* =====================================
   خصائص المنتج
===================================== */

function isOffer(product) {
    return [
        "special",
        "discount"
    ].includes(product.offer_type);
}

function isNew(product) {
    return product.is_new === true;
}

function isFeatured(product) {
    return product.is_featured === true;
}

/* =====================================
   صور المنتج
===================================== */

function getImages(product) {
    const images = [];

    if (product.main_image_url) {
        images.push(product.main_image_url);
    }

    if (Array.isArray(product.extra_image_urls)) {
        images.push(...product.extra_image_urls);
    }

    return [...new Set(images.filter(Boolean))];
}

/* =====================================
   واتساب
===================================== */

function whatsappNumber(product) {
    return product.whatsapp || "966551496121";
}

/* =====================================
   بطاقة المنتج
===================================== */

function productCard(product) {
    const images = getImages(product);

    const mainImage = images[0] ||
        "https://placehold.co/800x600/071522/e4c57e?text=Najoom";

    const name = product.name || "موديل";

    const description = product.description ||
        "موديل فاخر من نجوم الإبداع للمفروشات والكنبات";

    const offerBadge = isOffer(product)
        ? `<span class="badge special">${
            product.offer_type === "discount"
                ? "خصم"
                : "عرض خاص"
        }</span>`
        : "";

    const newBadge = isNew(product)
        ? `<span class="badge">جديد</span>`
        : "";

    const featuredBadge = isFeatured(product)
        ? `<span class="badge">مميز</span>`
        : "";

    const wa = String(
        whatsappNumber(product)
    ).replace(/\D/g, "");

    const message = encodeURIComponent(
        `السلام عليكم، أريد الاستفسار عن ${name}`
    );

    return `
        <article class="product-card">

            <div class="product-image">

                <img
                    src="${escapeHTML(mainImage)}"
                    alt="${escapeHTML(name)}"
                    loading="lazy"
                    decoding="async"
                >

                <div class="badges">
                    ${offerBadge}
                    ${newBadge}
                    ${featuredBadge}
                </div>

            </div>

            <div class="product-body">

                <h3>${escapeHTML(name)}</h3>

                <p>${escapeHTML(description)}</p>

                <div class="product-actions">

                    <button
                        type="button"
                        class="btn btn-outline"
                        data-view-product="${escapeHTML(
                            String(product.id ?? "")
                        )}"
                    >
                        عرض الصور
                    </button>

                    <a
                        class="btn"
                        target="_blank"
                        rel="noopener noreferrer"
                        href="https://wa.me/${wa}?text=${message}"
                    >
                        واتساب
                    </a>

                </div>

            </div>

        </article>
    `;
}

/* =====================================
   عارض الصور
===================================== */

function openProductViewer(product) {
    const images = getImages(product);

    if (!images.length) return;

    let current = 0;

    const overlay = document.createElement("div");
    overlay.className = "lightbox active";

    overlay.innerHTML = `
        <button
            class="lightbox-close"
            aria-label="إغلاق"
        >×</button>

        <button
            id="prevImage"
            aria-label="الصورة السابقة"
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
        >‹</button>

        <img id="viewerImage" alt="">

        <button
            id="nextImage"
            aria-label="الصورة التالية"
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
        >›</button>
    `;

    document.body.appendChild(overlay);

    const image = overlay.querySelector("#viewerImage");

    function showImage() {
        image.src = images[current];
        image.alt = product.name || "صور المنتج";
    }

    overlay.querySelector(".lightbox-close").onclick =
        () => overlay.remove();

    overlay.querySelector("#prevImage").onclick = () => {
        current = (current - 1 + images.length) % images.length;
        showImage();
    };

    overlay.querySelector("#nextImage").onclick = () => {
        current = (current + 1) % images.length;
        showImage();
    };

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });

    showImage();
}

/* =====================================
   بناء استعلام قاعدة البيانات
===================================== */

function buildQuery() {
    const type = document.body.dataset.productType;

    let query = db
        .from("tables")
        .select("*", { count: "exact" })
        .eq("published", true);

    /*
       تصنيف المنتجات القديمة والجديدة
       باستخدام product_type و category.
    */

    if (type === "dining") {
        query = query.or(
            "product_type.in.(dining_table,chair,buffet)," +
            "and(product_type.is.null,category.ilike.%طعام%)," +
            "and(product_type.is.null,category.ilike.%dining%)," +
            "and(product_type.is.null,category.ilike.%كرسي%)," +
            "and(product_type.is.null,category.ilike.%chair%)," +
            "and(product_type.is.null,category.ilike.%بوفيه%)," +
            "and(product_type.is.null,category.ilike.%buffet%)"
        );

    } else if (type === "table") {
        query = query.or(
            "product_type.eq.table," +
            "and(product_type.is.null,category.ilike.%طاول%,category.not.ilike.%طعام%,category.not.ilike.%dining%)," +
            "and(product_type.is.null,category.ilike.%table%,category.not.ilike.%dining%)"
        );

    } else if (type === "sofa") {
        query = query.or(
            "product_type.eq.sofa," +
            "and(product_type.is.null,category.not.ilike.%طعام%,category.not.ilike.%dining%,category.not.ilike.%كرسي%,category.not.ilike.%chair%,category.not.ilike.%بوفيه%,category.not.ilike.%buffet%,category.not.ilike.%طاول%,category.not.ilike.%table%)"
        );
    }

    /*
       البحث في قاعدة البيانات
    */

    const term = searchValue
        .trim()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .slice(0, 100);

    if (term) {
        const pattern = `%${term}%`;

        query = query.or(
            `name.ilike.${pattern},` +
            `description.ilike.${pattern},` +
            `category.ilike.${pattern}`
        );
    }

    /*
       فلاتر المنتجات
    */

    if (activeFilter === "offers") {
        query = query.in("offer_type", [
            "special",
            "discount"
        ]);
    }

    if (activeFilter === "new") {
        query = query.eq("is_new", true);
    }

    if (activeFilter === "featured") {
        query = query.eq("is_featured", true);
    }

    return query
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
}

/* =====================================
   زر عرض المزيد
===================================== */

function renderLoadMore() {
    const area = getPagination();

    if (!area) return;

    area.replaceChildren();

    const summary = document.createElement("div");

    summary.style.cssText = `
        color:#64748b;
        font-size:14px;
        text-align:center;
    `;

    summary.textContent =
        `تم عرض ${window.visibleProducts.length} من ${totalProducts} منتج`;

    area.appendChild(summary);

    if (!hasMore) return;

    const button = document.createElement("button");

    button.type = "button";
    button.textContent = isLoading
        ? "جاري تحميل المنتجات..."
        : "عرض المزيد";

    button.style.cssText = `
        min-width:180px;
        padding:13px 28px;
        border:1px solid #c8a15b;
        border-radius:10px;
        background:#071522;
        color:#e4c57e;
        font-size:16px;
        font-weight:600;
        cursor:pointer;
    `;

    button.disabled = isLoading;

    button.addEventListener("click", () => {
        loadProducts(true);
    });

    area.appendChild(button);
}

/* =====================================
   تحميل 16 منتجًا في كل طلب
===================================== */

async function loadProducts(append = false) {
    const grid = getGrid();

    if (!grid || isLoading) return;

    if (!append) {
        currentPage = 0;
        totalProducts = 0;
        hasMore = false;

        window.visibleProducts = [];
    }

    isLoading = true;

    const thisRequest = ++requestNumber;

    if (!append) {
        showMessage("جاري تحميل المنتجات...");
    }

    renderLoadMore();

    try {
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error, count } = await buildQuery()
            .range(from, to);

        if (thisRequest !== requestNumber) return;

        if (error) throw error;

        const products = data || [];

        totalProducts = count ?? 0;

        /*
           حفظ المنتجات لكل دفعة
           حتى يعمل عارض الصور بصورة صحيحة.
        */

        if (append) {
            window.visibleProducts.push(...products);
        } else {
            window.visibleProducts = [...products];
        }

        if (append) {
            products.forEach(product => {
                grid.insertAdjacentHTML(
                    "beforeend",
                    productCard(product)
                );
            });
        } else {
            grid.innerHTML = products
                .map(productCard)
                .join("");
        }

        currentPage++;

        hasMore =
            currentPage * PAGE_SIZE < totalProducts;

        if (!window.visibleProducts.length) {
            showMessage("لا توجد منتجات مطابقة.");
        }

        renderLoadMore();

    } catch (error) {
        console.error("خطأ تحميل المنتجات:", error);

        if (thisRequest === requestNumber) {
            if (!append) {
                showMessage(
                    "تعذر تحميل المنتجات. تحقق من الاتصال وحاول مرة أخرى."
                );
            }

            const area = getPagination();

            if (area) {
                area.replaceChildren();

                const retry = document.createElement("button");
                retry.type = "button";
                retry.className = "btn";
                retry.textContent = "إعادة المحاولة";

                retry.addEventListener("click", () => {
                    loadProducts(append);
                });

                area.appendChild(retry);
            }
        }

    } finally {
        if (thisRequest === requestNumber) {
            isLoading = false;
            renderLoadMore();
        }
    }
}

/* =====================================
   تشغيل الصفحة والبحث والفلاتر
===================================== */

document.addEventListener("DOMContentLoaded", () => {
    const grid = getGrid();

    const search = document.querySelector(
        "#productSearch"
    );

    const filters = document.querySelectorAll(
        ".filters [data-filter]"
    );

    if (!grid) return;

    /*
       عارض الصور: يبحث في كل المنتجات المحملة
    */

    grid.addEventListener("click", event => {
        const button = event.target.closest(
            "[data-view-product]"
        );

        if (!button) return;

        const id = button.dataset.viewProduct;

        const product = window.visibleProducts.find(
            item => String(item.id ?? "") === id
        );

        if (product) {
            openProductViewer(product);
        }
    });

    /*
       بدء التحميل الأول
    */

    loadProducts(false);

    /*
       البحث مع تأخير بسيط لتخفيف الطلبات
    */

    if (search) {
        let debounce;

        search.addEventListener("input", () => {
            clearTimeout(debounce);

            debounce = setTimeout(() => {
                searchValue = search.value;
                loadProducts(false);
            }, 300);
        });
    }

    /*
       الفلاتر
    */

    filters.forEach(button => {
        button.addEventListener("click", () => {
            filters.forEach(item => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            activeFilter =
                button.dataset.filter || "all";

            loadProducts(false);
        });
    });
});
