import fs from "node:fs";
import path from "node:path";

const contentPath = path.join(process.cwd(), "data", "content.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

const section = content.find((item) => item.id === "data-management-persistence");
if (!section) throw new Error("Missing data-management-persistence section");

const topic = (section.topics || []).find((item) => item.title === "Room Database");
if (!topic) throw new Error("Missing Room Database topic");

function upsertContentSection(heading, points = [], subtopics = []) {
  topic.content_sections = (topic.content_sections || []).filter((item) => item.heading !== heading);
  topic.content_sections.push({ heading, points, subtopics });
}

function upsertCodeBlock(title, code) {
  topic.code_blocks = (topic.code_blocks || []).filter((item) => item.title !== title);
  topic.code_blocks.push({ language: "kotlin", title, code });
}

topic.description =
  "A senior-level Room cheat sheet covering schema modeling, entities, DAOs, relationships, migrations, transactions, observable reads, testing, performance, and production failure modes.";

upsertContentSection(
  "Room Cheat Sheet",
  [
    "Use this as a quick Room reference before implementation, code review, migration work, and senior Android interviews.",
    "The core Room decision is source of truth: UI observes local database state, repositories write network or user changes into Room, and migrations protect existing user data.",
  ],
  [
    {
      title: "When to Use Room",
      description:
        "Structured relational data, local cache tables, offline-first screens, joins, transactions, observable invalidation, search, pagination, and schema evolution.",
    },
    {
      title: "When Not to Use Room",
      description:
        "Small preferences, feature flags, tokens, single settings, large binary blobs, temporary UI state, or remote-only data that does not need local querying.",
    },
    {
      title: "Entity Basics",
      description:
        "@Entity maps a Kotlin class to a table. Define tableName, @PrimaryKey, ignored fields, default values, indices, foreignKeys, and column names intentionally.",
    },
    {
      title: "Primary Keys",
      description:
        "Use stable backend IDs when data syncs with a server. Use autoGenerate only for truly local records that do not need server identity or deterministic merging.",
    },
    {
      title: "Indices",
      description:
        "Add indices for frequent WHERE, JOIN, ORDER BY, and uniqueness checks. Use unique indices for natural constraints such as email, remoteId, or composite keys.",
    },
    {
      title: "DAO Reads",
      description:
        "Return Flow for observable screen data, PagingSource for large lists, suspend for one-shot reads, and nullable results when missing rows are valid.",
    },
    {
      title: "DAO Writes",
      description:
        "Use @Insert, @Update, @Delete, @Upsert, and explicit @Query writes. Choose OnConflictStrategy based on whether replace, ignore, or abort preserves correctness.",
    },
    {
      title: "Transactions",
      description:
        "Use @Transaction for relation reads and multi-step writes that must stay consistent, especially replace-all cache refresh, parent-child updates, and sync checkpoints.",
    },
    {
      title: "Relationships",
      description:
        "Use @Embedded for nested value objects, @Relation for object graphs, Junction tables for many-to-many, and explicit SQL JOINs when projection control matters.",
    },
    {
      title: "Migrations",
      description:
        "Every schema change needs a Migration or AutoMigration plan. Export schemas, test every version path, and avoid destructive migration in production.",
    },
    {
      title: "TypeConverters",
      description:
        "Use converters for small value types such as Instant, UUID, enum, or lightweight lists. Avoid hiding large nested JSON where relational modeling is needed.",
    },
    {
      title: "Database Class",
      description:
        "@Database declares entities, version, exportSchema, views, converters, callbacks, and migrations. Keep one app database unless boundaries justify multiple DBs.",
    },
    {
      title: "Offline-First",
      description:
        "Make Room the local source of truth, refresh from network into transactions, expose Flow to UI, and model pending writes, retry, conflicts, and stale data.",
    },
    {
      title: "Paging 3",
      description:
        "Use PagingSource from DAO for local paging. Add RemoteMediator when network pagination should fill or refresh Room-backed pages.",
    },
    {
      title: "Full-Text Search",
      description:
        "Use @Fts4/@Fts5 for searchable text tables. Keep FTS tables synchronized and understand tokenizer, ranking, and prefix-query trade-offs.",
    },
    {
      title: "Testing",
      description:
        "Test DAO queries with in-memory Room, migration paths with MigrationTestHelper, and repository behavior with fake APIs plus real database transactions.",
    },
    {
      title: "Performance",
      description:
        "Inspect generated SQL, avoid giant relation graphs, index hot queries, keep writes off Main, limit large result sets, and measure invalidation churn.",
    },
    {
      title: "Common Pitfalls",
      description:
        "Using fallbackToDestructiveMigration in production, missing indices on foreign keys, exposing Entity directly to UI, replacing rows without transactions, and skipping migration tests.",
    },
  ],
);

upsertContentSection("Room API Map", [
  "@Entity: table definition, primary keys, indices, foreign keys, ignored columns, and embedded value objects.",
  "@Dao: typed SQL boundary for reads, writes, transactions, paging queries, and observable Flow results.",
  "@Database: schema owner that declares entities, version, migrations, callbacks, type converters, and schema export.",
  "@Query: compile-time checked SQL for SELECT, UPDATE, DELETE, joins, projections, and aggregate queries.",
  "@Transaction: consistency boundary for relation reads and multi-step write operations.",
  "@Relation: object graph mapping for parent-child data; use carefully because it may perform multiple queries.",
  "@Embedded: flattens a nested object into the parent table or projection.",
  "@TypeConverter: maps unsupported Kotlin types to SQLite-supported primitives.",
  "@DatabaseView: read-only projection for complex joins that deserve a named query surface.",
  "@Fts4/@Fts5: full-text search table support for local search use cases.",
]);

upsertContentSection("Schema Design Checklist", [
  "Start with access patterns: list screen, detail screen, search, filters, sync, and delete behavior should shape the schema.",
  "Choose IDs deliberately: local-only auto IDs, remote stable IDs, or composite keys all imply different sync and conflict behavior.",
  "Add foreign keys when referential integrity matters, and index foreign-key columns to avoid slow relation queries.",
  "Prefer small projection data classes for list rows instead of loading full entities and relation graphs into every screen.",
  "Represent deletion explicitly when sync needs tombstones; hard deletes can lose information required for conflict resolution.",
  "Use default values for new non-null columns during migration so old rows remain valid.",
  "Keep Entities persistence-focused; map to domain/UI models when API shape, database shape, and UI shape differ.",
]);

upsertContentSection("Migration Safety Checklist", [
  "Enable exportSchema and commit schema JSON files so migration tests can compare old and new versions.",
  "Write a Migration for every production schema change: add table, add column, rename, split table, backfill, or index change.",
  "Test every supported upgrade path, not only previous version to latest, when users may skip app versions.",
  "Avoid fallbackToDestructiveMigration in production unless data is disposable and the product explicitly accepts local data loss.",
  "For renamed columns or tables, create the new structure, copy data, validate counts/constraints, then drop the old structure.",
  "Backfill new required columns deterministically; do not rely on app code later to repair invalid historical rows.",
  "Review downgrade behavior, rollback risk, staged rollout, and crash monitoring before shipping a risky migration.",
]);

upsertContentSection("Query & Performance Checklist", [
  "Use EXPLAIN QUERY PLAN or database inspection for slow queries; guessing at SQL performance is fragile.",
  "Index columns used in WHERE, JOIN, ORDER BY, and uniqueness constraints, but avoid indexing every column because writes get slower.",
  "Avoid SELECT * for list rows when only title, subtitle, and timestamp are needed.",
  "Keep Flow queries stable; invalidation can re-run queries often when hot tables are updated frequently.",
  "Use @Transaction for relation graphs, but avoid huge nested graphs for screens that can render projections.",
  "Batch writes inside transactions during sync so UI does not observe half-updated cache state.",
  "Use PagingSource for large lists and RemoteMediator when backend pagination feeds the local cache.",
]);

upsertContentSection("Senior Interview Room Answers", [
  "Room vs DataStore: Room is for structured relational data, queries, transactions, migrations, and observable invalidation; DataStore is for small preferences or typed settings.",
  "Room vs raw SQLite: Room keeps SQL explicit while adding compile-time validation, observable queries, type mapping, schema export, and migration infrastructure.",
  "Flow from DAO: Room re-runs observable queries when affected tables are invalidated; UI should collect through ViewModel state, not directly own database policy.",
  "Repository boundary: repositories decide cache policy, refresh timing, network merge behavior, and error mapping; DAOs should not know product sync rules.",
  "Migration answer: export schemas, write explicit migrations, test old-to-new paths, avoid destructive migration, and treat failures as data-loss incidents.",
  "Relationship answer: use @Relation for convenience, JOIN/projections for control, and transactions when object graphs must be consistent.",
]);

upsertCodeBlock(
  "Room Entity With Indices And Foreign Key",
  "@Entity(\n    tableName = \"articles\",\n    indices = [\n        Index(value = [\"remoteId\"], unique = true),\n        Index(value = [\"authorId\"]),\n        Index(value = [\"updatedAt\"])\n    ],\n    foreignKeys = [\n        ForeignKey(\n            entity = AuthorEntity::class,\n            parentColumns = [\"id\"],\n            childColumns = [\"authorId\"],\n            onDelete = ForeignKey.CASCADE\n        )\n    ]\n)\ndata class ArticleEntity(\n    @PrimaryKey val id: String,\n    val remoteId: String,\n    val authorId: String,\n    val title: String,\n    val body: String,\n    val updatedAt: Instant,\n    val pendingSync: Boolean = false\n)",
);

upsertCodeBlock(
  "Room DAO Cheat Sheet",
  "@Dao\ninterface ArticleDao {\n    @Query(\"SELECT id, title, updatedAt FROM articles ORDER BY updatedAt DESC\")\n    fun observeArticleRows(): Flow<List<ArticleRow>>\n\n    @Query(\"SELECT * FROM articles WHERE id = :id\")\n    suspend fun getArticle(id: String): ArticleEntity?\n\n    @Transaction\n    @Query(\"SELECT * FROM articles WHERE id = :id\")\n    fun observeArticleWithAuthor(id: String): Flow<ArticleWithAuthor?>\n\n    @Upsert\n    suspend fun upsertAll(articles: List<ArticleEntity>)\n\n    @Query(\"DELETE FROM articles WHERE pendingSync = 0\")\n    suspend fun clearSyncedArticles()\n\n    @Transaction\n    suspend fun replaceCache(articles: List<ArticleEntity>) {\n        clearSyncedArticles()\n        upsertAll(articles)\n    }\n}",
);

upsertCodeBlock(
  "Room Migration Test",
  "@RunWith(AndroidJUnit4::class)\nclass AppDatabaseMigrationTest {\n    @get:Rule\n    val helper = MigrationTestHelper(\n        InstrumentationRegistry.getInstrumentation(),\n        AppDatabase::class.java\n    )\n\n    @Test\n    fun migrate1To2_preservesArticles() {\n        helper.createDatabase(TEST_DB, 1).apply {\n            execSQL(\"INSERT INTO articles(id, title) VALUES('a1', 'Room')\")\n            close()\n        }\n\n        val db = helper.runMigrationsAndValidate(TEST_DB, 2, true, MIGRATION_1_2)\n        db.query(\"SELECT id, title FROM articles WHERE id = 'a1'\").use { cursor ->\n            assertTrue(cursor.moveToFirst())\n            assertEquals(\"Room\", cursor.getString(cursor.getColumnIndexOrThrow(\"title\")))\n        }\n    }\n}",
);

fs.writeFileSync(contentPath, `${JSON.stringify(content, null, 2)}\n`);
console.log("Boosted Room Database with cheat-sheet content");
