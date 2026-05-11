(function () {
  const config = window.SITE_CONFIG || {};
  const faqs = window.FAQ_DATA || [];
  const categories = window.CATEGORY_DATA || [];
  const popularData = window.POPULAR_FAQ_DATA || [];
  const byId = new Map(faqs.map((faq) => [faq.id, faq]));

  const els = {
    search: document.getElementById("search"),
    searchForm: document.getElementById("searchForm"),
    categoryList: document.getElementById("categoryList"),
    popularList: document.getElementById("popularList"),
    faqList: document.getElementById("faqList"),
    activeMeta: document.getElementById("activeMeta"),
    newFaqLink: document.getElementById("newFaqLink")
  };

  const state = {
    query: "",
    category: "all",
    openId: parseHash()
  };
  const trackedViews = new Set();

  initAnalytics();
  setAddLink();
  renderCategories();
  render();

  window.addEventListener("hashchange", () => {
    state.openId = parseHash();
    render();
  });

  ["input", "keyup", "search", "change", "compositionend"].forEach((eventName) => {
    els.search.addEventListener(eventName, updateSearch);
  });

  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateSearch();
  });

  function updateSearch() {
    const nextQuery = els.search.value.toLowerCase();
    if (nextQuery === state.query) return;
    state.query = nextQuery;
    render();
  }

  function setAddLink() {
    els.newFaqLink.href = editUrl({ path: config.defaultNewFaqPath || "content/faqs/unanswered/new-faq.md" });
  }

  function renderCategories() {
    const allCount = faqs.length;
    const buttons = [{ slug: "all", title: "All FAQs", count: allCount }, ...categories];
    els.categoryList.innerHTML = buttons
      .map(
        (category) => `
          <button class="category-button" type="button" data-category="${escapeHtml(category.slug)}">
            <span>${escapeHtml(category.title)}</span>
            <span class="count">${category.count}</span>
          </button>
        `
      )
      .join("");

    els.categoryList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category]");
      if (!button) return;
      state.category = button.dataset.category;
      render();
    });
  }

  function render() {
    if (els.search.value.toLowerCase() !== state.query) {
      state.query = els.search.value.toLowerCase();
    }

    let filtered = getFilteredFaqs();
    const openFaq = byId.get(state.openId);
    if (openFaq && !filtered.some((faq) => faq.id === openFaq.id)) {
      state.openId = "";
      history.replaceState(null, "", location.pathname + location.search);
      filtered = getFilteredFaqs();
    }

    for (const button of els.categoryList.querySelectorAll(".category-button")) {
      button.classList.toggle("active", button.dataset.category === state.category);
    }

    renderMeta(filtered.length);
    renderPopular();
    renderFaqs(filtered);

    if (state.openId && byId.has(state.openId)) {
      markViewed(state.openId);
      trackFaqView(byId.get(state.openId));
    }
  }

  function renderMeta(count) {
    const categoryTitle = state.category === "all"
      ? "All categories"
      : categories.find((category) => category.slug === state.category)?.title || "All categories";
    const searchText = state.query ? `Search: "${state.query}"` : "No search filter";
    els.activeMeta.innerHTML = `
      <span class="tag">${escapeHtml(categoryTitle)}</span>
      <span class="tag">${count} result${count === 1 ? "" : "s"}</span>
      <span class="tag">${escapeHtml(searchText)}</span>
    `;
  }

  function renderFaqs(items) {
    if (!items.length) {
      els.faqList.innerHTML = '<div class="empty-state">No FAQs match the current filters.</div>';
      return;
    }

    els.faqList.innerHTML = items.map(renderFaqCard).join("");
    els.faqList.querySelectorAll("details").forEach((details) => {
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        const id = details.dataset.id;
        if (location.hash !== `#faq=${id}`) {
          history.replaceState(null, "", `#faq=${id}`);
        }
        state.openId = id;
        markViewed(id);
        trackFaqView(byId.get(id));
      });
    });
  }

  function renderFaqCard(faq) {
    const open = faq.id === state.openId ? " open" : "";
    return `
      <details class="faq-card" data-id="${escapeHtml(faq.id)}"${open}>
        <summary>
          <div>
            <h2 class="faq-title">${escapeHtml(faq.title)}</h2>
            <div class="meta-row">
              <span class="tag">${escapeHtml(faq.category)}</span>
              <span class="tag ${escapeHtml(faq.status)}">${formatStatus(faq.status)}</span>
              <span class="tag">${escapeHtml(formatLastUpdated(faq.lastUpdated))}</span>
              <span class="tag">${escapeHtml(formatLastEditedBy(faq.lastEditedBy))}</span>
            </div>
          </div>
          <span class="chevron" aria-hidden="true">+</span>
        </summary>
        <div class="faq-body">
          ${renderMarkdown(faq.body)}
          <div class="faq-actions">
            <a class="button" href="${editUrl(faq)}">Edit this FAQ</a>
            <a class="button" href="${sourceUrl(faq)}">View source</a>
          </div>
        </div>
      </details>
    `;
  }

  function renderPopular() {
    const sitePopular = popularData
      .map((item) => ({ ...item, faq: byId.get(item.id) }))
      .filter((item) => item.faq)
      .slice(0, 5);

    const localPopular = getLocalViews()
      .map((item) => ({ ...item, faq: byId.get(item.id) }))
      .filter((item) => item.faq)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    const items = sitePopular.length ? sitePopular : localPopular;

    if (!items.length) {
      els.popularList.innerHTML = '<div class="empty-state">Popularity data will appear after FAQs are viewed or analytics data is added.</div>';
      return;
    }

    els.popularList.innerHTML = items
      .map(
        (item) => `
          <div class="popular-item">
            <button type="button" data-open="${escapeHtml(item.faq.id)}">${escapeHtml(item.faq.title)}</button>
            <small>${escapeHtml(item.faq.category)}${item.views ? ` · ${item.views} views` : ""}</small>
          </div>
        `
      )
      .join("");

    els.popularList.querySelectorAll("button[data-open]").forEach((button) => {
      button.addEventListener("click", () => {
        location.hash = `#faq=${button.dataset.open}`;
      });
    });
  }

  function getFilteredFaqs() {
    const query = state.query;
    return faqs.filter((faq) => {
      const categoryMatch = state.category === "all" || faq.categorySlug === state.category;
      if (!categoryMatch) return false;
      const normalizedQuery = query.trim();
      if (!normalizedQuery) return true;
      return `${faq.title} ${faq.category} ${stripMarkdown(faq.body)}`.toLowerCase().includes(normalizedQuery);
    });
  }

  function parseHash() {
    const match = location.hash.match(/^#faq=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function editUrl(faq) {
    return `https://github.com/${config.repoOwner}/${config.repoName}/edit/${config.branch}/${faq.path}`;
  }

  function sourceUrl(faq) {
    return `https://github.com/${config.repoOwner}/${config.repoName}/blob/${config.branch}/${faq.path}`;
  }

  function formatStatus(status) {
    return status
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function formatLastUpdated(value) {
    if (!value) return "Last updated: Not recorded";
    return `Last updated: ${value}`;
  }

  function formatLastEditedBy(value) {
    if (!value) return "Last edited by: Not recorded";
    return `Last edited by: ${value}`;
  }

  function stripMarkdown(markdown) {
    return markdown
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 $2")
      .replace(/[*_`>#|\\-]/g, " ")
      .replace(/\s+/g, " ");
  }

  function renderMarkdown(markdown) {
    const lines = markdown.split(/\r?\n/);
    const html = [];
    let paragraph = [];
    let list = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }

    function closeList() {
      if (!list) return;
      html.push(`</${list}>`);
      list = null;
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph();
        closeList();
        continue;
      }

      if (isTableStart(lines, index)) {
        flushParagraph();
        closeList();
        const tableLines = [];
        while (index < lines.length && lines[index].trim().startsWith("|")) {
          tableLines.push(lines[index]);
          index += 1;
        }
        index -= 1;
        html.push(renderTable(tableLines));
        continue;
      }

      const heading = trimmed.match(/^(#{3,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        const level = Math.min(heading[1].length + 1, 6);
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        continue;
      }

      const ordered = trimmed.match(/^\d+(?:\\?\.|\))\s+(.+)$/);
      const unordered = trimmed.match(/^[-*]\s+(.+)$/);
      if (ordered || unordered) {
        flushParagraph();
        const nextList = ordered ? "ol" : "ul";
        if (list !== nextList) {
          closeList();
          html.push(`<${nextList}>`);
          list = nextList;
        }
        html.push(`<li>${inline((ordered || unordered)[1])}</li>`);
        continue;
      }

      paragraph.push(trimmed);
    }

    flushParagraph();
    closeList();
    return html.join("");
  }

  function isTableStart(lines, index) {
    return lines[index]?.trim().startsWith("|") && /^\|?\s*:?-{3,}:?\s*\|/.test(lines[index + 1] || "");
  }

  function renderTable(lines) {
    const rows = lines
      .filter((line, index) => index !== 1)
      .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
    const head = rows.shift() || [];
    const body = rows;
    return `
      <table>
        <thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead>
        <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    `;
  }

  function inline(text) {
    let value = escapeHtml(text.replace(/\\([!#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1"));
    value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
    value = value.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" rel="noopener noreferrer">$1</a>'
    );
    value = value.replace(
      /(^|\s)(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" rel="noopener noreferrer">$2</a>'
    );
    return value;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function markViewed(id) {
    if (trackedViews.has(id)) return;
    trackedViews.add(id);
    const views = getLocalViews();
    const existing = views.find((item) => item.id === id);
    if (existing) {
      existing.views += 1;
    } else {
      views.push({ id, views: 1 });
    }
    try {
      localStorage.setItem("coderant-faq-views", JSON.stringify(views.slice(-100)));
    } catch {
      /* Local popularity is optional. */
    }
  }

  function getLocalViews() {
    try {
      return JSON.parse(localStorage.getItem("coderant-faq-views") || "[]");
    } catch {
      return [];
    }
  }

  function initAnalytics() {
    const analytics = config.analytics || {};
    if (analytics.plausibleDomain) {
      const script = document.createElement("script");
      script.defer = true;
      script.dataset.domain = analytics.plausibleDomain;
      script.src = "https://plausible.io/js/script.tagged-events.js";
      document.head.appendChild(script);
    }
    if (analytics.goatCounterCode) {
      window.goatcounter = { path: location.pathname + location.hash };
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://${analytics.goatCounterCode}.goatcounter.com/count.js`;
      document.head.appendChild(script);
    }
  }

  function trackFaqView(faq) {
    if (!faq) return;
    if (window.plausible) {
      window.plausible("FAQ View", { props: { id: faq.id, category: faq.category, title: faq.title } });
    }
    if (window.goatcounter && typeof window.goatcounter.count === "function") {
      window.goatcounter.count({
        path: `/faq/${faq.id}`,
        title: faq.title,
        event: true
      });
    }
  }
})();
