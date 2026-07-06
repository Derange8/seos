# Faz 2 — Citation-aware before/after kanıtı

> Kurul tasarım dokümanı. Henüz kod değil.
> Amaç: Faz 1'de açılan **citation** eksenini, mevcut before/after deney
> (experiment) ve delta sistemine taşıyarak "acting on a query → did it move"
> kanıtının citation kazanımını da görmesini sağlamak.

---

## 0. Bugünkü durum (kod gerçeği)

Faz 2'nin ALTYAPISI zaten var ve iyi tasarlanmış:
- `VisibilityExperiment` entity: baseline slot → action → outcome slot ledger'ı.
- `StartVisibilityExperimentUseCase`: kullanıcı bir sorgu için içerik taslağı
  çıkarınca deney açar (baseline = o anki dominant slot).
- `ResolveVisibilityExperimentsUseCase`: sonraki probe o sorguyu yeniden
  ölçünce deneyi kapatır (outcome = yeni dominant slot).
- `AutoAiVisibilityProbeScheduler` (Otomatik Pilot): `autoPilotEnabled` projeler
  için günde bir kez otomatik yeniden-ölçüm. **Faz 1 sayesinde artık
  web_grounded çalışıyor.**
- `computeAiVisibilityDelta`: run-to-run slot % hareketi + slot değişimleri.

**Boşluk:** Bütün bu sistem yalnızca **slot (mention)** hareketini ölçüyor.
`classifyOutcome(baseline, outcome)` sadece `SLOT_RANK` farkına bakıyor.
`delta` sadece mentioned/open/contested %'lerini karşılaştırıyor. Faz 1'de
asıl para birimini **citation** yaptık ama kanıt katmanı onu görmüyor.

Somut başarısızlık: kullanıcı içerik yayınlar → AI araması artık siteyi
**kaynak gösterir** (citation kazanıldı) ama cevap gövdesinde hâlâ önermez
(slot OPEN kalır) → sistem "UNCHANGED" der. En değerli ara-kazanım görünmez.

## 1. Problem

Citation, mention'dan önce gelen ve daha ölçülebilir bir kazanımdır: bir sayfa
önce AI'nın kaynakçasına girer, sonra (yeterince güçlüyse) cevapta önerilmeye
başlar. Kanıt sistemi citation'ı görmezse, kullanıcının attığı doğru adımın
ilk somut karşılığını gizler ve "işe yaramadı" yanılsaması yaratır — SaaS
retention'ını doğrudan kıran bir kör nokta.

## 2. Kullanıcıya sağladığı değer

- **Erken kazanç sinyali:** "Slot daha değişmedi ama artık kaynak
  gösteriliyorsun (0 → 2 örnek)" — doğru yolda olduğunun kanıtı, vazgeçmeden.
- **Dürüst before/after:** Yayınla → yeniden ölç → "citation kazandın"
  otomatik kanıtlanır. Misyonun "sonucu tekrar doğrula" cümlesi tam bu.
- **Ölçülebilirlik:** IMPROVED artık iki eksende (slot VEYA citation ilerledi).

## 3. Teknik mimari

### 3.1 Experiment entity genişlemesi
`VisibilityExperimentProps`'a iki alan:
- `baselineCited: boolean` — deney açılırken sorgunun herhangi bir sample'ında
  domain cited miydi (baseline run'dan `outcome.citedSamples > 0`).
- `outcomeCited: boolean | null` — resolve edildiğinde post-action okuma.

`classifyOutcome` iki eksene bakar:
- Slot ilerledi (SLOT_RANK arttı) **VEYA** citation kazanıldı
  (baselineCited false → outcomeCited true) → **IMPROVED**.
- Slot geriledi **VEYA** citation kaybedildi (true → false) ve slot ilerlemedi
  → **REGRESSED**.
- İkisi de aynı → **UNCHANGED**.
(Kesin öncelik kuralları test-driven belirlenecek; slot ilerlemesi citation
kaybını gölgede bırakmamalı — sıralama testte netleşir.)

### 3.2 Delta genişlemesi
`AiVisibilityDelta`'ya `citedPctDelta: number` (curr.citedPct - prev.citedPct).
`changes` listesine citation kazanan/kaybeden sorgular için opsiyonel bir
`citationChange` işareti (slot değişmese bile citation değişimini gösterebilmek
için `changes`'ın koşulunu "slot değişti VEYA citation değişti"ye genişlet).

### 3.3 Etkilenen katmanlar
- `start-visibility-experiment-use-case`: baseline açarken `baselineCited`
  hesapla (`outcome.citedSamples > 0`).
- `resolve-visibility-experiments-use-case`: resolve ederken `outcomeCited`
  geçir.
- `visibility-experiment.resolve(outcomeSlot, outcomeCited, outcomeRunAt)`
  imzası genişler.
- Persistence: iki yeni kolon + migration.
- DTO: `VisibilityExperimentDto`'ya `baselineCited`/`outcomeCited`/citation-aware
  outcome.

## 4. UI/UX tasarımı
Mevcut deney/delta gösterimine ekleme, yeni ekran yok:
- Deney satırında outcome rozetine citation işareti: "IMPROVED (citation
  kazanıldı)" gibi.
- Delta kartına "Cited {+X}%" satırı (mevcut Mentioned/Open delta'larının
  yanına — Faz 1'de scorecard'a eklenen 🔗 ile tutarlı).

## 5. Veri modeli (Prisma)
```prisma
model VisibilityExperiment {
  // mevcut alanlar...
  baselineCited Boolean  @default(false)
  outcomeCited  Boolean?
}
```
Migration: eski satırlar `baselineCited=false`, `outcomeCited=null` — bu
doğru okuma (o deneyler citation ölçülmeden önce açıldı).

## 6. API akışı
Yeni endpoint YOK. Mevcut akışlar zenginleşir:
1. Kullanıcı içerik taslağı çıkarır → `start-experiment` baselineCited'i de yakalar.
2. Sonraki (manuel/otomatik) web_grounded probe → `resolve-experiments`
   outcomeCited'i de kaydeder → outcome citation-aware sınıflanır.
3. Deney listesi/delta DTO'su citation hareketini döner → UI gösterir.

## 7. Edge case'ler
- **Parametric baseline, web_grounded outcome (veya tersi):** citation eksenleri
  kıyaslanamaz (parametric'te citation hep 0). Kural: iki okuma da web_grounded
  değilse citation-outcome'u UNCHANGED kabul et, yanlış "kazandın" deme.
  Deney, hangi modda açıldığını bilmeli mi? — baselineCited zaten 0/false olur;
  ama outcome web_grounded'da true olursa sahte IMPROVED çıkar. Çözüm:
  `baselineGrounded`/`outcomeGrounded` bilgisini de taşı VEYA citation-outcome'u
  yalnızca ikisi de web_grounded olduğunda değerlendir. (Test-driven; muhtemelen
  experiment'a `baselineGrounded` boolean eklemek en temizi.)
- **Idempotent resolve:** mevcut davranış korunur (ilk post-action okuma kalır).
- **Citation gürültüsü:** tek sample'da citation gelip gitmesi. baselineCited
  "≥1 sample cited" eşiği kullanıyor; outcome da aynı eşik — tutarlı.

## 8. Güvenlik riskleri
Yeni dış girdi yok (citation verisi Faz 1'de zaten geliyor ve saklanıyor).
DB'ye iki boolean; risk yok.

## 9. Performans etkisi
İhmal edilebilir — hesaplama zaten yapılan probe verisi üzerinde, ekstra LLM
çağrısı veya sorgu yok. İki boolean kolon.

## 10. MVP kapsamı
**Dahil:**
- Experiment entity: baselineCited/outcomeCited + `baselineGrounded` (mod
  uyumsuzluğu edge-case'i için) + citation-aware `classifyOutcome`.
- start/resolve use-case güncellemesi.
- Delta: citedPctDelta + citation-aware changes.
- Persistence + migration + DTO.
- UI: outcome rozetinde citation, delta'da cited satırı.
- Testler: citation-aware outcome sınıflaması (slot sabit + citation kazanımı =
  IMPROVED; mod uyumsuzluğunda sahte IMPROVED yok), delta citation matematiği.

**Hariç (MVP değil):**
- Citation kaybının otomatik uyarısı/aksiyonu (sadece raporla).
- İstatistiksel anlamlılık testi (kaç sample "gerçek" kazanım — Faz 3 raporuna).

## 11. Gelecekte genişletme
- **Faz 3 raporu:** "Bu düzeltme şu sorguyu OPEN→CITED yaptı" satırları,
  paylaşılabilir before/after kanıt raporunun çekirdeği.
- **Otomatik draft→publish→verify döngüsü:** yayınla, N gün sonra otomatik
  web_grounded re-probe, citation kazanımını bildir (scheduler zaten web_grounded).
- **Collective layer (deferred):** citation-aware outcome'lar, "hangi içerik
  hamlesi hangi sektörde citation kazandırıyor" toplu modelinin daha zengin
  substratı.
```
