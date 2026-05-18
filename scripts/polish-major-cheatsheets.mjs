import fs from "node:fs";
import path from "node:path";

const contentPath = path.join(process.cwd(), "data", "content.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

let removedGoldenTakeaways = 0;

for (const section of content) {
  const before = section.topics?.length || 0;
  section.topics = (section.topics || []).filter((topic) => !/golden takeaways/i.test(topic.title || ""));
  removedGoldenTakeaways += before - section.topics.length;
}

function findTopic(sectionId, topicTitle) {
  const section = content.find((item) => item.id === sectionId);
  const topic = (section?.topics || []).find((item) => item.title === topicTitle);
  if (!topic) {
    console.warn(`Missing topic: ${sectionId} / ${topicTitle}`);
    return null;
  }
  return topic;
}

function upsertCheatSheet(sectionId, topicTitle, points, cards) {
  const topic = findTopic(sectionId, topicTitle);
  if (!topic) return false;

  const heading = `${topicTitle} Cheat Sheet`;
  topic.content_sections = (topic.content_sections || []).filter((section) => section.heading !== heading);
  topic.content_sections.push({ heading, points, subtopics: cards });
  return true;
}

const cheatSheets = [
  {
    sectionId: "android-fundamentals-platform-basics",
    topicTitle: "Lifecycle, State & Configuration Changes",
    points: [
      "Use this as the lifecycle restoration checklist for rotation, multi-window, process death, task restore, and logout.",
      "The senior mental model is state ownership: local UI state, saved instance state, ViewModel state, persisted state, and backend state are different tools.",
    ],
    cards: [
      ["Rotation", "Activity may recreate; ViewModel survives, remember state may reset, rememberSaveable and SavedStateHandle can restore small UI keys."],
      ["Process Death", "ViewModel and singletons are gone. Restore from route args, SavedStateHandle primitives, Room/DataStore/files, or backend reload."],
      ["Ephemeral UI State", "Expanded rows, scroll, selected tab, and text drafts can live near UI unless the product requires durability."],
      ["Durable State", "Saved records, user choices, sync progress, and business-critical drafts belong in Room, DataStore, files, or backend."],
      ["SavedStateHandle", "Use for route arguments and small restoration values. Do not store large objects, API payloads, or database caches."],
      ["repeatOnLifecycle", "Collect Flow only when the lifecycle is visible enough; cancellation and restart are expected behavior."],
      ["Compose Effects", "Key LaunchedEffect and DisposableEffect to the identity of the work, not to unstable objects that restart accidentally."],
      ["Leak Risks", "Never keep Activity, Fragment, View, NavController, or Context references in long-lived ViewModels or singletons."],
      ["Testing", "Rotate, enable Don't keep activities, simulate process death, restore from Recents, and assert loading/content/error recovery."],
      ["Interview Answer", "Separate configuration change from process death first; most weak answers mix them together."],
    ],
  },
  {
    sectionId: "jetpack-components-deep-dive",
    topicTitle: "Lifecycle, ViewModel & State Management",
    points: [
      "Use this as the screen-state ownership cheat sheet for ViewModel, Flow, StateFlow, LiveData interop, and UDF.",
      "The clean pattern is private mutable state, public immutable state, explicit events, and repositories/use cases as the durable source boundary.",
    ],
    cards: [
      ["ViewModel Role", "Own screen state, screen work, and UI-facing transformations that survive configuration change."],
      ["Not ViewModel Role", "Do not store Views, Activities, Fragment references, NavController, or long-lived framework callbacks."],
      ["MutableStateFlow", "Keep private; update atomically with update when new state depends on old state."],
      ["StateFlow", "Expose current UI state with an initial value and predictable loading/error/content modeling."],
      ["SharedFlow", "Use for events only when replay, buffering, and lifecycle behavior are intentional."],
      ["SavedStateHandle", "Store IDs, filters, selected tab, restoration hints, and small primitives, not full domain graphs."],
      ["UDF", "Events enter ViewModel, reducer updates immutable state, UI renders state, one-off effects are modeled separately."],
      ["Repository Boundary", "ViewModel should not decide cache invalidation, sync policy, or low-level API/database mapping."],
      ["Testing", "Use runTest, fake repositories, injected dispatchers, controlled flows, and assert state sequences."],
      ["Interview Answer", "Name state owner, lifecycle, persistence boundary, event strategy, and test approach."],
    ],
  },
  {
    sectionId: "jetpack-components-deep-dive",
    topicTitle: "WorkManager, Background Work & App Startup",
    points: [
      "Use this as the background-work decision chart for WorkManager, foreground services, alarms, app startup, and sync.",
      "The core decision is reliability vs immediacy: guaranteed deferrable work is different from active user-visible work.",
    ],
    cards: [
      ["WorkManager", "Deferrable, guaranteed work with constraints, retry, chaining, and persistence across process/device restart."],
      ["Foreground Service", "Immediate ongoing user-visible work with notification, strict service type, and cancellation path."],
      ["Alarm", "Time-based trigger. Use exact alarms sparingly because policy and battery restrictions are strict."],
      ["Coroutine", "In-process work tied to a scope. Not guaranteed after process death."],
      ["Unique Work", "Use unique names and ExistingWorkPolicy to avoid duplicate sync, upload, or cleanup jobs."],
      ["Input Data", "Pass small primitives only. Store large payloads in Room/files and pass stable IDs."],
      ["Retry", "Retry transient network/server failures; fail validation/auth/permanent data errors."],
      ["Idempotency", "Workers can rerun. Writes should be safe under duplicate execution."],
      ["App Startup", "Keep Application.onCreate thin; defer SDKs and optional work behind lazy or first-use boundaries."],
      ["Testing", "Use WorkManager test APIs, fake constraints, fake repositories, and assert final state in Room."],
    ],
  },
  {
    sectionId: "kotlin-coroutines-flow",
    topicTitle: "Coroutines Deep Dive",
    points: [
      "Use this as the coroutine ownership cheat sheet: scope, dispatcher, cancellation, failure, timeout, and testability.",
      "A senior coroutine answer always names who owns the work and what cancels it.",
    ],
    cards: [
      ["viewModelScope", "UI-related work owned by a ViewModel; cancelled when the ViewModel is cleared."],
      ["lifecycleScope", "Lifecycle-owned work; pair collection with repeatOnLifecycle for visibility-aware cancellation."],
      ["coroutineScope", "Child failure cancels siblings and parent; use when all parallel work is required."],
      ["supervisorScope", "Sibling failures are isolated; use for partial dashboard or independent refresh work."],
      ["Dispatchers.Main", "UI state updates and main-safe calls only. Do not block."],
      ["Dispatchers.IO", "Blocking I/O: files, database, network clients that block, and legacy APIs."],
      ["Dispatchers.Default", "CPU work: parsing, sorting, diffing, compression, image processing."],
      ["Cancellation", "Cooperative. Check ensureActive/yield in CPU loops and propagate cancellation through suspend APIs."],
      ["Exception Handling", "async exposes errors through await; CoroutineExceptionHandler observes uncaught root launch failures."],
      ["Testing", "Use runTest, TestDispatcher, injected dispatchers, virtual time, and no real delays."],
    ],
  },
  {
    sectionId: "kotlin-coroutines-flow",
    topicTitle: "Flow Advanced Patterns",
    points: [
      "Use this as the Flow operator and hot/cold stream cheat sheet for ViewModel state and reactive repositories.",
      "The core decision is whether the stream represents work, state, events, or shared upstream data.",
    ],
    cards: [
      ["Cold Flow", "Starts work per collector. Good for declarative data pipelines; dangerous if each collector repeats expensive work."],
      ["StateFlow", "Hot state holder with current value. Best default for ViewModel UI state."],
      ["SharedFlow", "Hot event/broadcast stream. Configure replay and buffering intentionally."],
      ["callbackFlow", "Bridge callback APIs; always clean up listeners in awaitClose."],
      ["stateIn", "Convert cold stream to StateFlow with scope, initial value, and SharingStarted policy."],
      ["shareIn", "Share upstream work without requiring a current-state model."],
      ["flatMapLatest", "Search/filter/selected ID; new input cancels stale work."],
      ["combine", "Latest values from multiple sources; ideal for UI state from database, sync, and network status."],
      ["catch", "Handles upstream exceptions only. Placement changes what it protects."],
      ["Testing", "Use runTest, virtual time, Turbine or explicit collection, and assert emission order."],
    ],
  },
  {
    sectionId: "ui-toolkit-views-jetpack-compose",
    topicTitle: "Compose Internals",
    points: [
      "Use this as the Compose performance and correctness cheat sheet for recomposition, stability, effects, and lazy lists.",
      "Recomposition is not the bug; unnecessary work and side effects during recomposition are the bug.",
    ],
    cards: [
      ["Recomposition", "Compose re-executes composables whose observed state changed; keep composables pure and cheap."],
      ["Stability", "@Stable/@Immutable help Compose skip work when contracts are true; wrong annotations can hide bugs."],
      ["remember", "Cache objects for the current composition. Not durable across process death."],
      ["rememberSaveable", "Restore small Bundle-compatible UI state across recreation."],
      ["derivedStateOf", "Memoize expensive derived values from frequently changing state."],
      ["LaunchedEffect", "Launch suspend work tied to composition; keys decide restart behavior."],
      ["DisposableEffect", "Register/unregister listeners, observers, or resources with clear cleanup."],
      ["rememberUpdatedState", "Keep latest lambda/value inside long-lived effects without restarting them."],
      ["Lazy Keys", "Use stable item keys to preserve item identity, animation, and remembered row state."],
      ["Performance", "Measure with Layout Inspector, recomposition counts, Macrobenchmark, and frame metrics."],
    ],
  },
  {
    sectionId: "state-navigation",
    topicTitle: "Type-Safe Compose Navigation",
    points: [
      "Use this as the navigation contract cheat sheet for typed routes, arguments, deep links, results, and modular graphs.",
      "The safe default is to pass stable IDs through navigation and load real data in the destination.",
    ],
    cards: [
      ["Typed Route", "Represent destinations as serializable contracts instead of fragile string concatenation."],
      ["Arguments", "Pass IDs and small primitives. Avoid passing domain objects, JSON blobs, or mutable state."],
      ["Destination ViewModel", "Read route args, load data from repository, expose UI state."],
      ["Deep Link", "Treat as external input: validate, authorize, handle missing records, and recover gracefully."],
      ["Back Stack", "Know whether state belongs to destination, graph, tab, or app shell."],
      ["Results", "Use SavedStateHandle or shared ViewModel only when lifecycle ownership is clear."],
      ["Nested Graph", "Use for auth, onboarding, bottom tabs, and feature-owned flows."],
      ["Modular Navigation", "Expose feature entry points and route contracts; avoid feature dependency on app shell internals."],
      ["Testing", "Assert visible destination and restored state, not just route strings."],
      ["Interview Answer", "Name route contract, state owner, deep-link policy, and process-death behavior."],
    ],
  },
  {
    sectionId: "dependency-injection",
    topicTitle: "Hilt Deep Dive",
    points: [
      "Use this as the Hilt graph cheat sheet for scopes, modules, qualifiers, assisted injection, and testing.",
      "The senior Hilt question is lifetime correctness: which object can safely depend on which other object?",
    ],
    cards: [
      ["SingletonComponent", "Process-wide dependencies: database, Retrofit, repositories, app-level managers."],
      ["ActivityRetainedComponent", "Survives configuration change; useful for dependencies shared by ViewModels in an Activity."],
      ["ViewModelComponent", "Dependencies scoped to a ViewModel lifecycle."],
      ["Activity/Fragment Scope", "UI-scope dependencies only; never inject them into longer-lived objects."],
      ["Constructor Injection", "Default for app-owned classes; easiest to test and reason about."],
      ["Modules", "Use for third-party builders, interfaces, framework objects, and factory-style creation."],
      ["Qualifiers", "Required when same type has different meaning: public vs auth client, IO vs Default dispatcher."],
      ["Assisted Injection", "Use when runtime parameters cannot come from the graph."],
      ["Test Replacement", "Replace modules with fakes that preserve behavior contracts, not only mocks."],
      ["Pitfall", "Scope leaks, circular dependencies, heavy startup graph, and hidden global mutable state."],
    ],
  },
  {
    sectionId: "networking-apis",
    topicTitle: "Retrofit & OkHttp",
    points: [
      "Use this as the Android networking stack cheat sheet for Retrofit, OkHttp, interceptors, serializers, and auth refresh.",
      "The production boundary is not the HTTP call; it is typed request, typed response, classified error, retry policy, and observability.",
    ],
    cards: [
      ["Retrofit", "Declarative API interfaces, converters, call adapters, suspend support, and endpoint grouping."],
      ["OkHttp", "Connection pooling, interceptors, caching, TLS, timeouts, logging, and request execution."],
      ["Interceptor", "Add auth headers, request IDs, logging, cache policy, and safe retry metadata."],
      ["Authenticator", "Central place for 401 token refresh; guard against refresh storms."],
      ["Timeouts", "Set connect/read/write/call timeouts based on product behavior, not defaults alone."],
      ["Serialization", "Handle unknown fields, nullability, enums, date formats, and backwards compatibility."],
      ["Error Mapping", "Classify no network, timeout, 4xx, 5xx, parsing, auth, validation, and rate-limit errors."],
      ["Caching", "Use HTTP cache when server headers support it; otherwise use Room-backed cache policy."],
      ["Observability", "Track endpoint, latency, status, retry count, payload size, and app version."],
      ["Testing", "Use MockWebServer for API behavior, headers, errors, latency, and malformed responses."],
    ],
  },
  {
    sectionId: "networking-apis",
    topicTitle: "API Response Handling",
    points: [
      "Use this as the response-state cheat sheet for success, empty, loading, validation errors, retries, pagination, and auth expiry.",
      "The UI should receive an actionable state, not raw Retrofit exceptions.",
    ],
    cards: [
      ["Success", "Map DTO to domain/UI model and validate required business fields before rendering."],
      ["Empty", "Model empty as a real state, not an error, when the API returns no items correctly."],
      ["Loading", "Show initial load, refresh, append, and background sync separately when the UX needs it."],
      ["No Connection", "Show offline state or stale cached data; do not retry aggressively."],
      ["4xx", "Usually caller/input/auth issue. Do not blindly retry."],
      ["5xx", "Server/transient class. Retry conservatively with backoff when user value justifies it."],
      ["401", "Central auth refresh or logout path; avoid every screen handling it differently."],
      ["Parsing", "Treat as contract drift. Capture payload version and fail gracefully."],
      ["Pagination", "Separate refresh, append, endReached, empty page, and append error states."],
      ["Telemetry", "Log error category, endpoint, status, retry count, and app version without PII."],
    ],
  },
  {
    sectionId: "testing-strategy",
    topicTitle: "Test Architecture",
    points: [
      "Use this as the Android test pyramid cheat sheet for deciding what belongs in unit, integration, screenshot, and instrumentation tests.",
      "The best senior test strategy is deterministic, fast at the bottom, selective at the top, and tied to production risk.",
    ],
    cards: [
      ["Unit Test", "Pure business rules, mappers, reducers, use cases, validators, and ViewModel state transitions."],
      ["Fake", "Prefer fakes for behavior-rich dependencies such as repositories, clocks, dispatchers, and APIs."],
      ["Mock", "Useful for interaction boundaries, but overuse creates brittle tests with little product confidence."],
      ["Integration", "Room DAO, migrations, repository with fake API + real database, serialization, and WorkManager behavior."],
      ["Compose UI", "Assert semantics and visible behavior, not internal composable implementation."],
      ["Screenshot", "Use for visual regressions across themes, font scale, and component states."],
      ["Instrumentation", "Framework behavior: navigation, permissions, database, process/lifecycle, and critical flows."],
      ["Coroutine Test", "runTest, TestDispatcher, virtual time, injected dispatchers, and no real delays."],
      ["CI Gate", "Fast PR checks plus slower nightly/release suites for expensive tests."],
      ["Flake Policy", "Track flakes separately, quarantine when needed, and fix root causes rather than rerunning forever."],
    ],
  },
  {
    sectionId: "performance-observability",
    topicTitle: "App Startup Optimization",
    points: [
      "Use this as the startup performance cheat sheet for cold start, first draw, deferred work, Baseline Profiles, and measurement.",
      "Do not optimize startup by guessing; measure the path from process creation to usable first screen.",
    ],
    cards: [
      ["Cold Start", "Process creation, Application.onCreate, first Activity, class loading, dependency graph, first draw."],
      ["Warm Start", "Process exists but Activity may need recreation; less expensive but still measurable."],
      ["Hot Start", "Bring existing Activity forward; should be fast unless resume work is heavy."],
      ["Application.onCreate", "Keep thin. Avoid heavy SDK, disk, network, database, and reflection work."],
      ["Lazy Init", "Defer analytics, remote config, optional SDKs, and feature-only dependencies until needed."],
      ["First Draw", "Use reportFullyDrawn when meaningful; distinguish first frame from usable content."],
      ["Baseline Profile", "Precompile startup and hot paths; keep profile coverage aligned with real journeys."],
      ["Macrobenchmark", "Measure startup timing repeatedly on realistic devices and release-like builds."],
      ["Perfetto", "Use traces to find blocking work, class loading, binder calls, I/O, and main-thread stalls."],
      ["Trade-Off", "Deferred work still needs ownership, ordering, failure handling, and user-visible readiness."],
    ],
  },
  {
    sectionId: "security-privacy-app-integrity",
    topicTitle: "Authentication & Authorization",
    points: [
      "Use this as the auth cheat sheet for login, tokens, refresh, storage, logout, biometrics, and server enforcement.",
      "Authentication proves identity; authorization decides allowed actions. The server must enforce real access control.",
    ],
    cards: [
      ["Access Token", "Short-lived bearer credential for API calls. Never log it."],
      ["Refresh Token", "Higher-value credential. Store carefully, rotate when possible, clear on logout."],
      ["Token Refresh", "Centralize and single-flight refresh so concurrent API calls do not create refresh storms."],
      ["401 Handling", "Refresh once when valid, otherwise transition to logged-out or re-auth state."],
      ["Secure Storage", "Use encrypted storage for sensitive local tokens, but do not treat client secrets as impossible to extract."],
      ["Biometric", "Local re-auth or secret release, not a replacement for backend authorization."],
      ["Authorization", "Server checks ownership, roles, entitlement, and object-level access. Client gates are UX only."],
      ["Logout", "Clear tokens, protected caches, pending sensitive work, and navigation back stack as required."],
      ["Telemetry", "Track auth failures by category without logging secrets or PII."],
      ["Threat Model", "Consider rooted device, reverse engineering, replay, MITM, stolen token, and compromised session."],
    ],
  },
  {
    sectionId: "build-release-ci-cd",
    topicTitle: "Gradle & Build System",
    points: [
      "Use this as the Gradle build health cheat sheet for configuration cache, build cache, modularization, dependencies, and CI speed.",
      "The senior build question is feedback time: how quickly can the team safely know a change is good?",
    ],
    cards: [
      ["Configuration Cache", "Avoid configuration-time side effects; make custom plugins/tasks cache-friendly."],
      ["Build Cache", "Cache task outputs when inputs/outputs are declared correctly."],
      ["Version Catalog", "Centralize dependency versions and plugin aliases for consistency."],
      ["Convention Plugin", "Move repeated Gradle config into build logic instead of copy-pasting module scripts."],
      ["KSP vs KAPT", "Prefer KSP when supported for faster annotation processing and better Kotlin integration."],
      ["Modularization", "Improve parallelism and incremental builds only when module boundaries are clean."],
      ["Dependency Hygiene", "Remove unused dependencies, align versions, avoid duplicate transitive stacks."],
      ["R8", "Test release builds; shrinking can expose reflection, serialization, and keep-rule issues."],
      ["CI", "Use remote/local caches carefully, publish reports, and keep commands reproducible locally."],
      ["Measurement", "Use build scans, Gradle profiler, and task timelines before restructuring modules."],
    ],
  },
  {
    sectionId: "system-design-for-mobile",
    topicTitle: "Scalability Considerations",
    points: [
      "Use this as the mobile system design cheat sheet for offline, sync, payloads, observability, rollout, and old app versions.",
      "Mobile scale is not just backend QPS; it is battery, storage, network variability, release lag, and recovery behavior.",
    ],
    cards: [
      ["Read Path", "Cache, pagination, freshness, offline state, and stale-data UI."],
      ["Write Path", "Idempotency, retries, pending state, conflict policy, and user feedback."],
      ["Sync", "Delta updates, checkpoints, tombstones, retry, backoff, and partial failure handling."],
      ["Payload", "Compression, field selection, pagination, image sizing, and memory limits."],
      ["Offline", "Define what works, what queues, what blocks, and how user trust is preserved."],
      ["Auth Expiry", "Refresh, re-auth, cache visibility, and protected data cleanup."],
      ["Old Versions", "Backward-compatible APIs because users do not upgrade instantly."],
      ["Feature Flags", "Roll out, kill switch, server compatibility, and metrics ownership."],
      ["Observability", "Client version, endpoint, latency, status, network type, sync state, and journey."],
      ["Failure Modes", "Airplane mode, server outage, partial sync, app upgrade, and corrupted local state."],
    ],
  },
];

let appliedCheatSheets = 0;
for (const item of cheatSheets) {
  const cards = item.cards.map(([title, description]) => ({ title, description }));
  if (upsertCheatSheet(item.sectionId, item.topicTitle, item.points, cards)) appliedCheatSheets += 1;
}

fs.writeFileSync(contentPath, `${JSON.stringify(content, null, 2)}\n`);
console.log(JSON.stringify({ removedGoldenTakeaways, appliedCheatSheets }, null, 2));
