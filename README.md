# Harayah Campus Care

בנה אפליקציית WEB מלאה בעברית בשם „הראי״ה – ניהול משימות ותקלות”, עבור תלמוד תורה הראי״ה, לפי מפרט הדרישות המצורף.

מנגנון הכניסה שנבחר: כניסה והרשמה באמצעות קוד בן 4 ספרות בלבד, עם אימות שרת מאובטח, שמירת אפסים מובילים, מניעת כפילויות קוד והגבלת ניסיונות (Rate Limiting).

בצע את שלב ראשון מתוך המפרט:
1. תשתית מסד נתונים וסכמות (משתמשים, תפקידים, משימות, תקלות, קבצים, היסטוריית פעולות).
2. מנגנון כניסה והרשמה ב-4 ספרות בלבד ללא צורך במייל/שם משתמש בכניסה שוטפת.
3. שלושת התפקידים:
   - מנהל ראשי: אבי נתן (avinatan50@gmail.com)
   - מנהלה: מנהל (eliyahuper@gmail.com) ומיכל (Tthareaya@gmail.com)
   - משתמש רגיל (ברירת מחדל לכל נרשם חדש)
4. אכיפת הרשאות וניתוב בשרת:
   - משתמש רגיל מנותב ישירות למסך פתיחת קריאה מהירה (כותרת, תיאור, קבצים/תמונות/וידאו, אישור קליטה ומספר קריאה ייחודי).
   - צוות הניהול מנותב ללוח הבקרה המלא.
5. לוח בקרה מותאם לעברית (RTL):
   - פס עליון בולט למפגעי בטיחות פתוחים.
   - כרטיסים לחיצים: משימות פתוחות, ממתין לאישור, ממתין להחלטה, ממתין לגורם חיצוני, באיחור, הושלמו.
   - רשימת משימות שעודכנו לאחרונה.
6. יצירה ועריכת משימות לצוות הניהול, כולל סוגי נושאים, סטטוסים, ברירות מחדל לפי סוג, דחיפויות ומיקומים.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://harayah-campus-care.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/68991417-9f34-491f-9375-accae562e4e6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
