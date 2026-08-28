// ══════════════════════════════════════════════════════════════
// IKKI BAZANI SOLISHTIRISH — eski Supabase ⟷ VPS
// ══════════════════════════════════════════════════════════════
// Ishlatish:
//   NSPOS_MANBA_URL=https://<eski-ref>.supabase.co \
//     node scripts/solishtir.mjs --ssh root@169.58.216.246 --target nspos
//
//   node scripts/solishtir.mjs --target "postgres://…/nspos"
//   node scripts/solishtir.mjs --target "…" --kesim 2026-08-20
//   node scripts/solishtir.mjs --target "…" --only=sales,sale_items
//
// `--ssh` — so'rov SERVERDA bajariladi. VPS Postgres'i tashqariga
// port ochmagani uchun ODATDAGI yo'l shu (pastdagi izohga qarang).
//
// HECH NARSA YOZMAYDI. Ikkala bazadan ham faqat O'QIYDI.
//
// —— Nima uchun kerak ——
// VPS'ga ko'chgandan keyin eski Vercel saytlari tirik qoldi va ular
// ESKI Supabase'ga yozishda davom etdi. Ya'ni ma'lumot ikkiga
// bo'lindi: bir qism yozuv faqat eskisida, bir qismi faqat yangisida.
// Eski bazani o'chirishdan OLDIN "eskisida bor, yangisida yo'q"
// qatorlarni topib olish kerak — aks holda ular butunlay yo'qoladi.
//
// —— Nega qator sanog'i yetarli emas ——
// `kochirish.mjs` oxiridagi solishtirish ikki jadvalning SONINI va
// PUL yig'indisini taqqoslaydi. Ko'chirish tugagan kunda bu yetardi.
// Endi esa ikkala baza ham oldinga siljigan: VPS'da Billz sinxroni
// yangi cheklarni qo'shgan, eskisida esa xodim qo'lda yozgan bo'lishi
// mumkin. Sanoq baribir teng chiqmaydi va u "qaysi qator qayerda"
// degan savolga javob bermaydi. Shuning uchun bu yerda BIRLAMCHI
// KALITLAR to'plami solishtiriladi.
//
// —— Uch xil farq ——
//   faqat_eski  — eski bazada bor, VPS'da yo'q  → KO'CHIRISH kerak
//   faqat_vps   — VPS'da bor, eskisida yo'q     → normal (Billz sinxroni)
//   ozgargan    — ikkalasida bor, lekin eski nusxasi KEYINROQ
//                 tahrirlangan → qo'lda ko'riladi (birlamchi kalit
//                 to'qnashgani uchun `on conflict do nothing` uni
//                 ko'chira olmaydi)
import { execFileSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { sql, manbaNomi } from "./lib/yuk.mjs";
import { BACKUP_TABLES } from "../lib/backupTables.js";

const arg = (nom, standart = null) => {
  const p = process.argv.find((a) => a.startsWith(`--${nom}=`));
  if (p) return p.slice(nom.length + 3);
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1] : standart;
};
const bor = (nom) => process.argv.includes(`--${nom}`);

const TARGET = arg("target");
if (!TARGET) {
  console.error("--target kerak. Masalan:");
  console.error('  node scripts/solishtir.mjs --target "postgres://127.0.0.1:6432/nspos"');
  process.exit(1);
}

// VPS'ga o'tish kuni. Shu sanadan keyin eski bazada tahrirlangan
// qator "shubhali" hisoblanadi — u paytda hamma yangi saytda ishlashi
// kerak edi.
const KESIM = arg("kesim", "2026-08-20");

// `--ssh root@…` berilsa so'rov SERVERDA bajariladi (sabab pastda,
// `psqlJson` izohida). U holda `--target` — shunchaki baza NOMI.
const SSH = arg("ssh");
const SSH_KALIT = process.env.NSPOS_KEY ?? `${process.env.HOME}/.ssh/nspos`;

// ══════════════════════════════════════════════════════════════
// QO'RIQCHI: manba va nishon BIR XIL bo'lib qolmasin
// ══════════════════════════════════════════════════════════════
// 2026-08-23 da aniqlangan xato aynan shu edi: `.env.local` qayerga
// qarayotgani hech qayerda yozilmagani uchun tekshiruv bir necha kun
// noto'g'ri baza ustida ishladi. Bu yerda xato yanada qimmatroq
// bo'lardi — VPS'ni VPS bilan solishtirsak "farq yo'q" chiqadi va
// eski bazadagi yozuvlar bilinmay o'chib ketardi.
const MANBA = manbaNomi();
const nishonHost = SSH
  ? `${SSH} → ${TARGET}`
  : TARGET.replace(/^postgres(ql)?:\/\//, "").split("@").pop().split("?")[0];

console.log(`\n  Manba (eski):  ${MANBA}`);
console.log(`  Nishon (VPS):  ${nishonHost}`);
console.log(`  Kesim sanasi:  ${KESIM}\n`);

if (MANBA.startsWith("Postgres:") && !bor("majburiy")) {
  const manbaHost = MANBA.slice("Postgres:".length).trim();
  const ikkalaMahalliy = /mahalliy soket|^127\.|^localhost/.test(manbaHost)
    && /^127\.|^localhost|^\//.test(nishonHost);
  if (manbaHost === nishonHost || ikkalaMahalliy) {
    console.error("TO'XTADI: manba va nishon bir xil bazaga qarayapti.");
    console.error("Manba ESKI Supabase bo'lishi kerak (NSPOS_PG ni olib tashlang).");
    console.error("Ataylab shunday bo'lsa: --majburiy");
    process.exit(1);
  }
}

const ISH = ".tmp/solishtir";
mkdirSync(ISH, { recursive: true });

// Nishondan o'qish. `yuk.mjs` dagi `sqlViaPsql` bilan bir xil usul:
// har SELECT `json_agg` ichiga o'raladi, ya'ni javob manbadagidek
// obyektlar massivi bo'lib keladi va solishtirish kodi ikki tomon
// uchun ham bitta bo'ladi.
// ── NISHONGA QANDAY BORILADI ──
// VPS Postgres'i TASHQARIGA PORT OCHMAYDI (`listen_addresses = localhost`,
// pg_hba faqat 127.0.0.1). Ya'ni kompyuterdan to'g'ridan-to'g'ri
// ulanib bo'lmaydi va `--target` shu holicha ishlamaydi.
//
// Tunnel ochish ham yaramaydi. Parol qo'yilgan yagona rol —
// `nspos_app`, u esa RLS ni CHETLAB O'TMAYDI (rolbypassrls = false).
// Uning ko'zi bilan `sales`, `customers`, `products` BO'SH ko'rinadi
// va solishtirish "eskisida 9 032 qator bor, VPS'da yo'q" deb
// chiqarardi — ya'ni javob xato emas, JIMGINA teskari bo'lardi va
// mavjud ma'lumot ustiga ko'chirish taklif qilinardi.
//
// Shuning uchun so'rov SERVERNING O'ZIDA, `postgres` roli bilan
// bajariladi (u superuser, RLS ko'rmaydi). SQL stdin orqali beriladi:
// buyruq satrida uzun so'rovni qavslash xato manbai bo'lardi.
const psqlJson = (query) => {
  const ichki = query.trim().replace(/;\s*$/, "");
  const toliq = `select coalesce(json_agg(t), '[]'::json) from (${ichki}) t;`;
  const opt = { encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
                stdio: ["pipe", "pipe", "pipe"] };
  const out = SSH
    ? execFileSync("ssh", ["-i", SSH_KALIT, "-o", "ConnectTimeout=20", SSH,
        `su postgres -c 'psql -d ${TARGET} -tAX -v ON_ERROR_STOP=1 -f -'`],
        { ...opt, input: toliq })
    : execFileSync("psql", [TARGET, "-tAX", "-v", "ON_ERROR_STOP=1", "-c", toliq], opt);
  return JSON.parse(out);
};

const son = (n) => Number(n).toLocaleString("ru-RU");
const boluv = (jadval) => (jadval.includes(".") ? jadval.split(".") : ["public", jadval]);

// Birlamchi kalit ustunlari — taxmin qilinmaydi, bazadan so'raladi.
// `information_schema` EMAS, `pg_catalog`: birinchisi jadval egasidan
// boshqaga bo'sh ko'rinadi (yuk.mjs dagi `fkColumn` izohiga qarang).
const PK_SQL = (sxema, nom) => `
  select a.attname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
  where n.nspname = '${sxema}' and t.relname = '${nom}' and c.contype = 'p'
  order by array_position(c.conkey, a.attnum)`;

const USTUN_SQL = (sxema, nom) => `
  select a.attname
  from pg_attribute a
  join pg_class t on t.oid = a.attrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = '${sxema}' and t.relname = '${nom}'
    and a.attnum > 0 and not a.attisdropped`;

// Pul ustunlari — `kochirish.mjs` dagi ro'yxat bilan bir xil.
// Farq topilganda "necha qator" dan ko'ra "qancha pul" muhimroq.
const PUL = {
  sales: "total", sale_items: "total", expenses: "amount",
  debts: "amount", debt_payments: "amount", kassa_ops: "amount",
  payouts: "amount", payroll_payments: "amount", products: "sale_price",
  stock: "qty", customers: "balance",
};

const JADVALLAR = ["auth.users", ...BACKUP_TABLES];
const faqat = arg("only");
const royxat = faqat
  ? JADVALLAR.filter((j) => faqat.split(",").includes(j.replace("auth.", "")))
  : JADVALLAR;

// Manbadan sahifalab o'qish: `sale_items` 34 000 dan ortiq qator va
// bitta so'rovda javob uzilib qoladi. Tartib BIRLAMCHI KALIT bo'yicha —
// `order by 1` bo'lsa teng qatorlar har so'rovda boshqa tartibda kelib,
// sahifa chegarasida qator ikki marta yoki umuman kelmasligi mumkin.
async function oqiManba(jadval, ustunlar, tartib) {
  const QADAM = 5000;
  const out = [];
  for (let ofset = 0; ; ofset += QADAM) {
    const rows = await sql(
      `select ${ustunlar} from ${jadval} order by ${tartib} offset ${ofset} limit ${QADAM};`);
    out.push(...rows);
    if (rows.length < QADAM) return out;
  }
}

const kalitla = (r, pk) => pk.map((c) => String(r[c] ?? "")).join("");
const vaqt = (v) => (v ? new Date(v).getTime() : 0);

// ══ SOLISHTIRISH ══════════════════════════════════════════════
console.log("══ SOLISHTIRISH ══");
console.log(`  ${"jadval".padEnd(21)} ${"eski".padStart(7)} ${"VPS".padStart(7)}`
  + ` ${"faqat eski".padStart(11)} ${"faqat VPS".padStart(10)} ${"o'zgargan".padStart(10)}  pul (faqat eski)`);

const hisobot = [];
for (const jadval of royxat) {
  const [sxema, nom] = boluv(jadval);
  process.stdout.write(`  ${jadval.padEnd(21)}`);
  try {
    const pk = (await sql(PK_SQL(sxema, nom))).map((r) => r.attname);
    if (!pk.length) throw new Error("birlamchi kalit yo'q — solishtirib bo'lmaydi");

    // Ikkala tomonning ustunlari BIR XIL emas: VPS'dagi `auth.users`
    // `00-shim.sql` da qaytadan yaratilgan va Supabase'nikidan tor.
    // Shuning uchun faqat IKKALASIDA ham bor ustun so'raladi.
    const uManba = new Set((await sql(USTUN_SQL(sxema, nom))).map((r) => r.attname));
    const uNishon = new Set(psqlJson(USTUN_SQL(sxema, nom)).map((r) => r.attname));
    const ikkalasida = (c) => uManba.has(c) && uNishon.has(c);

    const pulUstun = ikkalasida(PUL[nom]) ? PUL[nom] : null;
    const vaqtUstun = ikkalasida("updated_at") ? "updated_at"
      : (ikkalasida("created_at") ? "created_at" : null);

    const olinadi = [...pk, pulUstun, vaqtUstun].filter(Boolean);
    const ifoda = [...new Set(olinadi)].map((c) => `"${c}"`).join(", ");
    const tartib = pk.map((c) => `"${c}"`).join(", ");

    const eski = await oqiManba(jadval, ifoda, tartib);
    const vps = psqlJson(`select ${ifoda} from ${jadval} order by ${tartib}`);

    const vpsMap = new Map(vps.map((r) => [kalitla(r, pk), r]));
    const faqatEski = [];
    const ozgargan = [];
    for (const r of eski) {
      const k = kalitla(r, pk);
      const juft = vpsMap.get(k);
      if (!juft) { faqatEski.push(r); continue; }
      // Ikkalasida bor. Eski nusxa kesimdan keyin va VPS nusxasidan
      // KEYINROQ tahrirlangan bo'lsa — eskisida yangiroq ma'lumot bor.
      // Bir soniyalik farq e'tiborga olinmaydi (ko'chirish paytidagi
      // yaxlitlash).
      if (vaqtUstun) {
        const tE = vaqt(r[vaqtUstun]);
        const tV = vaqt(juft[vaqtUstun]);
        if (tE >= vaqt(KESIM) && tE > tV + 1000) ozgargan.push({ kalit: k, eski: r[vaqtUstun], vps: juft[vaqtUstun] });
      }
      vpsMap.delete(k);
    }
    const faqatVps = vpsMap.size;

    const pul = pulUstun
      ? +faqatEski.reduce((a, r) => a + (Number(r[pulUstun]) || 0), 0).toFixed(2) : null;

    console.log(`${son(eski.length).padStart(7)} ${son(vps.length).padStart(7)}`
      + ` ${son(faqatEski.length).padStart(11)} ${son(faqatVps).padStart(10)}`
      + ` ${son(ozgargan.length).padStart(10)}  ${pul === null ? "—" : pul.toFixed(2)}`);

    if (faqatEski.length || ozgargan.length) {
      writeFileSync(`${ISH}/${jadval.replace(".", "_")}.json`,
        JSON.stringify({ jadval, pk, pulUstun, vaqtUstun, faqatEski, ozgargan }, null, 2));
    }
    hisobot.push({ jadval, eski: eski.length, vps: vps.length,
      faqatEski: faqatEski.length, faqatVps, ozgargan: ozgargan.length, pul });
  } catch (e) {
    console.log(`  XATO: ${e.message.split("\n")[0].slice(0, 70)}`);
    hisobot.push({ jadval, xato: e.message.slice(0, 200) });
  }
}

// ══ AUDIT JURNALI ═════════════════════════════════════════════
// Birlamchi kalit solishtiruvi FAQAT qo'shilgan qatorni ko'radi.
// Eski saytda qator TAHRIRLANGAN yoki O'CHIRILGAN bo'lsa, u yerda
// hech qanday iz qolmaydi. `audit_log` esa uchalasini ham yozadi —
// ya'ni "farq qayerdan keldi" degan savolga aniq javob shu yerda.
console.log("\n══ ESKI BAZADAGI AUDIT JURNALI ══");
try {
  const jurnal = await sql(`
    select table_name, action, count(*) as soni,
           min(at)::text as boshi, max(at)::text as oxiri
    from audit_log where at >= '${KESIM}'
    group by 1, 2 order by 3 desc limit 40;`);
  if (!jurnal.length) {
    console.log(`  ${KESIM} dan keyin eski bazada hech qanday yozuv bo'lmagan.`);
  } else {
    console.log(`  ${"jadval".padEnd(24)} ${"amal".padEnd(8)} ${"soni".padStart(7)}  oxirgisi`);
    for (const r of jurnal) {
      console.log(`  ${String(r.table_name).padEnd(24)} ${String(r.action).padEnd(8)}`
        + ` ${son(r.soni).padStart(7)}  ${String(r.oxiri).slice(0, 16)}`);
    }
    writeFileSync(`${ISH}/audit_log.json`, JSON.stringify(jurnal, null, 2));
  }
} catch (e) {
  console.log(`  o'qib bo'lmadi: ${e.message.split("\n")[0].slice(0, 80)}`);
}

// ══ XULOSA ════════════════════════════════════════════════════
const kochiriladi = hisobot.filter((h) => h.faqatEski > 0);
const qolda = hisobot.filter((h) => h.ozgargan > 0);
const xatolar = hisobot.filter((h) => h.xato);

console.log("\n══ XULOSA ══");
if (xatolar.length) {
  console.log(`  ⚠ ${xatolar.length} ta jadval o'qilmadi: ${xatolar.map((h) => h.jadval).join(", ")}`);
}
if (!kochiriladi.length && !qolda.length) {
  console.log("  ✓ Eski bazadagi hamma qator VPS'da bor. Ko'chiradigan narsa yo'q.");
} else {
  if (kochiriladi.length) {
    const jamiQator = kochiriladi.reduce((a, h) => a + h.faqatEski, 0);
    const jamiPul = kochiriladi.reduce((a, h) => a + (h.pul ?? 0), 0);
    console.log(`  ${son(jamiQator)} qator faqat eski bazada (${jamiPul.toFixed(2)} USD) — ko'chirish kerak:\n`);
    console.log(`    node scripts/kochirish.mjs --target "${TARGET.replace(/:[^:@]*@/, ":***@")}" \\`);
    console.log(`      --only=${kochiriladi.map((h) => h.jadval.replace("auth.", "")).join(",")}\n`);
    console.log("  Ko'chirish FAQAT QO'SHADI (`on conflict do nothing`) — VPS'dagi");
    console.log("  qator hech qachon ustiga yozilmaydi.");
  }
  if (qolda.length) {
    console.log(`\n  ${qolda.reduce((a, h) => a + h.ozgargan, 0)} qator ikkala bazada bor, lekin eskisi yangiroq —`);
    console.log("  buni ko'chirish ko'chirmaydi (kalit to'qnashadi). Qo'lda ko'riladi:");
    for (const h of qolda) console.log(`    ${ISH}/${h.jadval.replace(".", "_")}.json  (${h.ozgargan} qator)`);
  }
}
console.log(`\n  Tafsilot: ${ISH}/*.json\n`);
process.exit(kochiriladi.length || qolda.length || xatolar.length ? 1 : 0);
