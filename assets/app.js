const { useState, useEffect } = React;

// Lucide Icon Component for CDN version
const Icon = ({ name, size = 20, className = "" }) => {
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [name]);
  return (
    <i
      data-lucide={name}
      style={{ width: size, height: size }}
      className={className}
    ></i>
  );
};

const PHONE_NUMBER = "0506890650";
const WA_NUMBER = "972506890650";
const EMAIL = "aviram@telemenv.co.il";
const LINKEDIN = "https://www.linkedin.com/in/aviram-botzer-01782aa5/";

const getPageFromPath = () => {
  const p = (window.location.pathname || "/").replace(/\/+$/, "");
  if (p === "" || p === "/") return "home";
  if (p.endsWith("/waste")) return "waste";
  if (p.endsWith("/solar")) return "solar";
  if (p.endsWith("/env")) return "env";
  if (p.endsWith("/history")) return "history";
  return "home";
};

const navigation = [
  { name: "דף הבית", href: "/" },
  { name: "נספח אצירת אשפה", href: "/waste/" },
  { name: "פרויקטים סולאריים ואגרו-וולטאי", href: "/solar/" },
  { name: "נספח סביבתי להיתר/תב״ע", href: "/env/" },
  { name: "סקר היסטורי", href: "/history/" },
];

const handleWhatsAppRedirect = (customMsg = "") => {
  const msg =
    customMsg ||
    "שלום, הגענו מהאתר ונשמח להתייעץ לגבי נספחים סביבתיים ופרויקטים סולאריים.";
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
};

const scrollToContact = () => {
  // אם אנחנו לא בדף הבית – נשלח ל-home עם עוגן
  const page = getPageFromPath();
  if (page !== "home") {
    window.location.href = "/#contact-form";
    return;
  }
  const element = document.getElementById("contact-form");
  if (element) element.scrollIntoView({ behavior: "smooth" });
};

const Header = ({ isMenuOpen, setIsMenuOpen }) => {
  const currentPage = getPageFromPath();

  return (
    <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
        <a
          className="flex items-center gap-2 text-2xl font-bold text-emerald-800 cursor-pointer"
          href="/"
        >
          <Icon name="tree-pine" className="text-emerald-600" size={32} />
          <span>
            תלם <span className="text-gray-600 font-light">| ניהול סביבה</span>
          </span>
        </a>

        <nav className="hidden lg:flex space-x-reverse space-x-6">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-sm font-semibold transition-colors ${
                (currentPage === "home" && item.href === "/") ||
                (item.href !== "/" && item.href.replace(/\/+$/, "") === window.location.pathname.replace(/\/+$/, ""))
                  ? "text-emerald-700 border-b-2 border-emerald-700"
                  : "text-gray-600 hover:text-emerald-600"
              }`}
            >
              {item.name}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => handleWhatsAppRedirect()}
            className="p-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-sm"
            title="WhatsApp"
          >
            <Icon name="message-circle" />
          </button>
          <a
            href={`tel:${PHONE_NUMBER}`}
            className="bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-emerald-800 transition-all"
          >
            050-6890650
          </a>
        </div>

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="lg:hidden text-gray-600"
        >
          <Icon name={isMenuOpen ? "x" : "menu"} size={28} />
        </button>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden bg-white border-t p-4 flex flex-col space-y-4 shadow-xl">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-right text-lg font-bold py-2 border-b border-gray-50 block"
              onClick={() => setIsMenuOpen(false)}
            >
              {item.name}
            </a>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                handleWhatsAppRedirect();
              }}
              className="bg-green-500 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2"
            >
              <Icon name="message-circle" /> WhatsApp
            </button>
            <a
              href={`tel:${PHONE_NUMBER}`}
              className="bg-emerald-700 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2"
              onClick={() => setIsMenuOpen(false)}
            >
              <Icon name="phone" /> התקשרו
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

const Footer = () => (
  <footer className="bg-gray-900 text-white py-12 px-4">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-right">
      <div>
        <h3 className="text-xl font-bold mb-4 text-emerald-400">תלם – ניהול סביבה</h3>
        <p className="text-gray-400 leading-relaxed">
          מומחים בהכנת נספחים סביבתיים להיתרי בנייה, פרויקטים סולאריים ואגרו-וולטאי.
          שירות מקצועי, מהיר וממוקד דרישות רגולטוריות מול הרשויות.
        </p>
        <p className="text-gray-400 leading-relaxed mt-3">
          <a className="hover:text-emerald-300" href={LINKEDIN} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-4">שירותים מקצועיים</h3>
        <ul className="space-y-2 text-gray-400">
          <li><a className="hover:text-emerald-400" href="/solar/">פרויקטים סולאריים ואגרו-וולטאי</a></li>
          <li><a className="hover:text-emerald-400" href="/waste/">נספח אצירת אשפה להיתר</a></li>
          <li><a className="hover:text-emerald-400" href="/env/">נספח סביבתי להיתר/תב״ע</a></li>
          <li><a className="hover:text-emerald-400" href="/history/">סקר היסטורי</a></li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-4">צרו איתנו קשר</h3>
        <div className="space-y-3">
          <a href={`tel:${PHONE_NUMBER}`} className="flex items-center gap-3 text-gray-400 hover:text-white justify-end md:justify-start">
            <span>050-6890650</span> <Icon name="phone" className="text-emerald-500" />
          </a>
          <a href={`mailto:${EMAIL}`} className="flex items-center gap-3 text-gray-400 hover:text-white justify-end md:justify-start">
            <span>{EMAIL}</span> <Icon name="mail" className="text-emerald-500" />
          </a>
          <button onClick={() => handleWhatsAppRedirect()} className="flex items-center gap-3 text-gray-400 hover:text-white justify-end md:justify-start w-full text-right">
            <span>WhatsApp</span> <Icon name="message-circle" className="text-emerald-500" />
          </button>
        </div>
      </div>
    </div>

    <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
      © {new Date().getFullYear()} תלם – ניהול סביבה | אבירם. כל הזכויות שמורות.
    </div>
  </footer>
);

const FeatureItem = ({ title, description }) => (
  <div className="flex items-start gap-3 text-right">
    <Icon name="check-circle" size={18} className="text-emerald-600 mt-1 flex-shrink-0" />
    <div>
      <h4 className="font-bold text-gray-900">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  </div>
);

const ServiceCard = ({ title, icon, description, href }) => (
  <a href={href} className="bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-xl hover:border-emerald-200 transition-all cursor-pointer flex flex-col h-full group text-right">
    <div className="mb-6 group-hover:scale-110 transition-transform text-emerald-600">
      <Icon name={icon} size={40} />
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-4 leading-snug">{title}</h3>
    <p className="text-gray-600 mb-6 flex-grow leading-relaxed">{description}</p>
    <span className="text-emerald-700 font-bold flex items-center gap-2">
      קרא עוד <Icon name="arrow-left" size={16} />
    </span>
  </a>
);

// Pages
const HomePage = ({ formData, setFormData, formError, setFormError }) => (
  <div className="animate-fade-in">
    <section className="pt-32 pb-20 bg-gray-50 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 text-right relative z-10">
        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-4 leading-tight">
          יועצי סביבה ופסולת | <span className="text-emerald-700">הופכים את הכאוס להיתר מאושר</span>
        </h1>
        <p className="text-xl md:text-2xl text-emerald-800 font-bold mb-8 italic">
          פרויקטים סולאריים ואגרו-וולטאי • נספח אצירת אשפה • נספח סביבתי • סקר היסטורי
        </p>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl leading-relaxed">
          ייעוץ סביבתי ממוקד ליזמים, אדריכלים ומפתחי אנרגיה. הכנת נספחים מקצועיים לקידום הפרויקט מול הרשויות.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-start">
          <button
            onClick={() => handleWhatsAppRedirect("היי, אנחנו רוצים לשלוח תכנית/גרמושקה לבדיקה של מה נדרש לרשות.")}
            className="bg-emerald-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-emerald-800 shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            <Icon name="message-circle" /> שלחו תכנית לבדיקה
          </button>
          <button
            onClick={scrollToContact}
            className="bg-white text-emerald-800 border-2 border-emerald-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-emerald-50 transition-all"
          >
            הצעת מחיר מהירה
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-4 italic font-medium">* בדיקה ראשונית ללא התחייבות</p>
      </div>
    </section>

    <section className="py-20 max-w-7xl mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold italic">שירותי הייעוץ שלנו</h2>
        <div className="w-20 h-1 bg-emerald-600 mx-auto mt-4 rounded-full"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <ServiceCard
          title="נספחי סביבה ושיקום קרקע לפרויקטים סולאריים ואגרו-וולטאי"
          icon="sun"
          description="נספחים לתכניות ולהיתרים, ליווי סביבתי למתקני אגירה, ונספחי שימור קרקע והשבה לחקלאות."
          href="/solar/"
        />
        <ServiceCard
          title="תכנון חדרי אשפה, חישוב נפחים, נספח אצירת אשפה להיתר"
          icon="trash-2"
          description="חישוב מדויק של ייצור אשפה ותכנון מערך אצירה תקני בהתאם לדרישות הרשות המקומית."
          href="/waste/"
        />
        <ServiceCard
          title="נספח סביבתי להיתר בנייה ולתב״ע"
          icon="file-text"
          description="מענה למטרדים, תנאי סביבה בתיק מידע, וליווי תכנוני מוקדם מול הוועדות."
          href="/env/"
        />
        <ServiceCard
          title="סקר היסטורי (קרקע / זיהומים)"
          icon="history"
          description="איתור שימושים קודמים ומקורות סיכון במגרש על בסיס מאגרי מידע ותצלומי אוויר."
          href="/history/"
        />
      </div>
    </section>

    <section id="contact-form" className="py-20 bg-emerald-900 text-white text-right">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-4xl font-bold mb-4">צריכים הצעה מהירה?</h2>
          <p className="text-xl text-emerald-100 mb-8 italic">
            שלחו פרטים ונחזור אליכם עם מה שנדרש לרשות (ללא התחייבות)
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formData.name || !formData.phone) {
                setFormError("נא למלא שם וטלפון תקינים");
                return;
              }
              setFormError("");
              const msg = `שלום, שמי ${formData.name}. הטלפון שלי הוא ${formData.phone}. אנחנו פונים מהאתר לגבי ייעוץ סביבתי.`;
              handleWhatsAppRedirect(msg);
            }}
            className="space-y-4 max-w-md"
          >
            <input
              type="text"
              placeholder="שם מלא"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-4 rounded-lg bg-emerald-800 border border-emerald-700 text-white placeholder:text-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <input
              type="tel"
              placeholder="טלפון"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-4 rounded-lg bg-emerald-800 border border-emerald-700 text-white placeholder:text-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            {formError && <p className="text-red-300 font-bold text-sm">{formError}</p>}
            <button
              type="submit"
              className="w-full py-4 bg-emerald-500 text-emerald-950 font-extrabold rounded-lg hover:bg-emerald-400 text-xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Icon name="message-circle" /> שלחו פנייה ב-WhatsApp
            </button>
          </form>
        </div>

        <div className="space-y-8">
          <div className="flex gap-4">
            <Icon name="check-circle" className="text-emerald-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-xl font-bold mb-1">מקצועיות וניסיון</h4>
              <p className="text-emerald-100/80">מומחיות רגולטורית מול רשויות מקומיות והמשרד להגנת הסביבה.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <Icon name="check-circle" className="text-emerald-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-xl font-bold mb-1">מהירות תגובה</h4>
              <p className="text-emerald-100/80">זמן בהיתר בנייה הוא קריטי לרווחיות הפרויקט.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <Icon name="check-circle" className="text-emerald-400 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-xl font-bold mb-1">מענה ישיר</h4>
              <p className="text-emerald-100/80">עבודה ישירה איתך, ללא מתווכים.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
);

const SolarPage = () => (
  <div className="pt-32 pb-20 max-w-4xl mx-auto px-4 text-right animate-fade-in">
    <a href="/" className="flex items-center gap-2 text-emerald-700 font-bold mb-8 hover:gap-3 transition-all">
      <Icon name="arrow-left" size={18} /> חזרה לדף הבית
    </a>
    <h1 className="text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
      נספחי סביבה ושיקום קרקע לפרויקטים סולאריים ואגרו-וולטאי
    </h1>
    <p className="text-xl text-gray-600 mb-12 leading-relaxed">
      ליווי סביבתי מקיף למתקני אנרגיה מתחדשת ואגרו-וולטאי, עם איזון בין פיתוח סולארי לשימור ערכי חקלאות וקרקע.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
      <FeatureItem title="נספחים סביבתיים לתכניות ולהיתרים" description="התאמה לדרישות הוועדות והגורמים הרלוונטיים לאורך התהליך." />
      <FeatureItem title="ליווי סביבתי למתקני אגירה (BESS)" description="מענה תכנוני/רגולטורי למערכות אגירת אנרגיה במתח גבוה ונמוך." />
      <FeatureItem title="נספחי שימור קרקע" description="הגדרת ממשק עבודה לשמירה על איכות הקרקע במהלך ההקמה." />
      <FeatureItem title="תכניות השבה לחקלאות" description="תכנון השבת הקרקע לשימוש חקלאי בתום הפרויקט (לפי הנחיות/דרישות)." />
    </div>

    <div className="bg-emerald-50 p-8 rounded-2xl border border-emerald-100">
      <h3 className="text-2xl font-bold mb-4 italic text-emerald-900">ליווי סביבתי שמקדם היתר ולא מעכב אותו</h3>
      <p className="text-lg text-gray-700 mb-8 leading-relaxed">
        מסמכים נכונים מהפעם הראשונה + תיאום מוקדם עם גורמי תכנון = פחות סבבי תיקונים ופחות עיכובים.
      </p>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => handleWhatsAppRedirect("היי, אנחנו מעוניינים בליווי סביבתי לפרויקט סולארי / מתקן אגירה.")}
          className="bg-emerald-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-800 transition-all shadow-md"
        >
          <Icon name="message-circle" /> התייעצו איתנו ב-WhatsApp
        </button>
        <a href={`tel:${PHONE_NUMBER}`} className="bg-white text-emerald-800 border border-emerald-700 px-8 py-3 rounded-lg font-bold">
          050-6890650
        </a>
      </div>
    </div>
  </div>
);

const WastePage = () => (
  <div className="pt-32 pb-20 max-w-4xl mx-auto px-4 text-right animate-fade-in">
    <a href="/" className="flex items-center gap-2 text-emerald-700 font-bold mb-8 hover:gap-3 transition-all">
      <Icon name="arrow-left" size={18} /> חזרה לדף הבית
    </a>
    <h1 className="text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
      תכנון חדרי אשפה, חישוב נפחי אשפה, נספח אצירת אשפה להיתר בנייה
    </h1>
    <p className="text-xl text-gray-600 mb-12 leading-relaxed">
      נספח אצירת אשפה להיתר כולל חישוב נפחים ותכנון מערך אצירה בהתאם לדרישות מחלקת התברואה של הרשות המקומית.
      זה תנאי שכיח לקבלת היתר בפרויקטים של מגורים, מסחר ותעסוקה.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
      <FeatureItem title="חישוב נפחי אשפה" description="חישוב ייצור אשפה צפוי לפי שימושים/תקנים והנחיות הרשות." />
      <FeatureItem title="תכנון חדרי אשפה" description="מיקום, מידות, אוורור/ניקוז ותפעול – כדי לעבור תברואה מהר." />
      <FeatureItem title="נספח אצירה להגשה" description="מסמך + תשריט/תרשים בהתאם לדרישות תיק המידע." />
      <FeatureItem title="התאמת כלי אצירה" description="בחירת פתרון (פחים, טמונים, מכולות) לפי היקף ושיטת פינוי." />
    </div>

    <div className="bg-emerald-50 p-8 rounded-2xl border border-emerald-100">
      <h3 className="text-2xl font-bold mb-4 italic text-emerald-900">למנוע עיכוב היתר בגלל אשפה</h3>
      <p className="text-lg text-gray-700 mb-8 leading-relaxed">
        תכנון לא מדויק גורר הערות חוזרות (תפעול, גישה, רדיוס סיבוב, ניקוז/אוורור). אנחנו סוגרים את זה נכון מהתחלה.
      </p>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => handleWhatsAppRedirect("היי, אנחנו מעוניינים בנספח אצירת אשפה להיתר בנייה. אפשר לשלוח תכנית לבדיקה?")}
          className="bg-emerald-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-800 transition-all shadow-md"
        >
          <Icon name="message-circle" /> שלחו תכנית לבדיקה
        </button>
        <a href={`tel:${PHONE_NUMBER}`} className="bg-white text-emerald-800 border border-emerald-700 px-8 py-3 rounded-lg font-bold">
          050-6890650
        </a>
      </div>
    </div>
  </div>
);

const EnvironmentalPage = () => (
  <div className="pt-32 pb-20 max-w-4xl mx-auto px-4 text-right animate-fade-in">
    <a href="/" className="flex items-center gap-2 text-emerald-700 font-bold mb-8 hover:gap-3 transition-all">
      <Icon name="arrow-left" size={18} /> חזרה לדף הבית
    </a>
    <h1 className="text-4xl font-extrabold text-gray-900 mb-6 leading-tight">נספח סביבתי להיתר בנייה ולתב״ע</h1>
    <p className="text-xl text-gray-600 mb-12 leading-relaxed">
      ליווי יזמים ואדריכלים בניהול היבטים סביבתיים: רעש, אוויר, פסולת, חומרים מסוכנים ותנאי תיק מידע – בהתאם לדרישות הרגולציה.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
      <div className="p-8 bg-white shadow-lg rounded-2xl border-t-4 border-emerald-700">
        <h2 className="text-2xl font-bold mb-4 italic">נספח סביבה לתב״ע</h2>
        <ul className="space-y-3 text-gray-700">
          <li>• בדיקת היתכנות סביבתית ותכנון מוקדם</li>
          <li>• חוות דעת מקצועיות בנושא מטרדים/מגבלות</li>
          <li>• מענה להערות ועדה מחוזית/גורמי סביבה</li>
          <li>• פתרונות להפחתת השפעות ושילוב בתכנון</li>
        </ul>
      </div>
      <div className="p-8 bg-white shadow-lg rounded-2xl border-t-4 border-blue-700">
        <h2 className="text-2xl font-bold mb-4 italic">נספח סביבתי להיתר</h2>
        <ul className="space-y-3 text-gray-700">
          <li>• מענה לתנאי סביבה בתיק מידע</li>
          <li>• רעש/אוויר/מטרדים והצעות למיתון</li>
          <li>• היבטי חומרים מסוכנים ותפעול</li>
          <li>• סגירת דרישות מול רשות/גורם מאשר</li>
        </ul>
      </div>
    </div>

    <div className="bg-gray-900 text-white rounded-2xl p-10 text-center">
      <h3 className="text-2xl font-bold mb-4 text-emerald-400 italic">יש לכם פרויקט עם דרישות סביבה?</h3>
      <p className="text-gray-300 mb-8 max-w-xl mx-auto text-lg leading-relaxed">
        שלחו תכנית/גרמושקה ונחזור עם ניתוח קצר של מה נדרש להגשה ומה צפוי מול הרשות.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => handleWhatsAppRedirect("היי, רצינו להתייעץ לגבי נספח סביבתי להיתר/תב״ע. אפשר לשלוח תכנית?")}
          className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-lg"
        >
          <Icon name="message-circle" /> שלחו תכנית/גרמושקה
        </button>
        <a href={`tel:${PHONE_NUMBER}`} className="bg-transparent border border-gray-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-800">
          שיחה טלפונית
        </a>
      </div>
    </div>
  </div>
);

const HistoryPage = () => (
  <div className="pt-32 pb-20 max-w-4xl mx-auto px-4 text-right animate-fade-in">
    <a href="/" className="flex items-center gap-2 text-emerald-700 font-bold mb-8 hover:gap-3 transition-all">
      <Icon name="arrow-left" size={18} /> חזרה לדף הבית
    </a>
    <h1 className="text-4xl font-extrabold text-gray-900 mb-6 leading-tight">סקר היסטורי סביבתי (קרקע וזיהומים)</h1>
    <p className="text-xl text-gray-600 mb-12 leading-relaxed">
      איתור שימושים קודמים ומקורות סיכון במגרש (תעשייה, מוסכים, דלקים וכו׳) על בסיס מאגרי מידע ותצלומי אוויר.
      תוצר ברור שמסייע להתקדם ברישוי.
    </p>

    <div className="bg-white p-8 shadow-xl rounded-2xl border border-gray-100 mb-12 space-y-4">
      <FeatureItem title="פענוח תצלומי אוויר (תצ״א)" description="ניתוח היסטורי של שימושי הקרקע לאורך שנים." />
      <FeatureItem title="סקירת מאגרי מידע" description="בדיקה מול המשרד להגנת הסביבה והרשויות הרלוונטיות." />
      <FeatureItem title="דוח בפורמט נדרש" description="עריכת דוח ברור להעברה לוועדה/רשות/יועצים לצורך התקדמות." />
    </div>

    <div className="bg-emerald-900 text-white rounded-2xl p-10 text-center">
      <h3 className="text-2xl font-bold mb-4 text-emerald-300 italic">רוצים בדיקה ראשונית?</h3>
      <p className="text-emerald-100/80 mb-8 max-w-xl mx-auto text-lg leading-relaxed">
        שלחו גוש/חלקה ונבצע בדיקה ראשונית מה צפוי להידרש סביב זיהומי קרקע ושימושים קודמים.
      </p>
      <button
        onClick={() => handleWhatsAppRedirect("היי, רצינו לשלוח גוש וחלקה לבדיקה לסקר היסטורי.")}
        className="bg-emerald-500 text-emerald-950 px-8 py-3 rounded-lg font-bold hover:bg-emerald-400 flex items-center justify-center gap-2 shadow-lg"
      >
        <Icon name="message-circle" /> שלחו גוש/חלקה ב-WhatsApp
      </button>
    </div>
  </div>
);

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "" });
  const [formError, setFormError] = useState("");

  // תמיכה בעוגן contact-form מהבית
  useEffect(() => {
    if (window.location.hash === "#contact-form") {
      setTimeout(() => {
        const el = document.getElementById("contact-form");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }
  }, []);

  const page = getPageFromPath();

  return (
    <div className="min-h-screen bg-white">
      <Header isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <main>
        {page === "home" && (
          <HomePage
            formData={formData}
            setFormData={setFormData}
            formError={formError}
            setFormError={setFormError}
          />
        )}
        {page === "waste" && <WastePage />}
        {page === "solar" && <SolarPage />}
        {page === "env" && <EnvironmentalPage />}
        {page === "history" && <HistoryPage />}
      </main>
      <Footer />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
