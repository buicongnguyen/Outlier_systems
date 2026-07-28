(() => {
  "use strict";

  const scriptUrl = new URL(document.currentScript.src);
  const docsBase = new URL("./", scriptUrl);
  const MOBILE_QUERY = "(max-width: 980px)";
  const PROGRESS_KEY = "embedded-learning-progress-v1";

  const chapters = [
    {
      title: "Start here",
      pages: [
        { code: "00", title: "Study hub", href: "index.html" },
        { code: "01", title: "Systems foundations", href: "systems-skills.html" },
        { code: "02", title: "Coding practice", href: "coding-questions.html" },
      ],
    },
    {
      title: "Embedded systems + NPU",
      pages: [
        { code: "03", title: "Learning map", href: "embedded-systems/index.html" },
        { code: "03.1", title: "RTOS & scheduling", href: "embedded-systems/rtos.html", topic: "rtos" },
        { code: "03.2", title: "Boot & trust chain", href: "embedded-systems/boot-chain.html", topic: "boot" },
        { code: "03.3", title: "Host + NPU startup", href: "embedded-systems/host-npu-startup.html", topic: "startup" },
        { code: "03.4", title: "Driver & data path", href: "embedded-systems/npu-data-path.html", topic: "datapath" },
        { code: "03.5", title: "First inference capstone", href: "embedded-systems/end-to-end.html", topic: "endtoend" },
      ],
    },
  ];

  const pages = chapters.flatMap((chapter) => chapter.pages);

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function canonicalPath(value) {
    const url = value instanceof URL ? value : new URL(value, globalThis.location.href);
    let pathname = decodeURIComponent(url.pathname).replace(/\/+/g, "/");
    if (pathname.endsWith("/")) pathname += "index.html";
    return pathname;
  }

  function pageUrl(page) {
    return new URL(page.href, docsBase);
  }

  function currentPage() {
    const path = canonicalPath(globalThis.location.href);
    return pages.find((page) => canonicalPath(pageUrl(page)) === path) ?? null;
  }

  function slugify(value, fallback) {
    const slug = value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return slug || fallback;
  }

  function pageSections(main) {
    const headings = [...main.querySelectorAll("h2")].filter((heading) =>
      !heading.closest(".learning-tree") &&
      !heading.closest(".book-page-turn") &&
      heading.textContent.trim()
    );
    const used = new Set([...document.querySelectorAll("[id]")].map((node) => node.id));

    return headings.map((heading, index) => {
      const section = heading.closest("section[id]");
      let id = heading.id || section?.id || slugify(heading.textContent, `section-${index + 1}`);
      if (!heading.id && !section?.id) {
        const base = id;
        let suffix = 2;
        while (used.has(id)) {
          id = `${base}-${suffix}`;
          suffix += 1;
        }
        heading.id = id;
        used.add(id);
      }
      return {
        id,
        heading,
        target: section?.id === id ? section : heading,
        title: heading.textContent.trim(),
      };
    });
  }

  function progressFor(topicId) {
    const progress = globalThis.EmbeddedProgress;
    if (!progress || !topicId) return null;
    return progress.getTopic(topicId);
  }

  function updateProgress(sidebar) {
    const progress = globalThis.EmbeddedProgress;
    const summaryNode = sidebar.querySelector("[data-book-course-progress]");
    if (progress && summaryNode) {
      const summary = progress.summary();
      summaryNode.textContent = `${summary.completed}/${summary.totalTopics} checkpoints complete`;
    }

    sidebar.querySelectorAll("[data-book-topic]").forEach((badge) => {
      const topic = progressFor(badge.dataset.bookTopic);
      if (!topic) {
        badge.textContent = "";
        badge.hidden = true;
        return;
      }

      badge.hidden = false;
      if (topic.completedEver) {
        badge.className = "book-nav-progress complete";
        badge.textContent = `✓ ${topic.best}/${topic.total}`;
      } else if (topic.answered > 0) {
        badge.className = "book-nav-progress active";
        badge.textContent = `${topic.answered}/${topic.total}`;
      } else {
        badge.className = "book-nav-progress";
        badge.textContent = "Not started";
      }
    });
  }

  function buildSidebar(main, activePage) {
    const sidebar = element("aside", "book-sidebar");
    sidebar.id = "book-sidebar";
    sidebar.setAttribute("aria-label", "Systems engineering book chapters");

    const intro = element("div", "book-sidebar-intro");
    intro.append(
      element("strong", "", "Systems Engineering"),
      element("span", "", "A practical study book · 9 chapters"),
      element("span", "book-course-progress", ""),
    );
    intro.lastElementChild.dataset.bookCourseProgress = "";
    sidebar.appendChild(intro);

    const searchLabel = element("label", "visually-hidden", "Filter chapters");
    searchLabel.htmlFor = "book-nav-filter";
    const search = document.createElement("input");
    search.id = "book-nav-filter";
    search.className = "book-nav-filter";
    search.type = "search";
    search.placeholder = "Filter chapters";
    search.autocomplete = "off";
    sidebar.append(searchLabel, search);

    for (const chapter of chapters) {
      const group = element("section", "book-nav-group");
      group.dataset.bookNavGroup = "";
      const title = element("h2", "book-nav-group-title", chapter.title);
      const list = element("ol", "book-nav-list");

      for (const page of chapter.pages) {
        const item = document.createElement("li");
        item.dataset.bookFilterText = `${page.code} ${page.title}`.toLowerCase();
        const link = element("a", "book-nav-link");
        link.href = pageUrl(page).href;
        if (page === activePage) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
        link.append(
          element("span", "book-nav-code", page.code),
          element("span", "book-nav-title", page.title),
        );
        if (page.topic) {
          const progress = element("span", "book-nav-progress");
          progress.dataset.bookTopic = page.topic;
          link.appendChild(progress);
        }
        item.appendChild(link);
        list.appendChild(item);
      }

      group.append(title, list);
      sidebar.appendChild(group);
    }

    const sections = pageSections(main);
    if (sections.length) {
      const group = element("section", "book-nav-group book-on-page");
      group.dataset.bookNavGroup = "";
      group.appendChild(element("h2", "book-nav-group-title", "On this page"));
      const list = element("ol", "book-nav-list book-section-list");
      for (const section of sections) {
        const item = document.createElement("li");
        item.dataset.bookFilterText = section.title.toLowerCase();
        const link = element("a", "book-section-link", section.title);
        link.href = `#${encodeURIComponent(section.id)}`;
        link.dataset.bookSection = section.id;
        item.appendChild(link);
        list.appendChild(item);
      }
      group.appendChild(list);
      sidebar.appendChild(group);
    }

    const repository = element("a", "book-repository-link", "View repository ↗");
    repository.href = "https://github.com/buicongnguyen/Outlier_systems";
    repository.target = "_blank";
    repository.rel = "noopener";
    sidebar.appendChild(repository);

    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      sidebar.querySelectorAll("[data-book-filter-text]").forEach((item) => {
        item.hidden = query !== "" && !item.dataset.bookFilterText.includes(query);
      });
      sidebar.querySelectorAll("[data-book-nav-group]").forEach((group) => {
        group.hidden = !group.querySelector("li:not([hidden])");
      });
    });

    return { sections, sidebar };
  }

  function addPageTurn(main, activePage) {
    if (!activePage || main.querySelector(".page-next, .book-page-turn")) return;
    const index = pages.indexOf(activePage);
    const previous = pages[index - 1] ?? null;
    const next = pages[index + 1] ?? null;
    if (!previous && !next) return;

    const navigation = element("nav", "book-page-turn");
    navigation.setAttribute("aria-label", "Previous and next chapters");

    const addLink = (page, direction) => {
      if (!page) {
        navigation.appendChild(element("span", "book-page-turn-spacer"));
        return;
      }
      const link = element("a", `book-page-turn-link ${direction}`);
      link.href = pageUrl(page).href;
      link.append(
        element("span", "", direction === "previous" ? "← Previous chapter" : "Next chapter →"),
        element("strong", "", page.title),
      );
      navigation.appendChild(link);
    };

    addLink(previous, "previous");
    addLink(next, "next");
    main.appendChild(navigation);
  }

  function initialize() {
    if (document.body.classList.contains("book-ready")) return;
    const header = document.querySelector(".topbar");
    const main = document.getElementById("main");
    if (!header || !main) return;

    const activePage = currentPage();
    const titleBlock = header.querySelector(":scope > div");
    titleBlock?.classList.add("book-current-title");
    const pageTitle = titleBlock?.querySelector("h1");
    if (pageTitle) {
      const headerTitle = element("span", "book-header-page-title", pageTitle.textContent.trim());
      titleBlock.appendChild(headerTitle);

      const chapter = chapters.find((candidate) => candidate.pages.includes(activePage));
      const masthead = element("section", "book-page-heading");
      const meta = element(
        "p",
        "book-page-meta",
        activePage ? `Chapter ${activePage.code} · ${chapter?.title ?? "Study guide"}` : "Systems study guide",
      );
      pageTitle.classList.add("book-page-title");
      masthead.append(meta, pageTitle);
      const breadcrumb = main.querySelector(":scope > .breadcrumb");
      if (breadcrumb) breadcrumb.after(masthead);
      else main.prepend(masthead);
    }

    const menu = element("button", "book-menu-button", "☰");
    menu.type = "button";
    menu.setAttribute("aria-controls", "book-sidebar");
    menu.setAttribute("aria-label", "Toggle chapter navigation");

    const brand = element("a", "book-brand");
    brand.href = new URL("index.html", docsBase).href;
    brand.setAttribute("aria-label", "Systems Engineering study book home");
    brand.append(
      element("span", "book-brand-mark", "S→E"),
      element("strong", "book-brand-name", "Systems Engineering"),
    );

    const brandCluster = element("div", "book-brand-cluster");
    brandCluster.append(menu, brand);
    header.prepend(brandCluster);

    const progressBar = element("div", "book-reading-progress");
    progressBar.setAttribute("aria-hidden", "true");
    header.appendChild(progressBar);

    const { sections, sidebar } = buildSidebar(main, activePage);
    const overlay = element("button", "book-sidebar-overlay");
    overlay.type = "button";
    overlay.setAttribute("aria-label", "Close chapter navigation");
    header.after(sidebar, overlay);

    document.body.classList.add("book-ready");
    addPageTurn(main, activePage);
    updateProgress(sidebar);

    const media = globalThis.matchMedia(MOBILE_QUERY);
    const sidebarOpen = () => media.matches
      ? document.body.classList.contains("book-sidebar-open")
      : !document.body.classList.contains("book-sidebar-collapsed");

    const syncMenu = () => {
      const open = sidebarOpen();
      menu.setAttribute("aria-expanded", String(open));
      menu.textContent = open && media.matches ? "×" : "☰";
      sidebar.toggleAttribute("inert", !open);
      sidebar.setAttribute("aria-hidden", String(!open));
    };

    menu.addEventListener("click", () => {
      if (media.matches) {
        document.body.classList.toggle("book-sidebar-open");
      } else {
        document.body.classList.toggle("book-sidebar-collapsed");
      }
      syncMenu();
    });
    overlay.addEventListener("click", () => {
      document.body.classList.remove("book-sidebar-open");
      syncMenu();
      menu.focus();
    });
    sidebar.addEventListener("click", (event) => {
      if (media.matches && event.target instanceof Element && event.target.closest("a")) {
        document.body.classList.remove("book-sidebar-open");
        syncMenu();
      }
    });
    globalThis.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("book-sidebar-open")) {
        document.body.classList.remove("book-sidebar-open");
        menu.focus();
        syncMenu();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (media.matches) document.body.classList.add("book-sidebar-open");
        else document.body.classList.remove("book-sidebar-collapsed");
        syncMenu();
        sidebar.querySelector(".book-nav-filter")?.focus();
      }
    });
    media.addEventListener?.("change", () => {
      document.body.classList.remove("book-sidebar-open");
      syncMenu();
    });

    let frame = 0;
    const updateScrollState = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - globalThis.innerHeight;
      const percent = scrollable > 0 ? Math.min(100, Math.max(0, globalThis.scrollY / scrollable * 100)) : 0;
      progressBar.style.width = `${percent}%`;

      if (!sections.length) return;
      const threshold = header.getBoundingClientRect().height + 28;
      let active = sections[0];
      for (const section of sections) {
        if (section.target.getBoundingClientRect().top <= threshold) active = section;
        else break;
      }
      sidebar.querySelectorAll("[data-book-section]").forEach((link) => {
        const current = link.dataset.bookSection === active.id;
        link.classList.toggle("active", current);
        if (current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const requestScrollUpdate = () => {
      if (!frame) frame = globalThis.requestAnimationFrame(updateScrollState);
    };
    globalThis.addEventListener("scroll", requestScrollUpdate, { passive: true });
    globalThis.addEventListener("resize", requestScrollUpdate);
    updateScrollState();
    syncMenu();

    globalThis.addEventListener("embedded-progress-change", () => updateProgress(sidebar));
    globalThis.addEventListener("storage", (event) => {
      if (event.key === PROGRESS_KEY || event.key === null) updateProgress(sidebar);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
