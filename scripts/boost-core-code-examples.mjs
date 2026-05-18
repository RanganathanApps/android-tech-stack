import fs from "node:fs";
import path from "node:path";

const contentPath = path.join(process.cwd(), "data", "content.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

function findTopic(sectionId, topicTitle) {
  const section = content.find((item) => item.id === sectionId);
  const topic = (section?.topics || []).find((item) => item.title === topicTitle);
  if (!topic) throw new Error(`Missing topic: ${sectionId} / ${topicTitle}`);
  return topic;
}

function upsertCodeBlock(sectionId, topicTitle, title, code) {
  const topic = findTopic(sectionId, topicTitle);
  topic.code_blocks = (topic.code_blocks || []).filter((block) => block.title !== title);
  topic.code_blocks.push({ language: "kotlin", title, code });
}

const examples = [
  {
    sectionId: "dependency-injection",
    topicTitle: "Hilt Deep Dive",
    title: "Hilt Repository Graph With Dispatchers",
    code: `@Qualifier
annotation class IoDispatcher

@Qualifier
annotation class DefaultDispatcher

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @IoDispatcher
    fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO

    @Provides
    @DefaultDispatcher
    fun provideDefaultDispatcher(): CoroutineDispatcher = Dispatchers.Default

    @Provides
    @Singleton
    fun provideArticleRepository(
        api: ArticleApi,
        dao: ArticleDao,
        @IoDispatcher io: CoroutineDispatcher
    ): ArticleRepository = RealArticleRepository(api, dao, io)
}`,
  },
  {
    sectionId: "dependency-injection",
    topicTitle: "Hilt Deep Dive",
    title: "Hilt Test Replacement Module",
    code: `@Module
@TestInstallIn(
    components = [SingletonComponent::class],
    replaces = [AppModule::class]
)
object FakeAppModule {
    @Provides
    @Singleton
    fun provideArticleRepository(): ArticleRepository =
        FakeArticleRepository(seed = listOf(Article("1", "Hilt Test")))
}

@HiltAndroidTest
class ArticleListTest {
    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @Test
    fun articleListShowsSeedData() {
        hiltRule.inject()
        // launch screen and assert "Hilt Test" is visible
    }
}`,
  },
  {
    sectionId: "kotlin-coroutines-flow",
    topicTitle: "Coroutines Deep Dive",
    title: "Coroutine Timeout With Domain Error Mapping",
    code: `sealed interface LoadProfileResult {
    data class Success(val profile: Profile) : LoadProfileResult
    data object Timeout : LoadProfileResult
    data class Failed(val cause: Throwable) : LoadProfileResult
}

suspend fun loadProfileSafely(
    userId: String,
    repository: ProfileRepository
): LoadProfileResult = try {
    val profile = withTimeout(4_000) {
        repository.loadProfile(userId)
    }
    LoadProfileResult.Success(profile)
} catch (error: TimeoutCancellationException) {
    LoadProfileResult.Timeout
} catch (error: Throwable) {
    LoadProfileResult.Failed(error)
}`,
  },
  {
    sectionId: "kotlin-coroutines-flow",
    topicTitle: "Coroutines Deep Dive",
    title: "Structured Concurrency For Partial Dashboard",
    code: `suspend fun loadDashboard(): DashboardUiModel = supervisorScope {
    val account = async { accountRepository.getAccount() }
    val inbox = async { inboxRepository.getUnreadCount() }
    val offers = async { offersRepository.getOffers() }

    DashboardUiModel(
        account = runCatching { account.await() }.getOrNull(),
        unreadCount = runCatching { inbox.await() }.getOrDefault(0),
        offers = runCatching { offers.await() }.getOrDefault(emptyList())
    )
}`,
  },
  {
    sectionId: "kotlin-coroutines-flow",
    topicTitle: "Flow Advanced Patterns",
    title: "Flow Search Pipeline With Retry Policy",
    code: `val searchState: StateFlow<SearchUiState> = query
    .map { it.trim() }
    .debounce(300)
    .distinctUntilChanged()
    .flatMapLatest { term ->
        if (term.length < 2) {
            flowOf(SearchUiState.Idle)
        } else {
            repository.search(term)
                .map<SearchResult, SearchUiState> { SearchUiState.Content(it.items) }
                .retryWhen { error, attempt ->
                    error is IOException && attempt < 2
                }
                .onStart { emit(SearchUiState.Loading) }
                .catch { error -> emit(SearchUiState.Error(error.message ?: "Search failed")) }
        }
    }
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SearchUiState.Idle)`,
  },
  {
    sectionId: "kotlin-coroutines-flow",
    topicTitle: "Flow Advanced Patterns",
    title: "callbackFlow With awaitClose Cleanup",
    code: `fun NetworkMonitor.observeConnectivity(): Flow<Boolean> = callbackFlow {
    val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            trySend(true)
        }

        override fun onLost(network: Network) {
            trySend(false)
        }
    }

    connectivityManager.registerDefaultNetworkCallback(callback)
    awaitClose { connectivityManager.unregisterNetworkCallback(callback) }
}.distinctUntilChanged()`,
  },
  {
    sectionId: "jetpack-components-deep-dive",
    topicTitle: "WorkManager, Background Work & App Startup",
    title: "WorkManager Chain With Constraints",
    code: `val upload = OneTimeWorkRequestBuilder<UploadLogsWorker>()
    .setConstraints(
        Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
    )
    .build()

val cleanup = OneTimeWorkRequestBuilder<CleanupLogsWorker>().build()

WorkManager.getInstance(context)
    .beginUniqueWork("log-upload", ExistingWorkPolicy.KEEP, upload)
    .then(cleanup)
    .enqueue()`,
  },
  {
    sectionId: "concurrency-threading-background-work",
    topicTitle: "WorkManager: Core Mechanisms & Reliability",
    title: "CoroutineWorker With Progress And Retry",
    code: `class UploadWorker(
    appContext: Context,
    params: WorkerParameters,
    private val uploader: LogUploader
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        setProgress(workDataOf("stage" to "starting"))

        return runCatching {
            uploader.uploadPending { uploaded, total ->
                setProgress(workDataOf("uploaded" to uploaded, "total" to total))
            }
        }.fold(
            onSuccess = { Result.success() },
            onFailure = { error ->
                if (error is IOException) Result.retry() else Result.failure()
            }
        )
    }
}`,
  },
  {
    sectionId: "ui-toolkit-views-jetpack-compose",
    topicTitle: "Compose Internals",
    title: "Compose Effect Handler Pattern",
    code: `@Composable
fun ArticleScreen(
    articleId: String,
    viewModel: ArticleViewModel,
    onOpenAuthor: (String) -> Unit
) {
    val state by viewModel.observe(articleId).collectAsStateWithLifecycle()
    val latestOpenAuthor by rememberUpdatedState(onOpenAuthor)

    LaunchedEffect(articleId) {
        viewModel.trackScreenOpen(articleId)
    }

    DisposableEffect(articleId) {
        viewModel.startObservingComments(articleId)
        onDispose { viewModel.stopObservingComments(articleId) }
    }

    ArticleContent(
        state = state,
        onAuthorClick = { authorId -> latestOpenAuthor(authorId) }
    )
}`,
  },
  {
    sectionId: "ui-toolkit-views-jetpack-compose",
    topicTitle: "Jetpack Compose (Modern UI)",
    title: "State Hoisting With Events",
    code: `data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null
)

@Composable
fun LoginScreen(
    state: LoginUiState,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onSubmit: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(value = state.email, onValueChange = onEmailChanged)
        OutlinedTextField(value = state.password, onValueChange = onPasswordChanged)
        Button(onClick = onSubmit, enabled = !state.isLoading) {
            Text(if (state.isLoading) "Signing in" else "Sign in")
        }
        state.error?.let { Text(text = it, color = MaterialTheme.colorScheme.error) }
    }
}`,
  },
  {
    sectionId: "jetpack-components-deep-dive",
    topicTitle: "Compose, UI Toolkit & View Interoperability",
    title: "ComposeView Interop In Fragment",
    code: `class ProfileFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = ComposeView(requireContext()).apply {
        setViewCompositionStrategy(
            ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
        )

        setContent {
            val viewModel: ProfileViewModel = hiltViewModel()
            val state by viewModel.uiState.collectAsStateWithLifecycle()
            ProfileScreen(state = state, onRefresh = viewModel::refresh)
        }
    }
}`,
  },
  {
    sectionId: "jetpack-components-deep-dive",
    topicTitle: "Paging, Hilt, Security & Testing Components",
    title: "Paging 3 RemoteMediator Skeleton",
    code: `@OptIn(ExperimentalPagingApi::class)
class ArticleRemoteMediator(
    private val api: ArticleApi,
    private val database: AppDatabase
) : RemoteMediator<Int, ArticleEntity>() {
    override suspend fun load(
        loadType: LoadType,
        state: PagingState<Int, ArticleEntity>
    ): MediatorResult = runCatching {
        val page = when (loadType) {
            LoadType.REFRESH -> 1
            LoadType.PREPEND -> return MediatorResult.Success(endOfPaginationReached = true)
            LoadType.APPEND -> database.remoteKeyDao().nextPage() ?: return MediatorResult.Success(true)
        }

        val response = api.getArticles(page = page, pageSize = state.config.pageSize)
        database.withTransaction {
            if (loadType == LoadType.REFRESH) database.articleDao().clear()
            database.articleDao().upsertAll(response.items.map { it.toEntity() })
            database.remoteKeyDao().saveNextPage(response.nextPage)
        }

        MediatorResult.Success(endOfPaginationReached = response.nextPage == null)
    }.getOrElse { error ->
        MediatorResult.Error(error)
    }
}`,
  },
  {
    sectionId: "jetpack-components-deep-dive",
    topicTitle: "Paging, Hilt, Security & Testing Components",
    title: "Paging Flow In ViewModel",
    code: `@HiltViewModel
class ArticleListViewModel @Inject constructor(
    repository: ArticleRepository
) : ViewModel() {
    val articles: Flow<PagingData<ArticleUiModel>> =
        repository.pagedArticles()
            .map { pagingData -> pagingData.map { it.toUiModel() } }
            .cachedIn(viewModelScope)
}`,
  },
  {
    sectionId: "state-navigation",
    topicTitle: "Compose Navigation",
    title: "Compose Navigation With Result",
    code: `@Serializable
data class EditProfileRoute(val userId: String)

fun NavGraphBuilder.profileGraph(navController: NavHostController) {
    composable<EditProfileRoute> { entry ->
        val route = entry.toRoute<EditProfileRoute>()
        EditProfileScreen(
            userId = route.userId,
            onSaved = {
                navController.previousBackStackEntry
                    ?.savedStateHandle
                    ?.set("profile_updated", true)
                navController.popBackStack()
            }
        )
    }
}`,
  },
  {
    sectionId: "state-navigation",
    topicTitle: "Type-Safe Compose Navigation",
    title: "Navigation 3 Style Route Contracts",
    code: `@Serializable
data class FeedRoute(val selectedTag: String? = null)

@Serializable
data class ArticleRoute(val articleId: String)

interface FeedNavigator {
    fun openArticle(articleId: String)
}

class AppFeedNavigator(
    private val navController: NavHostController
) : FeedNavigator {
    override fun openArticle(articleId: String) {
        navController.navigate(ArticleRoute(articleId))
    }
}`,
  },
  {
    sectionId: "jetpack-components-deep-dive",
    topicTitle: "Navigation, Activity Result APIs & Modular Screens",
    title: "Activity Result API Permission Contract",
    code: `@Composable
fun CameraPermissionGate(
    onGranted: () -> Unit
) {
    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) onGranted()
    }

    Button(onClick = { launcher.launch(Manifest.permission.CAMERA) }) {
        Text("Enable camera")
    }
}`,
  },
  {
    sectionId: "jetpack-components-deep-dive",
    topicTitle: "Lifecycle, ViewModel & State Management",
    title: "SavedStateHandle StateFlow Route State",
    code: `@HiltViewModel
class DetailsViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    repository: ArticleRepository
) : ViewModel() {
    private val articleId: String = checkNotNull(savedStateHandle["articleId"])

    val uiState: StateFlow<DetailsUiState> =
        repository.observeArticle(articleId)
            .map { article -> DetailsUiState.Content(article.toUiModel()) }
            .catch { emit(DetailsUiState.Error) }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),
                initialValue = DetailsUiState.Loading
            )
}`,
  },
];

for (const example of examples) {
  upsertCodeBlock(example.sectionId, example.topicTitle, example.title, example.code);
}

fs.writeFileSync(contentPath, `${JSON.stringify(content, null, 2)}\n`);
console.log(`Upserted ${examples.length} boosted Kotlin code examples`);
