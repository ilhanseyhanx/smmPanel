'use strict';

// SISTEM SAGLIGI PUANI (SYSTEM HEALTH) - FAZ 1
//
// TASARIM KURALLARI:
//  1) Tek karma puan YOK. Bu dosya yalnizca SYSTEM HEALTH uretir.
//     SEO HEALTH ayri bir puan olarak Faz 3'te eklenecek; iki puan
//     birbirine KARISTIRILMAZ. Googlebot/crawler/SEO olcumleri bu
//     puana asla girmez.
//  2) Yalnizca GERCEKTEN OLCULEN sey puanlanir. Saglayici ve odeme
//     saglig henuz olculmedigi icin (Faz 2) bu puana dahil EDILMEZ;
//     uydurma bilesen eklenmez.
//  3) Her bilesenin agirligi ve esikleri burada tek yerde tanimlidir;
//     /score-explain ucu bu tabloyu oldugu gibi admin'e gosterir.
//
// PUAN DAGILIMI (toplam 100):
//     Uygulama ayakta          30
//     Disk                     20
//     Bellek                   15
//     Veritabani erisimi       15
//     Yedek tazeligi           10
//     Uygulama kararliligi     10
//
// KRITIK TAVANI: herhangi bir bilesen "critical" ise toplam puan 60'i
// gecemez. Uc kritik sorun varken "82/100" gostermek yaniltici olurdu.

const KRITIK_TAVANI = 60;

// Esikler gercek sunucu kapasitesine gore secildi (7,8 GB RAM, 96 GB disk,
// olculen surec RSS'i ~180 MB).
const ESIKLER = {
  disk_uyari_pct: 70,
  disk_kritik_pct: 85,
  ram_uyari_pct: 80,
  ram_kritik_pct: 90,
  rss_uyari_mb: 512,
  rss_kritik_mb: 1024,
  wal_uyari_mb: 64,
  yedek_uyari_saat: 36,
  yedek_kritik_saat: 72,
  baslangic_uyari_24s: 3,
  baslangic_kritik_24s: 6
};

const MB = 1024 * 1024;

/** Bilesen sonucu uretir. durum: healthy | warning | critical | unknown */
function bilesen(key, label, weight, durum, deger, aciklama) {
  const oran = durum === 'healthy' ? 1 : durum === 'warning' ? 0.5 : 0;
  // Olculemedi: puani dusurmeyiz (cezalandirmak yaniltici olur), ama
  // toplam agirliktan da dusurulur ki puan sisirilmis olmasin.
  const olculdu = durum !== 'unknown';
  return {
    key,
    label,
    weight,
    status: durum,
    value: deger,
    note: aciklama,
    earned: olculdu ? Number((weight * oran).toFixed(1)) : null,
    lost: olculdu ? Number((weight * (1 - oran)).toFixed(1)) : null,
    counted: olculdu
  };
}

function diskBileseni(disk) {
  if (!disk || disk.used_percent == null) {
    return bilesen('disk', 'Disk', 20, 'unknown', null, 'Disk bilgisi bu ortamda okunamadı.');
  }
  const p = disk.used_percent;
  const deger = `%${p} dolu`;
  if (p >= ESIKLER.disk_kritik_pct) return bilesen('disk', 'Disk', 20, 'critical', deger, `Doluluk %${ESIKLER.disk_kritik_pct} eşiğini aştı.`);
  if (p >= ESIKLER.disk_uyari_pct) return bilesen('disk', 'Disk', 20, 'warning', deger, `Doluluk %${ESIKLER.disk_uyari_pct} üzerinde.`);
  return bilesen('disk', 'Disk', 20, 'healthy', deger, `%${ESIKLER.disk_uyari_pct} altında.`);
}

function bellekBileseni(server, application) {
  const ramPct = server?.mem_used_percent;
  const rssMb = application?.rss_bytes != null ? application.rss_bytes / MB : null;
  if (ramPct == null && rssMb == null) {
    return bilesen('memory', 'Bellek', 15, 'unknown', null, 'Bellek bilgisi okunamadı.');
  }
  const deger = `sistem %${ramPct ?? '?'} · süreç ${rssMb != null ? rssMb.toFixed(0) + ' MB' : '?'}`;
  // Iki sinyalin KOTU olani belirleyicidir.
  const ramKritik = ramPct != null && ramPct >= ESIKLER.ram_kritik_pct;
  const rssKritik = rssMb != null && rssMb >= ESIKLER.rss_kritik_mb;
  if (ramKritik || rssKritik) {
    return bilesen('memory', 'Bellek', 15, 'critical', deger,
      ramKritik ? `Sistem RAM %${ESIKLER.ram_kritik_pct} üzerinde.` : `Süreç RSS ${ESIKLER.rss_kritik_mb} MB üzerinde.`);
  }
  const ramUyari = ramPct != null && ramPct >= ESIKLER.ram_uyari_pct;
  const rssUyari = rssMb != null && rssMb >= ESIKLER.rss_uyari_mb;
  if (ramUyari || rssUyari) {
    return bilesen('memory', 'Bellek', 15, 'warning', deger,
      ramUyari ? `Sistem RAM %${ESIKLER.ram_uyari_pct} üzerinde.` : `Süreç RSS ${ESIKLER.rss_uyari_mb} MB üzerinde.`);
  }
  return bilesen('memory', 'Bellek', 15, 'healthy', deger, 'Sistem ve süreç belleği normal.');
}

function veritabaniBileseni(database) {
  if (!database) return bilesen('database', 'Veritabanı', 15, 'unknown', null, 'Veritabanı bilgisi alınamadı.');
  if (!database.accessible) {
    return bilesen('database', 'Veritabanı', 15, 'critical', 'erişilemiyor', 'Basit bir sorgu bile çalıştırılamadı.');
  }
  const walMb = database.wal_bytes != null ? database.wal_bytes / MB : null;
  const deger = `erişilebilir · WAL ${walMb != null ? walMb.toFixed(1) + ' MB' : '?'}`;
  if (walMb != null && walMb >= ESIKLER.wal_uyari_mb) {
    return bilesen('database', 'Veritabanı', 15, 'warning', deger,
      `WAL dosyası ${ESIKLER.wal_uyari_mb} MB üzerinde; checkpoint gecikiyor olabilir.`);
  }
  return bilesen('database', 'Veritabanı', 15, 'healthy', deger, 'Sorgulanabiliyor, WAL normal boyutta.');
}

function yedekBileseni(backup) {
  if (!backup || !backup.found) {
    return bilesen('backup', 'Yedek tazeliği', 10, 'critical', 'yedek bulunamadı',
      'Tanımlı yedek dizinlerinde veritabanı yedeği bulunamadı.');
  }
  const saat = backup.age_hours;
  const deger = `${saat} saat önce`;
  if (saat >= ESIKLER.yedek_kritik_saat) return bilesen('backup', 'Yedek tazeliği', 10, 'critical', deger, `${ESIKLER.yedek_kritik_saat} saatten eski.`);
  if (saat >= ESIKLER.yedek_uyari_saat) return bilesen('backup', 'Yedek tazeliği', 10, 'warning', deger, `${ESIKLER.yedek_uyari_saat} saatten eski.`);
  return bilesen('backup', 'Yedek tazeliği', 10, 'healthy', deger, `Son ${ESIKLER.yedek_uyari_saat} saat içinde alınmış.`);
}

function kararlilikBileseni(starts24h) {
  if (starts24h == null) {
    return bilesen('stability', 'Uygulama kararlılığı', 10, 'unknown', null, 'Başlangıç kaydı okunamadı.');
  }
  // NOT: bu sayac BASLANGIC sayisidir (ilk acilis dahil), restart sayisi degil.
  const deger = `son 24 saatte ${starts24h} başlangıç`;
  if (starts24h >= ESIKLER.baslangic_kritik_24s) {
    return bilesen('stability', 'Uygulama kararlılığı', 10, 'critical', deger, `24 saatte ${ESIKLER.baslangic_kritik_24s}+ başlangıç beklenmedik.`);
  }
  if (starts24h >= ESIKLER.baslangic_uyari_24s) {
    return bilesen('stability', 'Uygulama kararlılığı', 10, 'warning', deger, 'Planlı deploy dışında başlangıç olabilir.');
  }
  return bilesen('stability', 'Uygulama kararlılığı', 10, 'healthy', deger, 'Beklenen aralıkta (deploy kaynaklı başlangıçlar dahil).');
}

/**
 * SYSTEM HEALTH puanini ve bilesen dokumunu uretir.
 * @param {object} snapshot healthMetrics.anlikGoruntu() ciktisi
 * @param {number|null} starts24h son 24 saatteki uygulama baslangici sayisi
 */
function systemHealth(snapshot, starts24h) {
  const s = snapshot || {};
  const bilesenler = [
    // Istek islendigine gore surec ayakta. Disaridan erisilebilirlik bu
    // fazda olculmez (bkz. bilinen sinirlamalar).
    bilesen('app_online', 'Uygulama ayakta', 30, 'healthy',
      `çalışıyor · ${Math.round((s.application?.uptime_sec || 0) / 3600)} saattir`,
      'Bu yanıt uygulamanın kendisi tarafından üretildi.'),
    diskBileseni(s.disk),
    bellekBileseni(s.server, s.application),
    veritabaniBileseni(s.database),
    yedekBileseni(s.backup),
    kararlilikBileseni(starts24h)
  ];

  const sayilan = bilesenler.filter(b => b.counted);
  const toplamAgirlik = sayilan.reduce((t, b) => t + b.weight, 0);
  const kazanilan = sayilan.reduce((t, b) => t + b.earned, 0);
  // Olculemeyen bilesen varsa puan, olculen agirliklar uzerinden normalize
  // edilir; boylece "bilinmiyor" ne ceza ne de bedava puan olur.
  let puan = toplamAgirlik > 0 ? Math.round((kazanilan / toplamAgirlik) * 100) : 0;

  const kritikler = bilesenler.filter(b => b.status === 'critical');
  const uyarilar = bilesenler.filter(b => b.status === 'warning');
  const tavanUygulandi = kritikler.length > 0 && puan > KRITIK_TAVANI;
  if (tavanUygulandi) puan = KRITIK_TAVANI;

  const durum = kritikler.length ? 'critical' : uyarilar.length ? 'warning' : 'healthy';

  return {
    score: puan,
    status: durum,
    critical_count: kritikler.length,
    warning_count: uyarilar.length,
    healthy_count: bilesenler.filter(b => b.status === 'healthy').length,
    unknown_count: bilesenler.filter(b => b.status === 'unknown').length,
    components: bilesenler,
    // Admin "Nasil hesaplaniyor?" ekraninin ihtiyaci olan her sey:
    formula: {
      total_weight: 100,
      counted_weight: toplamAgirlik,
      earned_weight: Number(kazanilan.toFixed(1)),
      critical_cap: KRITIK_TAVANI,
      critical_cap_applied: tavanUygulandi,
      thresholds: ESIKLER,
      excluded: [
        'SEO ve crawler ölçümleri SYSTEM HEALTH puanına dahil edilmez (ayrı SEO HEALTH puanı Faz 3).',
        'Sağlayıcı ve ödeme sağlığı henüz ölçülmediği için (Faz 2) puana dahil edilmedi.'
      ]
    }
  };
}

module.exports = { systemHealth, ESIKLER, KRITIK_TAVANI };
