import json, os, re, unicodedata
from collections import defaultdict

HADITH_DIR = "v4/hadith"
COLLECTIONS = sorted(d for d in os.listdir(HADITH_DIR)
                     if os.path.isdir(os.path.join(HADITH_DIR, d)))

def strip_tashkeel(text):
    """Remove Arabic diacritics (tashkeel) for normalization."""
    if not text:
        return text
    # Remove Arabic diacritical marks
    diacritics = re.compile(r'[\u064B-\u065F\u0670]')
    return diacritics.sub('', text).strip()

def has_arabic_script(text):
    """Check if text contains actual Arabic characters (not English)."""
    if not text:
        return False
    return any('\u0600' <= c <= '\u06FF' or '\u0750' <= c <= '\u077F' for c in text)

def normalize_ar(text):
    """Normalize Arabic text for cross-collection matching."""
    if not text or not has_arabic_script(text):
        return None
    return strip_tashkeel(text).strip()

COLLECTION_ORDER = [
    "sahih-al-bukhari",
    "sahih-muslim",
    "sunan-abu-dawud",
    "sunan-al-tirmidhi",
    "sunan-an-nasai",
    "sunan-ibn-majah",
    "muwatta-imam-malik",
    "forty-hadith-of-an-nawawi",
    "forty-hadith-of-shah-waliullah-dehlawi",
    "forty-hadith-qudsi",
]

# ── 1. Build reference maps from ALL collections ──

# ar_ref_map: normalized_arabic -> {lang -> text}
# Only stores entries where text != en_text (genuine translations)
ar_ref_map = defaultdict(dict)

# en_ref_map: english_name -> {lang -> text}
en_ref_map = defaultdict(dict)

# Also track which fields are "corrupted" (Arabic field contains English)
# so we don't use those as reference
corrupted_ar_fields = {}  # (collection, book_id) -> True

for col in COLLECTION_ORDER:
    path = os.path.join(HADITH_DIR, col, "books.json")
    if not os.path.exists(path):
        continue
    with open(path, encoding="utf-8") as f:
        books = json.load(f)
    for b in books:
        name = b.get("name", {})
        en = name.get("en", "").strip()
        ar_raw = name.get("ar", "")
        if not en:
            continue
        n_ar = normalize_ar(ar_raw)
        if ar_raw and not has_arabic_script(ar_raw):
            corrupted_ar_fields[(col, b.get("id", ""))] = True

        for lang, text in name.items():
            if lang == "en":
                continue
            if isinstance(text, str) and text.strip() and text.strip() != en:
                if n_ar:
                    ar_ref_map[n_ar][lang] = text
                en_ref_map[en][lang] = text

# ── 2. FALLBACK hard-coded translations ──
FALLBACK = {

    # Bukhari - Oneness, Uniqueness of Allah (Tawheed)
    # Arabic field is corrupted (English text), so need fallback
    "Oneness, Uniqueness of Allah (Tawheed)": {
        "bn": "তাওহীদ",
        "id": "Tauhid",
        "fr": "L'Unicité d'Allah (Tawhid)",
        "ta": "தவ்ஹீத்",
        "ur": "توحید",
        "ar": "التوحيد",
        "ar-diacritics": "التَّوْحِيدُ",
    },

    # Bukhari - Witnesses (ar: الشهادات)
    "Witnesses": {
        "bn": "সাক্ষী",
        "fr": "Les Témoins",
        "id": "Saksi-saksi",
        "ta": "சாட்சிகள்",
        "ur": "گواہ",
    },

    # Nasai - corrupted Arabic fields
    "Menstruation and Istihadah": {
        "ar": "الحيض والإستحاضة",
        "ar-diacritics": "الْحَيْضُ وَالِاسْتِحَاضَةُ",
        "bn": "হায়েজ ও ইস্তিহাজা",
        "id": "Haid dan Istihadhah",
        "ur": "حیض اور استحاضہ",
        "fr": "Les Menstruations et l'Istihadha",
    },
    "Ghusl and Tayammum": {
        "ar": "الغسل والتيمم",
        "ar-diacritics": "الْغُسْلُ وَالتَّيَمُّمُ",
        "bn": "গোসল ও তায়াম্মুম",
        "id": "Mandi dan Tayammum",
        "ur": "غسل اور تیمم",
        "fr": "Le Ghousl et le Tayammum",
    },
    "The Kind Treatment of Women": {
        "ar": "حسن معاشرة النساء",
        "ar-diacritics": "حُسْنُ مُعَاشَرَةِ النِّسَاءِ",
        "bn": "স্ত্রীদের সঙ্গে সদয় ব্যবহার",
        "id": "Memperlakukan Wanita dengan Baik",
        "ur": "عورتوں کے ساتھ حسن سلوک",
        "fr": "Le Bon Traitement des Femmes",
    },
    "Fighting [The Prohibition of Bloodshed]": {
        "ar": "القتال",
        "ar-diacritics": "الْقِتَالُ",
        "bn": "যুদ্ধ",
        "id": "Pertempuran",
        "ur": "قتال",
        "fr": "Le Combat",
    },
    "Distribution of Al-Fay' (wealth gained without war)": {
        "ar": "فيء",
        "ar-diacritics": "الْفَيْءُ",
        "bn": "ফায়",
        "id": "Al-Fay'",
        "ur": "فیء",
        "fr": "Le Butin (Sans Combat)",
    },
    "al-Bay'ah": {
        "ar": "البيعة",
        "ar-diacritics": "الْبَيْعَةُ",
        "bn": "বাইআত",
        "id": "Baiat",
        "ur": "بیعت",
        "fr": "L'Allégeance",
    },
    "al-'Aqiqah": {
        "ar": "العقيقة",
        "ar-diacritics": "الْعَقِيقَةُ",
        "bn": "আকীকা",
        "id": "Akikah",
        "ur": "عقیقہ",
        "fr": "Al-'Aqiqah",
    },
    "al-Fara' and al-'Atirah": {
        "ar": "الفرع والعتيرة",
        "ar-diacritics": "الْفَرَعُ وَالْعَتِيرَةُ",
        "bn": "ফারায়াত ও আতীরা",
        "id": "Al-Fara' dan Al-'Atirah",
        "ur": "فرع اور عتیرہ",
        "fr": "Al-Fara' et al-'Atirah",
    },
    "Hunting and Slaughtering": {
        "ar": "الصيد والذبائح",
        "ar-diacritics": "الصَّيْدُ وَالذَّبَائِحُ",
        "bn": "শিকার ও জবাই",
        "id": "Berburu dan Menyembelih",
        "ur": "شکار اور ذبیحہ",
        "fr": "La Chasse et l'Abattage",
    },
    "ad-Dahaya (Sacrifices)": {
        "ar": "الضحايا",
        "ar-diacritics": "الضَّحَايَا",
        "bn": "কুরবানী",
        "id": "Ad-Dahaya (Kurban)",
        "ur": "ضحایا",
        "fr": "Les Sacrifices",
    },
    "'Umra": {
        "ar": "العمرى",
        "ar-diacritics": "الْعُمْرَى",
        "bn": "উমরা",
        "id": "'Umra",
        "ur": "عمری",
        "fr": "Al-'Umra",
    },
    "ar-Ruqba": {
        "ar": "الرقبى",
        "ar-diacritics": "الرُّقْبَى",
        "bn": "রুকবা",
        "id": "Ar-Ruqba",
        "ur": "رقبی",
        "fr": "Ar-Ruqba",
    },

    # Muslim - Turkish translations that are still English
    "I'tikaf": {
        "tr": "İtikaf",
    },
    "Pilgrimage": {
        "tr": "Hac",
    },
    "Invoking Curses": {
        "tr": "Lian",
    },
    "Emancipating Slaves": {
        "tr": "Köle Azadı",
    },
    "Transactions": {
        "tr": "Alışveriş",
    },
    "Irrigation": {
        "tr": "Sulama",
    },
    "The Rules of Inheritance": {
        "tr": "Miras Hükümleri",
    },
    "Vows": {
        "tr": "Nezirler",
    },
    "Oaths": {
        "tr": "Yeminler",
    },
    "Oaths, Muharibin, Qasas (Retaliation), and Diyat (Blood Money)": {
        "tr": "Yeminler, Muharibin, Kısas ve Diyet",
    },
    "Judicial Decisions": {
        "tr": "Kazai Kararlar",
    },
    "Jihad and Expeditions": {
        "tr": "Cihad ve Seferler",
    },
    "Government": {
        "tr": "Devlet Yönetimi",
    },
    "Hunting, Slaughter, and what may be Eaten": {
        "tr": "Av, Kesim ve Yenebilecekler",
    },
    "Clothes and Adornment": {
        "tr": "Giyim ve Süslenme",
    },
    "Manners and Etiquette": {
        "tr": "Görgü ve Adab",
    },
    "Concerning the Use of Correct Words": {
        "tr": "Doğru Kelimelerin Kullanımı",
    },
    "Poetry": {
        "tr": "Şiir",
    },
    "Virtues": {
        "tr": "Faziletler",
    },
    "The Merits of the Companions": {
        "tr": "Sahabelerin Faziletleri",
    },
    "Virtue, Enjoining Good Manners, and Joining of the Ties of Kinship": {
        "tr": "İyilik, Güzel Ahlak ve Sıla-i Rahim",
    },
    "Pertaining to the Remembrance of Allah, Supplication, Repentance and Seeking Forgiveness": {
        "tr": "Zikir, Dua, Tövbe ve İstiğfar",
    },
    "Heart-Melting Traditions": {
        "tr": "Rikak (Yürekleri Yumuşatan Hadisler)",
    },
    "Repentance": {
        "tr": "Tövbe",
    },
    "Characteristics of The Hypocrites And Rulings Concerning Them": {
        "tr": "Münafıkların Özellikleri ve Hükümleri",
    },
    "Characteristics of the Day of Judgment, Paradise, and Hell": {
        "tr": "Kıyamet, Cennet ve Cehennemin Özellikleri",
    },
    "Paradise, its Description, its Bounties and its Inhabitants": {
        "tr": "Cennet, Vasfı, Nimetleri ve Cennetlikler",
    },
    "Tribulations and Portents of the Last Hour": {
        "tr": "Fitneler ve Kıyamet Alametleri",
    },
    "Zuhd and Softening of Hearts": {
        "tr": "Zühd ve Kalpleri Yumuşatma",
    },
    "Commentary on the Qur'an": {
        "tr": "Tefsir",
    },

    # Tirmidhi - Urdu translations still English
    # Also covers: Tirmidhi - Bengali still English
    # These will now mostly be handled by Arabic-based matching, but
    # keep fallbacks for any that slip through
    "Salat (Prayer)": {
        "bn": "সালাত",
        "ur": "نماز",
    },
    "The Witr Prayer": {
        "bn": "বিতর নামাজ",
        "ur": "وتر نماز",
    },
    "The Day of Friday": {
        "bn": "জুমুআর দিন",
        "ur": "جمعہ کا دن",
    },
    "The Two Eids": {
        "bn": "দুই ঈদ",
        "ur": "دو عیدیں",
    },
    "Traveling": {
        "bn": "সফর",
        "ur": "سفر",
    },
    "Business": {
        "bn": "ব্যবসা",
        "ur": "تجارت",
    },
    "Vows and Oaths": {
        "bn": "মান্নত ও শপথ",
        "ur": "نذریں اور قسمیں",
    },
    "Virtues of Jihad": {
        "bn": "জিহাদের ফজিলত",
        "ur": "جہاد کی فضیلت",
    },
    "Righteousness and Maintaining Family Ties": {
        "bn": "সৎকর্ম ও আত্মীয়তার সম্পর্ক রক্ষা",
        "ur": "نیکی اور صلہ رحمی",
    },
    "Inheritance": {
        "bn": "মিরাস",
        "ur": "وراثت",
    },
    "Wasaya (Wills and Testament)": {
        "bn": "ওসিয়াত",
        "ur": "وصیت",
    },
    "Wala' And Gifts": {
        "bn": "ওয়ালা ও উপহার",
        "ur": "ولاء اور ہبہ",
    },
    "Asceticism": {
        "bn": "জুহদ",
        "ur": "زہد",
    },
    "The description of the Day of Judgement, Softening of Hearts (Riqāq), and Scrupulousness (Waraʿ)": {
        "bn": "কিয়ামতের বিবরণ, হৃদয়দ্রাবক বর্ণনা ও ওয়ারাআ",
        "ur": "قیامت کا بیان، رقاق اور ورع",
    },
    "The description of Paradise": {
        "bn": "জান্নাতের বিবরণ",
        "ur": "جنت کا بیان",
    },
    "The Description of Hellfire": {
        "bn": "জাহান্নামের বিবরণ",
        "ur": "دوزخ کا بیان",
    },
    "Seeking Permission": {
        "bn": "অনুমতি প্রার্থনা",
        "ur": "اجازت طلب کرنا",
    },
    "Manners": {
        "bn": "আদব",
        "ur": "آداب",
    },
    "Parables": {
        "bn": "উপমা",
        "ur": "امثال",
    },
    "Recitation": {
        "bn": "তিলাওয়াত",
        "ur": "تلاوت",
    },
    "Exegesis": {
        "bn": "তাফসীর",
        "ur": "تفسیر",
    },
    "Merits and Virtues": {
        "bn": "ফজিলত ও গুণাবলি",
        "ur": "فضائل و مناقب",
    },
    "Destiny": {
        "ur": "تقدیر",
        "bn": "তাকদীর",
    },
    "Suckling": {
        "ur": "رضاعت",
    },
    "Divorce and Mutual Imprecation": {
        "ur": "طلاق اور لعان",
    },
    "Judgements": {
        "ur": "فیصلے",
    },
    "Dreams": {
        "ur": "خواب",
    },

    # Abu Dawud - missing Indonesian
    "Zakat": {
        "id": "Zakat",
    },
    "Sacrifice": {
        "bn": "কুরবানী",
        "id": "Kurban",
    },

    # Nasai - Indonesian/Bengali still English
    "Jihad": {
        "bn": "জিহাদ",
        "id": "Jihad",
        "fr": "Le Jihad",
    },

    # Ibn Majah
    "Sunnah (Introduction)": {
        "fr": "La Sunna (Introduction)",
    },

    "Faith": {
        "bn": "ঈমান",
        "ur": "ایمان",
        "ru": "Вера (Иман)",
    },

    # Malik - all missing Bengali
    "The Times of Prayer": {
        "bn": "সালাতের সময়সমূহ",
    },
    "Purity": {
        "bn": "পবিত্রতা",
    },
    "Jumu'a": {
        "bn": "জুমুআ",
    },
    "Prayer in Ramadan (Taraweeh)": {
        "bn": "রমজানে সালাত (তারাবীহ)",
    },
    "Night Prayer (Tahajjud)": {
        "bn": "নামাজে রাত (তাহাজ্জুদ)",
    },
    "Prayer in Congregation": {
        "bn": "জামাতে নামাজ",
    },
    "Shortening the Prayer": {
        "bn": "সংক্ষিপ্তকরণ (কসর)",
    },
    "The Two 'Ids": {
        "bn": "দুই ঈদ",
    },
    "The Eclipse Prayer": {
        "bn": "গ্রহণের সালাত",
    },
    "Asking for Rain": {
        "bn": "বৃষ্টি প্রার্থনা",
    },
    "The Qibla": {
        "bn": "কিবলা",
    },
    "The Qur'an": {
        "bn": "কুরআন",
    },
    "Burials": {
        "bn": "কবরস্থান (জানাযা)",
    },
    "I'tikaf in Ramadan": {
        "bn": "রমজানে ইতিকাফ",
    },
    "Hajj": {
        "bn": "হজ্জ",
    },
    "Sacrificial Animals": {
        "bn": "কুরবানীর পশু",
    },
    "Fara'id": {
        "bn": "ফারায়েজ",
    },
    "Qirad": {
        "bn": "কিরাদ",
    },
    "Sharecropping": {
        "bn": "বর্গা চাষ",
    },
    "Renting Land": {
        "bn": "জমি ভাড়া",
    },
    "Pre-emption in Property": {
        "bn": "প্রাক-ক্রয় অধিকার (শুফয়া)",
    },
    "Setting Free and Wala'": {
        "bn": "মুক্তি ও ওয়ালা",
    },
    "The Mukatab": {
        "bn": "মুকাতাব",
    },
    "The Mudabbar": {
        "bn": "মুদাব্বার",
    },
    "Hudud": {
        "bn": "হদ্দ (শরীয়তের শাস্তি)",
    },
    "Blood-Money": {
        "bn": "দিয়াত (রক্তপণ)",
    },
    "The Oath of Qasama": {
        "bn": "কাসামার শপথ",
    },
    "Madinah": {
        "bn": "মদীনা",
    },
    "The Decree": {
        "bn": "তাকদীর (ভাগ্য)",
    },
    "Good Character": {
        "bn": "সচ্চরিত্র",
    },
    "The Description of the Prophet, may Allah Bless Him and Grant Him Peace": {
        "bn": "নবী (সা.)-এর বিবরণ",
    },
    "The Evil Eye": {
        "bn": "বদনজর (আইন)",
    },
    "Hair": {
        "bn": "চুল",
    },
    "The Oath of Allegiance": {
        "bn": "বাইআত",
    },
    "Speech": {
        "bn": "কথা বলা",
    },
    "Jahannam": {
        "bn": "জাহান্নাম",
    },
    "Sadaqa": {
        "bn": "সদকা",
    },
    "The Supplication of the Unjustly Wronged": {
        "bn": "মজলুমের বদদুআ",
    },
    "The Names of the Prophet, may Allah Bless Him and Grant Him Peace": {
        "bn": "নবী (সা.)-এর নামসমূহ",
    },
    "Dress": {
        "bn": "পোশাক",
    },
    "Marriage": {
        "bn": "বিয়ে",
    },
    "Divorce": {
        "bn": "তালাক",
    },
    "Breastfeeding": {
        "bn": "স্তন্যদান",
    },
    "Wills and Testaments": {
        "bn": "ওসিয়াত",
    },
    "Game": {
        "bn": "শিকার",
    },
    "Slaughtering Animals": {
        "bn": "পশু জবাই",
    },
    "The 'Aqiqa": {
        "bn": "আকীকা",
    },
    "Leadership": {
        "bn": "নেতৃত্ব",
    },
    "The Description of the Prophet (ﷺ)": {
        "bn": "নবী (সা.)-এর বিবরণ",
    },
    "The Book of Salat": {
        "bn": "সালাতের কিতাব",
    },
    "The Book of Zakat": {
        "bn": "যাকাতের কিতাব",
    },
    "The Book of Hajj": {
        "bn": "হজ্জের কিতাব",
    },
    "Keeping relationships and maintaining good character": {
        "bn": "আত্মীয়তার সম্পর্ক রক্ষা ও সচ্চরিত্র",
    },

}

# ── 3. Fix function ──

def fix_name(name_obj, en_text, ar_normalized):
    """Replace English copies with proper translations."""
    fixed = dict(name_obj)
    for lang, text in list(name_obj.items()):
        if lang == "en":
            continue
        if isinstance(text, str) and text.strip() == en_text:
            replacement = None

            # Priority 1: Arabic-based reference
            if ar_normalized and lang in ar_ref_map.get(ar_normalized, {}):
                replacement = ar_ref_map[ar_normalized][lang]

            # Priority 2: English-based reference
            if replacement is None and lang in en_ref_map.get(en_text, {}):
                replacement = en_ref_map[en_text][lang]

            # Priority 3: Fallback dictionary
            if replacement is None and en_text in FALLBACK and lang in FALLBACK[en_text]:
                replacement = FALLBACK[en_text][lang]

            if replacement:
                fixed[lang] = replacement
    return fixed

# ── 4. Process each collection ──

total_fixed = 0
for col in COLLECTION_ORDER:
    json_path = os.path.join(HADITH_DIR, col, "books.json")
    min_path = os.path.join(HADITH_DIR, col, "books.min.json")

    if not os.path.exists(json_path):
        print(f"SKIP {col}: books.json not found")
        continue

    with open(json_path, encoding="utf-8") as f:
        books = json.load(f)

    changed = 0
    for b in books:
        name = b.get("name", {})
        en = name.get("en", "").strip()
        ar_raw = name.get("ar", "")
        if not en:
            continue
        n_ar = normalize_ar(ar_raw)
        fixed = fix_name(name, en, n_ar)
        if fixed != name:
            b["name"] = fixed
            changed += 1
            total_fixed += 1

    # Write pretty JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(books, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Write minified JSON (single line, no whitespace)
    with open(min_path, "w", encoding="utf-8") as f:
        json.dump(books, f, separators=(",", ":"), ensure_ascii=False)

    print(f"{col}: {changed} book(s) fixed")

print(f"\nTotal fixes: {total_fixed}")
print("Done!")
