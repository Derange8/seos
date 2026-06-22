# Seos Kullanım Kılavuzu

Bu kılavuz, Seos'u hiç kullanmamış birinin uygulamayı açıp ilk sonuçları almasına kadar olan adımları anlatır.

## 1. Uygulamayı açma

`npm run dev` ile başlatıp `http://localhost:3000` adresine gidildiğinde, henüz proje yoksa doğrudan "Set up your site" formu görünür.

## 2. Site ekleme

- **Project name**: site için bir isim (örn. "Janus")
- **Domain**: sitenin alan adı (örn. `janus.vote`)

Kaydedince proje sayfasına yönlenir.

## 3. Domain sahipliğini doğrulama

Crawl başlatabilmek için önce domain'in sana ait olduğu kanıtlanmalı. Proje sayfasında iki seçenek gösterilir, biri yeterli:

- **DNS TXT kaydı**: gösterilen kayıt adı/değerini domain sağlayıcının DNS panelinden eklemek
- **Dosya yöntemi**: gösterilen `.well-known` adresine, içinde verilen token'ı barındıran bir dosya koymak

Ekledikten sonra **"Check verification"** butonuna tıkla. DNS değişiklikleri yayılmada birkaç dakika sürebilir.

## 4. (Opsiyonel ama önerilir) AI öneri sağlayıcısını ayarlama

`/settings` sayfasından bir LLM sağlayıcı (OpenAI, Anthropic veya DeepSeek) seçip API key'ini girebilirsin.

- **Girersen**: her sorun için gerçek bir AI açıklaması/önerisi üretilir.
- **Girmezsen**: sistem otomatik olarak ücretsiz, şablon tabanlı (statik) önerilere düşer — hâlâ çalışır, sadece daha az kişiselleştirilmiş.

## 5. (Opsiyonel) WordPress bağlama

Site WordPress ise, proje sayfasındaki **WordPress** kartından bağlanabilirsin:

- WordPress admin → Kullanıcılar → Profil → **Application Password** oluştur
- Site URL, kullanıcı adı ve bu şifreyi forma gir

Bağlandığında, **sadece TITLE (başlık) düzeltmeleri** için "Approve & Apply" butonu görünür ve tek tıkla siteye gerçekten yazılır. Diğer düzeltme tipleri (meta açıklama, H1, canonical) şu an için kopyala-yapıştırla uygulanıyor.

## 6. (Opsiyonel) Google Search Console / Analytics bağlama

**Search Performance** kartından Google hesabını bağlayıp ilgili Search Console sitesini ve GA4 mülkünü seçersen, sıralama ve organik trafik verileri otomatik olarak (yaklaşık 24 saatte bir) çekilip dashboard'da gösterilir. Salt-okunur, Google hesabına hiçbir yazma işlemi yapılmaz.

## 7. Crawl başlatma

Domain doğrulandıktan sonra **"Start crawl"** butonu aktif olur. Tıklandığında:

1. Site, iç linkleri takip ederek taranır (sayfa sayısı dashboard'da canlı güncellenir)
2. Tarama bitince otomatik olarak: SEO denetimi, skor hesaplama, düzeltme önerisi üretimi, sitemap/llms.txt/schema markup üretimi ve (sağlayıcı ayarlıysa) AI önerileri sırasıyla çalışır

Bu adımların hiçbiri ekstra tıklama gerektirmez — crawl bitince hepsi kendiliğinden tetiklenir.

## 8. Sonuçları okuma

**Audit** kartında:
- Genel skor (0–100) ve kategori bazlı skorlar (technical, content, performance, structured_data)
- Bulunan her sorun: mesaj, kural kimliği, önem derecesi (severity) ve önceliği
- Sorunun altında, hazırsa AI açıklaması/önerisi (yoksa "Generating recommendation…" görünür, kısa süre sonra dolar)

## 9. Düzeltmeleri uygulama

Bir sorun için otomatik üretilmiş bir düzeltme varsa, mesajın altında kutu içinde görünür:

- **Copy** butonu: düzeltme metnini panoya kopyalar — her zaman kullanılabilir, herhangi bir site için
- **Approve & Apply** butonu: sadece TITLE tipi düzeltmelerde ve WordPress bağlıyken görünür, tıklanınca gerçekten WordPress'teki sayfaya yazılır
- Uygulandıktan sonra **Revert** ile geri alınabilir (eski değer saklanır)

Hiçbir düzeltme senin onayın olmadan kendiliğinden uygulanmaz — hepsi DRAFT (taslak) olarak başlar.

## 10. Diğer çıktılar

Sayfanın altında ayrıca görüntülenebilir/indirilebilir:
- **sitemap.xml**
- **llms.txt**
- **robots.txt**

## 11. Tekrar crawl çalıştırma

"Start crawl" tekrar çalıştırıldığında, önceki sonuçla karşılaştıran bir **Trend** kartı belirir (skor değişimi, çözülen/yeni sorunlar).

---

**Özet akış:** Site ekle → doğrula → (istersen AI key / WordPress / Google bağla) → crawl başlat → sonuçları oku → düzeltmeleri kopyala veya (WordPress'te TITLE için) tek tıkla uygula.
