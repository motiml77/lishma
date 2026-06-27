# בית מדרש לשמה — חבילת מסירה סופית

שני אתרים מאוחדים תחת פרויקט Firebase אחד (`harav-tabady`).

## תוכן החבילה

```
final/
├── index.html                ← אתר העלונים (דף הבית + ארכיון + ניהול)
├── logo-lishmah.png          ← הלוגו
├── store/
│   └── index.html            ← חנות הספרים (סל, תשלום, הזמנות, ניהול)
├── vercel.json               ← הגדרות פריסה ל-Vercel
├── .vercelignore             ← מחריג את migration/ מהאתר הציבורי
├── DEPLOY-CLAUDE-CODE.md     ← ⭐ הוראות העלאה ל-Vercel + Firebase (להעתקה ל-Claude Code)
└── migration/                ← כלי העברת הנתונים + הוראות
    ├── migrate.js
    ├── package.json
    ├── README.md             ← הוראות הגירה מלאות (כולל הנחיה ל-Claude Code)
    └── web3forms-setup.md    ← חיבור התראות מייל למנהל
```

## סדר הפעולות לעלייה לאוויר

0. **הפעלת שירותים ב-harav-tabady (חובה!)** — ב-[Firebase Console](https://console.firebase.google.com):
   - **Firestore Database** → Create database (Production, אזור `eur3` או `me-west1`).
   - **Storage** → Get Started.
   - בלי שני אלה ההגירה תיכשל.
1. **הגירת נתונים** — בצע לפי `migration/README.md`. הרץ קודם `--dry-run`.
2. **התראות מייל** — בצע לפי `migration/web3forms-setup.md` (Web3Forms — דקה אחת, ללא שרת).
3. **העלאת האתרים** — העלה את תיקיית `final/` כפי שהיא לאחסון. הקישורים ההדדיים בין העלונים לחנות כבר מוגדרים נכון (`store/index.html` ו-`../index.html`).

## מה כבר מוגדר ומוכן
- ✅ שני האתרים מחוברים ל-`harav-tabady` בלבד.
- ✅ מעבר דו-כיווני: כפתור "חנות הספרים" בעלונים, כפתור "אתר העלונים" בחנות.
- ✅ עריכת תוכן "אודות" וקישור תרומות (PayBox) מהניהול בעלונים.
- ✅ סל קניות מקצועי עם checkout מלא בתוך ה-drawer.
- ✅ הוספת ספר חדש יוצרת תיקייה תקינה (`books/{id}/images|pdfs`) ב-harav-tabady.
- ✅ webhook התראות מייל בכל הזמנה (Web3Forms — צריך רק להדביק Access Key בניהול).

## כתובות חשובות (לעדכון אם משתנות בפרודקשן)
- **חנות → עלונים:** הקבוע `NEWSLETTER_SITE_URL` בראש `store/index.html`.
- **עלונים → חנות:** ה-`href` של כפתור "חנות הספרים" ב-`index.html`.
- **שליחת עלון לרשימה:** `EMAIL_WORKER_URL` ב-`index.html` (Cloudflare Worker קיים).
