import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuditIssueDto } from "@/application/auditing/dto";
import type { FixCandidateDto } from "@/application/fixes/dto";
import type { WordPressConnectionDto } from "@/application/wordpress/dto";
import type { KeywordOpportunityDto } from "@/application/tracking/dto";
import type { Language } from "@/hooks/use-language";

export type KeywordOpportunityRow = KeywordOpportunityDto & { suggestion: string | null };

export type GoogleStatusDto =
  | { connected: false }
  | {
      connected: true;
      gscSiteUrl: string | null;
      ga4PropertyId: string | null;
      autoRefreshEnabled: boolean;
      createdAt: string;
      availableSites?: string[];
    };

export interface EventFailureDto {
  id: string;
  eventType: string;
  message: string;
  occurredAt: string;
}

export const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  performance: "Performance",
  structured_data: "Structured Data",
};

export const POLLABLE_STATUSES = new Set(["PENDING", "RUNNING"]);
export const POLL_ATTEMPTS = 10;
export const POLL_INTERVAL_MS = 1000;

// Grouping cards into tabs (rather than one long stacked column) keeps a
// big issue list from burying Outputs/Integrations far down the page —
// the exact complaint that prompted this. Pure presentation: no fetching
// or state logic changes based on which tab is active.
export type TabId = "overview" | "issues" | "growth" | "integrations" | "outputs";
export const TABS: Array<{ id: TabId; key: TranslationKey }> = [
  { id: "overview", key: "tabOverview" },
  { id: "issues", key: "tabIssues" },
  { id: "growth", key: "tabGrowth" },
  { id: "integrations", key: "tabIntegrations" },
  { id: "outputs", key: "tabOutputs" },
];

// Full-coverage translation dictionary for the dashboard: every user-facing
// string (headings, buttons, error messages, empty states, table headers,
// hints) goes through `t()`, not just headings/tab names as before — a
// partial dictionary meant TR mode still showed English sentences
// throughout. Dynamic values (counts, URLs, dates) are interpolated by the
// caller; static microcopy lives here so no screen is ever mixed-language.
export const TRANSLATIONS = {
  allSites: { en: "All sites", tr: "Tüm siteler" },
  guide: { en: "Guide", tr: "Kılavuz" },
  settings: { en: "Settings", tr: "Ayarlar" },
  verified: { en: "Verified", tr: "Doğrulandı" },
  unverified: { en: "Unverified", tr: "Doğrulanmadı" },
  tabOverview: { en: "Overview", tr: "Genel Bakış" },
  tabIssues: { en: "Issues & Fixes", tr: "Sorunlar & Düzeltmeler" },
  tabGrowth: { en: "Growth", tr: "Büyüme" },
  tabIntegrations: { en: "Integrations", tr: "Entegrasyonlar" },
  tabOutputs: { en: "Outputs", tr: "Çıktılar" },
  cardCrawl: { en: "Crawl", tr: "Tarama" },
  cardAuditScore: { en: "Audit Score", tr: "Denetim Skoru" },
  cardTrend: { en: "Trend", tr: "Trend" },
  cardAudit: { en: "Audit", tr: "Denetim" },
  cardAiVisibility: { en: "AI Visibility", tr: "AI Görünürlük" },
  cardWordPress: { en: "WordPress", tr: "WordPress" },
  cardSearchPerformance: { en: "Search Performance", tr: "Arama Performansı" },
  cardRobots: { en: "Robots.txt", tr: "Robots.txt" },
  cardSchema: { en: "Schema Markup", tr: "Şema İşaretleme" },
  cardSitemap: { en: "Sitemap", tr: "Site Haritası" },
  cardLlmsTxt: { en: "llms.txt", tr: "llms.txt" },
  cardVerify: { en: "Verify domain ownership", tr: "Domain sahipliğini doğrula" },
  startCrawl: { en: "Start crawl", tr: "Taramayı başlat" },
  starting: { en: "Starting…", tr: "Başlatılıyor…" },
  crawling: { en: "Crawling…", tr: "Taranıyor…" },
  checkVerification: { en: "Check verification", tr: "Doğrulamayı kontrol et" },
  checking: { en: "Checking…", tr: "Kontrol ediliyor…" },
  connect: { en: "Connect", tr: "Bağlan" },
  connecting: { en: "Connecting…", tr: "Bağlanıyor…" },
  disconnect: { en: "Disconnect", tr: "Bağlantıyı kes" },
  disconnecting: { en: "Disconnecting…", tr: "Bağlantı kesiliyor…" },
  copy: { en: "Copy", tr: "Kopyala" },
  copied: { en: "Copied!", tr: "Kopyalandı!" },
  copyFullReport: { en: "Copy full report", tr: "Tüm raporu kopyala" },
  copyReport: { en: "Copy report", tr: "Raporu kopyala" },
  copyEverything: { en: "Copy everything", tr: "Tümünü kopyala" },
  prepareFixPlan: { en: "Prepare fix plan", tr: "Düzeltme planı hazırla" },
  preparingFixPlan: { en: "Preparing…", tr: "Hazırlanıyor…" },
  approveApply: { en: "Approve & Apply", tr: "Onayla & Uygula" },
  applying: { en: "Applying…", tr: "Uygulanıyor…" },
  revert: { en: "Revert", tr: "Geri al" },
  reverting: { en: "Reverting…", tr: "Geri alınıyor…" },
  viewIssuesAndFixes: { en: "View issues & fixes →", tr: "Sorunları & düzeltmeleri gör →" },
  cardAutoPilot: { en: "Otomatik Pilot", tr: "Otomatik Pilot" },
  autoPilotDescription: {
    en: "When on, this project re-crawls itself daily and automatically applies Title/Meta description fixes to your connected WordPress site — every other fix type stays manual.",
    tr: "Açıkken bu proje her gün kendini yeniden tarar ve bağlı WordPress sitenizdeki Title/Meta description düzeltmelerini otomatik uygular — diğer tüm düzeltme tipleri manuel kalır.",
  },
  autoPilotNoWordPress: {
    en: "Re-crawling will run daily; connect WordPress above to also enable auto-apply.",
    tr: "Yeniden tarama her gün çalışacak; otomatik uygulamayı açmak için yukarıdan WordPress'e bağlanın.",
  },
  autoPilotOn: { en: "On", tr: "Açık" },
  autoPilotOff: { en: "Off", tr: "Kapalı" },
  autoPilotUpdating: { en: "Updating…", tr: "Güncelleniyor…" },
  publish: { en: "Publish to WordPress", tr: "WordPress'e yayınla" },
  publishing: { en: "Publishing…", tr: "Yayınlanıyor…" },
  published: { en: "Published", tr: "Yayınlandı" },
  publishFailed: { en: "Publish failed", tr: "Yayınlama başarısız" },
  draftNeedsWordPress: { en: "Connect WordPress above to publish this draft directly.", tr: "Bu taslağı doğrudan yayınlamak için yukarıdan WordPress'e bağlanın." },

  // --- IssueRow (shared) ---
  generatingRecommendation: { en: "Generating recommendation…", tr: "Öneri oluşturuluyor…" },
  fixLabel: { en: "fix", tr: "düzeltme" },
  applied: { en: "Applied", tr: "Uygulandı" },
  applyFailed: { en: "Apply failed", tr: "Uygulama başarısız" },
  connectWordPressToApply: {
    en: "Connect WordPress to apply this automatically — for now, copy it in manually.",
    tr: "Bunu otomatik uygulamak için WordPress'e bağlanın — şimdilik elle kopyalayın.",
  },
  noAutoApplyForFixType: {
    en: "No automatic apply for this fix type yet — copy it in manually.",
    tr: "Bu düzeltme tipi için henüz otomatik uygulama yok — elle kopyalayın.",
  },
  metaDescriptionExcerptNote: {
    en: "Applies to WordPress's excerpt field — whether this changes your live meta description tag depends on your theme/SEO plugin.",
    tr: "WordPress'in excerpt alanına uygulanır — canlı meta açıklama etiketinizi değiştirip değiştirmeyeceği tema/SEO eklentinize bağlıdır.",
  },
  noTrafficDataTooltip: {
    en: "No Search Console traffic data for this page yet — ranked by severity only",
    tr: "Bu sayfa için henüz Search Console trafik verisi yok — sadece önem derecesine göre sıralandı",
  },
  trafficImpact: { en: "traffic impact", tr: "trafik etkisi" },
  noDataYet: { en: "no data yet", tr: "veri yok" },
  impressionsAbbrev: { en: "impr.", tr: "gösterim" },
  impressionsSlashClicksLast30Days: { en: "impressions / {clicks} clicks (last 30 days)", tr: "gösterim / {clicks} tıklama (son 30 gün)" },

  // --- Overview tab ---
  seoHealth: { en: "SEO Health", tr: "SEO Sağlığı" },
  runACrawl: { en: "Run a crawl", tr: "Bir tarama çalıştır" },
  aiVisibility: { en: "AI Visibility", tr: "AI Görünürlük" },
  notMeasuredYet: { en: "Not measured yet", tr: "Henüz ölçülmedi" },
  recommendedByAi: { en: "recommended by AI", tr: "AI tarafından öneriliyor" },
  citedInSources: { en: "Cited in sources", tr: "Kaynaklarda atıf" },
  measureWithWebSearch: { en: "Measure with web search", tr: "Web aramasıyla ölç" },
  inAiSearchAnswers: { en: "in AI-search answers", tr: "AI arama cevaplarında" },
  pendingFixes: { en: "Pending fixes", tr: "Bekleyen düzeltmeler" },
  readyToApply: { en: "ready to apply", tr: "uygulamaya hazır" },
  nothingPending: { en: "nothing pending", tr: "bekleyen yok" },
  issueCountLabel: { en: "issue", tr: "sorun" },
  issueCountLabelPlural: { en: "issues", tr: "sorun" },
  pagesCrawled: { en: "Pages crawled", tr: "Taranan sayfa" },
  score: { en: "Score", tr: "Skor" },
  contentIdeasTitle: { en: "Content Ideas", tr: "İçerik Fikirleri" },
  generateContentIdeas: { en: "Generate content ideas", tr: "İçerik fikirleri üret" },
  regenerate: { en: "Regenerate", tr: "Yeniden üret" },
  generatingEllipsis: { en: "Generating…", tr: "Üretiliyor…" },
  contentIdeasDescription: {
    en: "New-page ideas based on your existing pages' topics — common questions people ask that this site doesn't appear to have a dedicated page for yet. These are LLM-generated ideas to consider, not measured search data or a guarantee of traffic.",
    tr: "Mevcut sayfalarınızın konularına dayalı yeni sayfa fikirleri — bu sitenin henüz özel bir sayfası olmayan, insanların sıkça sorduğu sorular. Bunlar değerlendirilecek LLM tarafından üretilmiş fikirlerdir, ölçülmüş arama verisi veya trafik garantisi değildir.",
  },
  fromLabel: { en: "From", tr: "Kaynak" },
  resolved: { en: "resolved", tr: "çözüldü" },
  newLabel: { en: "new", tr: "yeni" },
  unchanged: { en: "unchanged", tr: "değişmedi" },
  fixed: { en: "Fixed", tr: "Düzeltildi" },
  pagesCrawledArrow: { en: "pages crawled", tr: "sayfa tarandı" },
  scorePerPageNote: {
    en: "score is a per-page average, so a deeper crawl can shift the issue count a lot while the score barely moves",
    tr: "skor sayfa başına ortalamadır, bu yüzden daha derin bir tarama skor neredeyse hiç değişmeden sorun sayısını çok değiştirebilir",
  },
  noTitle: { en: "(no title)", tr: "(başlık yok)" },

  // --- Issues tab ---
  noAuditYet: {
    en: "No audit yet — run a crawl from the Overview tab first.",
    tr: "Henüz denetim yok — önce Genel Bakış sekmesinden bir tarama çalıştırın.",
  },
  pagesAffectedBySameIssue: { en: "pages affected by the same underlying issue", tr: "sayfa aynı temel sorundan etkileniyor" },
  hidePages: { en: "Hide pages", tr: "Sayfaları gizle" },
  showPages: { en: "Show pages", tr: "Sayfaları göster" },
  pagesMatchTemplate: { en: "pages match this template (e.g.", tr: "sayfa bu şablonla eşleşiyor (örn." },
  fixingTemplateFixesAll: { en: ") — fixing the template fixes all of them", tr: ") — şablonu düzeltmek hepsini düzeltir" },

  // --- Growth tab ---
  aiVisibilityDescription: {
    en: "Measures whether AI answer engines (e.g. ChatGPT) recommend your site for buyer-intent queries — the discovery layer no classic SEO tool sees. Click Suggest queries to have the tool propose them from your site, or type your own (one per line). Each is sampled several times, so this can take a minute.",
    tr: "AI cevap motorlarının (ör. ChatGPT) sitenizi alıcı niyetli sorgular için önerip önermediğini ölçer — hiçbir klasik SEO aracının görmediği keşif katmanı. Aracın kendi sitenizden önermesi için Sorgu öner'e tıklayın, ya da kendi sorgularınızı yazın (satır başına bir tane). Her biri birkaç kez örneklenir, bu yüzden bir dakika sürebilir.",
  },
  suggestQueries: { en: "Suggest queries", tr: "Sorgu öner" },
  suggesting: { en: "Suggesting…", tr: "Öneriliyor…" },
  measure: { en: "Measure", tr: "Ölç" },
  measuring: { en: "Measuring…", tr: "Ölçülüyor…" },
  remeasure: { en: "Re-measure", tr: "Yeniden ölç" },
  compareEngines: { en: "Compare engines", tr: "Motorları karşılaştır" },
  comparing: { en: "Comparing…", tr: "Karşılaştırılıyor…" },
  compareEnginesTooltip: {
    en: "Measure on every configured engine and compare",
    tr: "Yapılandırılmış her motorda ölç ve karşılaştır",
  },
  engineComparison: { en: "Engine comparison", tr: "Motor karşılaştırması" },
  engine: { en: "Engine", tr: "Motor" },
  recommended: { en: "Recommended", tr: "Önerildi" },
  winnable: { en: "Winnable", tr: "Kazanılabilir" },
  contested: { en: "Contested", tr: "Tartışmalı" },
  cited: { en: "Cited", tr: "Atıf yapıldı" },
  couldntMeasure: { en: "Couldn't measure:", tr: "Ölçülemedi:" },
  useLiveWebSearch: {
    en: "Use live web search (real AI-search surface + source citations). Uncheck for a faster, cheaper memory-only reading.",
    tr: "Canlı web aramasını kullan (gerçek AI-arama yüzeyi + kaynak atıfları). Daha hızlı, ucuz bellek-tabanlı okuma için işareti kaldırın.",
  },
  targetQueries: { en: "Target queries (one per line)", tr: "Hedef sorgular (satır başına bir tane)" },
  knownCompetitors: { en: "Known competitors (comma-separated, optional)", tr: "Bilinen rakipler (virgülle ayrılmış, opsiyonel)" },
  noProbeRunYet: { en: "No probe run yet for this project.", tr: "Bu proje için henüz bir ölçüm çalıştırılmadı." },
  trendRuns: { en: "Trend", tr: "Trend" },
  runsLabel: { en: "runs", tr: "çalıştırma" },
  samples: { en: "samples", tr: "örnek" },
  liveWebSearch: { en: "live web search", tr: "canlı web araması" },
  modelMemory: { en: "model memory", tr: "model belleği" },
  since: { en: "since", tr: "şu tarihten beri" },
  vsLast: { en: "vs last", tr: "öncekine göre" },
  competitorsDominating: { en: "Competitors dominating:", tr: "Baskın rakipler:" },
  winnableQueriesNoIncumbent: { en: "Winnable queries (no incumbent yet):", tr: "Kazanılabilir sorgular (henüz sahibi yok):" },
  whyNot: { en: "Why not?", tr: "Neden değil?" },
  diagnosing: { en: "Diagnosing…", tr: "Teşhis ediliyor…" },
  sourcesCited: { en: "Sources cited", tr: "Atıf yapılan kaynaklar" },
  draftContent: { en: "Draft content", tr: "İçerik taslağı hazırla" },
  drafting: { en: "Drafting…", tr: "Taslak hazırlanıyor…" },
  copiedLabel: { en: "Copied", tr: "Kopyalandı" },
  draftCreatedInWordPress: { en: "Draft created in WordPress", tr: "WordPress'te taslak oluşturuldu" },
  connectWordPressToPushDraft: {
    en: "Connect WordPress (Integrations tab) to push this as a new draft page.",
    tr: "Bunu yeni bir taslak sayfa olarak göndermek için WordPress'e bağlanın (Entegrasyonlar sekmesi).",
  },
  faq: { en: "FAQ", tr: "SSS" },
  experiments: { en: "Experiments", tr: "Deneyler" },
  experimentsDescription: {
    en: "What moved after you drafted content — observed over time, not proven causation.",
    tr: "İçerik taslağı hazırladıktan sonra ne değişti — zaman içinde gözlemlenmiştir, kanıtlanmış nedensellik değildir.",
  },
  tracking: { en: "tracking…", tr: "izleniyor…" },
  growthAnalysisTitle: { en: "Growth Analysis", tr: "Büyüme Analizi" },
  generateGrowthAnalysis: { en: "Generate growth analysis", tr: "Büyüme analizi üret" },
  analyzing: { en: "Analyzing…", tr: "Analiz ediliyor…" },
  growthAnalysisDescription: {
    en: "A business-growth read of your whole site — not a technical audit. Identifies missing content, weak conversion pages, and new pages worth writing, reasoned from your crawled pages as one business. LLM-generated ideas to consider, not measured search data or a traffic guarantee.",
    tr: "Tüm sitenizin iş büyümesi okuması — teknik bir denetim değil. Taranan sayfalarınızdan tek bir işletme olarak akıl yürüterek eksik içerikleri, zayıf dönüşüm sayfalarını ve yazılmaya değer yeni sayfaları belirler. Değerlendirilecek LLM tarafından üretilmiş fikirlerdir, ölçülmüş arama verisi veya trafik garantisi değildir.",
  },
  noAnalysisGeneratedYet: { en: "No analysis generated yet for this project.", tr: "Bu proje için henüz analiz üretilmedi." },
  businessUnderstanding: { en: "Business Understanding", tr: "İş Anlayışı" },
  contentCoverageGaps: { en: "Content Coverage Gaps", tr: "İçerik Kapsama Boşlukları" },
  highImpactOpportunities: { en: "High-Impact Content Opportunities", tr: "Yüksek Etkili İçerik Fırsatları" },
  intentLabel: { en: "Intent", tr: "Niyet" },
  revenueCase: { en: "Revenue case:", tr: "Gelir gerekçesi:" },
  conversionOpportunities: { en: "Conversion Opportunities on Existing Pages", tr: "Mevcut Sayfalarda Dönüşüm Fırsatları" },
  competitorLikePagesMissing: { en: "Competitor-Like Pages Missing", tr: "Rakip Benzeri Eksik Sayfalar" },
  next10Pages: { en: "Next 10 Pages To Create", tr: "Oluşturulacak Sonraki 10 Sayfa" },
  executiveSummary: { en: "Executive Summary", tr: "Yönetici Özeti" },
  pageContentDraftTitle: { en: "Page Content Draft", tr: "Sayfa İçerik Taslağı" },
  pageContentDraftDescription: {
    en: "Generate ready-to-publish content for a crawled page — a suggested title, meta description, body sections, and a full FAQ, in the page's own language, grounded in the page's real content. Turns a content gap into something you can paste straight in.",
    tr: "Taranan bir sayfa için yayına hazır içerik üretin — sayfanın kendi dilinde, sayfanın gerçek içeriğine dayalı önerilen başlık, meta açıklama, gövde bölümleri ve tam bir SSS. Bir içerik boşluğunu doğrudan yapıştırabileceğiniz bir şeye dönüştürür.",
  },
  runCrawlFromOverviewFirst: { en: "Run a crawl from the Overview tab first.", tr: "Önce Genel Bakış sekmesinden bir tarama çalıştırın." },
  selectAPage: { en: "Select a page…", tr: "Bir sayfa seçin…" },
  generateDraft: { en: "Generate draft", tr: "Taslak üret" },
  writingEllipsis: { en: "Writing…", tr: "Yazılıyor…" },
  draftPrefix: { en: "Draft", tr: "Taslak" },
  title: { en: "Title", tr: "Başlık" },
  metaDescription: { en: "Meta description", tr: "Meta açıklama" },
  mentionedOpenContestedTooltip: {
    en: "Mentioned / Open / Contested sample counts",
    tr: "Önerildi / Açık / Tartışmalı örnek sayıları",
  },
  uncertainReadingTooltip: {
    en: "Reading too split to trust ({pct}% consensus) — measure again with more samples",
    tr: "Sonuç güvenilir olamayacak kadar dağınık (%{pct} uzlaşma) — daha fazla örnekle yeniden ölçün",
  },
  uncertainBadge: { en: "uncertain", tr: "belirsiz" },
  citedSamplesTooltip: { en: "Samples that cited your domain", tr: "Domaininize atıf yapan örnekler" },
  nowCitedInSourcesTooltip: { en: "Now cited in AI-search sources", tr: "Artık AI-arama kaynaklarında atıf yapılıyor" },
  citedBadge: { en: "cited", tr: "atıf yapıldı" },
  competitorPlaceholderExample: { en: "Polymarket, Kalshi, Manifold", tr: "Polymarket, Kalshi, Manifold" },
  winnableOpen: { en: "Winnable (open)", tr: "Kazanılabilir (açık)" },

  // --- Integrations tab ---
  connectedLabel: { en: "Connected", tr: "Bağlı" },
  notConnected: { en: "Not connected", tr: "Bağlı değil" },
  siteLabel: { en: "Site", tr: "Site" },
  asLabel: { en: "as", tr: "kullanıcı adı ile" },
  wordPressConnectDescription: {
    en: "Connect a WordPress site to apply title and meta description fixes directly — generate an Application Password from your WordPress admin (Users → Profile) and paste it below. Other fix types stay copy-paste only for now.",
    tr: "Title ve meta açıklama düzeltmelerini doğrudan uygulamak için bir WordPress sitesi bağlayın — WordPress yöneticinizden (Kullanıcılar → Profil) bir Uygulama Şifresi oluşturun ve aşağıya yapıştırın. Diğer düzeltme tipleri şimdilik yalnızca kopyala-yapıştır.",
  },
  applicationPassword: { en: "Application Password", tr: "Uygulama Şifresi" },
  siteUrl: { en: "Site URL", tr: "Site URL" },
  username: { en: "Username", tr: "Kullanıcı adı" },
  applicationPasswordField: { en: "Application password", tr: "Uygulama şifresi" },
  googleConnectDescription: {
    en: "Connect a Google account to pull Search Console rankings and GA4 organic traffic into this dashboard — read-only, never writes anything to your Google account.",
    tr: "Search Console sıralamalarını ve GA4 organik trafiğini bu panele çekmek için bir Google hesabı bağlayın — salt okunur, Google hesabınıza asla bir şey yazmaz.",
  },
  connectGoogleAccount: { en: "Connect Google Account", tr: "Google Hesabı Bağla" },
  waitingForAuthorization: { en: "Waiting for authorization…", tr: "Yetkilendirme bekleniyor…" },
  pickSearchConsoleProperty: { en: "Pick the Search Console property for this site:", tr: "Bu site için Search Console mülkünü seçin:" },
  noSearchConsoleProperties: {
    en: "No Search Console properties found for this Google account — add and verify this site in Search Console first.",
    tr: "Bu Google hesabı için Search Console mülkü bulunamadı — önce bu siteyi Search Console'a ekleyip doğrulayın.",
  },
  searchConsoleLabel: { en: "Search Console", tr: "Search Console" },
  dateLabel: { en: "Date", tr: "Tarih" },
  clicksLabel: { en: "Clicks", tr: "Tıklama" },
  impressionsLabel: { en: "Impressions", tr: "Gösterim" },
  ctrLabel: { en: "CTR", tr: "TO" },
  avgPositionLabel: { en: "Avg. position", tr: "Ort. sıralama" },
  ga4PropertyIdLabel: { en: "GA4 Property ID (optional, for organic traffic)", tr: "GA4 Mülk Kimliği (opsiyonel, organik trafik için)" },
  save: { en: "Save", tr: "Kaydet" },
  organicSessions: { en: "Organic sessions", tr: "Organik oturum" },
  conversionsLabel: { en: "Conversions", tr: "Dönüşüm" },
  autoRefreshDaily: { en: "Auto-refresh daily while Seos is open", tr: "Seos açıkken günlük otomatik yenile" },
  refreshNow: { en: "Refresh now", tr: "Şimdi yenile" },
  refreshing: { en: "Refreshing…", tr: "Yenileniyor…" },
  keywordOpportunitiesTitle: { en: "Keyword Opportunities", tr: "Anahtar Kelime Fırsatları" },
  keywordOpportunitiesDescription: {
    en: "Pages already ranking on Google but not yet on page 1 — the highest-ROI targets for a content improvement, since relevance is already established.",
    tr: "Google'da zaten sıralanan ama henüz 1. sayfada olmayan sayfalar — alaka zaten kurulduğu için içerik iyileştirmesi için en yüksek geri dönüşlü hedefler.",
  },
  positionLabel: { en: "Position", tr: "Sıralama" },
  generateContentSuggestion: { en: "Generate content suggestion", tr: "İçerik önerisi üret" },
  keywordCannibalizationTitle: { en: "Keyword Cannibalization", tr: "Anahtar Kelime Yamyamlığı" },
  keywordCannibalizationDescription: {
    en: "Two or more pages competing for the same query split (and likely suppress) each other's ranking — consider consolidating them or differentiating their targeting.",
    tr: "Aynı sorgu için yarışan iki veya daha fazla sayfa birbirlerinin sıralamasını bölüyor (ve muhtemelen bastırıyor) — bunları birleştirmeyi veya hedeflemelerini farklılaştırmayı düşünün.",
  },
  ctrUnderperformersTitle: { en: "CTR Underperformers", tr: "TO Düşük Performans Gösterenler" },
  ctrUnderperformersDescription: {
    en: "These pages rank well but get far fewer clicks than this site's own average at that rank — the ranking is fine, the title or meta description in the snippet isn't earning the clicks it should.",
    tr: "Bu sayfalar iyi sıralanıyor ama o sıralamadaki site ortalamasından çok daha az tıklama alıyor — sıralama iyi, snippet'teki başlık veya meta açıklama hak ettiği tıklamayı almıyor.",
  },
  expectedLabel: { en: "expected", tr: "beklenen" },
  impressionsInline: { en: "impressions", tr: "gösterim" },
  clicksInline: { en: "clicks", tr: "tıklama" },
  ctrVsLabel: { en: "CTR vs.", tr: "TO'ya karşı" },

  // --- Outputs tab ---
  generated: { en: "generated", tr: "oluşturuldu" },
  viewRobotsTxt: { en: "View robots.txt", tr: "robots.txt görüntüle" },
  hideRobotsTxt: { en: "Hide robots.txt", tr: "robots.txt gizle" },
  jsonLdBlocksGenerated: { en: "JSON-LD block(s) generated", tr: "JSON-LD blok(u) oluşturuldu" },
  viewJsonLd: { en: "View JSON-LD", tr: "JSON-LD görüntüle" },
  hideJsonLd: { en: "Hide JSON-LD", tr: "JSON-LD gizle" },
  urlsLabel: { en: "URLs", tr: "URL" },
  viewSitemapXml: { en: "View sitemap.xml", tr: "sitemap.xml görüntüle" },
  hideSitemapXml: { en: "Hide sitemap.xml", tr: "sitemap.xml gizle" },
  pagesListedLabel: { en: "page(s) listed", tr: "sayfa listelendi" },
  viewLlmsTxt: { en: "View llms.txt", tr: "llms.txt görüntüle" },
  hideLlmsTxt: { en: "Hide llms.txt", tr: "llms.txt gizle" },
  nothingGeneratedYet: {
    en: "Nothing generated yet — these appear automatically once a crawl completes.",
    tr: "Henüz bir şey oluşturulmadı — bir tarama tamamlandığında bunlar otomatik olarak görünür.",
  },

  // --- Sites page ---
  sitesTitle: { en: "Sites", tr: "Siteler" },
  sitesSubtitleWithProjects: {
    en: "Measure and grow how AI assistants recommend each of your sites.",
    tr: "AI asistanlarının her bir sitenizi nasıl önerdiğini ölçün ve büyütün.",
  },
  sitesSubtitleEmpty: {
    en: "Connect your first site to see how AI assistants recommend it.",
    tr: "AI asistanlarının onu nasıl önerdiğini görmek için ilk sitenizi bağlayın.",
  },
  addAnotherSite: { en: "Add another site", tr: "Başka bir site ekle" },
  setUpFirstSite: { en: "Set up your first site", tr: "İlk sitenizi kurun" },
  setUpFirstSiteDescription: {
    en: "Add a name and domain to start measuring how AI assistants like ChatGPT and Perplexity recommend your site — and close the gaps where they don't.",
    tr: "ChatGPT ve Perplexity gibi AI asistanlarının sitenizi nasıl önerdiğini ölçmeye başlamak için bir isim ve domain ekleyin — ve önermedikleri boşlukları kapatın.",
  },
  openDashboard: { en: "Open dashboard →", tr: "Panele git →" },
  setupBadge: { en: "Setup", tr: "Kurulum" },
  projectName: { en: "Project name", tr: "Proje adı" },
  domain: { en: "Domain", tr: "Domain" },
  createProject: { en: "Create project", tr: "Proje oluştur" },
  creating: { en: "Creating…", tr: "Oluşturuluyor…" },
  failedToDisconnect: { en: "Failed to disconnect", tr: "Bağlantı kesilemedi" },
  disconnectConfirm: {
    en: "Disconnect \"{domain}\"? This permanently deletes its crawl history, audit results, and any WordPress/Google connections. This can't be undone.",
    tr: "\"{domain}\" bağlantısı kesilsin mi? Bu, tarama geçmişini, denetim sonuçlarını ve tüm WordPress/Google bağlantılarını kalıcı olarak siler. Bu geri alınamaz.",
  },
  failedToCreateProject: { en: "Failed to create project", tr: "Proje oluşturulamadı" },
  projectNamePlaceholder: { en: "My Site", tr: "Sitem" },

  // --- Settings page ---
  settingsTitle: { en: "Settings", tr: "Ayarlar" },
  settingsSubtitle: {
    en: "Configure the AI provider for content, and the engines to measure your visibility on.",
    tr: "İçerik için AI sağlayıcısını ve görünürlüğünüzü ölçeceğiniz motorları yapılandırın.",
  },
  aiProviderTitle: { en: "AI Provider", tr: "AI Sağlayıcı" },
  configuredLabel: { en: "Configured:", tr: "Yapılandırıldı:" },
  notConfiguredHint: {
    en: "Not configured — audit recommendations use free, template-based text until a key is added here.",
    tr: "Yapılandırılmadı — buraya bir anahtar eklenene kadar denetim önerileri ücretsiz, şablon tabanlı metin kullanır.",
  },
  provider: { en: "Provider", tr: "Sağlayıcı" },
  apiKey: { en: "API Key", tr: "API Anahtarı" },
  apiKeyReplaceHint: { en: "Enter a new key to replace the saved one", tr: "Kaydedilmiş anahtarı değiştirmek için yeni bir anahtar girin" },
  apiKeyStaysHint: {
    en: "Stays on this computer, encrypted at rest — never sent anywhere except the provider you pick above.",
    tr: "Bu bilgisayarda kalır, şifrelenmiş olarak saklanır — yukarıda seçtiğiniz sağlayıcı dışında hiçbir yere gönderilmez.",
  },
  modelOptional: { en: "Model (optional)", tr: "Model (opsiyonel)" },
  modelDefaultHint: { en: "Defaults to a sensible model for the provider", tr: "Sağlayıcı için makul bir modele varsayılan olur" },
  saveLabel: { en: "Save", tr: "Kaydet" },
  saving: { en: "Saving…", tr: "Kaydediliyor…" },
  removeLabel: { en: "Remove", tr: "Kaldır" },
  removing: { en: "Removing…", tr: "Kaldırılıyor…" },
  measurementEnginesTitle: { en: "Measurement engines", tr: "Ölçüm motorları" },
  measurementEnginesDescription: {
    en: "Add a key for each AI engine you want to measure on. One \"Measure\" then probes all of them and compares your visibility side by side — a site recommended on ChatGPT can be invisible on Gemini.",
    tr: "Ölçüm yapmak istediğiniz her AI motoru için bir anahtar ekleyin. Bir \"Ölç\" hepsini yoklar ve görünürlüğünüzü yan yana karşılaştırır — ChatGPT'de önerilen bir site Gemini'de görünmez olabilir.",
  },
  engineKeyReplaceHint: { en: "Enter a new key to replace the saved one", tr: "Kaydedilmiş anahtarı değiştirmek için yeni bir anahtar girin" },
  engineKeyEnterHint: { en: "Enter this engine's API key", tr: "Bu motorun API anahtarını girin" },
  storedEncryptedHint: { en: "Stored on this computer, encrypted at rest.", tr: "Bu bilgisayarda şifrelenmiş olarak saklanır." },
  updateKey: { en: "Update key", tr: "Anahtarı güncelle" },
  addEngine: { en: "Add engine", tr: "Motor ekle" },
  networkErrorRetry: { en: "Network error — check your connection and try again.", tr: "Ağ hatası — bağlantınızı kontrol edip tekrar deneyin." },
  someBackgroundProcessingFailed: { en: "Some background processing failed", tr: "Bazı arka plan işlemleri başarısız oldu" },
  backgroundStepsFailedNote: {
    en: "These steps failed and won't retry automatically — some results above may be missing.",
    tr: "Bu adımlar başarısız oldu ve otomatik olarak yeniden denenmeyecek — yukarıdaki bazı sonuçlar eksik olabilir.",
  },
  networkErrorTryAgain: { en: "Network error — try again.", tr: "Ağ hatası — tekrar deneyin." },
  verificationCheckFailed: { en: "Verification check failed", tr: "Doğrulama kontrolü başarısız oldu" },
  domainVerified: { en: "Domain verified!", tr: "Domain doğrulandı!" },
  notVerifiedYetRecordNotFound: { en: "Not verified yet — record not found.", tr: "Henüz doğrulanmadı — kayıt bulunamadı." },
  failedToGenerateContentIdeas: { en: "Failed to generate content ideas", tr: "İçerik fikirleri üretilemedi" },
  failedToSuggestQueries: { en: "Failed to suggest queries", tr: "Sorgu önerisi yapılamadı" },
  failedToDiagnose: { en: "Failed to diagnose", tr: "Teşhis yapılamadı" },
  failedToDraftContent: { en: "Failed to draft content", tr: "İçerik taslağı hazırlanamadı" },
  failedToPublishToWordPress: { en: "Failed to publish to WordPress", tr: "WordPress'e yayınlanamadı" },
  failedToBuildFixPlan: { en: "Failed to build the fix plan", tr: "Düzeltme planı hazırlanamadı" },
  runWebSearchMeasurementFirst: {
    en: "Run a web-search measurement first — a fix plan needs a web-grounded probe.",
    tr: "Önce bir web arama ölçümü çalıştırın — düzeltme planı için web tabanlı bir ölçüm gerekir.",
  },
  noWinnableQueriesToplanFor: {
    en: "No winnable queries to plan for yet — nothing to fix.",
    tr: "Henüz planlanacak kazanılabilir sorgu yok — düzeltilecek bir şey yok.",
  },
  enterAtLeastOneTargetQuery: { en: "Enter at least one target query (one per line).", tr: "En az bir hedef sorgu girin (satır başına bir tane)." },
  failedToRunMultiEngineComparison: { en: "Failed to run the multi-engine comparison", tr: "Çoklu motor karşılaştırması çalıştırılamadı" },
  failedToRunAiVisibilityProbe: { en: "Failed to run the AI visibility probe", tr: "AI görünürlük ölçümü çalıştırılamadı" },
  failedToGenerateGrowthAnalysis: { en: "Failed to generate the growth analysis", tr: "Büyüme analizi üretilemedi" },
  failedToGenerateContentDraft: { en: "Failed to generate the content draft", tr: "İçerik taslağı üretilemedi" },
  failedToPublishDraft: { en: "Failed to publish draft", tr: "Taslak yayınlanamadı" },
  failedToRevertDraft: { en: "Failed to revert draft", tr: "Taslak geri alınamadı" },
  failedToStartCrawl: { en: "Failed to start crawl", tr: "Tarama başlatılamadı" },
  failedToConnectToWordPress: { en: "Failed to connect to WordPress", tr: "WordPress'e bağlanılamadı" },
  timedOutWaitingForGoogleAuth: {
    en: "Timed out waiting for Google authorization — try connecting again.",
    tr: "Google yetkilendirmesi beklenirken zaman aşımına uğradı — tekrar bağlanmayı deneyin.",
  },
  failedToStartGoogleConnection: { en: "Failed to start Google connection", tr: "Google bağlantısı başlatılamadı" },
  failedToSelectSearchConsoleProperty: { en: "Failed to select the Search Console property", tr: "Search Console mülkü seçilemedi" },
  failedToSaveGa4PropertyId: { en: "Failed to save the GA4 property id", tr: "GA4 mülk kimliği kaydedilemedi" },
  failedToUpdateAutoRefresh: { en: "Failed to update auto-refresh", tr: "Otomatik yenileme güncellenemedi" },
  failedToGenerateSuggestion: { en: "Failed to generate a suggestion.", tr: "Öneri üretilemedi." },
  failedToApplyFix: { en: "Failed to apply fix", tr: "Düzeltme uygulanamadı" },
  failedToRevertFix: { en: "Failed to revert fix", tr: "Düzeltme geri alınamadı" },
  crawlStatusPending: { en: "Pending", tr: "Bekliyor" },
  crawlStatusRunning: { en: "Running", tr: "Çalışıyor" },
  crawlStatusCompleted: { en: "Completed", tr: "Tamamlandı" },
  crawlStatusFailed: { en: "Failed", tr: "Başarısız" },
  failedToSaveSettings: { en: "Failed to save settings", tr: "Ayarlar kaydedilemedi" },
  failedToSaveEngineKey: { en: "Failed to save this engine's key", tr: "Bu motorun anahtarı kaydedilemedi" },

  // --- App shell ---
  sitesNavLabel: { en: "Sites", tr: "Siteler" },
  settingsNavLabel: { en: "Settings", tr: "Ayarlar" },
  guideNavLabel: { en: "Guide", tr: "Kılavuz" },
  taglineLabel: {
    en: "AI Growth Engineer — the answer AI assistants recommend.",
    tr: "AI Büyüme Mühendisi — AI asistanlarının önerdiği cevap.",
  },
} as const;
export type TranslationKey = keyof typeof TRANSLATIONS;

export const SEVERITY_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  CRITICAL: "destructive",
  WARNING: "default",
  INFO: "secondary",
};

export const FIX_TYPE_LABEL: Record<string, { en: string; tr: string }> = {
  TITLE: { en: "Title", tr: "Başlık" },
  META_DESCRIPTION: { en: "Meta description", tr: "Meta açıklama" },
  H1: { en: "H1", tr: "H1" },
  CANONICAL_URL: { en: "Canonical URL", tr: "Canonical URL" },
};

export const SOURCE_LABEL: Record<string, { en: string; tr: string }> = {
  rule_based: { en: "rule-based", tr: "kural tabanlı" },
  ai_generated: { en: "AI-generated", tr: "AI tarafından üretildi" },
  manual: { en: "manual", tr: "manuel" },
};

export const PRIORITY_TIER_LABEL: Record<string, { en: string; tr: string }> = {
  QUICK_WIN: { en: "Quick win", tr: "Hızlı kazanım" },
  MANUAL_REVIEW: { en: "Needs review", tr: "İnceleme gerekli" },
  FILL_IN: { en: "Fill-in", tr: "Doldurulacak" },
  LOW_PRIORITY: { en: "Low priority", tr: "Düşük öncelik" },
};

export const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export const PRIORITY_LABEL: Record<string, { en: string; tr: string }> = {
  HIGH: { en: "High", tr: "Yüksek" },
  MEDIUM: { en: "Medium", tr: "Orta" },
  LOW: { en: "Low", tr: "Düşük" },
};

export const SEVERITY_LABEL: Record<string, { en: string; tr: string }> = {
  CRITICAL: { en: "Critical", tr: "Kritik" },
  WARNING: { en: "Warning", tr: "Uyarı" },
  INFO: { en: "Info", tr: "Bilgi" },
};

export const PRIORITY_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  HIGH: "destructive",
  MEDIUM: "default",
  LOW: "secondary",
};

export const EVENT_TYPE_LABEL: Record<string, { en: string; tr: string }> = {
  CrawlJobCompleted: { en: "Processing the crawl results", tr: "Tarama sonuçları işleniyor" },
  AuditRunCompleted: { en: "Processing the audit results", tr: "Denetim sonuçları işleniyor" },
};

// A single status metric on the overview — big number, quiet label, one-line
// hint. `accent` highlights the product's north-star (AI visibility). Empty
// values render "—" so a not-yet-measured tile stays calm, not alarming.
export function StatTile({
  label,
  value,
  suffix,
  hint,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="glass-card flex flex-col gap-1.5 rounded-2xl p-5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={`text-4xl font-semibold tracking-tight tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
        >
          {value}
        </span>
        {suffix && <span className="text-base text-muted-foreground">{suffix}</span>}
      </span>
      {hint && <span className="text-xs text-muted-foreground/70">{hint}</span>}
    </div>
  );
}

// The product's core reading, as an actual hero number — this is the
// headline metric ("does AI recommend you") the whole Growth tab exists to
// answer, so it gets the largest type on the page, not a cell the same size
// as a caption. Quiet label, huge number, and (optionally) the signed delta
// vs the previous run beneath it. `tone` colors the number; `delta` null
// hides the movement line (e.g. cited isn't comparable, or no previous run).
export function VisibilityMetric({
  label,
  pct,
  tone,
  delta,
  vsLastLabel,
}: {
  label: string;
  pct: number;
  tone: "good" | "open" | "muted" | "cited";
  delta?: number | null;
  vsLastLabel: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-green-400"
      : tone === "open"
        ? "text-cyan-300"
        : tone === "cited"
          ? "text-amber-300"
          : "text-foreground";
  const deltaClass =
    delta == null || delta === 0
      ? "text-muted-foreground/60"
      : delta > 0
        ? "text-green-400"
        : "text-red-400";
  return (
    <div className="glass-card flex flex-col gap-1 rounded-2xl p-5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={`text-4xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{pct}%</span>
      {delta != null && (
        <span className={`text-xs ${deltaClass}`}>
          {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {delta > 0 ? "+" : ""}
          {delta}% {vsLastLabel}
        </span>
      )}
    </div>
  );
}

// Extracted from the audit issue list so the same row markup can render
// both a rule's directly-listed issues and the issues inside an expanded
// route-template sub-group (e.g. /post/[id]) without duplicating this
// (fairly large) block of fix-action JSX in two places.
export function IssueRow({
  issue,
  fix,
  wordPressConnection,
  fixActionErrors,
  copiedFixId,
  fixActionPendingId,
  onCopyFix,
  onApplyFix,
  onRevertFix,
  t,
  language,
}: {
  issue: AuditIssueDto;
  fix: FixCandidateDto | undefined;
  wordPressConnection: WordPressConnectionDto | null;
  fixActionErrors: Record<string, string>;
  copiedFixId: string | null;
  fixActionPendingId: string | null;
  onCopyFix: (fixId: string, content: string) => void;
  onApplyFix: (fixId: string) => void;
  onRevertFix: (fixId: string) => void;
  t: (key: TranslationKey) => string;
  language: Language;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-1">
      <div>
        <p>{issue.message}</p>
        <p className="text-xs text-muted-foreground">
          {issue.ruleId} · {issue.category}
        </p>
        {issue.recommendation ? (
          <p className="mt-1 text-xs italic text-zinc-600 dark:text-muted-foreground/70">{issue.recommendation}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground/70">{t("generatingRecommendation")}</p>
        )}
        {fix && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                {FIX_TYPE_LABEL[fix.type]?.[language] ?? fix.type} {t("fixLabel")}
                {fix.status === "APPLIED" && <span className="ml-2 text-green-400">{t("applied")}</span>}
                {fix.status === "FAILED" && <span className="ml-2 text-red-400">{t("applyFailed")}</span>}
              </p>
              {/* Only TITLE/META_DESCRIPTION can ever be auto-applied (see the
                  Approve & Apply button below), and only with WordPress connected
                  — say so plainly here too, since this box is the first thing a
                  user sees and "Quick win" elsewhere could otherwise read as a
                  promise this tool can't keep for H1/CANONICAL_URL fixes or
                  without a WordPress connection. */}
              {fix.type === "TITLE" || fix.type === "META_DESCRIPTION" ? (
                !wordPressConnection && (
                  <p className="text-xs text-muted-foreground/70">{t("connectWordPressToApply")}</p>
                )
              ) : (
                <p className="text-xs text-muted-foreground/70">{t("noAutoApplyForFixType")}</p>
              )}
              <p className="text-xs">{fix.content}</p>
              {/* META_DESCRIPTION applies to WordPress's core "excerpt" field —
                  a real, always-writable field, but not guaranteed to be what the
                  live page's <meta name="description"> tag actually renders (that
                  depends on the site's theme/SEO plugin — Yoast/RankMath usually
                  override it with their own field). Said upfront, not just after
                  the fact, so "Applied" isn't read with TITLE's same certainty. */}
              {fix.type === "META_DESCRIPTION" && wordPressConnection && (
                <p className="mt-1 text-xs text-amber-400">{t("metaDescriptionExcerptNote")}</p>
              )}
              {fixActionErrors[fix.id] && <p className="mt-1 text-xs text-red-400">{fixActionErrors[fix.id]}</p>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button variant="outline" size="sm" onClick={() => onCopyFix(fix.id, fix.content)}>
                {copiedFixId === fix.id ? t("copied") : t("copy")}
              </Button>
              {/* Only TITLE and META_DESCRIPTION fixes can be pushed to WordPress
                  today — see ApplyFixCandidateUseCase's MVP scope. */}
              {(fix.type === "TITLE" || fix.type === "META_DESCRIPTION") &&
                wordPressConnection &&
                fix.status !== "APPLIED" && (
                  <Button size="sm" disabled={fixActionPendingId === fix.id} onClick={() => onApplyFix(fix.id)}>
                    {fixActionPendingId === fix.id ? t("applying") : t("approveApply")}
                  </Button>
                )}
              {(fix.type === "TITLE" || fix.type === "META_DESCRIPTION") &&
                wordPressConnection &&
                fix.status === "APPLIED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={fixActionPendingId === fix.id}
                    onClick={() => onRevertFix(fix.id)}
                  >
                    {fixActionPendingId === fix.id ? t("reverting") : t("revert")}
                  </Button>
                )}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant={SEVERITY_BADGE_VARIANT[issue.severity] ?? "default"}>{SEVERITY_LABEL[issue.severity]?.[language] ?? issue.severity}</Badge>
        <span className="text-xs text-muted-foreground">{PRIORITY_TIER_LABEL[issue.priority.tier]?.[language] ?? issue.priority.tier}</span>
        <span
          className="text-xs text-muted-foreground"
          title={
            issue.trafficImpact.hasTrafficData
              ? `${issue.trafficImpact.pageImpressions} ${t("impressionsSlashClicksLast30Days").replace("{clicks}", String(issue.trafficImpact.pageClicks))}`
              : t("noTrafficDataTooltip")
          }
        >
          {issue.trafficImpact.tier} {t("trafficImpact")}
          {issue.trafficImpact.hasTrafficData ? ` (${issue.trafficImpact.pageImpressions} ${t("impressionsAbbrev")})` : ` (${t("noDataYet")})`}
        </span>
      </div>
    </div>
  );
}
