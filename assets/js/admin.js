/* =========================================================
   Painel de produtos — salva direto no repositório do GitHub
   (o GitHub Pages republica o site automaticamente)
   ========================================================= */
(() => {
  "use strict";
  const CFG = window.SITE_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DATA_PATH = "data/produtos.json";
  const IMG_DIR = "assets/produtos";
  // Chave salva por repositório (v1 e v2 ficam no mesmo domínio e não podem se misturar)
  const LS_KEY = `ely_admin_${(CFG.github && CFG.github.repo) || "site"}`;

  const st = {
    gh: null,          // { owner, repo, branch, token }
    sha: null,         // sha atual do produtos.json
    data: { categorias: [], produtos: [] },
    editing: null,     // id em edição (null = novo)
    pendingImage: null,// { blob, dataUrl }
    sourceImage: null  // HTMLImageElement original (para refazer ajuste)
  };

  /* ---------- util ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const brl = (v) => (v > 0 ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Consulte");
  const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "produto";
  const parsePrice = (s) => {
    const t = String(s || "").replace(/[^\d,.-]/g, "");
    if (!t) return 0;
    const n = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  };
  let tt;
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("is-show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("is-show"), 2600); };
  const busy = (on, msg) => { $("#busy").hidden = !on; if (msg) $("#busyMsg").textContent = msg; };

  const utf8ToB64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const b64ToUtf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const blobToB64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const { owner, repo, token } = st.gh;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, {
      ...opts,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {})
      }
    });
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try { const j = await res.json(); if (j.message) msg += `: ${j.message}`; } catch {}
      if (res.status === 401) msg = "Chave de acesso inválida ou expirada.";
      if (res.status === 404) msg = "Repositório ou arquivo não encontrado. Confira usuário, repositório e permissões da chave.";
      if (res.status === 409) msg = "O arquivo mudou no GitHub enquanto você editava. Recarregue e tente de novo.";
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  const contentsUrl = (p) => `contents/${p.split("/").map(encodeURIComponent).join("/")}`;

  async function loadData() {
    const j = await gh(`${contentsUrl(DATA_PATH)}?ref=${encodeURIComponent(st.gh.branch)}`);
    st.sha = j.sha;
    const data = JSON.parse(b64ToUtf8(j.content));
    st.data = { categorias: data.categorias || [], produtos: data.produtos || [] };
  }

  async function saveData(message) {
    const body = {
      message,
      content: utf8ToB64(JSON.stringify(st.data, null, 2) + "\n"),
      sha: st.sha,
      branch: st.gh.branch
    };
    const j = await gh(contentsUrl(DATA_PATH), { method: "PUT", body: JSON.stringify(body) });
    st.sha = j.content.sha;
  }

  async function uploadImage(blob, name) {
    const path = `${IMG_DIR}/${name}`;
    await gh(contentsUrl(path), {
      method: "PUT",
      body: JSON.stringify({ message: `Imagem: ${name}`, content: await blobToB64(blob), branch: st.gh.branch })
    });
    return path;
  }

  // Executa uma alteração e publica; se der conflito, recarrega e reaplica uma vez
  async function commit(mutator, message) {
    busy(true, "Publicando…");
    try {
      mutator();
      try {
        await saveData(message);
      } catch (e) {
        if (e.status !== 409) throw e;
        await loadData();
        mutator();
        await saveData(message);
      }
      toast("Publicado! O site atualiza em ~1 minuto.");
      return true;
    } catch (e) {
      console.error(e);
      alert(e.message || "Não foi possível publicar.");
      try { await loadData(); } catch {}
      return false;
    } finally {
      busy(false);
      render();
    }
  }

  /* ---------- Login ---------- */
  function readSaved() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
  }
  function initLogin() {
    const saved = readSaved();
    const g = CFG.github || {};
    $("#ghOwner").value = saved?.owner || g.owner || "";
    $("#ghRepo").value = saved?.repo || g.repo || "";
    $("#ghBranch").value = saved?.branch || g.branch || "main";
    if (saved?.token) { $("#ghToken").value = saved.token; login(saved, false); }

    $("#loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const cred = {
        owner: $("#ghOwner").value.trim(),
        repo: $("#ghRepo").value.trim(),
        branch: $("#ghBranch").value.trim() || "main",
        token: $("#ghToken").value.trim()
      };
      login(cred, $("#remember").checked);
    });
    $("#logout").addEventListener("click", () => {
      try { localStorage.removeItem(LS_KEY); } catch {}
      location.reload();
    });
  }
  async function login(cred, remember) {
    st.gh = cred;
    $("#loginError").textContent = "";
    busy(true, "Conectando…");
    try {
      await loadData();
      if (remember) { try { localStorage.setItem(LS_KEY, JSON.stringify(cred)); } catch {} }
      $("#loginView").hidden = true;
      $("#listView").hidden = false;
      $("#logout").hidden = false;
      $("#repoLabel").textContent = `Conectado a ${cred.owner}/${cred.repo}`;
      render();
    } catch (e) {
      $("#loginError").textContent = e.message;
      if (e.status === 404) $(".adm-advanced").open = true;
      if (e.status === 401) { try { localStorage.removeItem(LS_KEY); } catch {} }
    } finally {
      busy(false);
    }
  }

  /* ---------- Lista ---------- */
  function render() {
    const { produtos, categorias } = st.data;
    const allCats = [...new Set([...categorias, ...produtos.map((p) => p.categoria).filter(Boolean)])];
    const sel = $("#admCat");
    const cur = sel.value || "";
    sel.innerHTML = `<option value="">Todas as categorias</option>` + allCats.map((c) => `<option ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("");
    $("#edCategoria").innerHTML = allCats.map((c) => `<option>${esc(c)}</option>`).join("");
    $("#marcas").innerHTML = [...new Set(produtos.map((p) => p.marca).filter(Boolean))].map((m) => `<option value="${esc(m)}">`).join("");

    const q = ($("#admSearch").value || "").toLowerCase();
    const list = produtos
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => (!cur || p.categoria === cur) && (!q || `${p.nome} ${p.marca}`.toLowerCase().includes(q)));
    const off = produtos.filter((p) => p.disponivel === false).length;
    $("#admStats").innerHTML = `
      <li><strong>${produtos.length}</strong><span>Produtos</span></li>
      <li><strong>${off}</strong><span>Esgotados</span></li>
      <li><strong>${produtos.filter((p) => p.destaque).length}</strong><span>Mais desejados</span></li>`;
    const base = location.href.replace(/admin\.html.*$/, "");
    $("#admList").innerHTML = list.length
      ? list.map(({ p, i }) => `
        <li class="adm-item${p.disponivel === false ? " is-off" : ""}">
          <div class="adm-item__thumb"><img src="${esc(base + p.imagem)}" alt="" loading="lazy"></div>
          <div>
            <div class="adm-item__name">${esc(p.nome)}</div>
            <div class="adm-item__meta mono">${esc(p.marca || "—")} · ${esc(p.categoria)} · ${brl(p.preco)}</div>
            <div class="adm-item__flags">
              <button class="adm-flag${p.disponivel !== false ? " is-on" : ""}" data-toggle="disponivel" data-i="${i}">${p.disponivel !== false ? "Disponível" : "Esgotado"}</button>
              <button class="adm-flag${p.destaque ? " is-on" : ""}" data-toggle="destaque" data-i="${i}">★ Desejado</button>
            </div>
          </div>
          <div class="adm-item__actions">
            <button class="adm-icon adm-icon--edit" data-edit="${i}">Editar</button>
            <button class="adm-icon" data-move="-1" data-i="${i}" aria-label="Subir">↑</button>
            <button class="adm-icon" data-move="1" data-i="${i}" aria-label="Descer">↓</button>
            <button class="adm-icon" data-dup="${i}" aria-label="Duplicar" title="Duplicar">⧉</button>
            <button class="adm-icon" data-del="${i}" aria-label="Excluir" title="Excluir">✕</button>
          </div>
        </li>`).join("")
      : `<li class="adm-item"><p class="label">Nenhum produto encontrado.</p></li>`;

    $("#catList").innerHTML = categorias.map((c, i) => `
      <li><span>${esc(c)} <span class="mono label">(${produtos.filter((p) => p.categoria === c).length})</span></span>
        <span class="grp">
          <button class="adm-icon" data-catmove="-1" data-i="${i}" aria-label="Subir">↑</button>
          <button class="adm-icon" data-catmove="1" data-i="${i}" aria-label="Descer">↓</button>
          <button class="adm-icon" data-catdel="${i}" aria-label="Remover">✕</button>
        </span></li>`).join("");
  }

  /* ---------- Editor ---------- */
  function openEditor(i) {
    const p = i == null ? null : st.data.produtos[i];
    st.editing = p ? p.id : null;
    st.pendingImage = null;
    st.sourceImage = null;
    $("#edTitle").textContent = p ? "Editar produto" : "Novo produto";
    $("#edNome").value = p?.nome || "";
    $("#edMarca").value = p?.marca || "";
    $("#edCategoria").value = p?.categoria || st.data.categorias[0] || "";
    $("#edPreco").value = p ? (p.preco > 0 ? String(p.preco.toFixed(2)).replace(".", ",") : "0") : "100,00";
    $("#edVolume").value = p?.volume || "";
    $("#edFamilia").value = p?.familia || "";
    $("#edDescricao").value = p?.descricao || "";
    $("#edDisponivel").checked = p ? p.disponivel !== false : true;
    $("#edDestaque").checked = !!p?.destaque;
    $("#edFile").value = "";
    const img = $("#edPreview");
    if (p?.imagem) { img.src = p.imagem; img.hidden = false; $("#edNoPhoto").hidden = true; }
    else { img.hidden = true; $("#edNoPhoto").hidden = false; }
    $("#edDelete").hidden = !p;
    $("#editor").classList.add("is-open");
    $("#overlay").classList.add("is-open");
    document.body.classList.add("is-locked");
    $("#edForm").scrollTop = 0;
  }
  function closeEditor() {
    $("#editor").classList.remove("is-open");
    $("#overlay").classList.remove("is-open");
    document.body.classList.remove("is-locked");
  }

  function processImage(img, fit) {
    const W = 1000, H = 1250;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = "high";
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let s, dw, dh;
    if (fit === "cover") s = Math.max(W / iw, H / ih);
    else s = Math.min((W * 0.86) / iw, (H * 0.86) / ih);
    dw = iw * s; dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return new Promise((res) => c.toBlob((blob) => res({ blob, dataUrl: c.toDataURL("image/jpeg", 0.86) }), "image/jpeg", 0.86));
  }
  async function refreshPreview() {
    if (!st.sourceImage) return;
    const fit = $("input[name=fit]:checked").value;
    st.pendingImage = await processImage(st.sourceImage, fit);
    $("#edPreview").src = st.pendingImage.dataUrl;
    $("#edPreview").hidden = false;
    $("#edNoPhoto").hidden = true;
  }

  async function saveProduct(e) {
    e.preventDefault();
    const nome = $("#edNome").value.trim();
    if (!nome) return;
    const fields = {
      nome,
      marca: $("#edMarca").value.trim(),
      categoria: $("#edCategoria").value,
      volume: $("#edVolume").value.trim(),
      preco: parsePrice($("#edPreco").value),
      familia: $("#edFamilia").value.trim(),
      descricao: $("#edDescricao").value.trim(),
      destaque: $("#edDestaque").checked,
      disponivel: $("#edDisponivel").checked
    };
    const editingId = st.editing;
    let id = editingId;
    if (!id) {
      id = slug(nome);
      let n = 2;
      while (st.data.produtos.some((p) => p.id === id)) id = `${slug(nome)}-${n++}`;
    }
    if (!editingId && !st.pendingImage) {
      if (!confirm("Este produto está sem foto. Salvar mesmo assim?")) return;
    }

    let imagePath = null;
    if (st.pendingImage) {
      busy(true, "Enviando foto…");
      try {
        imagePath = await uploadImage(st.pendingImage.blob, `${id}-${Date.now().toString(36)}.jpg`);
      } catch (err) {
        busy(false);
        alert(err.message || "Não foi possível enviar a foto.");
        return;
      }
    }

    const ok = await commit(() => {
      const list = st.data.produtos;
      const idx = list.findIndex((p) => p.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...fields, ...(imagePath ? { imagem: imagePath } : {}) };
      } else {
        list.unshift({ id, ...fields, imagem: imagePath || "assets/logo/icone-512.png" });
      }
      if (fields.categoria && !st.data.categorias.includes(fields.categoria)) st.data.categorias.push(fields.categoria);
    }, `${editingId ? "Edita" : "Adiciona"} produto: ${nome}`);
    if (ok) closeEditor();
  }

  /* ---------- Eventos ---------- */
  function bind() {
    $("#newBtn").addEventListener("click", () => openEditor(null));
    $("#admSearch").addEventListener("input", render);
    $("#admCat").addEventListener("change", render);
    $("#edForm").addEventListener("submit", saveProduct);
    $("#overlay").addEventListener("click", closeEditor);
    $("[data-close]", $("#editor")).addEventListener("click", closeEditor);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeEditor(); });

    $("#edFile").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => { st.sourceImage = img; refreshPreview(); };
      img.onerror = () => alert("Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.");
      img.src = url;
    });
    $$("input[name=fit]").forEach((r) => r.addEventListener("change", refreshPreview));

    $("#edDelete").addEventListener("click", async () => {
      const p = st.data.produtos.find((x) => x.id === st.editing);
      if (!p || !confirm(`Excluir "${p.nome}" da vitrine?`)) return;
      const ok = await commit(() => { st.data.produtos = st.data.produtos.filter((x) => x.id !== p.id); }, `Remove produto: ${p.nome}`);
      if (ok) closeEditor();
    });

    $("#admList").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const L = st.data.produtos;
      if (b.dataset.edit != null) return openEditor(+b.dataset.edit);
      if (b.dataset.toggle) {
        const p = L[+b.dataset.i]; const key = b.dataset.toggle; const id = p.id;
        const val = key === "disponivel" ? p.disponivel === false : !p.destaque;
        return commit(() => { const q = st.data.produtos.find((x) => x.id === id); if (q) q[key] = val; }, `${p.nome}: ${key} = ${val}`);
      }
      if (b.dataset.move) {
        const i = +b.dataset.i, j = i + +b.dataset.move;
        if (j < 0 || j >= L.length) return;
        const id = L[i].id;
        return commit(() => {
          const A = st.data.produtos; const a = A.findIndex((x) => x.id === id); const z = a + +b.dataset.move;
          if (a < 0 || z < 0 || z >= A.length) return;
          [A[a], A[z]] = [A[z], A[a]];
        }, `Reordena: ${L[i].nome}`);
      }
      if (b.dataset.dup != null) {
        const src = L[+b.dataset.dup];
        let id = `${src.id}-copia`, n = 2;
        while (L.some((x) => x.id === id)) id = `${src.id}-copia-${n++}`;
        return commit(() => { const A = st.data.produtos; const k = A.findIndex((x) => x.id === src.id); A.splice(k + 1, 0, { ...src, id, nome: `${src.nome} (cópia)` }); }, `Duplica: ${src.nome}`);
      }
      if (b.dataset.del != null) {
        const p = L[+b.dataset.del];
        if (!confirm(`Excluir "${p.nome}" da vitrine?`)) return;
        return commit(() => { st.data.produtos = st.data.produtos.filter((x) => x.id !== p.id); }, `Remove produto: ${p.nome}`);
      }
    });

    $("#catList").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const C = st.data.categorias;
      if (b.dataset.catmove) {
        const i = +b.dataset.i, j = i + +b.dataset.catmove;
        if (j < 0 || j >= C.length) return;
        const name = C[i];
        return commit(() => { const A = st.data.categorias; const a = A.indexOf(name); const z = a + +b.dataset.catmove; if (a < 0 || z < 0 || z >= A.length) return; [A[a], A[z]] = [A[z], A[a]]; }, `Reordena categoria: ${name}`);
      }
      if (b.dataset.catdel != null) {
        const name = C[+b.dataset.catdel];
        const n = st.data.produtos.filter((p) => p.categoria === name).length;
        if (n) return alert(`"${name}" tem ${n} produto(s). Mude a categoria deles antes de remover.`);
        return commit(() => { st.data.categorias = st.data.categorias.filter((c) => c !== name); }, `Remove categoria: ${name}`);
      }
    });
    $("#catForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#catName").value.trim();
      if (!name || st.data.categorias.includes(name)) return;
      commit(() => { if (!st.data.categorias.includes(name)) st.data.categorias.push(name); }, `Nova categoria: ${name}`).then(() => ($("#catName").value = ""));
    });

    $("#exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(st.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `produtos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    });
    $("#reloadBtn").addEventListener("click", async () => {
      busy(true, "Carregando…");
      try { await loadData(); render(); toast("Atualizado"); } catch (e) { alert(e.message); } finally { busy(false); }
    });
  }

  bind();
  initLogin();
})();
