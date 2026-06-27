# העברת כל הנתונים — sfarim-tabady ➜ harav-tabady

חבילה זו מעבירה את **כל** המידע מפרויקט הספרים (`sfarim-tabady`) אל פרויקט העלונים (`harav-tabady`),
כך ששני האתרים (עלונים + חנות ספרים) יעבדו תחת פרויקט Firebase **אחד**.

מה מועבר, במבנה זהה אחד-לאחד (אותם מזהי מסמכים, אותם נתיבי קבצים):
- **Firestore:** `books`, `orders`, `settings`
- **Storage:** כל הקבצים (תמונות ספרים, PDF, תמונת הרב, אייקוני paybox/bit)
- כל קישורי ה-Storage בתוך המסמכים מתעדכנים אוטומטית לבאקט החדש.

> ⚠️ הסקריפט **לא מוחק** כלום מהמקור. בטוח להרצה חוזרת.

---

## הוראות ל-Claude Code

> ⚠️ **שלב 0 — חובה לפני הכל:** ודא שבפרויקט היעד `harav-tabady` מופעלים:
> 1. **Firestore Database** — [Firebase Console](https://console.firebase.google.com) → harav-tabady → **Firestore Database** → **Create database** (מצב Production, בחר אזור — מומלץ `eur3` או `me-west1`).
> 2. **Storage** — אותו פרויקט → **Storage** → **Get Started**.
>
> בלי שני אלה ההגירה תיכשל (השגיאה: *"The database (default) does not exist"*).

העתק את ההנחיה הבאה ל-Claude Code (היא כוללת הכל):

```
יש לי תיקיית migration עם migrate.js ו-package.json.
המטרה: להעביר את כל הנתונים מפרויקט Firebase בשם sfarim-tabady אל harav-tabady
(Firestore: books, orders, settings + כל קבצי ה-Storage).

עזור לי שלב-אחר-שלב:
1. הסבר לי איך להוריד Service Account JSON משני הפרויקטים ב-Firebase Console
   (Project Settings → Service Accounts → Generate new private key).
2. צור תיקיית migration/keys ושמור בה:
   - sfarim-tabady.json
   - harav-tabady.json
3. הרץ: npm install
4. הרץ סריקה בלבד: node migrate.js --dry-run  — והצג לי את הפלט.
5. אם הכל נראה תקין, הרץ הגירה אמיתית: node migrate.js
6. בסיום, הצג לי את סיכום הספירות (מסמכים, קבצים, שגיאות).
```

---

## הוראות ידניות (אם תרצה להריץ בעצמך)

### 1. דרישות מקדימות
- Node.js 18+ מותקן.
- גישת Owner/Editor לשני פרויקטי Firebase.

### 2. הורדת מפתחות שירות (Service Accounts)
לכל אחד משני הפרויקטים:
1. היכנס ל-[Firebase Console](https://console.firebase.google.com) → בחר פרויקט.
2. ⚙️ **Project Settings** → לשונית **Service Accounts**.
3. לחץ **Generate new private key** → יורד קובץ JSON.
4. שמור אותו בתיקייה `migration/keys/` בשמות **המדויקים**:
   - `migration/keys/sfarim-tabady.json`
   - `migration/keys/harav-tabady.json`

> 🔒 קבצי המפתח הם סודיים — אל תעלה אותם ל-Git/אחסון ציבורי. ה-`.gitignore` כבר חוסם אותם.

### 3. התקנה
```bash
cd migration
npm install
```

### 4. סריקה (Dry-Run) — לא כותב כלום
```bash
node migrate.js --dry-run
```
בדוק שמספרי המסמכים והקבצים הגיוניים.

### 5. הגירה אמיתית
```bash
node migrate.js
```

### דגלים אופציונליים
| דגל | משמעות |
|-----|--------|
| `--dry-run` | סריקה בלבד, ללא כתיבה |
| `--no-storage` | לדלג על העתקת קבצים (רק Firestore) |
| `--no-orders` | לדלג על אוסף ההזמנות |
| `--skip-existing` | לא לשכתב מסמך/קובץ שכבר קיים ביעד (ברירת מחדל: שכתוב) |

---

## אחרי ההגירה

1. **קבצי האתר** (`index.html` של העלונים + `index-76c71286.html` של החנות) כבר מוגדרים ל-`harav-tabady` — פשוט העלה אותם לאחסון.
2. הוספת ספר חדש בחנות תיצור אוטומטית `books/{id}/images` ו-`books/{id}/pdfs` בפרויקט המאוחד.
3. **התראות מייל למנהל (Web3Forms):** ראה `web3forms-setup.md` בחבילה — צור Access Key חינמי ב-web3forms.com והכנס אותו בפאנל הניהול של החנות (כפתור "🔑 מפתח שליחת מייל").

## פתרון תקלות
- **`PERMISSION_DENIED`** — ודא שקובץ ה-Service Account שייך לפרויקט הנכון ויש לו הרשאות.
- **קבצים לא הועתקו** — ודא שה-Storage מופעל בפרויקט היעד (Firebase Console → Storage → Get Started).
- **קישורי תמונות שבורים אחרי ההגירה** — הסקריפט יוצר download token לכל קובץ; אם בכל זאת יש בעיה, הרץ שוב (בטוח).
