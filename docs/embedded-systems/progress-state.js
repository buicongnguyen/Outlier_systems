(() => {
  "use strict";

  const STORAGE_KEY = "embedded-learning-progress-v1";
  const VERSION = 1;
  const DEFAULT_TOTAL = 5;
  const TOPICS = Object.freeze([
    Object.freeze({ id: "rtos", title: "RTOS & scheduling", href: "rtos.html" }),
    Object.freeze({ id: "boot", title: "Boot & trust chain", href: "boot-chain.html" }),
    Object.freeze({ id: "startup", title: "Host + NPU startup", href: "host-npu-startup.html" }),
    Object.freeze({ id: "datapath", title: "Driver & data path", href: "npu-data-path.html" }),
    Object.freeze({ id: "endtoend", title: "First inference capstone", href: "end-to-end.html" }),
  ]);
  const topicIds = new Set(TOPICS.map((topic) => topic.id));
  let memoryState = { version: VERSION, topics: {} };
  let memoryOnly = false;

  function storage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  function emptyState() {
    return { version: VERSION, topics: {} };
  }

  function emptyTopic(total = DEFAULT_TOTAL) {
    return {
      total,
      best: null,
      attempts: 0,
      current: { answers: {} },
    };
  }

  function normalizeTopic(candidate) {
    const total = Number.isInteger(candidate?.total) && candidate.total > 0
      ? candidate.total
      : DEFAULT_TOTAL;
    const topic = emptyTopic(total);

    if (Number.isInteger(candidate?.best)) {
      topic.best = Math.max(0, Math.min(total, candidate.best));
    }
    if (Number.isInteger(candidate?.attempts) && candidate.attempts > 0) {
      topic.attempts = candidate.attempts;
    }

    const answers = candidate?.current?.answers;
    if (answers && typeof answers === "object") {
      for (const [rawIndex, answer] of Object.entries(answers)) {
        const index = Number(rawIndex);
        if (
          Number.isInteger(index) &&
          index >= 0 &&
          index < total &&
          Number.isInteger(answer?.selected) &&
          answer.selected >= 0 &&
          answer.selected < 4 &&
          typeof answer?.correct === "boolean"
        ) {
          topic.current.answers[String(index)] = {
            selected: answer.selected,
            correct: answer.correct,
          };
        }
      }
    }

    const savedAnswers = Object.values(topic.current.answers);
    if (savedAnswers.length === total) {
      const score = savedAnswers.filter((answer) => answer.correct).length;
      topic.best = topic.best === null ? score : Math.max(topic.best, score);
      if (topic.attempts === 0) topic.attempts = 1;
    } else if (topic.best === null) {
      topic.attempts = 0;
    }

    return topic;
  }

  function read() {
    const store = storage();
    if (!store || memoryOnly) return structuredCloneSafe(memoryState);

    let stored;
    try {
      stored = store.getItem(STORAGE_KEY);
    } catch {
      return structuredCloneSafe(memoryState);
    }

    if (stored === null) {
      memoryState = emptyState();
      return structuredCloneSafe(memoryState);
    }

    try {
      const parsed = JSON.parse(stored);
      const state = emptyState();
      if (
        !parsed ||
        typeof parsed !== "object" ||
        parsed.version !== VERSION ||
        !parsed.topics ||
        typeof parsed.topics !== "object"
      ) {
        memoryState = state;
        return structuredCloneSafe(memoryState);
      }

      for (const topic of TOPICS) {
        if (parsed.topics?.[topic.id]) {
          state.topics[topic.id] = normalizeTopic(parsed.topics[topic.id]);
        }
      }
      memoryState = structuredCloneSafe(state);
      return state;
    } catch {
      memoryState = emptyState();
      return structuredCloneSafe(memoryState);
    }
  }

  function write(state) {
    memoryState = structuredCloneSafe(state);
    const store = storage();
    if (!store) {
      memoryOnly = true;
      return false;
    }
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(state));
      memoryOnly = false;
      return true;
    } catch {
      memoryOnly = true;
      return false;
    }
  }

  function snapshot(topicId, state = read()) {
    if (!topicIds.has(topicId)) return null;
    const topic = normalizeTopic(state.topics[topicId]);
    const answers = topic.current.answers;
    const answered = Object.keys(answers).length;
    const currentCorrect = Object.values(answers).filter((answer) => answer.correct).length;
    return {
      ...topic,
      current: { answers: structuredCloneSafe(answers) },
      answered,
      currentCorrect,
      currentComplete: answered === topic.total,
      completedEver: topic.attempts > 0,
    };
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function recordAnswer(topicId, questionIndex, selected, correct, total = DEFAULT_TOTAL) {
    if (
      !topicIds.has(topicId) ||
      !Number.isInteger(questionIndex) ||
      questionIndex < 0 ||
      !Number.isInteger(selected) ||
      selected < 0 ||
      selected >= 4 ||
      typeof correct !== "boolean" ||
      !Number.isInteger(total) ||
      total <= 0 ||
      questionIndex >= total
    ) {
      throw new TypeError("Invalid embedded quiz answer");
    }

    const state = read();
    const topic = normalizeTopic(state.topics[topicId] ?? emptyTopic(total));
    topic.total = total;
    const key = String(questionIndex);
    if (topic.current.answers[key]) return snapshot(topicId, state);

    topic.current.answers[key] = { selected, correct };
    if (Object.keys(topic.current.answers).length === total) {
      const score = Object.values(topic.current.answers).filter((answer) => answer.correct).length;
      topic.best = topic.best === null ? score : Math.max(topic.best, score);
      topic.attempts += 1;
    }

    state.topics[topicId] = topic;
    write(state);
    return snapshot(topicId, state);
  }

  function restartTopic(topicId) {
    if (!topicIds.has(topicId)) throw new TypeError("Unknown embedded quiz topic");
    const state = read();
    const topic = normalizeTopic(state.topics[topicId]);
    topic.current = { answers: {} };
    state.topics[topicId] = topic;
    write(state);
    return snapshot(topicId, state);
  }

  function clearAll() {
    memoryState = emptyState();
    const store = storage();
    if (!store) {
      memoryOnly = true;
      return false;
    }
    try {
      store.removeItem(STORAGE_KEY);
      memoryOnly = false;
      return true;
    } catch {
      memoryOnly = true;
      return false;
    }
  }

  function summary() {
    const state = read();
    const topics = TOPICS.map((definition) => ({
      ...definition,
      ...snapshot(definition.id, state),
    }));
    const completed = topics.filter((topic) => topic.completedEver).length;
    const started = topics.filter((topic) => topic.completedEver || topic.answered > 0).length;
    const bestCorrect = topics.reduce((sum, topic) => sum + (topic.best ?? 0), 0);
    return {
      topics,
      completed,
      started,
      bestCorrect,
      totalTopics: TOPICS.length,
      totalQuestions: topics.reduce((sum, topic) => sum + topic.total, 0),
      percent: Math.round((completed / TOPICS.length) * 100),
    };
  }

  globalThis.EmbeddedProgress = Object.freeze({
    STORAGE_KEY,
    TOPICS,
    getTopic: snapshot,
    recordAnswer,
    restartTopic,
    clearAll,
    summary,
  });
})();
