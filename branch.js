const SUPABASE_URL =
"https://kpgfdhxwcormlqfkpoye.supabase.co";

const SUPABASE_KEY =
"sb_publishable_VYD0M_I_yrW-DlQUYhtvGQ_lUQcHwXG";

const branchDB =
window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


async function loadBranchGallery(){

    const branch =
        document.body.dataset.branch;

    const gallery =
        document.getElementById("branchGallery");

    if(!branch || !gallery){
        return;
    }

    gallery.innerHTML =
        `<div class="empty">جاري تحميل صور الفرع...</div>`;


    const { data, error } =
        await branchDB
        .from("branch_images")
        .select("*")
        .eq("branch", branch)
        .eq("published", true)
        .order("sort_order", {
            ascending:true
        })
        .order("created_at", {
            ascending:false
        });


    if(error){

        console.error(error);

        gallery.innerHTML =
            `<div class="empty">
                تعذر تحميل صور الفرع
            </div>`;

        return;
    }


    if(!data || !data.length){

        gallery.innerHTML =
            `<div class="empty">
                لا توجد صور منشورة لهذا الفرع حالياً
            </div>`;

        return;
    }


    gallery.innerHTML =
        data.map(item => {

            return `
                <div
                    class="gallery-item"
                    onclick="openBranchImage('${encodeURIComponent(item.image_url)}')"
                >

                    <img
                        src="${item.image_url}"
                        alt="${item.title || 'فرع نجوم الإبداع'}"
                        loading="lazy"
                    >

                </div>
            `;

        }).join("");
}


function openBranchImage(encodedUrl){

    const url =
        decodeURIComponent(encodedUrl);

    const overlay =
        document.createElement("div");

    overlay.className =
        "lightbox active";

    overlay.innerHTML = `

        <button
            class="lightbox-close"
            onclick="this.parentElement.remove()"
        >
            ×
        </button>

        <img
            src="${url}"
            alt=""
        >

    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", e => {

        if(e.target === overlay){
            overlay.remove();
        }

    });
}


document.addEventListener(
    "DOMContentLoaded",
    loadBranchGallery
);
