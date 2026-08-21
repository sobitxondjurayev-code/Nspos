"use client";
// ══════════════════════════════════════════════════════════════
// KATEGORIYALAR — BAZADAN
// ══════════════════════════════════════════════════════════════
// Nega alohida modul kerak bo'ldi (2026-08-21 da aniqlandi):
//
// Kategoriya nomi butun ilovada `demoCategories` dan olinardi, u esa
// `lib/billzExport.js` dagi MUZLATILGAN Excel'dan yasaladi — nomlar
// ro'yxatidan sun'iy id yaratib ("c1", "c2"...). Bazadagi
// `products.category_id` esa UUID.
//
// Ya'ni ular HECH QACHON mos kelmasdi: Tovarlar sahifasidagi
// kategoriya yorlig'i "—" bo'lib turardi va kategoriya kesimidagi
// har qanday tahlil "Kategoriyasiz" chiqarardi.
//
// Bazada esa hammasi bor: 35 ta kategoriya, 653 tovardan 580 tasi
// biriktirilgan (Camera 198, Boshqa 107, NVR 36, Domafon 27…) —
// bog'lanmagan id YO'Q, tekshirildi 2026-08-22.
//
// `storesData` bilan bir xil naqsh: modul faqat O'QIYDI va nomni
// beradi. Yozish Billz sinxronizatsiyasi orqali ketadi.
//
// Billz kategoriya daraxtini bergani bilan, `lib/billzMap.js` uni
// TEKISLAB yozadi — jadvalda `parent_id` yo'q. Shuning uchun bu yerda
// ham ierarxiya yo'q.
// Modulning O'ZI `productsData.js` da qayd qilingan — u sahifalar
// bilan birga doim yuklanadi, bu fayl esa faqat `analytics.js` dan
// chaqiriladi. Bu yerda ustiga nom bo'yicha qidiruv qo'shiladi.
import { demoCategories } from "./productsData";

export const listCategories = () => [...demoCategories];
export const getCategory = (id) => demoCategories.find((c) => c.id === id) ?? null;

// Nom topilmasa NULL qaytadi — chaqiruvchi o'zi qaror qiladi.
// "—" yoki "Kategoriyasiz" ni shu yerda qotirib qo'ymaymiz: bir joyda
// bo'sh katak kerak, boshqasida guruh nomi kerak.
export const categoryName = (id) => getCategory(id)?.name ?? null;
