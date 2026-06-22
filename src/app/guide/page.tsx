"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/hooks/use-language";

interface Step {
  title: string;
  body: React.ReactNode;
}

const STEPS_EN: Step[] = [
  {
    title: "1. Add your site",
    body: (
      <p>On the home screen, fill in a project name and the domain you want to optimize (e.g. <code>example.com</code>).</p>
    ),
  },
  {
    title: "2. Verify domain ownership",
    body: (
      <>
        <p>A crawl can only start once you&apos;ve proven you own the domain. Pick whichever is easier:</p>
        <ul className="ml-4 list-disc">
          <li>Add the shown DNS TXT record at your domain provider, or</li>
          <li>Upload a file with the given token at the shown <code>.well-known</code> URL</li>
        </ul>
        <p>Then click <strong>Check verification</strong>. DNS changes can take a few minutes to propagate.</p>
      </>
    ),
  },
  {
    title: "3. (Optional) Set an AI recommendation provider",
    body: (
      <p>
        In <Link href="/settings" className="underline">Settings</Link>, you can add an API key for OpenAI,
        Anthropic, or DeepSeek. With a key set, every issue gets a real AI-written explanation. Without one, Seos
        falls back to free, template-based recommendations — still useful, just less tailored.
      </p>
    ),
  },
  {
    title: "4. (Optional) Connect WordPress",
    body: (
      <>
        <p>
          If the site runs WordPress, generate an <strong>Application Password</strong> from WP Admin → Users →
          Profile, then paste the site URL, username, and password into the WordPress card on your project page.
        </p>
        <p>
          Once connected, <strong>TITLE</strong> fixes get an &quot;Approve &amp; Apply&quot; button that writes
          directly to the real post. Other fix types stay copy-paste for now.
        </p>
      </>
    ),
  },
  {
    title: "5. (Optional) Connect Google Search Console / Analytics",
    body: (
      <p>
        The Search Performance card lets you connect a Google account and pick a Search Console property and GA4
        property. Rankings and organic traffic then refresh automatically roughly once a day. This is read-only —
        nothing is ever written back to your Google account.
      </p>
    ),
  },
  {
    title: "6. Start a crawl",
    body: (
      <>
        <p>Once verified, click <strong>Start crawl</strong>. Seos will:</p>
        <ul className="ml-4 list-disc">
          <li>Crawl the site, following internal links (page count updates live)</li>
          <li>
            Automatically run an SEO audit, calculate scores, generate fix suggestions, build sitemap.xml/llms.txt/
            schema markup, and (if a provider is set) generate AI recommendations
          </li>
        </ul>
        <p>None of this needs extra clicks — it all runs on its own once the crawl finishes.</p>
      </>
    ),
  },
  {
    title: "7. Read the results",
    body: (
      <>
        <p>The Audit card shows your overall score (0–100), per-category scores, and every issue found, each with:</p>
        <ul className="ml-4 list-disc">
          <li>A message, rule id, severity, and priority</li>
          <li>An AI explanation underneath (shows &quot;Generating recommendation…&quot; briefly while it&apos;s in progress)</li>
        </ul>
      </>
    ),
  },
  {
    title: "8. Apply a fix",
    body: (
      <>
        <p>When Seos has a suggested fix for an issue, it appears in a box under that issue:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Copy</strong> — copies the suggested text, always available, for any site</li>
          <li>
            <strong>Approve &amp; Apply</strong> — only for TITLE fixes with WordPress connected; writes the change
            directly to the live page. Can be undone with <strong>Revert</strong> afterward.
          </li>
        </ul>
        <p>Nothing is ever applied without you clicking — every fix starts as a draft suggestion.</p>
      </>
    ),
  },
  {
    title: "9. Other outputs",
    body: (
      <p>Further down the page you can view/download the generated <code>sitemap.xml</code>, <code>llms.txt</code>, and <code>robots.txt</code>.</p>
    ),
  },
  {
    title: "10. Re-crawl later",
    body: (
      <p>Running <strong>Start crawl</strong> again shows a Trend card comparing this run to the previous one — score change, fixed issues, new issues.</p>
    ),
  },
];

const STEPS_TR: Step[] = [
  {
    title: "1. Site ekle",
    body: <p>Ana ekranda bir proje ismi ve optimize etmek istediğin domain&apos;i gir (örn. <code>example.com</code>).</p>,
  },
  {
    title: "2. Domain sahipliğini doğrula",
    body: (
      <>
        <p>Crawl başlatabilmek için önce domain&apos;in sana ait olduğu kanıtlanmalı. Biri yeterli:</p>
        <ul className="ml-4 list-disc">
          <li>Gösterilen DNS TXT kaydını domain sağlayıcının panelinden eklemek, veya</li>
          <li>Verilen token&apos;ı içeren bir dosyayı gösterilen <code>.well-known</code> adresine koymak</li>
        </ul>
        <p><strong>Check verification</strong>&apos;a tıkla. DNS değişiklikleri yayılmada birkaç dakika sürebilir.</p>
      </>
    ),
  },
  {
    title: "3. (Opsiyonel) AI öneri sağlayıcısını ayarla",
    body: (
      <p>
        <Link href="/settings" className="underline">Settings</Link>&apos;ten OpenAI, Anthropic veya DeepSeek için
        API key girebilirsin. Key varsa her sorun için gerçek bir AI açıklaması üretilir. Yoksa Seos ücretsiz,
        şablon tabanlı önerilere düşer — hâlâ kullanışlı, sadece daha az kişiselleştirilmiş.
      </p>
    ),
  },
  {
    title: "4. (Opsiyonel) WordPress bağla",
    body: (
      <>
        <p>
          Site WordPress ise, WP Admin → Kullanıcılar → Profil&apos;den bir <strong>Application Password</strong>{" "}
          oluştur, sonra site URL, kullanıcı adı ve şifreyi proje sayfasındaki WordPress kartına gir.
        </p>
        <p>
          Bağlandığında <strong>TITLE</strong> düzeltmeleri için &quot;Approve &amp; Apply&quot; butonu çıkar ve
          gerçek sayfaya yazar. Diğer düzeltme tipleri şimdilik kopyala-yapıştır.
        </p>
      </>
    ),
  },
  {
    title: "5. (Opsiyonel) Google Search Console / Analytics bağla",
    body: (
      <p>
        Search Performance kartından Google hesabını bağlayıp bir Search Console ve GA4 mülkü seçebilirsin.
        Sıralama ve organik trafik verisi günde bir kez otomatik yenilenir. Salt okunur — Google hesabına hiçbir
        şey yazılmaz.
      </p>
    ),
  },
  {
    title: "6. Crawl başlat",
    body: (
      <>
        <p>Doğrulandıktan sonra <strong>Start crawl</strong>&apos;a tıkla. Seos şunları yapar:</p>
        <ul className="ml-4 list-disc">
          <li>Siteyi iç linkleri takip ederek tarar (sayfa sayısı canlı güncellenir)</li>
          <li>
            Otomatik olarak SEO denetimi yapar, skor hesaplar, düzeltme önerisi üretir, sitemap.xml/llms.txt/
            schema markup oluşturur ve (sağlayıcı ayarlıysa) AI önerileri üretir
          </li>
        </ul>
        <p>Bunların hiçbiri ek tıklama gerektirmez — crawl bitince kendiliğinden çalışır.</p>
      </>
    ),
  },
  {
    title: "7. Sonuçları oku",
    body: (
      <>
        <p>Audit kartında genel skor (0–100), kategori skorları ve bulunan her sorun görünür:</p>
        <ul className="ml-4 list-disc">
          <li>Mesaj, kural kimliği, önem derecesi ve öncelik</li>
          <li>Altında AI açıklaması (hazır değilse kısa süre &quot;Generating recommendation…&quot; gösterir)</li>
        </ul>
      </>
    ),
  },
  {
    title: "8. Bir düzeltmeyi uygula",
    body: (
      <>
        <p>Bir sorun için öneri varsa, altında bir kutu içinde görünür:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Copy</strong> — önerilen metni kopyalar, her zaman ve her site için kullanılabilir</li>
          <li>
            <strong>Approve &amp; Apply</strong> — sadece WordPress bağlıyken TITLE düzeltmeleri için; gerçek
            sayfaya yazar. Sonra <strong>Revert</strong> ile geri alınabilir.
          </li>
        </ul>
        <p>Sen tıklamadan hiçbir şey uygulanmaz — her düzeltme taslak olarak başlar.</p>
      </>
    ),
  },
  {
    title: "9. Diğer çıktılar",
    body: <p>Sayfanın altında üretilen <code>sitemap.xml</code>, <code>llms.txt</code> ve <code>robots.txt</code> görüntülenebilir/indirilebilir.</p>,
  },
  {
    title: "10. Tekrar crawl çalıştır",
    body: <p><strong>Start crawl</strong>&apos;ı tekrar çalıştırmak, önceki sonuçla karşılaştıran bir Trend kartı gösterir — skor değişimi, çözülen ve yeni sorunlar.</p>,
  },
];

export default function GuidePage() {
  const [language, setLanguage] = useLanguage();
  const steps = language === "en" ? STEPS_EN : STEPS_TR;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {language === "en" ? "Getting started with Seos" : "Seos'a Başlangıç"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === "en"
              ? "From adding your first site to applying your first fix."
              : "İlk siteni eklemekten ilk düzeltmeyi uygulamaya kadar."}
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

      <div className="flex flex-col gap-4">
        {steps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-base">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">{step.body}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
