// ══════════════════════════════════════════════════════════════
// ILOVA MODULLARINI NODE'DA O'QIY OLISH UCHUN
// ══════════════════════════════════════════════════════════════
// Next.js kengaytmasiz import'ni ("./demoData") o'zi tushunadi, Node
// esa tushunmaydi. Shu ilgak kengaytmani qo'shib beradi — shu sabab
// tekshiruv skripti ilovaning AYNAN o'z kodini ishlata oladi.
//
// Nega muhim: tekshiruvda formulalar qaytadan yozilsa, ular ilovadan
// asta-sekin uzoqlashadi va tekshiruv "hammasi joyida" deb turgan
// paytda ekranda boshqa raqam turadi (2026-08-14 da aynan shunday
// bo'ldi: doimiy xarajat skriptda hisobga olinmagan edi).
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      for (const suffix of [".js", "/index.js"]) {
        try { return await next(specifier + suffix, context); } catch {}
      }
    }
    throw err;
  }
}
