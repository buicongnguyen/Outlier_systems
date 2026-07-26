(() => {
  "use strict";

  const progress = globalThis.EmbeddedProgress;
  if (!progress) return;

  function emitChange() {
    globalThis.dispatchEvent(new CustomEvent("embedded-progress-change"));
  }

  function treeTopicId(href) {
    const filename = href.split("/").pop()?.split(/[?#]/)[0];
    return progress.TOPICS.find((topic) => topic.href === filename)?.id ?? null;
  }

  function renderTree() {
    const summary = progress.summary();
    const byId = new Map(summary.topics.map((topic) => [topic.id, topic]));

    document.querySelectorAll(".learning-tree a[href]").forEach((link) => {
      const topicId = treeTopicId(link.getAttribute("href"));
      if (!topicId) return;
      const topic = byId.get(topicId);
      let badge = link.querySelector(".tree-progress");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "tree-progress";
        link.appendChild(badge);
      }

      if (topic.completedEver) {
        badge.className = "tree-progress complete";
        badge.textContent = `✓ Best ${topic.best}/${topic.total}`;
      } else if (topic.answered > 0) {
        badge.className = "tree-progress active";
        badge.textContent = `${topic.answered}/${topic.total} answered`;
      } else {
        badge.className = "tree-progress";
        badge.textContent = "Not started";
      }
    });
  }

  function topicStatus(topic) {
    if (topic.currentComplete) {
      return `Attempt complete · ${topic.currentCorrect}/${topic.total} correct`;
    }
    if (topic.answered > 0) {
      const best = topic.best === null ? "" : ` · Best ${topic.best}/${topic.total}`;
      return `In progress · ${topic.answered}/${topic.total} answered${best}`;
    }
    if (topic.completedEver) {
      return `Completed · Best ${topic.best}/${topic.total} across ${topic.attempts} ${topic.attempts === 1 ? "attempt" : "attempts"}`;
    }
    return "Not started";
  }

  function topicAction(topic) {
    if (topic.answered > 0 && !topic.currentComplete) return "Continue";
    if (topic.completedEver) return "Review";
    return "Start";
  }

  function renderDashboard() {
    const shell = document.querySelector("[data-learning-dashboard]");
    if (!shell) return;

    const summary = progress.summary();
    const headline = shell.querySelector("[data-progress-headline]");
    const detail = shell.querySelector("[data-progress-detail]");
    const meter = shell.querySelector("progress");
    const grid = shell.querySelector("[data-progress-topics]");
    const clear = shell.querySelector("[data-clear-progress]");

    headline.textContent = `${summary.completed} of ${summary.totalTopics} checkpoints complete`;
    detail.textContent = summary.started === 0
      ? "Start with RTOS or choose the branch that matches your current work."
      : `${summary.percent}% complete · best scores total ${summary.bestCorrect}/${summary.totalQuestions}`;
    meter.value = summary.completed;
    meter.max = summary.totalTopics;
    meter.setAttribute("aria-label", `${summary.completed} of ${summary.totalTopics} checkpoints complete`);
    clear.disabled = summary.started === 0;

    grid.replaceChildren(...summary.topics.map((topic, index) => {
      const card = document.createElement("article");
      card.className = "progress-topic";
      if (topic.completedEver) card.classList.add("complete");
      else if (topic.answered > 0) card.classList.add("active");

      const step = document.createElement("span");
      step.className = "progress-step";
      step.textContent = topic.completedEver ? "✓" : String(index + 1);
      step.setAttribute("aria-hidden", "true");

      const copy = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = topic.title;
      const status = document.createElement("p");
      status.textContent = topicStatus(topic);
      copy.append(title, status);

      const link = document.createElement("a");
      link.href = topic.href;
      link.textContent = topicAction(topic);
      link.setAttribute("aria-label", `${topicAction(topic)} ${topic.title}`);

      card.append(step, copy, link);
      return card;
    }));
  }

  const clearButton = document.querySelector("[data-clear-progress]");
  clearButton?.addEventListener("click", () => {
    const confirmed = globalThis.confirm(
      "Clear all five embedded-systems quiz scores and saved answers from this browser?",
    );
    if (!confirmed) return;
    progress.clearAll();
    renderDashboard();
    renderTree();
    emitChange();
  });

  globalThis.addEventListener("embedded-progress-change", () => {
    renderTree();
    renderDashboard();
  });
  globalThis.addEventListener("storage", (event) => {
    if (event.key === progress.STORAGE_KEY) {
      renderTree();
      renderDashboard();
    }
  });

  renderTree();
  renderDashboard();
})();
