(function () {
  const words = Array.isArray(window.HAIKU_WORDS) ? window.HAIKU_WORDS : [];
  const linePatterns = {
    5: [[5], [2, 3], [3, 2], [1, 4], [4, 1], [1, 1, 3], [1, 2, 2], [2, 1, 2], [2, 2, 1]],
    7: [[2, 5], [5, 2], [3, 4], [4, 3], [2, 2, 3], [2, 3, 2], [3, 2, 2], [1, 2, 4], [1, 3, 3], [2, 1, 4], [1, 1, 5]]
  };
  const bySyllables = new Map();
  const controls = {
    season: document.getElementById("season"),
    time: document.getElementById("time"),
    mood: document.getElementById("mood"),
    concreteness: document.getElementById("concreteness")
  };

  const poemNode = document.getElementById("poem");
  const generateButton = document.getElementById("generate");
  const datasetSummary = document.getElementById("datasetSummary");
  const metaText = document.getElementById("metaText");
  let lastSignature = "";

  if (!generateButton || !poemNode || !datasetSummary || !metaText) {
    return;
  }

  const moodProfiles = {
    any: {},
    calm: { energy: "low", valence: "neutral", emotion: ["trust", "neutral"], sensory: ["sound", "touch", "visual"] },
    bright: { energy: "high", valence: "positive", emotion: ["joy", "anticipation", "trust"], sensory: ["visual", "temperature", "motion"] },
    dark: { energy: "low", valence: "negative", emotion: ["sadness", "fear"], sensory: ["sound", "visual", "conceptual"] },
    tense: { energy: "high", valence: "negative", emotion: ["anger", "fear", "surprise"], sensory: ["motion", "sound", "temperature"] },
    tender: { energy: "low", valence: "positive", emotion: ["joy", "trust"], sensory: ["touch", "sound", "visual"] }
  };

  for (let syllables = 1; syllables <= 5; syllables += 1) {
    bySyllables.set(syllables, words.filter((word) => word.syllables === syllables));
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function uniqueWords(wordsList) {
    return [...new Set(wordsList.filter(Boolean))];
  }

  function normalizeMoodLabel(moodKey) {
    return moodKey === "any" ? "open" : moodKey;
  }

  function scoreCandidate(word, context) {
    let score = 0;
    const { filters, seed, used } = context;
    const moodProfile = moodProfiles[filters.mood] || {};

    if (filters.season === "any" || word.season === filters.season) {
      score += filters.season === "any" ? 1 : 5;
    }
    if (filters.time === "any" || word.time_of_day === filters.time) {
      score += filters.time === "any" ? 1 : 5;
    }
    if (filters.concreteness === "any" || word.concreteness === filters.concreteness) {
      score += filters.concreteness === "any" ? 1 : 4;
    }

    if (moodProfile.energy && word.energy === moodProfile.energy) {
      score += 4;
    }
    if (moodProfile.valence && word.valence === moodProfile.valence) {
      score += 4;
    }
    if (Array.isArray(moodProfile.emotion) && moodProfile.emotion.includes(word.emotion)) {
      score += 5;
    }
    if (Array.isArray(moodProfile.sensory) && moodProfile.sensory.includes(word.sensory_mode)) {
      score += 2;
    }

    if (word.concreteness === "concrete") {
      score += 2;
    }
    if (word.sensory_mode !== "conceptual") {
      score += 2;
    }
    if (seed) {
      if (word.theme === seed.theme) {
        score += 4;
      }
      if (word.emotion === seed.emotion) {
        score += 3;
      }
      if (word.associations.includes(seed.word) || seed.associations.includes(word.word)) {
        score += 7;
      }
      const sharedAssociations = word.associations.filter((assoc) => seed.associations.includes(assoc)).length;
      score += sharedAssociations * 1.4;
    }

    if (used.has(word.word.toLowerCase())) {
      score -= 20;
    }
    if (word.word.length <= 2) {
      score -= 6;
    }
    if (word.word.endsWith("ly")) {
      score -= 1;
    }

    score += Math.random() * 2;
    return score;
  }

  function pickWord(syllables, context) {
    const pool = bySyllables.get(syllables) || [];
    let best = null;
    let bestScore = -Infinity;

    const sample = shuffle(pool).slice(0, 240);
    for (const word of sample) {
      const score = scoreCandidate(word, context);
      if (score > bestScore) {
        best = word;
        bestScore = score;
      }
    }
    return best;
  }

  function lineToText(wordsList) {
    return wordsList.map((word) => word.word.toLowerCase()).join(" ");
  }

  function scorePoem(lines, context) {
    const wordsList = lines.flat();
    const concreteCount = wordsList.filter((word) => word.concreteness === "concrete").length;
    const sensoryCount = wordsList.filter((word) => word.sensory_mode !== "conceptual").length;
    const sameSeasonCount = wordsList.filter((word) => word.season === context.seed.season).length;
    const sameTimeCount = wordsList.filter((word) => word.time_of_day === context.seed.time_of_day).length;
    const emotionMatches = wordsList.filter((word) => word.emotion === context.seed.emotion).length;
    return Math.round(
      concreteCount * 7 +
      sensoryCount * 6 +
      sameSeasonCount * 4 +
      sameTimeCount * 4 +
      emotionMatches * 5
    );
  }

  function buildLine(target, context) {
    const patterns = shuffle(linePatterns[target]);
    for (const pattern of patterns) {
      const localUsed = new Set(context.used);
      const wordsList = [];
      let failed = false;
      for (const syllables of pattern) {
        const word = pickWord(syllables, { ...context, used: localUsed });
        if (!word) {
          failed = true;
          break;
        }
        wordsList.push(word);
        localUsed.add(word.word.toLowerCase());
      }
      if (!failed) {
        for (const word of wordsList) {
          context.used.add(word.word.toLowerCase());
        }
        return wordsList;
      }
    }
    return null;
  }

  function chooseSeed(filters) {
    const moodProfile = moodProfiles[filters.mood] || {};
    let pool = words.filter((word) => word.syllables >= 1 && word.syllables <= 3);

    pool = pool.filter((word) => {
      if (filters.season !== "any" && word.season !== filters.season) {
        return false;
      }
      if (filters.time !== "any" && word.time_of_day !== filters.time) {
        return false;
      }
      if (filters.concreteness !== "any" && word.concreteness !== filters.concreteness) {
        return false;
      }
      return true;
    });

    if (moodProfile.valence) {
      const matched = pool.filter((word) => word.valence === moodProfile.valence);
      if (matched.length > 250) {
        pool = matched;
      }
    }
    if (moodProfile.energy) {
      const matched = pool.filter((word) => word.energy === moodProfile.energy);
      if (matched.length > 250) {
        pool = matched;
      }
    }
    const concreteBias = pool.filter((word) => word.concreteness === "concrete");
    if (concreteBias.length > 250) {
      pool = concreteBias;
    }
    return randomItem(pool.length ? pool : words);
  }

  function generateHaiku() {
    const filters = {
      season: controls.season.value,
      time: controls.time.value,
      mood: controls.mood.value,
      concreteness: controls.concreteness.value
    };

    let best = null;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const seed = chooseSeed(filters);
      const context = { filters, seed, used: new Set([seed.word.toLowerCase()]) };
      const line1 = buildLine(5, context);
      const line2 = buildLine(7, context);
      const line3 = buildLine(5, context);
      if (!line1 || !line2 || !line3) {
        continue;
      }
      const lines = [line1, line2, line3];
      const score = scorePoem(lines, context);
      if (!best || score > best.score) {
        best = { lines, score, seed, filters };
      }
    }
    return best;
  }

  function signatureForResult(result) {
    if (!result) {
      return "";
    }
    return result.lines.map(lineToText).join(" | ");
  }

  function renderResult(result) {
    if (!result) {
      poemNode.innerHTML = [
        "<div class='poem-line'>generator stalled</div>",
        "<div class='poem-line'>the page listened but found no line</div>",
        "<div class='poem-line'>try a softer filter</div>"
      ].join("");
      lastSignature = "";
      return;
    }

    const lines = result.lines.map(lineToText);
    poemNode.innerHTML = lines.map((line) => `<div class="poem-line">${line}</div>`).join("");
    metaText.textContent = `Generated from ${result.seed.word.toLowerCase()} with ${normalizeMoodLabel(result.filters.mood)} mood bias.`;
    lastSignature = lines.join(" | ");
  }

  function renderFreshResult() {
    metaText.textContent = "Generating...";
    let result = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      result = generateHaiku();
      if (!result) {
        break;
      }
      if (signatureForResult(result) !== lastSignature) {
        break;
      }
    }
    renderResult(result);
  }

  function updateSummary() {
    const concreteCount = words.filter((word) => word.concreteness === "concrete").length;
    const sensoryCount = words.filter((word) => word.sensory_mode !== "conceptual").length;
    datasetSummary.textContent = `${words.length.toLocaleString()} exported words loaded. ${concreteCount.toLocaleString()} concrete words and ${sensoryCount.toLocaleString()} sensory-leaning words are currently eligible for stronger imagery.`;
  }

  generateButton.addEventListener("click", function () {
    renderFreshResult();
  });

  updateSummary();
  renderFreshResult();
})();
