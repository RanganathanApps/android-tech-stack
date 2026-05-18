import fs from "node:fs";
import path from "node:path";

const contentPath = path.join(process.cwd(), "data", "content.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

const skippedSectionIds = new Set([
  "kotlin-coroutines-flow",
  "philipp-lackner-youtube-watchlist",
  "philipp-lackner-playlist-golden-data",
]);

const headingOrder = [
  "Production Decision Guide",
  "Senior Trade-Offs",
  "Interview Framing",
  "Practice Prompt",
];
const managedHeadings = new Set(headingOrder);

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function pointKey(value) {
  return normalizeText(value).toLowerCase().replace(/[.!?]+$/g, "");
}

function sentenceCase(value) {
  const text = normalizeText(value);
  if (!text) return "";
  return text[0].toUpperCase() + text.slice(1);
}

function trimSentence(value, maxLength = 220) {
  const text = normalizeText(value).replace(/\s*Example:\s*$/i, "");
  if (text.length <= maxLength) return text;

  const clipped = text.slice(0, maxLength);
  const boundary = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf(";"), clipped.lastIndexOf(","));
  return `${clipped.slice(0, boundary > 80 ? boundary : maxLength).trim()}...`;
}

function stripTerminal(value) {
  return normalizeText(value).replace(/[.!?]+$/g, "");
}

function lowerLead(value) {
  const text = normalizeText(value);
  if (!text) return "";
  if (/^[A-Z]{2}|^[A-Z][a-z]*[A-Z]/.test(text)) return text;
  return text[0].toLowerCase() + text.slice(1);
}

function cleanHeading(value) {
  return normalizeText(value || "Core concept");
}

function conceptLabel(summary, fallback) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "when",
    "where",
    "should",
    "would",
    "could",
    "your",
    "they",
    "their",
    "app",
    "apps",
    "android",
  ]);
  const words = normalizeText(summary)
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word.toLowerCase()));

  const selected = words.slice(0, 4).join(" ");
  return selected || fallback;
}

function displayHeading(heading, topicTitle, summary = "") {
  const clean = cleanHeading(heading);
  const title = normalizeText(topicTitle || "topic");

  if (/senior deep dive expansion/i.test(clean)) return `${title} production rules`;
  if (/focused senior boost/i.test(clean)) return `${title} senior focus`;
  if (/structured highlights|highlights/i.test(clean)) return `${title} essentials`;
  if (/golden takeaways/i.test(clean)) return `${title} takeaways`;
  return clean;
}

function existingPointKeys(topic) {
  const keys = new Set();

  for (const contentSection of topic.content_sections || []) {
    if (managedHeadings.has(contentSection.heading)) continue;

    for (const point of contentSection.points || []) {
      const key = pointKey(point);
      if (key) keys.add(key);
    }
    for (const subtopic of contentSection.subtopics || []) {
      const key = pointKey(`${subtopic.title}: ${subtopic.description}`);
      if (key) keys.add(key);
    }
  }

  return keys;
}

function firstUsefulPoint(contentSection) {
  const point = (contentSection.points || []).find((item) => {
    const text = normalizeText(item);
    return text && !/^example:?$/i.test(text);
  });

  if (point) return trimSentence(point);

  const subtopic = (contentSection.subtopics || []).find((item) => normalizeText(item.title) || normalizeText(item.description));
  if (!subtopic) return "";

  const title = normalizeText(subtopic.title);
  const description = normalizeText(subtopic.description);
  if (title && description) return trimSentence(`${title}: ${description}`);
  return trimSentence(title || description);
}

function collectSourceSections(topic) {
  return (topic.content_sections || [])
    .filter((contentSection) => !managedHeadings.has(contentSection.heading))
    .map((contentSection) => {
      const summary = firstUsefulPoint(contentSection);
      return {
        heading: displayHeading(contentSection.heading, topic.title, summary),
        summary,
        pointCount: (contentSection.points || []).length,
        subtopicCount: (contentSection.subtopics || []).length,
      };
    })
    .filter((item) => item.summary || item.heading)
    .slice(0, 8);
}

function fallbackSources(topic) {
  const description = trimSentence(topic.description || "");
  return [
    {
      heading: cleanHeading(topic.title),
      summary: description || `${normalizeText(topic.title)} needs a clear owner, boundary, and verification path.`,
      pointCount: 0,
      subtopicCount: 0,
    },
  ];
}

function joinHeadings(items, limit = 4) {
  return items
    .slice(0, limit)
    .map((item) => item.heading)
    .filter(Boolean)
    .join(" -> ");
}

function codeTitles(topic) {
  return (topic.code_blocks || [])
    .map((block) => normalizeText(block.title))
    .filter(Boolean)
    .slice(0, 3);
}

function addUnique(points, seen, point) {
  const clean = sentenceCase(point);
  const key = pointKey(clean);
  if (!key || seen.has(key)) return;

  seen.add(key);
  points.push(clean);
}

function buildDetails(section, topic) {
  const title = normalizeText(topic.title || "this topic");
  const sectionTitle = normalizeText(section.title || "this section");
  const sources = collectSourceSections(topic);
  const sourceItems = sources.length ? sources : fallbackSources(topic);
  const [primary, secondary, tertiary, quaternary] = sourceItems;
  const codes = codeTitles(topic);
  const path = joinHeadings(sourceItems);
  const description = trimSentence(topic.description || "");

  const production = [];
  const tradeoffs = [];
  const interview = [];
  const practice = [];
  const productionSeen = new Set();
  const tradeoffSeen = new Set();
  const interviewSeen = new Set();
  const practiceSeen = new Set();

  addUnique(
    production,
    productionSeen,
    `Decision anchor: model ${title} around ${primary.heading}, especially ${lowerLead(primary.summary || description)}.`,
  );

  if (secondary) {
    addUnique(
      production,
      productionSeen,
      `Implementation boundary: ${secondary.heading} should answer how the app handles "${stripTerminal(secondary.summary)}".`,
    );
  }

  if (tertiary) {
    addUnique(
      production,
      productionSeen,
      `Design review check: include ${tertiary.heading} because ${lowerLead(stripTerminal(tertiary.summary))}.`,
    );
  }

  if (codes.length) {
    addUnique(
      production,
      productionSeen,
      `Reference implementation: use ${codes[0]} to validate the shape of ${title} before extracting a reusable pattern.`,
    );
  }

  if (description) {
    addUnique(
      production,
      productionSeen,
      `Use the topic description as the acceptance frame: ${description}`,
    );
  }

  addUnique(
    tradeoffs,
    tradeoffSeen,
    `${primary.heading}: decide whether "${stripTerminal(primary.summary)}" is a hard correctness rule or only guidance for the current feature.`,
  );

  if (secondary) {
    addUnique(
      tradeoffs,
      tradeoffSeen,
      `${secondary.heading}: compare the safer implementation against a lighter version before applying the same pattern across multiple screens or modules.`,
    );
  }

  if (tertiary) {
    addUnique(
      tradeoffs,
      tradeoffSeen,
      `${tertiary.heading}: explain what breaks when "${stripTerminal(tertiary.summary)}" is ignored, then decide which tests or metrics should catch it.`,
    );
  }

  if (quaternary) {
    addUnique(
      tradeoffs,
      tradeoffSeen,
      `${quaternary.heading}: decide how this part of ${title} is surfaced to users, retried, tested, and observed after release.`,
    );
  }

  if (codes.length > 1) {
    addUnique(
      tradeoffs,
      tradeoffSeen,
      `Compare ${codes[0]} with ${codes[1]}: the difference should explain whether ${title} needs a small local fix or a reusable pattern.`,
    );
  }

  addUnique(
    interview,
    interviewSeen,
    `Opening path for ${title}: ${path || primary.heading}. Use that order to move from concept to production behavior.`,
  );

  addUnique(
    interview,
    interviewSeen,
    `First example: ${primary.heading} - ${primary.summary}. Follow it with the lifecycle, ownership, or failure boundary that makes the example safe.`,
  );

  if (secondary && tertiary) {
    addUnique(
      interview,
      interviewSeen,
      `Follow-up depth: compare ${secondary.heading} with ${tertiary.heading}, then state how you would test both paths.`,
    );
  } else if (secondary) {
    addUnique(
      interview,
      interviewSeen,
      `Follow-up depth: use ${secondary.heading} to explain how "${stripTerminal(secondary.summary)}" changes the production design.`,
    );
  }

  if (codes.length) {
    addUnique(
      interview,
      interviewSeen,
      `If asked for code, walk through ${codes.join(" and ")} and name the assumption each example makes about ${title}.`,
    );
  }

  addUnique(
    practice,
    practiceSeen,
    `Feature exercise: build or review a small flow that proves ${primary.heading} works as described by "${stripTerminal(primary.summary)}".`,
  );

  if (secondary) {
    addUnique(
      practice,
      practiceSeen,
      `Failure drill: break the ${secondary.heading} assumption "${stripTerminal(secondary.summary)}" and document the recovery path for ${title}.`,
    );
  }

  if (tertiary) {
    addUnique(
      practice,
      practiceSeen,
      `Review drill: write three questions for ${tertiary.heading}; each one should expose a bug that the happy path would miss.`,
    );
  }

  if (codes.length) {
    addUnique(
      practice,
      practiceSeen,
      `Modify ${codes[0]} for a second use case, then note what stayed stable and what had to change for ${title}.`,
    );
  }

  return {
    "Production Decision Guide": production,
    "Senior Trade-Offs": tradeoffs,
    "Interview Framing": interview,
    "Practice Prompt": practice,
  };
}

function upsertDetailSection(topic, heading, points, seenKeys) {
  topic.content_sections = (topic.content_sections || []).filter((contentSection) => contentSection.heading !== heading);
  const uniquePoints = [];

  for (const point of points) {
    const key = pointKey(point);
    if (!key || seenKeys.has(key)) continue;

    seenKeys.add(key);
    uniquePoints.push(point);
  }

  if (uniquePoints.length) {
    topic.content_sections.push({ heading, points: uniquePoints, subtopics: [] });
  }
}

let enrichedTopics = 0;
let updatedSections = 0;
let writtenPoints = 0;

for (const section of content) {
  if (skippedSectionIds.has(section.id)) continue;

  for (const topic of section.topics || []) {
    const title = normalizeText(topic.title);
    if (!title) continue;

    const details = buildDetails(section, topic);
    const seenKeys = existingPointKeys(topic);
    const beforeSections = (topic.content_sections || []).length;
    const beforePoints = (topic.content_sections || []).reduce(
      (total, contentSection) => total + (contentSection.points || []).length,
      0,
    );

    for (const heading of headingOrder) {
      upsertDetailSection(topic, heading, details[heading], seenKeys);
    }

    const afterSections = (topic.content_sections || []).length;
    const afterPoints = (topic.content_sections || []).reduce(
      (total, contentSection) => total + (contentSection.points || []).length,
      0,
    );

    if (afterPoints !== beforePoints || afterSections !== beforeSections) enrichedTopics += 1;
    updatedSections += headingOrder.filter((heading) =>
      (topic.content_sections || []).some((contentSection) => contentSection.heading === heading),
    ).length;
    writtenPoints += Object.values(details).reduce((total, points) => total + points.length, 0);
  }
}

fs.writeFileSync(contentPath, `${JSON.stringify(content, null, 2)}\n`);
console.log(JSON.stringify({ enrichedTopics, updatedSections, writtenPoints }, null, 2));
