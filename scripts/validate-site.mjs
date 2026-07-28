import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = path.join(repoRoot, "docs");
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [fullPath] : [];
  });
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}

function attributes(source) {
  const result = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return result;
}

function tags(html) {
  return [...html.matchAll(/<([a-z][\w:-]*)(\s[^<>]*?)?>/gi)].map((match) => ({
    name: match[1].toLowerCase(),
    attrs: attributes(match[2] ?? ""),
  }));
}

function stripQuery(value) {
  return value.split("?")[0];
}

function resolveLocalReference(page, value) {
  const [rawFile, fragment = ""] = stripQuery(value).split("#", 2);
  const target = rawFile
    ? path.resolve(path.dirname(page), decodeURIComponent(rawFile))
    : page;
  return { target, fragment: decodeURIComponent(fragment) };
}

const htmlFiles = walk(docsRoot, ".html");
const parsedPages = new Map();

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const pageTags = tags(html);
  const ids = pageTags.map((tag) => tag.attrs.id).filter(Boolean);
  const idSet = new Set(ids);
  parsedPages.set(path.resolve(file), { html, pageTags, idSet });

  if (!/^<!doctype html>/i.test(html.trimStart())) fail(`${relative(file)}: missing HTML5 doctype`);
  if (!/<html\b[^>]*\blang=["']en["']/i.test(html)) fail(`${relative(file)}: missing lang="en"`);
  if (!/<meta\b[^>]*\bname=["']viewport["']/i.test(html)) fail(`${relative(file)}: missing viewport metadata`);
  if (!/<meta\b[^>]*\bname=["']description["']/i.test(html)) fail(`${relative(file)}: missing description metadata`);
  if ((html.match(/<title\b/gi) ?? []).length !== 1) fail(`${relative(file)}: expected exactly one title`);
  if ((html.match(/<h1\b/gi) ?? []).length !== 1) fail(`${relative(file)}: expected exactly one h1`);
  if ((html.match(/<main\b/gi) ?? []).length !== 1) fail(`${relative(file)}: expected exactly one main landmark`);
  if (!pageTags.some((tag) => tag.name === "main" && tag.attrs.id === "main")) {
    fail(`${relative(file)}: main landmark must use id="main"`);
  }
  const skipLinks = pageTags.filter((tag) =>
    tag.name === "a" && tag.attrs.class?.split(/\s+/).includes("skip-link") && tag.attrs.href === "#main");
  if (skipLinks.length !== 1) fail(`${relative(file)}: expected one skip link to #main`);

  const sharedStylesheets = pageTags.filter((tag) =>
    tag.name === "link" &&
    tag.attrs.rel === "stylesheet" &&
    stripQuery(tag.attrs.href ?? "").endsWith("styles.css"));
  if (sharedStylesheets.length !== 1) {
    fail(`${relative(file)}: expected exactly one shared styles.css link`);
  } else if (!sharedStylesheets[0].attrs.href.endsWith("?v=book-2")) {
    fail(`${relative(file)}: shared styles.css must use the current cache version`);
  }

  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) fail(`${relative(file)}: duplicate IDs: ${[...new Set(duplicateIds)].join(", ")}`);

  for (const tag of pageTags.filter((item) => item.name === "button")) {
    if (tag.attrs.type !== "button") fail(`${relative(file)}: static button missing type="button"`);
  }

  for (const tag of pageTags.filter((item) => item.name === "a" && item.attrs.target === "_blank")) {
    const relTokens = new Set((tag.attrs.rel ?? "").split(/\s+/));
    if (!relTokens.has("noopener")) fail(`${relative(file)}: target="_blank" link missing rel="noopener"`);
  }

  const themeScripts = pageTags.filter((tag) =>
    tag.name === "script" && tag.attrs.src && tag.attrs.src.endsWith("theme-toggle.js"));
  if (themeScripts.length !== 1) {
    fail(`${relative(file)}: expected exactly one theme-toggle.js script, found ${themeScripts.length}`);
  }
  const headSource = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  if (!/<script\b[^>]*\bsrc=["'][^"']*theme-toggle\.js["'][^>]*><\/script>/i.test(headSource)) {
    fail(`${relative(file)}: theme-toggle.js must load in <head> to prevent a saved-theme flash`);
  }
  const bookScripts = pageTags.filter((tag) =>
    tag.name === "script" && tag.attrs.src && tag.attrs.src.endsWith("book-shell.js"));
  if (bookScripts.length !== 1) {
    fail(`${relative(file)}: expected exactly one book-shell.js script, found ${bookScripts.length}`);
  }
  if (!/<script\b[^>]*\bsrc=["'][^"']*book-shell\.js["'][^>]*><\/script>/i.test(headSource)) {
    fail(`${relative(file)}: book-shell.js must load in <head>`);
  }
  if (headSource.indexOf("theme-toggle.js") > headSource.indexOf("book-shell.js")) {
    fail(`${relative(file)}: theme-toggle.js must load before book-shell.js`);
  }
  const progressScripts = pageTags.filter((tag) =>
    tag.name === "script" && tag.attrs.src && tag.attrs.src.endsWith("progress-state.js"));
  if (progressScripts.length !== 1) {
    fail(`${relative(file)}: expected exactly one progress-state.js script, found ${progressScripts.length}`);
  }

  const pageName = relative(file);
  if (pageName.startsWith("docs/embedded-systems/")) {
    const scriptSources = pageTags
      .filter((tag) => tag.name === "script" && tag.attrs.src)
      .map((tag) => tag.attrs.src);
    const required = ["progress-state.js", "learning-progress.js"];
    for (const source of required) {
      if (scriptSources.filter((item) => item === source).length !== 1) {
        fail(`${pageName}: expected exactly one ${source} script`);
      }
    }

    const hasQuiz = pageTags.some((tag) => tag.attrs["data-quiz"]);
    const dashboards = pageTags.filter((tag) => tag.attrs["data-learning-dashboard"] !== undefined);
    const expectedDashboards = pageName === "docs/embedded-systems/index.html" ? 1 : 0;
    if (dashboards.length !== expectedDashboards) {
      fail(`${pageName}: expected ${expectedDashboards} learning progress dashboard(s)`);
    }
    const quizCount = scriptSources.filter((source) => source === "quiz.js").length;
    if (quizCount !== (hasQuiz ? 1 : 0)) {
      fail(`${pageName}: quiz.js inclusion does not match the page quiz shell`);
    }

    const stateIndex = scriptSources.indexOf("progress-state.js");
    const uiIndex = scriptSources.indexOf("learning-progress.js");
    const quizIndex = scriptSources.indexOf("quiz.js");
    if (stateIndex > uiIndex || (hasQuiz && uiIndex > quizIndex)) {
      fail(`${pageName}: embedded progress scripts are in the wrong dependency order`);
    }
  }

  const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  inlineScripts.forEach((match, index) => {
    try {
      new vm.Script(match[1], { filename: `${relative(file)}#inline-${index + 1}` });
    } catch (error) {
      fail(`${relative(file)}: inline script ${index + 1} does not parse: ${error.message}`);
    }
  });
}

for (const [file, page] of parsedPages) {
  for (const tag of page.pageTags) {
    const references = [];
    if (tag.attrs.href) references.push(tag.attrs.href);
    if (tag.attrs.src) references.push(tag.attrs.src);

    for (const reference of references) {
      if (/^(?:[a-z]+:)?\/\//i.test(reference)) continue;
      if (/^(?:mailto:|tel:|data:|javascript:)/i.test(reference)) continue;
      if (reference.startsWith("/")) {
        fail(`${relative(file)}: root-relative reference is unsafe for a GitHub project page: ${reference}`);
        continue;
      }

      const { target, fragment } = resolveLocalReference(file, reference);
      if (!fs.existsSync(target)) {
        fail(`${relative(file)}: missing local target ${reference}`);
        continue;
      }

      if (fragment && path.extname(target).toLowerCase() === ".html") {
        const targetPage = parsedPages.get(path.resolve(target));
        if (!targetPage?.idSet.has(fragment)) {
          fail(`${relative(file)}: missing fragment #${fragment} in ${relative(target)}`);
        }
      }
    }
  }
}

for (const file of walk(docsRoot, ".js")) {
  try {
    new vm.Script(fs.readFileSync(file, "utf8"), { filename: relative(file) });
  } catch (error) {
    fail(`${relative(file)}: JavaScript does not parse: ${error.message}`);
  }
}

function loadMainQuizzes() {
  const source = fs.readFileSync(path.join(docsRoot, "quiz-data.js"), "utf8");
  const context = {};
  vm.runInNewContext(`${source}\nglobalThis.__quizData = quizData;`, context);
  return context.__quizData;
}

function loadEmbeddedQuizzes() {
  const source = fs.readFileSync(path.join(docsRoot, "embedded-systems", "quiz.js"), "utf8");
  const marker = "  function createQuestion";
  const end = source.indexOf(marker);
  if (end < 0) throw new Error("could not locate embedded quiz data boundary");
  const context = {};
  vm.runInNewContext(`${source.slice(0, end)}  globalThis.__quizData = quizzes;\n})();`, context);
  return context.__quizData;
}

function validateQuizSet(name, quizzes, expectedKeys, expectedPerSection, mainFormat) {
  const keys = Object.keys(quizzes);
  if (keys.join(",") !== expectedKeys.join(",")) {
    fail(`${name}: expected sections ${expectedKeys.join(", ")}, found ${keys.join(", ")}`);
  }

  for (const key of expectedKeys) {
    const questions = quizzes[key];
    if (!Array.isArray(questions) || questions.length !== expectedPerSection) {
      fail(`${name}.${key}: expected ${expectedPerSection} questions`);
      continue;
    }

    questions.forEach((question, index) => {
      const label = `${name}.${key}[${index}]`;
      if (typeof question.q !== "string" || !question.q.trim()) fail(`${label}: missing question`);
      if (typeof question.explain !== "string" || !question.explain.trim()) fail(`${label}: missing explanation`);

      if (!mainFormat) {
        if (!Array.isArray(question.options) || question.options.length !== 4) {
          fail(`${label}: embedded MCQ must have exactly four options`);
        }
        if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) {
          fail(`${label}: answer index is out of range`);
        }
        if (new Set(question.options).size !== question.options.length) fail(`${label}: duplicate options`);
        return;
      }

      const type = question.type ?? "single";
      if (type === "order") {
        if (!Array.isArray(question.steps) || question.steps.length < 2) fail(`${label}: order question needs steps`);
        if (new Set(question.steps).size !== question.steps.length) fail(`${label}: duplicate ordering steps`);
        if (question.steps?.some((step) => typeof step !== "string" || !step.trim())) {
          fail(`${label}: ordering steps must be non-empty strings`);
        }
        return;
      }

      if (!Array.isArray(question.options) || question.options.length < 2) {
        fail(`${label}: too few options`);
        return;
      }
      if (question.options.some((option) =>
        !Array.isArray(option) ||
        typeof option[0] !== "string" ||
        !option[0].trim() ||
        typeof option[1] !== "boolean"
      )) {
        fail(`${label}: each option must contain non-empty text and a boolean answer flag`);
      }
      const answerFlags = question.options.map((option) => Array.isArray(option) && option[1] === true);
      if (type === "multi") {
        if (!answerFlags.some(Boolean) || answerFlags.every(Boolean)) fail(`${label}: multi-select needs a mixed answer set`);
      } else if (answerFlags.filter(Boolean).length !== 1) {
        fail(`${label}: single/code question needs exactly one correct option`);
      }
    });
  }
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function contrastRatio(first, second) {
  function luminance(hex) {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function validateProgressState() {
  const source = fs.readFileSync(
    path.join(docsRoot, "embedded-systems", "progress-state.js"),
    "utf8",
  );
  const localStorage = createMemoryStorage();
  const context = { localStorage };
  vm.runInNewContext(source, context);
  const progress = context.EmbeddedProgress;

  if (!progress || progress.TOPICS.length !== 5) {
    fail("embeddedProgress: expected five topic definitions");
    return;
  }

  let summary = progress.summary();
  if (summary.started !== 0 || summary.completed !== 0 || summary.percent !== 0) {
    fail("embeddedProgress: fresh state should have no started or completed topics");
  }

  progress.recordAnswer("rtos", 0, 1, true, 5);
  progress.recordAnswer("rtos", 0, 0, false, 5);
  let topic = progress.getTopic("rtos");
  if (topic.answered !== 1 || topic.currentCorrect !== 1) {
    fail("embeddedProgress: duplicate answers must not replace the first saved answer");
  }

  for (let index = 1; index < 5; index += 1) {
    progress.recordAnswer("rtos", index, 1, index < 4, 5);
  }
  topic = progress.getTopic("rtos");
  if (!topic.currentComplete || !topic.completedEver || topic.best !== 4 || topic.attempts !== 1) {
    fail("embeddedProgress: completing an attempt should save its score and attempt count");
  }

  progress.restartTopic("rtos");
  topic = progress.getTopic("rtos");
  if (topic.answered !== 0 || topic.best !== 4 || !topic.completedEver) {
    fail("embeddedProgress: restarting should clear current answers but preserve the best score");
  }

  for (let index = 0; index < 5; index += 1) {
    progress.recordAnswer("rtos", index, 0, false, 5);
  }
  topic = progress.getTopic("rtos");
  if (topic.best !== 4 || topic.attempts !== 2) {
    fail("embeddedProgress: a lower retry score must not replace the best score");
  }

  progress.recordAnswer("boot", 0, 1, true, 5);
  summary = progress.summary();
  if (summary.started !== 2 || summary.completed !== 1 || summary.bestCorrect !== 4) {
    fail("embeddedProgress: aggregate summary is inconsistent");
  }

  let rejectedInvalidAnswer = false;
  try {
    progress.recordAnswer("unknown", 0, 0, true, 5);
  } catch {
    rejectedInvalidAnswer = true;
  }
  if (!rejectedInvalidAnswer) fail("embeddedProgress: invalid topic answers must be rejected");

  let rejectedInvalidOption = false;
  try {
    progress.recordAnswer("boot", 1, 4, true, 5);
  } catch {
    rejectedInvalidOption = true;
  }
  if (!rejectedInvalidOption) fail("embeddedProgress: invalid option indexes must be rejected");

  localStorage.removeItem(progress.STORAGE_KEY);
  summary = progress.summary();
  if (summary.started !== 0 || summary.completed !== 0) {
    fail("embeddedProgress: storage changes from another tab should replace stale in-memory state");
  }

  progress.recordAnswer("boot", 0, 1, true, 5);
  const reloadedContext = { localStorage };
  vm.runInNewContext(source, reloadedContext);
  if (reloadedContext.EmbeddedProgress.getTopic("boot").answered !== 1) {
    fail("embeddedProgress: a new page load should recover persisted answers");
  }

  localStorage.setItem(progress.STORAGE_KEY, JSON.stringify({
    version: 999,
    topics: { boot: { total: 5, best: 5, attempts: 1, current: { answers: {} } } },
  }));
  if (progress.summary().started !== 0) {
    fail("embeddedProgress: incompatible storage schema versions must be ignored");
  }

  progress.recordAnswer("boot", 0, 1, true, 5);
  progress.clearAll();
  if (progress.summary().started !== 0) {
    fail("embeddedProgress: clearing state should remove all saved progress");
  }

  const memoryOnlyContext = {};
  vm.runInNewContext(source, memoryOnlyContext);
  memoryOnlyContext.EmbeddedProgress.recordAnswer("boot", 0, 1, true, 5);
  memoryOnlyContext.EmbeddedProgress.recordAnswer("boot", 1, 1, true, 5);
  if (memoryOnlyContext.EmbeddedProgress.getTopic("boot").answered !== 2) {
    fail("embeddedProgress: quiz state should remain usable when browser storage is unavailable");
  }
}

function validateThemeState() {
  const source = fs.readFileSync(path.join(docsRoot, "theme-toggle.js"), "utf8");

  function loadTheme(initialTheme, prefersLight) {
    let savedTheme = initialTheme;
    const windowListeners = new Map();
    const documentListeners = new Map();
    const documentElement = { dataset: {} };
    const context = {
      localStorage: {
        getItem() {
          return savedTheme;
        },
        setItem(_key, value) {
          savedTheme = value;
        },
      },
      matchMedia() {
        return { matches: prefersLight, addEventListener() {} };
      },
      addEventListener(type, listener) {
        windowListeners.set(type, listener);
      },
      document: {
        documentElement,
        readyState: "loading",
        querySelector() {
          return null;
        },
        addEventListener(type, listener) {
          documentListeners.set(type, listener);
        },
      },
    };
    vm.runInNewContext(source, context);
    return {
      documentElement,
      documentListeners,
      setSavedTheme(value) {
        savedTheme = value;
      },
      windowListeners,
    };
  }

  const systemDefault = loadTheme(null, true);
  if (systemDefault.documentElement.dataset.siteTheme !== "light") {
    fail("themeToggle: first visit should honor the operating-system color preference");
  }
  if (!systemDefault.documentListeners.has("DOMContentLoaded")) {
    fail("themeToggle: loading from <head> must defer button creation until the document is ready");
  }

  const persisted = loadTheme("dark", true);
  if (persisted.documentElement.dataset.siteTheme !== "dark") {
    fail("themeToggle: a saved theme should override the operating-system preference");
  }
  persisted.setSavedTheme("light");
  persisted.windowListeners.get("storage")?.({ key: "site-color-theme" });
  if (persisted.documentElement.dataset.siteTheme !== "light") {
    fail("themeToggle: theme changes from another tab should apply immediately");
  }
}

function validatePageContracts() {
  const systemsFile = path.join(docsRoot, "systems-skills.html");
  const systemsPage = parsedPages.get(path.resolve(systemsFile));
  const quizSections = systemsPage.pageTags
    .filter((tag) => tag.attrs.class?.split(/\s+/).includes("quiz"))
    .map((tag) => tag.attrs["data-section"]);
  if (quizSections.join(",") !== "db,os,dist,net,infra") {
    fail(`docs/systems-skills.html: unexpected quiz section order: ${quizSections.join(",")}`);
  }
  for (const id of ["score-text", "score-note", "toggle-explain", "retry", "sh-play"]) {
    if (!systemsPage.idSet.has(id)) fail(`docs/systems-skills.html: missing interactive control #${id}`);
  }

  const codingFile = path.join(docsRoot, "coding-questions.html");
  const codingPage = parsedPages.get(path.resolve(codingFile));
  const solutionButtons = codingPage.pageTags.filter((tag) =>
    tag.name === "button" && tag.attrs.class?.split(/\s+/).includes("sol-btn"));
  const solutions = codingPage.pageTags.filter((tag) =>
    tag.attrs.class?.split(/\s+/).includes("solution"));
  if (solutionButtons.length !== 12 || solutions.length !== solutionButtons.length) {
    fail("docs/coding-questions.html: expected 12 solution buttons paired with 12 solutions");
  }
  if (!codingPage.idSet.has("toggle-all")) {
    fail("docs/coding-questions.html: missing #toggle-all solution control");
  }

  const styleSources = [
    fs.readFileSync(path.join(docsRoot, "styles.css"), "utf8"),
    fs.readFileSync(path.join(docsRoot, "embedded-systems", "embedded.css"), "utf8"),
    systemsPage.html,
    codingPage.html,
  ];
  const lowContrastAccent = /\{[^{}]*background\s*:\s*var\(--accent\)[^{}]*color\s*:\s*#(?:fff|ffffff)\b[^{}]*\}/i;
  if (styleSources.some((source) => lowContrastAccent.test(source))) {
    fail("site styles: accent-filled controls must use the theme-aware --on-accent color");
  }

  const sharedStyles = styleSources[0];
  for (const theme of ["light", "dark"]) {
    const block = sharedStyles.match(
      new RegExp(`:root\\[data-site-theme="${theme}"\\]\\s*\\{([^}]*)\\}`, "i"),
    )?.[1] ?? "";
    const accent = block.match(/--accent:\s*(#[0-9a-f]{6})/i)?.[1];
    const foreground = block.match(/--on-accent:\s*(#[0-9a-f]{6})/i)?.[1];
    if (!accent || !foreground || contrastRatio(accent, foreground) < 4.5) {
      fail(`site styles: ${theme} accent-filled controls must meet 4.5:1 text contrast`);
    }
  }
}

function validateBookShell() {
  const source = fs.readFileSync(path.join(docsRoot, "book-shell.js"), "utf8");
  const linkedPages = [...source.matchAll(/\bhref:\s*"([^"]+\.html)"/g)].map((match) => match[1]);
  if (linkedPages.length !== 9 || new Set(linkedPages).size !== linkedPages.length) {
    fail(`bookShell: expected nine unique chapter pages, found ${linkedPages.length}`);
  }
  for (const href of linkedPages) {
    const target = path.resolve(docsRoot, href);
    if (!fs.existsSync(target)) fail(`bookShell: missing chapter target ${href}`);
  }

  const styles = fs.readFileSync(path.join(docsRoot, "styles.css"), "utf8");
  for (const contract of [
    "--book-header-height: 64px",
    "--book-sidebar-width: 280px",
    "flex-direction: row",
    ".book-reading-progress",
    ".book-section-link.active",
    "body.book-sidebar-open .book-sidebar",
  ]) {
    if (!styles.includes(contract)) fail(`bookShell: missing style contract ${contract}`);
  }
  for (const contract of [
    'sidebar.toggleAttribute("inert", !open)',
    'sidebar.setAttribute("aria-hidden", String(!open))',
    'menu.setAttribute("aria-expanded", String(open))',
  ]) {
    if (!source.includes(contract)) fail(`bookShell: missing accessibility contract ${contract}`);
  }
}

try {
  validateQuizSet("mainQuiz", loadMainQuizzes(), ["db", "os", "dist", "net", "infra"], 20, true);
  validateQuizSet(
    "embeddedQuiz",
    loadEmbeddedQuizzes(),
    ["rtos", "boot", "startup", "datapath", "endtoend"],
    5,
    false,
  );
  validateProgressState();
  validateThemeState();
  validatePageContracts();
  validateBookShell();
} catch (error) {
  fail(`site data could not be validated: ${error.message}`);
}

if (failures.length) {
  console.error(`Site validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Site validation passed: ${htmlFiles.length} HTML pages, ` +
    `${walk(docsRoot, ".js").length} JavaScript files, 125 quiz questions, ` +
    "persistent progress transitions, and book navigation contracts.",
  );
}
