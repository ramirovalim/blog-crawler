async function loadPosts() {
    const res = await fetch("/api/posts");
    if (!res.ok) {
        document.getElementById("posts").textContent =
            "Run `npm run build-index` first.";
        return;
    }
    const idx = await res.json();
    const container = document.getElementById("posts");
    container.innerHTML = "";
    idx.posts.forEach((p) => {
        const div = document.createElement("div");
        div.className = "post";
        div.innerHTML = `
      <div class="meta">
        <label><input type="checkbox" data-id="${p.id}"> <strong>${
            p.title || "(no title)"
        }</strong></label>
        <div style="font-size:12px;color:#666">${
            (p.themes || []).slice(0, 4).join(", ")
        } • ${p.readingMinutes || "?"} min</div>
      </div>
      <div>
        <button data-id="${p.id}" class="preview-btn">Preview</button>
      </div>
    `;
        container.appendChild(div);
    });

    Array.from(document.querySelectorAll(".preview-btn")).forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            const id = btn.dataset.id;
            const pv = document.getElementById("preview");
            pv.textContent = "Loading preview…";
            try {
                const r = await fetch(`/api/post/${encodeURIComponent(id)}`);
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    pv.textContent = "Preview error: " + JSON.stringify(err);
                    return;
                }
                const data = await r.json();
                pv.innerHTML = `<strong>${data.title}</strong> — ${
                    data.publishedDate || ""
                }<br/><small>${data.url || ""}</small><p>${data.excerpt}</p>`;
            } catch (err) {
                pv.textContent = "Preview failed: " + String(err);
            }
        });
    });
}

document.getElementById("generate").addEventListener("click", async () => {
    const checked = Array.from(
        document.querySelectorAll("#posts input[type=checkbox]:checked"),
    ).map((el) => el.dataset.id);
    const baseStyle = document.getElementById("baseStyle").value;
    const theme = document.getElementById("theme").value;
    if (checked.length === 0) {
        alert("Select at least one post as inspiration.");
        return;
    }
    document.getElementById("result").textContent = "Generating…";
    const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: checked, baseStyle, theme }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        document.getElementById("result").textContent = "Generation error: " +
            JSON.stringify(err);
        return;
    }
    const data = await resp.json();
    document.getElementById("result").textContent = data.result;
});

loadPosts();
