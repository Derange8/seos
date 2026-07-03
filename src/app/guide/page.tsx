"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

interface Section {
  title: string;
  body: React.ReactNode;
}

type TabId = "why" | "features" | "howto";

const TABS: Array<{ id: TabId; en: string; tr: string }> = [
  { id: "why", en: "Why Seos exists", tr: "Neden Seos" },
  { id: "features", en: "What it does", tr: "Ne yapar" },
  { id: "howto", en: "How to use it", tr: "Nasıl kullanılır" },
];

// ---------------------------------------------------------------------------
// WHY — the product thesis. Not a step list — the reasoning a whitepaper
// would lead with, so a reader understands the problem before the feature
// list, and the feature list before the click-by-click instructions.
// ---------------------------------------------------------------------------

const WHY_EN: Section[] = [
  {
    title: "The problem with SEO tools today",
    body: (
      <>
        <p>
          Semrush, Ahrefs, Screaming Frog, Yoast — almost every SEO tool on the market does the same thing: it
          crawls your site and hands you a list of problems. Title too short. Missing meta description. Broken
          link. You already knew something was wrong; now you have a name for it. The actual work — rewriting the
          title, fixing the link, publishing the change — is still entirely on you.
        </p>
        <p>
          That gap between <strong>diagnosis</strong> and <strong>action</strong> is where most SEO effort quietly
          dies. A 40-page audit report is a to-do list nobody finishes.
        </p>
        <p>
          And there&apos;s a deeper shift underway. People increasingly get answers straight from AI assistants —
          ChatGPT, Perplexity, Google&apos;s AI Overviews — not a page of ten blue links. A perfect technical SEO
          score has never been further from the thing you actually want, which is to be the business the AI
          recommends when your customer asks. That is a layer no classic SEO tool even looks at.
        </p>
      </>
    ),
  },
  {
    title: "What Seos does differently",
    body: (
      <>
        <p>
          Seos leads with the question that now matters most: <strong>do AI answer engines actually recommend your
          site</strong> for what your customers ask? It measures exactly that — sampling each buyer-intent question
          several times (AI answers vary run to run) and reporting whether you&apos;re recommended, beaten by a named
          competitor, or absent from an open slot no one owns yet.
        </p>
        <p>
          Then it closes the loop. For any question you aren&apos;t winning, Seos asks the model precisely what your
          site would need to be recommended, drafts the citation-optimized content that would close that gap, and
          lets you re-measure to see whether it moved. That is the difference between a tool that reports and an
          agent that drives a result.
        </p>
        <p>
          It still does the classic work too — the 21-rule audit, ready-to-apply Title/Meta fixes, one-click
          WordPress publishing with rollback, all with you approving every step. But the headline question is no
          longer &quot;is your score 100&quot;; it&apos;s &quot;does AI recommend you.&quot;
        </p>
      </>
    ),
  },
  {
    title: "Why a desktop program, not a SaaS subscription",
    body: (
      <>
        <p>
          Seos installs and runs on your own computer. There&apos;s no monthly fee, no third party storing your
          site&apos;s data, and no markup on AI usage — you bring your own OpenAI, Anthropic, or DeepSeek API key
          and pay that provider directly, exactly what you use. The crawler, the audit engine, and the database
          (a single local SQLite file) all run locally. The only network calls Seos makes are the ones you
          explicitly asked for: crawling your own site, calling your own LLM provider, talking to WordPress or
          Google on your behalf.
        </p>
      </>
    ),
  },
  {
    title: "The trust model — what Seos will never do",
    body: (
      <>
        <p>These rules aren&apos;t configurable. They&apos;re the actual design constraints the codebase enforces:</p>
        <ul className="ml-4 list-disc">
          <li>
            <strong>Reading is always allowed, writing never happens silently.</strong> Crawling and auditing a
            domain need no proof of ownership — that&apos;s no different from what any search engine does when it
            indexes a public page. But before Seos is allowed to store credentials and push a real change to a
            live site (connecting WordPress), it requires you to prove you own the domain first.
          </li>
          <li>
            <strong>Nothing is ever applied without approval.</strong> Every fix and every content draft starts as
            a DRAFT. A human click on &quot;Approve &amp; Apply&quot; or &quot;Publish&quot; is what turns it into a
            real change — there is no separate hidden &quot;auto-approved&quot; state. Otomatik Pilot doesn&apos;t
            bypass this; turning it on for a project <em>is</em> the standing approval, and it only ever covers the
            two fix types (Title, Meta description) that were already safe enough for one-click manual approval.
          </li>
          <li>
            <strong>Every applied change can be undone.</strong> Before Seos overwrites anything on your live site,
            it captures the previous value. Revert pushes it straight back — undone only counts once the live site
            actually reflects it, not just locally in Seos&apos;s own database.
          </li>
          <li>
            <strong>No invented numbers.</strong> Search volume, ranking position, traffic — anywhere Seos shows a
            number like this, it&apos;s a real value pulled from Google Search Console or Analytics. Where that data
            doesn&apos;t exist yet, the dashboard says &quot;no data yet&quot;, never a guess dressed up as a fact.
            Content Ideas and the Growth Analysis report are explicitly labeled as reasoned suggestions, not
            verified opportunities — Seos will not pretend an LLM&apos;s guess about a content gap is the same
            thing as a real demand signal.
          </li>
          <li>
            <strong>No silent failures.</strong> If a background step fails — a score calculation, a fix generator,
            an LLM call — it&apos;s recorded and surfaced as a visible banner on your dashboard, not swallowed in a
            server log you&apos;ll never read.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "The autonomy ladder",
    body: (
      <>
        <p>Seos&apos;s capabilities are organized around how much it&apos;s trusted to act without you, on purpose:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Level 0 — Read:</strong> crawl the site, run the audit, show the score. No content is generated.</li>
          <li><strong>Level 1 — Recommend:</strong> every issue gets a written, AI-backed explanation of what to do.</li>
          <li><strong>Level 2 — Generate:</strong> ready-to-use fix content and page drafts are produced — never applied automatically.</li>
          <li>
            <strong>Level 3 — Apply after approval:</strong> one click pushes a specific, approved change to the
            live site, with rollback. This is where &quot;Approve &amp; Apply&quot; and &quot;Publish&quot; live.
          </li>
          <li>
            <strong>Otomatik Pilot — standing approval, narrow scope:</strong> once switched on for a project,
            Seos re-crawls it daily and auto-applies only Title/Meta-description fixes through an already-connected
            WordPress site — the same two fix types Level 3 already trusted a human to approve with one click.
          </li>
          <li>
            <strong>Level 4 — fully autonomous, no human in the loop at all — is deliberately not offered.</strong>{" "}
            That ceiling is a design decision, not a missing feature.
          </li>
        </ul>
      </>
    ),
  },
];

const WHY_TR: Section[] = [
  {
    title: "Bugünkü SEO araçlarının sorunu",
    body: (
      <>
        <p>
          Semrush, Ahrefs, Screaming Frog, Yoast — piyasadaki neredeyse her SEO aracı aynı şeyi yapar: siteni tarar
          ve sana bir sorun listesi verir. Başlık çok kısa. Meta açıklama eksik. Kırık link. Bir şeyin yanlış
          olduğunu zaten biliyordun; şimdi bir de ismi var. Asıl iş — başlığı yeniden yazmak, linki düzeltmek,
          değişikliği yayınlamak — hâlâ tamamen sana kalıyor.
        </p>
        <p>
          <strong>Teşhis</strong> ile <strong>aksiyon</strong> arasındaki bu boşluk, çoğu SEO çalışmasının sessizce
          öldüğü yerdir. 40 sayfalık bir denetim raporu, kimsenin bitirmediği bir yapılacaklar listesidir.
        </p>
        <p>
          Ve daha derin bir kayma yaşanıyor. İnsanlar giderek cevabı doğrudan AI asistanlarından alıyor — ChatGPT,
          Perplexity, Google&apos;ın AI Overviews&apos;ı — on mavi linklik bir sayfadan değil. Mükemmel bir teknik SEO
          skoru, aslında istediğin şeyden hiç bu kadar uzak olmamıştı: müşterin sorduğunda AI&apos;ın önerdiği işletme
          olmak. Bu, hiçbir klasik SEO aracının bakmadığı bir katman.
        </p>
      </>
    ),
  },
  {
    title: "Seos'un farkı ne",
    body: (
      <>
        <p>
          Seos artık en çok önem taşıyan soruyla başlıyor: <strong>AI cevap motorları siteni gerçekten öneriyor
          mu</strong> — müşterinin sorduğu şey için? Tam da bunu ölçüyor: her alıcı-niyetli soruyu birkaç kez
          örnekleyerek (AI cevapları çalıştıkça değişir) ve seni önerilmiş mi, adı geçen bir rakibe mi yenik, yoksa
          henüz kimsenin sahip olmadığı boş bir slotta mı yok — bunu raporlayarak.
        </p>
        <p>
          Sonra döngüyü kapatıyor. Kazanamadığın her soru için, siteninin önerilmesi için tam olarak neyin gerektiğini
          modele soruyor, o boşluğu kapatacak citation-optimize içeriği taslak olarak üretiyor ve hareket edip
          etmediğini görmek için tekrar ölçmene izin veriyor. Rapor veren bir araç ile sonuç üreten bir ajan
          arasındaki fark budur.
        </p>
        <p>
          Klasik işi de hâlâ yapıyor — 21 kurallı denetim, uygulamaya hazır Title/Meta düzeltmeleri, geri alma dahil
          tek tıkla WordPress yayınlama, hepsi senin her adımı onaylamanla. Ama asıl soru artık &quot;skorun 100 mü&quot;
          değil; &quot;AI seni öneriyor mu.&quot;
        </p>
      </>
    ),
  },
  {
    title: "Neden SaaS değil, masaüstü program",
    body: (
      <>
        <p>
          Seos kendi bilgisayarına kurulur ve orada çalışır. Aylık ücret yok, sitenin verisini saklayan bir üçüncü
          taraf yok, AI kullanımına eklenen bir kâr payı yok — kendi OpenAI, Anthropic veya DeepSeek API key&apos;ini
          getirip o sağlayıcıya doğrudan, tam kullandığın kadar ödüyorsun. Crawler, denetim motoru ve veritabanı
          (tek bir yerel SQLite dosyası) hepsi yerelde çalışır. Seos&apos;un yaptığı tek ağ çağrıları, senin açıkça
          istediğin şeylerdir: kendi siteni taramak, kendi LLM sağlayıcını çağırmak, senin adına WordPress veya
          Google ile konuşmak.
        </p>
      </>
    ),
  },
  {
    title: "Güven modeli — Seos'un asla yapmayacağı şeyler",
    body: (
      <>
        <p>Bu kurallar ayarlanabilir değil. Kod tabanının gerçekten uyguladığı tasarım kısıtları:</p>
        <ul className="ml-4 list-disc">
          <li>
            <strong>Okumak her zaman serbest, yazmak asla sessiz olmaz.</strong> Bir domain&apos;i taramak ve denetlemek
            sahiplik kanıtı gerektirmez — bu, bir arama motorunun herkese açık bir sayfayı indekslerken yaptığından
            farklı değil. Ama Seos&apos;un kimlik bilgisi saklayıp canlı siteye gerçek bir değişiklik göndermesine
            (WordPress bağlamak) izin verilmeden önce, önce domain&apos;in sana ait olduğunu kanıtlaman gerekir.
          </li>
          <li>
            <strong>Onay olmadan hiçbir şey uygulanmaz.</strong> Her düzeltme ve her içerik taslağı DRAFT olarak
            başlar. &quot;Onayla &amp; Uygula&quot; veya &quot;Yayınla&quot;ya bir insan tıklaması, onu gerçek bir değişikliğe çevirir —
            gizli bir &quot;otomatik onaylı&quot; durum yoktur. Otomatik Pilot bunu atlamaz; bir proje için açmak zaten kalıcı
            onaydır ve sadece zaten manuel tek-tıkla onay için güvenli kabul edilen iki düzeltme tipini (Title, Meta
            açıklama) kapsar.
          </li>
          <li>
            <strong>Uygulanan her değişiklik geri alınabilir.</strong> Seos canlı sitende herhangi bir şeyin üzerine
            yazmadan önce, önceki değeri kaydeder. Geri Al, doğrudan onu geri gönderir — geri alma, sadece Seos&apos;un
            kendi veritabanında değil, canlı site gerçekten onu yansıttığında sayılır.
          </li>
          <li>
            <strong>Hiçbir sayı icat edilmez.</strong> Arama hacmi, sıralama, trafik — Seos böyle bir sayı
            gösterdiğinde, bu Google Search Console veya Analytics&apos;ten gelen gerçek bir değerdir. Bu veri henüz yoksa,
            panoda &quot;veri yok&quot; yazar, gerçek gibi giydirilmiş bir tahmin değil. Content Ideas ve Growth Analysis raporu
            açıkça &quot;düşünülmüş öneriler&quot; olarak etiketlenir, doğrulanmış fırsatlar değil — Seos bir LLM&apos;in içerik
            boşluğu tahminini gerçek bir talep sinyaliyle aynı şeymiş gibi göstermez.
          </li>
          <li>
            <strong>Sessiz hata yok.</strong> Arka planda bir adım başarısız olursa — skor hesaplama, düzeltme
            üretici, bir LLM çağrısı — bu kaydedilir ve panonda görünür bir uyarı olarak gösterilir, asla
            okumayacağın bir sunucu logunda kaybolmaz.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Otonomi merdiveni",
    body: (
      <>
        <p>Seos&apos;un yetenekleri, kendisine ne kadar güvenildiğine göre, kasıtlı olarak kademelendirilmiştir:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Seviye 0 — Oku:</strong> siteyi tara, denetim yap, skoru göster. Hiçbir içerik üretilmez.</li>
          <li><strong>Seviye 1 — Öner:</strong> her sorun için yazılı, AI destekli bir açıklama üretilir.</li>
          <li><strong>Seviye 2 — Üret:</strong> kullanıma hazır düzeltme içeriği ve sayfa taslakları üretilir — asla otomatik uygulanmaz.</li>
          <li>
            <strong>Seviye 3 — Onayla, sonra uygula:</strong> tek tıkla, onaylanmış belirli bir değişiklik canlı
            siteye gönderilir, geri alma dahil. &quot;Onayla &amp; Uygula&quot; ve &quot;Yayınla&quot; burada yaşar.
          </li>
          <li>
            <strong>Otomatik Pilot — kalıcı onay, dar kapsam:</strong> bir proje için açıldığında, Seos onu günde
            bir kez yeniden tarar ve sadece zaten bağlı bir WordPress sitesi üzerinden Title/Meta açıklama
            düzeltmelerini otomatik uygular — Seviye 3&apos;ün zaten bir insanın tek tıkla onaylamasına güvendiği aynı
            iki düzeltme tipi.
          </li>
          <li>
            <strong>Seviye 4 — tamamen otonom, hiç insan onayı olmayan — kasıtlı olarak sunulmuyor.</strong> Bu tavan,
            eksik bir özellik değil, bir tasarım kararıdır.
          </li>
        </ul>
      </>
    ),
  },
];

// ---------------------------------------------------------------------------
// FEATURES — one-by-one walkthrough of every shipped capability.
// ---------------------------------------------------------------------------

const FEATURES_EN: Section[] = [
  {
    title: "★ AI Visibility — become the answer AI recommends",
    body: (
      <>
        <p>
          The headline capability. For the buyer-intent questions your customers ask an AI assistant, Seos measures
          whether your site is recommended, beaten by a named competitor, or absent from an open slot — sampling each
          question several times, because AI answers vary run to run, and reading the distribution rather than a
          single lucky shot.
        </p>
        <p>
          It closes the loop end to end: <strong>Suggest queries</strong> proposes the questions worth measuring
          from your own site; <strong>Measure</strong> runs the probe and scores your visibility; <strong>Why
          not?</strong> asks the model exactly what your site would need to be recommended for a question you&apos;re
          losing; <strong>Draft content</strong> turns that diagnosis into a ready citation-optimized page; and a
          re-measure shows the movement versus your last run. No classic SEO tool sees this layer.
        </p>
      </>
    ),
  },
  {
    title: "1. The crawler",
    body: (
      <p>
        Follows internal links breadth-first, respects <code>robots.txt</code> by default, and renders JavaScript
        with a real browser engine only for pages that need it (plain HTML is fetched directly — faster, no
        wasted resources). Refuses to crawl into private/internal network addresses, so a malicious or
        misconfigured target can&apos;t be used to probe your own machine&apos;s network.
      </p>
    ),
  },
  {
    title: "2. SEO Audit Engine",
    body: (
      <p>
        21 rules across four categories — technical, content, performance, structured data — including cross-page
        checks no single-page tool catches: duplicate titles/meta descriptions/content across pages, orphan pages
        nothing else links to, and broken internal links.
      </p>
    ),
  },
  {
    title: "3. SEO Score",
    body: (
      <p>
        A 0–100 overall score plus a per-category breakdown, computed from the severity of every issue found
        (critical issues weigh more than minor ones). Re-crawl later and a Trend card shows exactly how the score
        moved and which issues were resolved, newly introduced, or still persisting.
      </p>
    ),
  },
  {
    title: "4. Fix candidates",
    body: (
      <p>
        For Title, Meta description, H1, and Canonical URL issues, Seos generates the actual replacement text —
        not a description of what to change, the change itself, ready to copy or apply. Other issue types (broken
        links, thin content) need a human decision and intentionally don&apos;t get an auto-generated fix.
      </p>
    ),
  },
  {
    title: "5. Prioritization",
    body: (
      <>
        <p>Every issue is ranked two independent ways, shown side by side:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Ease</strong> — Quick win, Needs review, Fill-in, or Low priority, based on severity and whether a ready fix exists.</li>
          <li><strong>Traffic impact (P1–P4)</strong> — when Google Search Console is connected, issues on your highest-impression pages rank as P1; pages with no measured traffic honestly show &quot;no data yet&quot; rather than a fabricated rank.</li>
        </ul>
      </>
    ),
  },
  {
    title: "6. WordPress integration",
    body: (
      <p>
        Connects via a WordPress Application Password (no plugin install needed). Once connected, Title and Meta
        description fixes — and full Page Content Drafts — gain an &quot;Approve &amp; Apply&quot; / &quot;Publish&quot;
        button that writes directly to the real page, plus &quot;Revert&quot; to undo it. Credentials are encrypted
        at rest.
      </p>
    ),
  },
  {
    title: "7. Otomatik Pilot",
    body: (
      <p>
        An opt-in switch per project. Once on, Seos re-crawls the site roughly once a day on its own and
        automatically applies any new Title/Meta-description fixes through your connected WordPress site — the
        same two fix types you could already one-click approve manually. Every other fix type always stays manual.
      </p>
    ),
  },
  {
    title: "8. Page Content Draft",
    body: (
      <p>
        For any already-crawled page, generates a full ready-to-publish draft — title, meta description, body
        sections, and a complete FAQ — written in the page&apos;s own language and grounded only in that
        page&apos;s real crawled content. One click publishes the whole thing to WordPress (title, excerpt, and
        body); Revert restores exactly what was there before.
      </p>
    ),
  },
  {
    title: "9. Content Ideas",
    body: (
      <p>
        Looks at your site&apos;s existing pages and suggests topics for pages that don&apos;t exist yet — e.g. a
        product page suggests the question-style articles customers would search for. Explicitly labeled as ideas
        to consider, since real search-demand data for pages you don&apos;t have yet isn&apos;t something Search
        Console can ever report.
      </p>
    ),
  },
  {
    title: "10. Growth Analysis",
    body: (
      <p>
        A single AI pass that reasons over your whole crawled site at once (not page by page), so it can spot
        catalog-level gaps — two product pages with no comparison page between them, a missing category, an
        under-used conversion path. Produces a structured report: business understanding, content gaps,
        prioritized opportunities, conversion opportunities, and an executive summary.
      </p>
    ),
  },
  {
    title: "11. Sitemap, robots.txt, llms.txt, Schema markup",
    body: (
      <p>
        Generated automatically after every crawl. Schema markup includes Organization, BreadcrumbList, and
        (where a heading reads like a question) FAQPage JSON-LD — all rule-based, deterministic, no AI guessing on
        structured data.
      </p>
    ),
  },
  {
    title: "12. AI recommendations",
    body: (
      <p>
        Every audit issue gets a written explanation of what to do and why. With an API key configured, it&apos;s a
        real, specific explanation from your chosen LLM; without one, Seos falls back to a free, template-based
        explanation — still correct, just more generic.
      </p>
    ),
  },
  {
    title: "13. LLM Settings — your own key, your own choice",
    body: (
      <p>
        Choose OpenAI, Anthropic, or DeepSeek and paste your own API key in Settings. It&apos;s tested live before
        being saved, encrypted at rest, and never shown back to you afterward. This one key powers every AI feature
        above — recommendations, content suggestions, content ideas, page drafts, and growth analysis.
      </p>
    ),
  },
  {
    title: "14. Google Search Console + Analytics",
    body: (
      <p>
        Connect your Google account (read-only — nothing is ever written back to it) to pull real ranking,
        impression, and organic-traffic data into the dashboard, refreshed automatically about once a day. This
        real data is what makes traffic-impact prioritization and Keyword Opportunities possible.
      </p>
    ),
  },
  {
    title: "15. Keyword Opportunities",
    body: (
      <p>
        Surfaces your &quot;striking distance&quot; queries — ones ranking position 5–20, close enough to page 1
        to be worth targeted improvement — pulled directly from your real Search Console data, with an optional
        AI-drafted content suggestion for closing the gap on an existing page.
      </p>
    ),
  },
  {
    title: "16. Multiple sites, one install",
    body: <p>Manage as many projects as you want from a single Seos installation, each independently configured and crawled.</p>,
  },
  {
    title: "17. Security model",
    body: (
      <p>
        WordPress and LLM credentials are encrypted (AES-256-GCM) before they ever touch disk. The encryption key
        itself is generated uniquely per installation and protected by your operating system&apos;s own secure
        keychain — never baked into the app, never shared across installs. Every outbound request Seos makes (to
        WordPress, to a crawl target) is checked against private/internal network ranges first.
      </p>
    ),
  },
];

const FEATURES_TR: Section[] = [
  {
    title: "★ AI Görünürlük — AI'ın önerdiği cevap ol",
    body: (
      <>
        <p>
          Amiral özellik. Müşterilerinin bir AI asistanına sorduğu alıcı-niyetli sorular için Seos, sitenin önerilmiş
          mi, adı geçen bir rakibe mi yenik, yoksa boş bir slotta mı yok olduğunu ölçer — her soruyu birkaç kez
          örnekleyerek (AI cevapları çalıştıkça değişir) ve tek şanslı bir atış yerine dağılımı okuyarak.
        </p>
        <p>
          Döngüyü uçtan uca kapatır: <strong>Suggest queries</strong> ölçülmeye değer soruları kendi sitenden önerir;
          <strong>Measure</strong> probe&apos;u çalıştırıp görünürlüğünü skorlar; <strong>Why not?</strong> kaybettiğin
          bir soru için siteninin önerilmesi için tam olarak neyin gerektiğini modele sorar; <strong>Draft
          content</strong> o teşhisi hazır bir citation-optimize sayfaya çevirir; ve tekrar ölçüm, son çalıştırmana
          göre hareketi gösterir. Hiçbir klasik SEO aracı bu katmanı görmez.
        </p>
      </>
    ),
  },
  {
    title: "1. Crawler (Tarayıcı)",
    body: (
      <p>
        İç linkleri genişlik-öncelikli sırayla takip eder, varsayılan olarak <code>robots.txt</code>&apos;a uyar, ve
        JavaScript&apos;i sadece gerçekten gerektiren sayfalar için gerçek bir tarayıcı motoruyla render eder (düz
        HTML doğrudan çekilir — daha hızlı, kaynak israfı yok). Özel/iç ağ adreslerine taramayı reddeder, böylece
        kötü niyetli veya yanlış yapılandırılmış bir hedef, kendi makinenin ağını araştırmak için kullanılamaz.
      </p>
    ),
  },
  {
    title: "2. SEO Denetim Motoru",
    body: (
      <p>
        Dört kategoride 21 kural — teknik, içerik, performans, yapılandırılmış veri — ve tek sayfalık hiçbir aracın
        yakalayamayacağı çapraz-sayfa kontrolleri dahil: sayfalar arası tekrarlayan başlık/meta açıklama/içerik,
        hiçbir yerden link almayan yetim sayfalar, ve kırık iç linkler.
      </p>
    ),
  },
  {
    title: "3. SEO Skoru",
    body: (
      <p>
        Bulunan her sorunun önem derecesine göre hesaplanan 0-100 arası genel skor ve kategori bazlı kırılım (kritik
        sorunlar küçük sorunlardan daha ağır basar). Daha sonra tekrar tara, bir Trend kartı skorun nasıl
        değiştiğini ve hangi sorunların çözüldüğünü, yeni çıktığını veya devam ettiğini tam olarak gösterir.
      </p>
    ),
  },
  {
    title: "4. Düzeltme önerileri (Fix candidates)",
    body: (
      <p>
        Title, Meta açıklama, H1 ve Canonical URL sorunları için Seos gerçek yedek metni üretir — ne değiştirileceğinin
        açıklamasını değil, değişikliğin kendisini, kopyalamaya veya uygulamaya hazır. Diğer sorun tipleri (kırık
        linkler, az içerik) insan kararı gerektirir ve kasıtlı olarak otomatik üretilmiş bir düzeltme almaz.
      </p>
    ),
  },
  {
    title: "5. Önceliklendirme",
    body: (
      <>
        <p>Her sorun birbirinden bağımsız iki şekilde sıralanır, yan yana gösterilir:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Kolaylık</strong> — önem derecesine ve hazır bir düzeltme olup olmadığına göre Quick win, Needs review, Fill-in veya Low priority.</li>
          <li><strong>Trafik etkisi (P1–P4)</strong> — Google Search Console bağlıyken, en çok gösterim alan sayfalardaki sorunlar P1 olarak sıralanır; ölçülmüş trafiği olmayan sayfalar icat edilmiş bir sıra yerine dürüstçe &quot;veri yok&quot; gösterir.</li>
        </ul>
      </>
    ),
  },
  {
    title: "6. WordPress entegrasyonu",
    body: (
      <p>
        Bir WordPress Application Password ile bağlanır (eklenti kurulumu gerekmez). Bağlandığında, Title ve Meta
        açıklama düzeltmeleri — ve tam Sayfa İçerik Taslakları — gerçek sayfaya doğrudan yazan bir &quot;Onayla &amp;
        Uygula&quot; / &quot;Yayınla&quot; butonu kazanır, ayrıca geri almak için &quot;Geri Al&quot;. Kimlik bilgileri şifreli saklanır.
      </p>
    ),
  },
  {
    title: "7. Otomatik Pilot",
    body: (
      <p>
        Proje bazında açılıp kapanan bir anahtar. Açıldığında, Seos siteyi kendiliğinden günde bir kez yeniden tarar
        ve bağlı WordPress sitesindeki yeni Title/Meta açıklama düzeltmelerini otomatik uygular — zaten manuel
        olarak tek tıkla onaylayabildiğin aynı iki düzeltme tipi. Diğer tüm düzeltme tipleri her zaman manuel kalır.
      </p>
    ),
  },
  {
    title: "8. Sayfa İçerik Taslağı (Page Content Draft)",
    body: (
      <p>
        Daha önce taranmış herhangi bir sayfa için, tam yayına hazır bir taslak üretir — başlık, meta açıklama, içerik
        bölümleri ve eksiksiz bir FAQ — sayfanın kendi dilinde yazılmış ve sadece o sayfanın gerçek taranmış
        içeriğine dayanır. Tek tıkla tamamı WordPress&apos;e yayınlanır (başlık, özet ve gövde); Geri Al öncesinde orada
        olanı tam olarak geri yükler.
      </p>
    ),
  },
  {
    title: "9. İçerik Fikirleri (Content Ideas)",
    body: (
      <p>
        Sitenin mevcut sayfalarına bakar ve henüz var olmayan sayfalar için konu önerir — örn. bir ürün sayfası,
        müşterilerin arayacağı soru tarzı makaleleri önerir. Açıkça &quot;düşünülecek fikirler&quot; olarak etiketlenir, çünkü
        henüz var olmayan sayfalar için gerçek arama-talebi verisi Search Console&apos;un asla raporlayamayacağı bir şeydir.
      </p>
    ),
  },
  {
    title: "10. Büyüme Analizi (Growth Analysis)",
    body: (
      <p>
        Taranan tüm siteni tek seferde (sayfa sayfa değil) değerlendiren tek bir AI geçişi — böylece katalog seviyesindeki
        boşlukları görebilir: arasında karşılaştırma sayfası olmayan iki ürün sayfası, eksik bir kategori, az kullanılan
        bir dönüşüm yolu. Yapılandırılmış bir rapor üretir: iş anlayışı, içerik boşlukları, önceliklendirilmiş fırsatlar,
        dönüşüm fırsatları ve bir yönetici özeti.
      </p>
    ),
  },
  {
    title: "11. Sitemap, robots.txt, llms.txt, Şema işaretleme",
    body: (
      <p>
        Her taramadan sonra otomatik üretilir. Şema işaretleme; Organization, BreadcrumbList ve (bir başlık soru
        gibi okunuyorsa) FAQPage JSON-LD içerir — hepsi kural tabanlı, deterministik, yapılandırılmış veride AI
        tahmini yok.
      </p>
    ),
  },
  {
    title: "12. AI önerileri",
    body: (
      <p>
        Her denetim sorunu, ne yapılması gerektiğine dair yazılı bir açıklama alır. Bir API key ayarlıyken, seçtiğin
        LLM&apos;den gerçek, spesifik bir açıklama olur; ayarlı değilse Seos ücretsiz, şablon tabanlı bir açıklamaya
        düşer — hâlâ doğru, sadece daha genel.
      </p>
    ),
  },
  {
    title: "13. LLM Ayarları — kendi key'in, kendi seçimin",
    body: (
      <p>
        Settings&apos;ten OpenAI, Anthropic veya DeepSeek seç ve kendi API key&apos;ini yapıştır. Kaydedilmeden önce canlı
        test edilir, şifreli saklanır ve sonrasında sana asla geri gösterilmez. Bu tek key, yukarıdaki tüm AI
        özelliklerini besler — öneriler, içerik önerileri, içerik fikirleri, sayfa taslakları ve büyüme analizi.
      </p>
    ),
  },
  {
    title: "14. Google Search Console + Analytics",
    body: (
      <p>
        Google hesabını bağla (salt okunur — hiçbir şey geri yazılmaz) ve gerçek sıralama, gösterim ve organik
        trafik verisini panoya çek, günde bir kez otomatik yenilenir. Bu gerçek veri, trafik-etkisi
        önceliklendirmesini ve Anahtar Kelime Fırsatlarını mümkün kılan şeydir.
      </p>
    ),
  },
  {
    title: "15. Anahtar Kelime Fırsatları",
    body: (
      <p>
        &quot;Yakın menzil&quot; sorgularını ortaya çıkarır — 5-20. sırada olan, 1. sayfaya yeterince yakın olduğu için
        hedefli iyileştirmeye değer olanlar — doğrudan gerçek Search Console verinden alınır, mevcut bir sayfadaki
        boşluğu kapatmak için opsiyonel bir AI taslağı öneri ile birlikte.
      </p>
    ),
  },
  {
    title: "16. Birden çok site, bir kurulum",
    body: <p>Tek bir Seos kurulumundan istediğin kadar projeyi yönet, her biri bağımsız olarak yapılandırılır ve taranır.</p>,
  },
  {
    title: "17. Güvenlik modeli",
    body: (
      <p>
        WordPress ve LLM kimlik bilgileri diske dokunmadan önce şifrelenir (AES-256-GCM). Şifreleme anahtarının
        kendisi her kurulum için benzersiz üretilir ve işletim sisteminin kendi güvenli anahtarlığı tarafından
        korunur — uygulamaya gömülü değildir, kurulumlar arasında paylaşılmaz. Seos&apos;un yaptığı her dış istek (WordPress&apos;e,
        bir tarama hedefine) önce özel/iç ağ aralıklarına karşı kontrol edilir.
      </p>
    ),
  },
];

// ---------------------------------------------------------------------------
// HOW TO USE — the practical click-by-click walkthrough, refreshed to match
// every feature listed above (not just the original M1 crawl/audit loop).
// ---------------------------------------------------------------------------

const STEPS_EN: Section[] = [
  {
    title: "1. Add your site",
    body: <p>On the home screen, fill in a project name and the domain you want to optimize (e.g. <code>example.com</code>). You can add as many sites as you want — each is managed independently.</p>,
  },
  {
    title: "2. (Recommended) Set an AI provider",
    body: (
      <p>
        In <Link href="/settings" className="underline">Settings</Link>, add an API key for OpenAI, Anthropic, or
        DeepSeek. This single key powers every AI feature: audit recommendations, content suggestions, content
        ideas, page drafts, and growth analysis. Without one, Seos still works using free, template-based
        recommendations — just less tailored.
      </p>
    ),
  },
  {
    title: "3. Start a crawl",
    body: (
      <>
        <p>Click <strong>Start crawl</strong> — no domain verification is needed yet, crawling is read-only. Seos will:</p>
        <ul className="ml-4 list-disc">
          <li>Crawl the site, following internal links (page count updates live)</li>
          <li>Automatically run the 21-rule audit, calculate scores, generate fix candidates, build sitemap.xml/robots.txt/llms.txt/schema markup, and (if a provider is set) generate AI recommendations</li>
        </ul>
        <p>None of this needs extra clicks — it all runs on its own once the crawl finishes.</p>
      </>
    ),
  },
  {
    title: "4. Read the results",
    body: (
      <p>
        The Audit card shows your overall score, per-category scores, and every issue — each with its severity,
        priority tier, traffic-impact tier (once Google is connected), and an AI explanation underneath.
      </p>
    ),
  },
  {
    title: "★ Measure your AI Visibility (the new core)",
    body: (
      <p>
        In the Growth tab, open the <strong>AI Visibility</strong> card (needs an AI provider set). Click{" "}
        <strong>Suggest queries</strong> to let Seos propose the buyer-intent questions worth measuring from your own
        site — or type your own, one per line — then <strong>Measure</strong>. For any question you aren&apos;t
        winning, <strong>Why not?</strong> gives a concrete diagnosis and <strong>Draft content</strong> generates a
        ready citation page. Come back and Measure again any time to see the delta versus your last run.
      </p>
    ),
  },
  {
    title: "5. (Optional) Verify domain ownership",
    body: (
      <>
        <p>Only needed before connecting WordPress — crawling and auditing never require it. Pick whichever is easier:</p>
        <ul className="ml-4 list-disc">
          <li>Add the shown DNS TXT record at your domain provider, or</li>
          <li>Upload a file with the given token at the shown <code>.well-known</code> URL</li>
        </ul>
        <p>Then click <strong>Check verification</strong>. DNS changes can take a few minutes to propagate.</p>
      </>
    ),
  },
  {
    title: "6. (Optional) Connect WordPress",
    body: (
      <p>
        Generate an <strong>Application Password</strong> from WP Admin → Users → Profile, then paste the site
        URL, username, and password into the WordPress card. Once connected, Title/Meta fixes and Page Content
        Drafts gain an &quot;Approve &amp; Apply&quot; / &quot;Publish&quot; button — and a &quot;Revert&quot; once
        applied.
      </p>
    ),
  },
  {
    title: "7. (Optional) Connect Google Search Console / Analytics",
    body: (
      <p>
        From the Integrations tab, connect a Google account and pick a Search Console property and GA4 property.
        Rankings, impressions, and organic traffic then refresh automatically about once a day, and unlock
        real-data features: traffic-impact priority and Keyword Opportunities. Read-only — nothing is ever written
        back to your Google account.
      </p>
    ),
  },
  {
    title: "8. Apply a fix",
    body: (
      <>
        <p>When Seos has a suggested fix for an issue, it appears in a box under that issue:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Copy</strong> — copies the suggested text, always available, for any site</li>
          <li><strong>Approve &amp; Apply</strong> — only for Title/Meta fixes with WordPress connected; writes the change directly to the live page, undoable with <strong>Revert</strong></li>
        </ul>
      </>
    ),
  },
  {
    title: "9. Try the content tools",
    body: (
      <>
        <p>From the Growth tab:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Content Ideas</strong> — generate new-page topic suggestions from your existing site</li>
          <li><strong>Page Content Draft</strong> — pick a crawled page, generate a full ready-to-publish draft, then Publish it to WordPress in one click</li>
          <li><strong>Growth Analysis</strong> — generate a whole-site business-growth report</li>
        </ul>
      </>
    ),
  },
  {
    title: "10. Turn on Otomatik Pilot (optional)",
    body: (
      <p>
        In the Integrations tab, once WordPress is connected, flip the &quot;Otomatik Pilot&quot; switch on. From
        then on, this project re-crawls itself daily and auto-applies any new Title/Meta fixes without you having
        to click anything — everything else still requires your approval.
      </p>
    ),
  },
  {
    title: "11. Re-crawl later",
    body: <p>Running <strong>Start crawl</strong> again shows a Trend card comparing this run to the previous one — score change, resolved issues, new issues.</p>,
  },
];

const STEPS_TR: Section[] = [
  {
    title: "1. Site ekle",
    body: <p>Ana ekranda bir proje ismi ve optimize etmek istediğin domain&apos;i gir (örn. <code>example.com</code>). İstediğin kadar site ekleyebilirsin — her biri bağımsız yönetilir.</p>,
  },
  {
    title: "2. (Önerilir) AI sağlayıcısını ayarla",
    body: (
      <p>
        <Link href="/settings" className="underline">Settings</Link>&apos;ten OpenAI, Anthropic veya DeepSeek için bir
        API key ekle. Bu tek key tüm AI özelliklerini besler: denetim önerileri, içerik önerileri, içerik fikirleri,
        sayfa taslakları ve büyüme analizi. Girmezsen Seos hâlâ ücretsiz, şablon tabanlı önerilerle çalışır — sadece
        daha az kişiselleştirilmiş.
      </p>
    ),
  },
  {
    title: "3. Crawl başlat",
    body: (
      <>
        <p><strong>Start crawl</strong>&apos;a tıkla — henüz domain doğrulaması gerekmez, tarama salt okunurdur. Seos şunları yapar:</p>
        <ul className="ml-4 list-disc">
          <li>Siteyi iç linkleri takip ederek tarar (sayfa sayısı canlı güncellenir)</li>
          <li>Otomatik olarak 21 kurallı denetimi çalıştırır, skor hesaplar, düzeltme önerisi üretir, sitemap.xml/robots.txt/llms.txt/şema işaretleme oluşturur ve (sağlayıcı ayarlıysa) AI önerileri üretir</li>
        </ul>
        <p>Bunların hiçbiri ek tıklama gerektirmez — crawl bitince hepsi kendiliğinden çalışır.</p>
      </>
    ),
  },
  {
    title: "4. Sonuçları oku",
    body: (
      <p>
        Audit kartı genel skoru, kategori bazlı skorları ve bulunan her sorunu gösterir — her biri önem derecesi,
        öncelik katmanı, (Google bağlıysa) trafik-etki katmanı ve altında bir AI açıklamasıyla birlikte.
      </p>
    ),
  },
  {
    title: "★ AI Görünürlüğünü ölç (yeni çekirdek)",
    body: (
      <p>
        Growth sekmesinde <strong>AI Görünürlük</strong> kartını aç (bir AI sağlayıcı ayarlı olmalı).{" "}
        <strong>Suggest queries</strong>&apos;e tıklayarak Seos&apos;un ölçülmeye değer alıcı-niyetli soruları kendi
        sitenden önermesini sağla — veya kendi sorularını satır satır yaz — sonra <strong>Measure</strong>.
        Kazanamadığın her soru için <strong>Why not?</strong> somut bir teşhis, <strong>Draft content</strong> ise
        hazır bir citation sayfası üretir. İstediğin zaman tekrar Measure&apos;a basıp son çalıştırmana göre delta&apos;yı
        gör.
      </p>
    ),
  },
  {
    title: "5. (Opsiyonel) Domain sahipliğini doğrula",
    body: (
      <>
        <p>Sadece WordPress bağlamadan önce gerekir — tarama ve denetim asla gerektirmez. Biri yeterli:</p>
        <ul className="ml-4 list-disc">
          <li>Gösterilen DNS TXT kaydını domain sağlayıcının panelinden eklemek, veya</li>
          <li>Verilen token&apos;ı içeren bir dosyayı gösterilen <code>.well-known</code> adresine koymak</li>
        </ul>
        <p>Sonra <strong>Check verification</strong>&apos;a tıkla. DNS değişiklikleri yayılmada birkaç dakika sürebilir.</p>
      </>
    ),
  },
  {
    title: "6. (Opsiyonel) WordPress bağla",
    body: (
      <p>
        WP Admin → Kullanıcılar → Profil&apos;den bir <strong>Application Password</strong> oluştur, sonra site URL,
        kullanıcı adı ve şifreyi WordPress kartına gir. Bağlandığında, Title/Meta düzeltmeleri ve Sayfa İçerik
        Taslakları bir &quot;Onayla &amp; Uygula&quot; / &quot;Yayınla&quot; butonu kazanır — uygulandıktan sonra da &quot;Geri Al&quot;.
      </p>
    ),
  },
  {
    title: "7. (Opsiyonel) Google Search Console / Analytics bağla",
    body: (
      <p>
        Integrations sekmesinden Google hesabını bağla, bir Search Console ve GA4 mülkü seç. Sıralama, gösterim ve
        organik trafik verisi günde bir kez otomatik yenilenir ve gerçek-veri özelliklerinin kilidini açar: trafik-etki
        önceliklendirmesi ve Anahtar Kelime Fırsatları. Salt okunur — Google hesabına hiçbir şey geri yazılmaz.
      </p>
    ),
  },
  {
    title: "8. Bir düzeltmeyi uygula",
    body: (
      <>
        <p>Bir sorun için öneri varsa, altında bir kutu içinde görünür:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Copy</strong> — önerilen metni kopyalar, her zaman ve her site için kullanılabilir</li>
          <li><strong>Onayla &amp; Uygula</strong> — sadece WordPress bağlıyken Title/Meta düzeltmeleri için; gerçek sayfaya yazar, <strong>Geri Al</strong> ile geri alınabilir</li>
        </ul>
      </>
    ),
  },
  {
    title: "9. İçerik araçlarını dene",
    body: (
      <>
        <p>Growth sekmesinden:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Content Ideas</strong> — mevcut sitenden yeni sayfa konu önerileri üret</li>
          <li><strong>Page Content Draft</strong> — taranmış bir sayfa seç, tam yayına hazır bir taslak üret, sonra tek tıkla WordPress&apos;e yayınla</li>
          <li><strong>Growth Analysis</strong> — site-geneli bir iş büyütme raporu üret</li>
        </ul>
      </>
    ),
  },
  {
    title: "10. Otomatik Pilot'u aç (opsiyonel)",
    body: (
      <p>
        Integrations sekmesinde, WordPress bağlıyken &quot;Otomatik Pilot&quot; anahtarını aç. O andan sonra, bu proje
        kendiliğinden günde bir kez yeniden taranır ve sen hiçbir şeye tıklamadan yeni Title/Meta düzeltmelerini
        otomatik uygular — diğer her şey hâlâ senin onayını gerektirir.
      </p>
    ),
  },
  {
    title: "11. Tekrar crawl çalıştır",
    body: <p><strong>Start crawl</strong>&apos;ı tekrar çalıştırmak, önceki sonuçla karşılaştıran bir Trend kartı gösterir — skor değişimi, çözülen sorunlar, yeni sorunlar.</p>,
  },
];

export default function GuidePage() {
  const [language, setLanguage] = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("why");

  const sections =
    activeTab === "why" ? (language === "en" ? WHY_EN : WHY_TR)
    : activeTab === "features" ? (language === "en" ? FEATURES_EN : FEATURES_TR)
    : language === "en" ? STEPS_EN : STEPS_TR;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← {language === "en" ? "Back" : "Geri"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {language === "en" ? "The Seos Guide" : "Seos Kılavuzu"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === "en"
              ? "Why this program exists, everything it does, and how to use it."
              : "Bu programın neden var olduğu, yaptığı her şey ve nasıl kullanılacağı."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>
            English
          </Button>
          <Button variant={language === "tr" ? "default" : "outline"} size="sm" onClick={() => setLanguage("tr")}>
            Türkçe
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm transition",
              activeTab === tab.id
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {language === "en" ? tab.en : tab.tr}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">{section.body}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
