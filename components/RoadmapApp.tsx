"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  estimateSectionDuration,
  getPriorityLabel,
  getSectionPriority,
  getTopicKey,
  normalizeSearchText,
  topicMatchesSearch,
  type Priority,
  type RoadmapSection,
  type RoadmapTopic,
} from "@/lib/content";

type Filter = Priority | "all";

type RoadmapAppProps = {
  initialContent: RoadmapSection[];
};

const progressStorageKey = "modern-android-roadmap-progress";
const themeStorageKey = "modern-android-roadmap-theme";

const themes = {
  light: "theme-light bg-white text-zinc-950",
  dark: "theme-dark bg-[#10211f] text-zinc-950",
};

type Theme = keyof typeof themes;

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All Sections" },
  { id: "must-know", label: "Must Know" },
  { id: "important", label: "Important" },
  { id: "advanced", label: "Advanced" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getCodeLanguage(language?: string) {
  return language || "text";
}

const kotlinKeywords = new Set([
  "as",
  "break",
  "by",
  "catch",
  "class",
  "companion",
  "continue",
  "data",
  "do",
  "else",
  "false",
  "finally",
  "for",
  "fun",
  "if",
  "in",
  "interface",
  "is",
  "null",
  "object",
  "override",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "sealed",
  "suspend",
  "this",
  "throw",
  "true",
  "try",
  "typealias",
  "val",
  "var",
  "when",
  "while",
]);

function isKotlinLanguage(language?: string) {
  return getCodeLanguage(language).toLowerCase() === "kotlin";
}

function highlightKotlinSegment(segment: string, lineIndex: number, segmentKey: string) {
  const tokenPattern = /(@[A-Za-z_][\w.]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
  const nodes = [];
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of segment.matchAll(tokenPattern)) {
    const token = match[0];
    const start = match.index || 0;

    if (start > cursor) {
      nodes.push(segment.slice(cursor, start));
    }

    let className = "";
    if (token.startsWith("@")) {
      className = "kotlin-token-annotation";
    } else if (token.startsWith("\"") || token.startsWith("'")) {
      className = "kotlin-token-string";
    } else if (/^\d/.test(token)) {
      className = "kotlin-token-number";
    } else if (kotlinKeywords.has(token)) {
      className = "kotlin-token-keyword";
    } else if (/^[A-Z]/.test(token)) {
      className = "kotlin-token-type";
    }

    nodes.push(
      className ? (
        <span key={`${lineIndex}-${segmentKey}-${tokenIndex}`} className={className}>
          {token}
        </span>
      ) : (
        token
      ),
    );

    cursor = start + token.length;
    tokenIndex += 1;
  }

  if (cursor < segment.length) {
    nodes.push(segment.slice(cursor));
  }

  return nodes;
}

function renderKotlinCode(code: string) {
  const lines = code.split("\n");

  return lines.map((line, lineIndex) => {
    const commentStart = line.indexOf("//");
    const codeSegment = commentStart >= 0 ? line.slice(0, commentStart) : line;
    const commentSegment = commentStart >= 0 ? line.slice(commentStart) : "";

    return (
      <span key={`line-${lineIndex}`} className="kotlin-code-line">
        {highlightKotlinSegment(codeSegment, lineIndex, "code")}
        {commentSegment ? <span className="kotlin-token-comment">{commentSegment}</span> : null}
        {lineIndex < lines.length - 1 ? "\n" : null}
      </span>
    );
  });
}

type VideoResource = {
  title: string;
  url: string;
  summary: string;
  topicFit?: string;
  timestamps: string[];
  codeLinks: string[];
  videoId?: string;
};

function getYouTubeVideoId(url: string) {
  return url.match(/[?&]v=([^&]+)/)?.[1] || url.match(/youtu\.be\/([^?]+)/)?.[1];
}

function parseListField(description: string, label: string) {
  const match = description.match(new RegExp(`${label}:\\s*([\\s\\S]+?)(?=\\s(?:URL|Timestamps|Code links|Topic fit):|$)`));
  if (!match?.[1]) return [];

  return match[1]
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseVideoResource(title: string, description: string): VideoResource | null {
  const url = description.match(/https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+/)?.[0];
  if (!url) return null;

  const topicFit = description.match(/Topic fit:\s*([\s\S]+?)\.\s/)?.[1]?.trim();
  const timestamps = parseListField(description, "Timestamps");
  const codeLinks = parseListField(description, "Code links");
  const summary = description
    .replace(/Topic fit:\s*[\s\S]+?\.\s/, "")
    .replace(/URL:\s*https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+\.?/, "")
    .replace(/Timestamps:\s*[\s\S]+?(?=\sCode links:|$)/, "")
    .replace(/Code links:\s*[\s\S]+$/, "")
    .trim();

  return {
    title,
    url,
    summary,
    topicFit,
    timestamps,
    codeLinks,
    videoId: getYouTubeVideoId(url),
  };
}

function isVideoContentSection(contentSection: { heading?: string; subtopics?: Array<{ title?: string; description?: string }> }) {
  const heading = contentSection.heading || "";
  return (
    /video|watchlist|extracted/i.test(heading) &&
    (contentSection.subtopics || []).some((subtopic) => subtopic.description?.includes("youtube.com/watch"))
  );
}

function isCheatSheetContentSection(contentSection: { heading?: string; subtopics?: Array<{ title?: string; description?: string }> }) {
  return /cheat\s*sheet/i.test(contentSection.heading || "") && Boolean(contentSection.subtopics?.length);
}

function CheatSheetSection({
  heading,
  points = [],
  subtopics = [],
}: {
  heading?: string;
  points?: string[];
  subtopics?: Array<{ title?: string; description?: string }>;
}) {
  return (
    <section className="grid gap-3">
      {heading ? (
        <div className="grid gap-2 border-b border-teal-200/20 pb-3">
          <h4 className="landing-display text-sm font-black text-teal-100">{heading}</h4>
          {points.length ? (
            <div className="grid gap-2 text-xs leading-5 text-slate-300 sm:grid-cols-2">
              {points.map((point, pointIndex) => (
                <p key={`${heading}-cheat-summary-${pointIndex}`} className="m-0 rounded-lg border border-white/10 bg-teal-200/[0.06] p-3">
                  {point}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {subtopics.map((subtopic, subtopicIndex) => (
          <article key={`${heading}-cheat-${subtopicIndex}`} className="grid min-h-32 gap-2 rounded-lg border border-white/10 bg-slate-950/55 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-teal-300 text-[10px] font-black text-slate-950">
                {subtopicIndex + 1}
              </span>
              <h5 className="landing-display min-w-0 text-sm font-black leading-5 text-slate-100">{subtopic.title || "Room Note"}</h5>
            </div>
            {subtopic.description ? <p className="m-0 text-xs leading-5 text-slate-400">{subtopic.description}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function VideoResourceSection({
  heading,
  resources,
}: {
  heading?: string;
  resources: VideoResource[];
}) {
  return (
    <section className="video-resource-section grid gap-4">
      {heading ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="landing-display text-sm font-black text-white">{heading}</h4>
            <p className="mt-1 text-xs font-medium text-slate-400">{resources.length} curated video resource{resources.length === 1 ? "" : "s"}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        {resources.map((resource) => (
          <article key={resource.url} className="video-resource-card grid overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:grid-cols-[168px_minmax(0,1fr)]">
            <a href={resource.url} target="_blank" rel="noreferrer" className="video-thumb relative block min-h-32 bg-slate-950">
              {resource.videoId ? (
                <img
                  src={`https://i.ytimg.com/vi/${resource.videoId}/hqdefault.jpg`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <span className="absolute inset-0 grid place-items-center bg-black/15">
                <span className="video-play-button grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/55 text-white">
                  <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" />
                </span>
              </span>
            </a>

            <div className="grid gap-3 p-3">
              <div className="grid gap-1">
                {resource.topicFit ? <div className="text-[11px] font-black uppercase tracking-[0.12em] text-teal-200">{resource.topicFit}</div> : null}
                <a href={resource.url} target="_blank" rel="noreferrer" className="landing-display text-sm font-black leading-5 text-slate-100 hover:text-teal-100">
                  {resource.title}
                </a>
                {resource.summary ? <p className="line-clamp-3 text-xs leading-5 text-slate-400">{resource.summary}</p> : null}
              </div>

              {resource.timestamps.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {resource.timestamps.slice(0, 4).map((timestamp) => (
                    <span key={timestamp} className="video-chip rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300">
                      {timestamp}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <a href={resource.url} target="_blank" rel="noreferrer" className="video-primary-link rounded-lg bg-teal-300 px-3 py-2 text-xs font-black text-slate-950">
                  Watch video
                </a>
                {resource.codeLinks.slice(0, 2).map((link) => (
                  <a key={link} href={link} target="_blank" rel="noreferrer" className="video-secondary-link rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300">
                    Code
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={cx("h-4 w-4 transition-transform duration-200", expanded && "rotate-90")}
    >
      <path d="M7.5 4.75L12.5 10L7.5 15.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M4.75 10.5L8.25 14L15.25 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RoadmapApp({ initialContent }: RoadmapAppProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchTerm = normalizeSearchText(searchInput);
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(() => new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(initialContent.map((_, index) => getSectionId(index))),
  );
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(() => new Set());
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Set<string>>(() => new Set());
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setIsHydrated(true);

    let storedProgress: string | null = null;
    let storedTheme: string | null = null;

    try {
      storedProgress = window.localStorage.getItem(progressStorageKey);
      storedTheme = window.localStorage.getItem(themeStorageKey);
    } catch {
      storedProgress = null;
      storedTheme = null;
    }

    if (storedProgress) {
      try {
        setCompletedTopics(new Set(JSON.parse(storedProgress) as string[]));
      } catch {
        setCompletedTopics(new Set());
      }
    }

    if (storedTheme) {
      setTheme(normalizeStoredTheme(storedTheme));
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify([...completedTopics]));
    } catch {
      // Progress still works for the current session if browser storage is blocked.
    }
  }, [completedTopics, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;

    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Theme still works for the current session if browser storage is blocked.
    }
  }, [isHydrated, theme]);

  useEffect(() => {
    if (!searchTerm) return;

    const nextSections = new Set<string>();
    const nextTopics = new Set<string>();

    initialContent.forEach((section, sectionIndex) => {
      const sectionId = getSectionId(sectionIndex);
      let sectionHasMatch = false;

      (section.topics || []).forEach((topic, topicIndex) => {
        const topicNumber = `${sectionIndex + 1}.${topicIndex + 1}`;
        if (topicMatchesSearch(section.title || "", topic, topicNumber, searchTerm)) {
          sectionHasMatch = true;
          nextTopics.add(getTopicKey(section, topic, sectionIndex, topicIndex));
        }
      });

      if (sectionHasMatch) {
        nextSections.add(sectionId);
      }
    });

    setExpandedSections(nextSections);
    setExpandedTopics(nextTopics);
  }, [initialContent, searchTerm]);

  const visibleSections = useMemo(() => {
    return initialContent
      .map((section, sectionIndex) => {
        const priority = getSectionPriority(section.title);
        if (activeFilter !== "all" && priority !== activeFilter) return null;

        const visibleTopics = (section.topics || [])
          .map((topic, topicIndex) => ({ topic, topicIndex }))
          .filter(({ topic, topicIndex }) => {
            const topicNumber = `${sectionIndex + 1}.${topicIndex + 1}`;
            return topicMatchesSearch(section.title || "", topic, topicNumber, searchTerm);
          });

        if (visibleTopics.length === 0) return null;
        return { section, sectionIndex, priority, visibleTopics };
      })
      .filter(Boolean);
  }, [activeFilter, initialContent, searchTerm]);

  const totalTopics = initialContent.reduce((sum, section) => sum + (section.topics?.length || 0), 0);
  const totalSections = initialContent.length;
  const progressPercent = totalTopics ? Math.round((completedTopics.size / totalTopics) * 100) : 0;

  function toggleSetValue(setter: Dispatch<SetStateAction<Set<string>>>, value: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function toggleTopicCompletion(topicKey: string) {
    toggleSetValue(setCompletedTopics, topicKey);
  }

  function toggleSection(sectionId: string) {
    toggleSetValue(setExpandedSections, sectionId);
  }

  function expandAllSections() {
    setExpandedSections(new Set(initialContent.map((_, index) => getSectionId(index))));
  }

  function collapseAllSections() {
    setExpandedSections(new Set());
  }

  function collapseAllTopics() {
    setExpandedTopics(new Set());
  }

  function expandAllTopics() {
    const next = new Set<string>();
    initialContent.forEach((section, sectionIndex) => {
      (section.topics || []).forEach((topic, topicIndex) => {
        next.add(getTopicKey(section, topic, sectionIndex, topicIndex));
      });
    });
    setExpandedTopics(next);
  }

  return (
    <main className={cx("min-h-screen", themes[theme])}>
      <div className="grid w-full">
        <section className="landing-header grid min-h-screen content-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-teal-200/20 bg-teal-200/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-100">
                  Senior Android Roadmap
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-300">
                  Interview-ready practice
                </span>
              </div>
              <div className="grid gap-5">
                <h1 className="landing-display max-w-3xl text-3xl font-black leading-[1.08] text-white sm:text-5xl lg:text-6xl">
                  Build senior Android confidence, one topic at a time
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  A focused study workspace for architecture decisions, Kotlin and Compose depth, testing strategy, performance trade-offs, and production readiness.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#roadmap-workspace"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-teal-300 px-6 text-sm font-black text-slate-950 shadow-[0_18px_40px_rgba(45,212,191,0.18)] transition hover:-translate-y-0.5 hover:bg-teal-200"
                >
                  Open roadmap
                </a>
              </div>
            </div>

            <div className="grid gap-5 border-l border-white/20 pl-5 sm:pl-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Your progress</span>
                <span className="landing-display text-lg font-black text-teal-200">
                  {completedTopics.size} / {totalTopics}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-950 ring-1 ring-white/10">
                <div className="h-full bg-teal-300 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="landing-display text-6xl font-black leading-none text-white">{progressPercent}%</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border-y border-white/10 py-3">
                  <div className="font-black text-white">{totalSections}</div>
                  <div className="mt-1 text-slate-400">Sections</div>
                </div>
                <div className="border-y border-white/10 py-3">
                  <div className="font-black text-white">{totalTopics}</div>
                  <div className="mt-1 text-slate-400">Topics</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <header className="roadmap-actionbar sticky top-0 z-30 border-b border-white/10 bg-[#10211f]/95 px-3 py-2 backdrop-blur sm:px-5 sm:py-3">
          <div className="grid gap-2 sm:gap-3 xl:grid-cols-[minmax(220px,280px)_minmax(260px,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-300 text-xs font-black text-slate-950 sm:h-10 sm:w-10 sm:text-sm">
                AS
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="landing-display truncate text-base font-black text-white">Android Study Roadmap</h1>
                <p className="truncate text-xs font-medium text-slate-400">
                  {completedTopics.size} / {totalTopics} topics complete
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 xl:hidden">
                <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs font-black text-teal-200">{progressPercent}%</span>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as Theme)}
                  className="h-8 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs text-white outline-none focus:border-teal-300"
                  aria-label="Theme"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 lg:items-center">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search topics, code, concepts..."
                className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300 sm:h-10 sm:px-4"
              />

              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value as Filter)}
                className="h-9 max-w-32 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs font-semibold text-white outline-none focus:border-teal-300 sm:h-10 sm:max-w-none sm:px-3 sm:text-sm"
                aria-label="Roadmap filter"
              >
                {filters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 xl:justify-end xl:overflow-visible xl:pb-0">
              <button className="h-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs font-bold text-slate-200 transition hover:border-teal-200/70" onClick={expandAllSections} type="button">
                Open Sec
              </button>
              <button className="h-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs font-bold text-slate-200 transition hover:border-teal-200/70" onClick={collapseAllSections} type="button">
                Close Sec
              </button>
              <button className="h-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs font-bold text-slate-200 transition hover:border-teal-200/70" onClick={expandAllTopics} type="button">
                Open Topics
              </button>
              <button className="h-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs font-bold text-slate-200 transition hover:border-teal-200/70" onClick={collapseAllTopics} type="button">
                Close Topics
              </button>
              <span className="hidden rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-black text-teal-200 xl:inline-flex">{progressPercent}%</span>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as Theme)}
                className="hidden h-10 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-teal-300 xl:block"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </header>

        <section id="roadmap-workspace" className="grid gap-0 lg:h-[calc(100vh-72px)] lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="grid min-h-0 border-b border-white/10 bg-white/[0.035] p-4 lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:border-b-0 lg:border-r lg:border-r-white/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="landing-display text-base font-black text-white">Study Roadmap</h2>
            </div>

            <div className="my-4 grid gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="font-bold text-slate-100">{totalSections}</div>
                <div className="mt-1 text-slate-500">Sections</div>
              </div>
            </div>

            <div className="grid gap-2 pr-1 lg:overflow-auto">
              {visibleSections.map((item) => {
                if (!item) return null;
                const { section, sectionIndex, priority } = item;

                return (
                  <a
                    key={getSectionId(sectionIndex)}
                    href={`#section-${sectionIndex + 1}`}
                    className="rounded-lg border border-white/10 bg-slate-950/45 p-3 text-sm transition hover:border-teal-200/70"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-teal-200/10 px-1 text-[10px] font-black text-teal-200">{sectionIndex + 1}</span>
                      <span className="text-xs text-slate-400">{estimateSectionDuration(section, priority)}</span>
                    </div>
                    <div className="landing-display font-black text-slate-100">{section.title || "Untitled Section"}</div>
                    <div className="mt-2 text-xs text-slate-500">{getPriorityLabel(priority)}</div>
                  </a>
                );
              })}
            </div>
          </aside>

          <div className="grid min-h-0">
            <div className="overflow-visible p-4 sm:p-5 lg:overflow-auto">
              <div className="grid gap-4">
                {visibleSections.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center text-slate-300">
                    No topics matched your current search or filter.
                  </div>
                ) : (
                  visibleSections.map((item) => {
                    if (!item) return null;
                    const { section, sectionIndex, priority, visibleTopics } = item;
                    const sectionId = getSectionId(sectionIndex);
                    const sectionExpanded = expandedSections.has(sectionId);

                    return (
                      <section
                        key={sectionId}
                        id={`section-${sectionIndex + 1}`}
                        onClick={(event) => {
                          if (event.target !== event.currentTarget) return;
                          toggleSection(sectionId);
                        }}
                        className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(sectionId)}
                          className="group grid w-full gap-3 rounded-lg p-4 text-left transition hover:bg-white/[0.04] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                          aria-expanded={sectionExpanded}
                        >
                          <span className="grid gap-1">
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-teal-300 px-1 text-[10px] font-black text-slate-950">
                                {sectionIndex + 1}
                              </span>
                              <span className="landing-display min-w-0 text-lg font-black text-white sm:text-xl">{section.title || "Untitled Section"}</span>
                            </span>
                            <span className="text-sm leading-6 text-slate-300">
                              {section.description ? `${section.description} ` : ""}
                              {visibleTopics.length} topic{visibleTopics.length === 1 ? "" : "s"} in this section.
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={cx("rounded-md border px-1.5 py-0.5 text-[10px] font-bold", priorityClass(priority))}>
                              {getPriorityLabel(priority)}
                            </span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-300 transition group-hover:border-teal-200/50 group-hover:text-teal-100">
                              <ChevronIcon expanded={sectionExpanded} />
                            </span>
                          </span>
                        </button>

                        {sectionExpanded ? (
                          <div className="grid gap-0 px-4 pb-4">
                            {visibleTopics.map(({ topic, topicIndex }) => (
                              <TopicCard
                                key={getTopicKey(section, topic, sectionIndex, topicIndex)}
                                topic={topic}
                                topicIndex={topicIndex}
                                section={section}
                                sectionIndex={sectionIndex}
                                completedTopics={completedTopics}
                                expandedTopics={expandedTopics}
                                expandedCodeBlocks={expandedCodeBlocks}
                                toggleSetValue={toggleSetValue}
                                toggleTopicCompletion={toggleTopicCompletion}
                                setExpandedTopics={setExpandedTopics}
                                setExpandedCodeBlocks={setExpandedCodeBlocks}
                              />
                            ))}
                          </div>
                        ) : null}
                      </section>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function TopicCard({
  topic,
  topicIndex,
  section,
  sectionIndex,
  completedTopics,
  expandedTopics,
  expandedCodeBlocks,
  toggleSetValue,
  toggleTopicCompletion,
  setExpandedTopics,
  setExpandedCodeBlocks,
}: {
  topic: RoadmapTopic;
  topicIndex: number;
  section: RoadmapSection;
  sectionIndex: number;
  completedTopics: Set<string>;
  expandedTopics: Set<string>;
  expandedCodeBlocks: Set<string>;
  toggleSetValue: (setter: Dispatch<SetStateAction<Set<string>>>, value: string) => void;
  toggleTopicCompletion: (topicKey: string) => void;
  setExpandedTopics: Dispatch<SetStateAction<Set<string>>>;
  setExpandedCodeBlocks: Dispatch<SetStateAction<Set<string>>>;
}) {
  const topicKey = getTopicKey(section, topic, sectionIndex, topicIndex);
  const topicExpanded = expandedTopics.has(topicKey);
  const isComplete = completedTopics.has(topicKey);

  return (
    <article className={cx("border-t border-white/10 py-4 first:border-t-0", isComplete && "opacity-70")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <button
          type="button"
          aria-expanded={topicExpanded}
          onClick={() => toggleSetValue(setExpandedTopics, topicKey)}
          className="group grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-2 text-left outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-teal-300/70"
        >
          <span className="landing-display min-w-0 text-base font-black text-slate-100">{topic.title || "Untitled Topic"}</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-300 transition group-hover:border-teal-200/50 group-hover:text-teal-100">
            <ChevronIcon expanded={topicExpanded} />
          </span>
        </button>

        <label
          className={cx(
            "relative flex h-10 w-10 items-center justify-center rounded-full border transition hover:border-teal-200/70",
            isComplete ? "border-teal-300 bg-teal-300 text-slate-950" : "border-white/10 bg-black/20 text-transparent",
          )}
          title={isComplete ? "Mark topic incomplete" : "Mark topic complete"}
        >
          <input
            type="checkbox"
            checked={isComplete}
            onChange={() => toggleTopicCompletion(topicKey)}
            className="peer sr-only"
            aria-label={`Mark ${topic.title || "topic"} complete`}
          />
          <span className="absolute inset-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-teal-300/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950" />
          <CheckIcon />
        </label>
      </div>

      {topicExpanded ? (
        <div className="grid gap-5 px-2 pb-2 pt-3">
          {topic.description ? <p className="m-0 text-sm leading-6 text-slate-300">{topic.description}</p> : null}

          {(topic.content_sections || []).map((contentSection, index) => {
            if (isCheatSheetContentSection(contentSection)) {
              return (
                <CheatSheetSection
                  key={`${topicKey}-content-${index}`}
                  heading={contentSection.heading}
                  points={contentSection.points}
                  subtopics={contentSection.subtopics}
                />
              );
            }

            if (isVideoContentSection(contentSection)) {
              const resources = (contentSection.subtopics || [])
                .map((subtopic) => parseVideoResource(subtopic.title || "Video", subtopic.description || ""))
                .filter((resource): resource is VideoResource => Boolean(resource));

              return <VideoResourceSection key={`${topicKey}-content-${index}`} heading={contentSection.heading} resources={resources} />;
            }

            return (
              <section key={`${topicKey}-content-${index}`} className="grid gap-3">
                {contentSection.heading ? <h4 className="landing-display text-sm font-black text-white">{contentSection.heading}</h4> : null}
                {contentSection.points?.length ? (
                  <div className="grid gap-2">
                    {contentSection.points.map((point, pointIndex) => (
                      <div key={`${topicKey}-point-${pointIndex}`} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3 text-sm leading-6 text-slate-300">
                        <span className="mt-2 h-2 w-2 rounded-full bg-teal-300" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {contentSection.subtopics?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {contentSection.subtopics.map((subtopic, subtopicIndex) => (
                      <div key={`${topicKey}-subtopic-${subtopicIndex}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="text-sm font-bold text-slate-100">{subtopic.title}</div>
                        {subtopic.description ? <div className="mt-1 text-sm leading-6 text-slate-400">{subtopic.description}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}

          {(topic.code_blocks || []).map((block, codeIndex) => {
            const codeKey = `${topicKey}:code:${codeIndex}`;
            const expanded = expandedCodeBlocks.has(codeKey);

            return (
              <section key={codeKey} className="code-example overflow-hidden rounded-lg border border-white/10 bg-slate-950">
                <button
                  type="button"
                  onClick={() => toggleSetValue(setExpandedCodeBlocks, codeKey)}
                  className="code-example-header group flex w-full items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left hover:bg-white/[0.04]"
                  aria-expanded={expanded}
                >
                  <span className="landing-display min-w-0 font-black text-slate-100">{block.title || "Code Example"}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="code-language-pill rounded-lg bg-teal-200/10 px-2 py-1 text-xs font-bold text-teal-200">
                      {getCodeLanguage(block.language)}
                    </span>
                    <span className="code-chevron flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-300 transition group-hover:border-teal-200/50 group-hover:text-teal-100">
                      <ChevronIcon expanded={expanded} />
                    </span>
                  </span>
                </button>
                {expanded ? (
                  <pre className="code-example-body overflow-auto p-4 text-sm leading-6 text-slate-200">
                    <code className={isKotlinLanguage(block.language) ? "kotlin-code" : undefined}>
                      {isKotlinLanguage(block.language) ? renderKotlinCode(block.code || "") : block.code || ""}
                    </code>
                  </pre>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function getSectionId(sectionIndex: number) {
  return `section-${sectionIndex + 1}`;
}

function normalizeStoredTheme(value: string): Theme {
  if (value === "light" || value === "dark") return value;
  return "dark";
}

function priorityClass(priority: Priority) {
  if (priority === "must-know") return "border-teal-200/30 bg-teal-200/10 text-teal-100";
  if (priority === "important") return "border-amber-200/30 bg-amber-200/10 text-amber-100";
  return "border-sky-200/30 bg-sky-200/10 text-sky-100";
}
