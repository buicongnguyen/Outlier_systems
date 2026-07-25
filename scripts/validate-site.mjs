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
        if (!Array.isArray(question.options) || question.options.length < 2) fail(`${label}: too few options`);
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
        return;
      }

      if (!Array.isArray(question.options) || question.options.length < 2) {
        fail(`${label}: too few options`);
        return;
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

try {
  validateQuizSet("mainQuiz", loadMainQuizzes(), ["db", "os", "dist", "net", "infra"], 20, true);
  validateQuizSet(
    "embeddedQuiz",
    loadEmbeddedQuizzes(),
    ["rtos", "boot", "startup", "datapath", "endtoend"],
    5,
    false,
  );
} catch (error) {
  fail(`quiz data could not be loaded: ${error.message}`);
}

if (failures.length) {
  console.error(`Site validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Site validation passed: ${htmlFiles.length} HTML pages, ` +
    `${walk(docsRoot, ".js").length} JavaScript files, 125 quiz questions.`,
  );
}
