import fs from "node:fs";
import path from "node:path";

const contentPath = path.join(process.cwd(), "data", "content.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const next = [];
  let removed = 0;

  for (const item of items || []) {
    const key = keyFn(item);
    if (key && seen.has(key)) {
      removed += 1;
      continue;
    }
    if (key) seen.add(key);
    next.push(item);
  }

  return { next, removed };
}

function cleanPoints(points = []) {
  return dedupeBy(
    points.map((point) => normalizeText(point)).filter(Boolean),
    (point) => point.toLowerCase(),
  );
}

const report = {
  duplicateSections: 0,
  duplicateTopics: 0,
  duplicateContentSections: 0,
  duplicatePoints: 0,
  duplicateTopicDescriptionPoints: 0,
  migratedKeyPoints: 0,
  skippedDuplicateMigratedKeyPoints: 0,
  removedKeyPointSections: 0,
  duplicateSubtopics: 0,
  duplicateCodeBlocks: 0,
  emptyContentSections: 0,
};

const sectionDedupe = dedupeBy(content, (section) => normalizeText(section.id || section.title).toLowerCase());
report.duplicateSections = sectionDedupe.removed;
const cleanedContent = sectionDedupe.next;

for (const section of cleanedContent) {
  section.title = normalizeText(section.title);
  section.description = normalizeText(section.description);

  const topicDedupe = dedupeBy(section.topics || [], (topic) => normalizeText(topic.title).toLowerCase());
  report.duplicateTopics += topicDedupe.removed;
  section.topics = topicDedupe.next;

  for (const topic of section.topics) {
    topic.title = normalizeText(topic.title);
    topic.description = normalizeText(topic.description);
    const topicDescriptionKey = topic.description.toLowerCase();

    const contentSectionDedupe = dedupeBy(topic.content_sections || [], (contentSection) =>
      normalizeText(contentSection.heading).toLowerCase(),
    );
    report.duplicateContentSections += contentSectionDedupe.removed;
    topic.content_sections = contentSectionDedupe.next;

    for (const contentSection of topic.content_sections) {
      contentSection.heading = normalizeText(contentSection.heading);

      const pointDedupe = cleanPoints(contentSection.points || []);
      report.duplicatePoints += pointDedupe.removed;
      const cleanedPoints = [];

      for (const point of pointDedupe.next) {
        const pointKey = point.toLowerCase();

        if (pointKey && pointKey === topicDescriptionKey) {
          report.duplicateTopicDescriptionPoints += 1;
          continue;
        }

        cleanedPoints.push(point);
      }

      contentSection.points = cleanedPoints;

      const subtopicDedupe = dedupeBy(contentSection.subtopics || [], (subtopic) =>
        `${normalizeText(subtopic.title).toLowerCase()}::${normalizeText(subtopic.description).toLowerCase()}`,
      );
      report.duplicateSubtopics += subtopicDedupe.removed;
      contentSection.subtopics = subtopicDedupe.next.map((subtopic) => ({
        title: normalizeText(subtopic.title),
        description: normalizeText(subtopic.description),
      }));
    }

    const contentSectionsByHeading = new Map();
    const topicPointKeys = new Set();

    for (const contentSection of topic.content_sections) {
      const headingKey = normalizeText(contentSection.heading).toLowerCase();
      if (headingKey && headingKey !== "key points" && !contentSectionsByHeading.has(headingKey)) {
        contentSectionsByHeading.set(headingKey, contentSection);
      }

      for (const point of contentSection.points || []) {
        const pointKey = normalizeText(point).toLowerCase();
        if (pointKey) topicPointKeys.add(pointKey);
      }
    }

    const fallbackContentSection =
      topic.content_sections.find((contentSection) => normalizeText(contentSection.heading).toLowerCase() !== "key points") ||
      null;

    for (const keyPointSection of topic.content_sections.filter(
      (contentSection) => normalizeText(contentSection.heading).toLowerCase() === "key points",
    )) {
      report.removedKeyPointSections += 1;

      for (const point of keyPointSection.points || []) {
        const normalizedPoint = normalizeText(point);
        if (!normalizedPoint) continue;

        const colonIndex = normalizedPoint.indexOf(":");
        const prefixKey = colonIndex > 0 ? normalizeText(normalizedPoint.slice(0, colonIndex)).toLowerCase() : "";
        const targetContentSection = contentSectionsByHeading.get(prefixKey) || fallbackContentSection;
        const pointToAdd = targetContentSection && contentSectionsByHeading.has(prefixKey)
          ? normalizeText(normalizedPoint.slice(colonIndex + 1))
          : normalizedPoint;
        const pointKey = pointToAdd.toLowerCase();

        if (!targetContentSection || !pointKey) continue;

        if (topicPointKeys.has(pointKey)) {
          report.skippedDuplicateMigratedKeyPoints += 1;
          continue;
        }

        targetContentSection.points = [...(targetContentSection.points || []), pointToAdd];
        topicPointKeys.add(pointKey);
        report.migratedKeyPoints += 1;
      }
    }

    topic.content_sections = topic.content_sections.filter(
      (contentSection) => normalizeText(contentSection.heading).toLowerCase() !== "key points",
    );

    const beforeEmpty = topic.content_sections.length;
    topic.content_sections = topic.content_sections.filter(
      (contentSection) => (contentSection.points || []).length || (contentSection.subtopics || []).length,
    );
    report.emptyContentSections += beforeEmpty - topic.content_sections.length;

    const codeDedupe = dedupeBy(topic.code_blocks || [], (block) =>
      `${normalizeText(block.title).toLowerCase()}::${normalizeText(block.language).toLowerCase()}::${normalizeText(block.code)}`,
    );
    report.duplicateCodeBlocks += codeDedupe.removed;
    topic.code_blocks = codeDedupe.next.map((block) => ({
      language: normalizeText(block.language || "text"),
      title: normalizeText(block.title || "Code Example"),
      code: String(block.code || "").trim(),
    }));
  }
}

fs.writeFileSync(contentPath, `${JSON.stringify(cleanedContent, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
