# Yangi tizim manzili — xodimlar uchun bir varaq

**2026-09-02 dan boshlab dastur faqat shu manzilda ishlaydi:**

# https://tizim.enes.uz

Eski manzil (`nspos.vercel.app`) **yopildi** — u yerga endi kirib bo'lmaydi
va u yerga yozilgan narsa hech qayerga bormaydi.

## Nima qilish kerak (bir marta, 2 daqiqa)

1. Brauzerda **https://tizim.enes.uz** ni oching va **zakladkaga qo'shing**
   (telefonda: "Bosh ekranga qo'shish"). Eski zakladkani o'chiring.
2. **Login** — o'sha telefon raqamingiz, faqat raqamlar, masalan
   `998901234567`. `+` va bo'shliqsiz.
3. **Parol — YANGI.** Uni rahbar sizga shaxsan beradi (eski parol ishlamaydi).
4. Chrome eski saytning parolini eslab qolgan bo'lsa, uni o'chiring:
   Chrome → Sozlamalar (⋮) → Parollar → `nspos.vercel.app` → o'chirish.
   Aks holda brauzer eski parolni o'zi qo'yib, "noto'g'ri parol" deydi.
5. Kirib, avval **bugungi kassa yoki xarajatni** kiriting — ishlayotganini
   o'zingiz ko'rasiz.

## Muammo bo'lsa

- **"Login yoki parol noto'g'ri"** — raqamni `998` bilan, bo'shliqsiz
  yozing; parolni rahbar bergan qog'ozdan aynan ko'chiring (kichik harf,
  chiziqcha, raqamlar).
- **Parolni o'zgartirmoqchiman** — o'zingiz qilasiz: Sozlamalar →
  "Parolni yangilash" (kamida 6 belgi). Rahbar kerak emas.
- **Parolni unutdim** — rahbarga ayting: Sozlamalar → Ustalar → yangi parol.
- **Eski saytga kirib qoldim** — u yopiq, kirmaydi. Manzilni tekshiring:
  `tizim.enes.uz`.

---

## Telegram'ga yuboriladigan xabar

Har xodimga ALOHIDA xabar (login va parol bilan) tayyor faylda turadi:

```
node scripts/login-xabar.mjs --sana=2026-09-02   →   .tmp/xabarlar-2026-09-02.md
```

Fayldagi har blokni (`--- Ism ---` dan keyingi matn) belgilab, o'sha odamga
Telegram'da tashlang. Fayl repoga tushmaydi. Xabar matni:

> Assalomu alaykum, <Ism>!
> Bugundan dastur yangi manzilda: https://tizim.enes.uz
> Eski manzil (nspos.vercel.app) yopildi — unga kirib bo'lmaydi.
>
> Login: <telefon raqami, faqat raqamlar>
> Parol: <yangi parol>
>
> Kirgach parolni o'zingiz o'zgartirib oling:
> Sozlamalar → "Parolni yangilash" (kamida 6 belgi).
>
> Iltimos: 1) yangi manzilni zakladkaga qo'ying, eskisini o'chiring;
> 2) Chrome eski parolni eslab qolgan bo'lsa o'chiring
> (Sozlamalar → Parollar → nspos.vercel.app); 3) kirib, bugungi kassa
> yoki xarajatni kiriting. Kira olmasangiz — menga yozing.
