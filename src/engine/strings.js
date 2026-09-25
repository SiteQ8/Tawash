/*
  Every word Tawash shows a person, in English and Arabic.

  The tests hold both languages to the same rules: nothing missing, the same
  placeholders on both sides, no Latin letters in Arabic outside backticks or
  the proper nouns listed below, Arabic punctuation, and a period only at the
  end of an Arabic sentence. Text between backticks is code, such as a domain.
*/

/* Proper nouns that may appear in Arabic text as they are. */
export const LATIN_NAMES = [
  "DNS", "Google", "Public", "Cloudflare", "MIT", "GitHub", "MISP", "STIX", "CSV",
  "JSON", "TLS", "HTTPS", "RDAP", "KNET", "WhoisDS", "CIRCL", "openSquat", "Node.js"
];

export const STRINGS = {
  algorithm: {
    homoglyph: {
      name: { en: "Lookalike characters", ar: "حروف متشابهة الشكل" },
      about: {
        en: "Letters that look alike, such as o and 0, l and 1, rn and m, or Cyrillic and Greek letters that pass for Latin ones.",
        ar: "حروف متشابهة الشكل مثل `o` و`0` و`l` و`1` و`rn` و`m`، أو حروف كيريلية ويونانية تُشبه الحروف اللاتينية."
      }
    },
    transliteration: {
      name: { en: "Other Latin spellings", ar: "كتابات لاتينية أخرى" },
      about: {
        en: "Other ways to write an Arabic name in Latin letters, such as u for ou, g for q, or an added or dropped al.",
        ar: "طرق أخرى لكتابة الاسم العربي بالحروف اللاتينية، كأن تُكتب `u` بدل `ou` أو `g` بدل `q` أو تُضاف `al` إلى الاسم أو تُحذف منه."
      }
    },
    "kuwait-affix": {
      name: { en: "Kuwait lure words", ar: "كلمات استدراج كويتية" },
      about: {
        en: "The name glued to words scammers in Kuwait use, such as kw, q8, knet, pay and login.",
        ar: "الاسم ملصوقاً بكلمات يستعملها المحتالون في الكويت مثل `kw` و`q8` و`knet` و`pay` و`login`."
      }
    },
    omission: {
      name: { en: "Missing letter", ar: "حرف محذوف" },
      about: { en: "One letter left out.", ar: "حذف حرف واحد من الاسم." }
    },
    repetition: {
      name: { en: "Repeated letter", ar: "حرف مكرر" },
      about: { en: "One letter typed twice.", ar: "كتابة أحد الحروف مرتين." }
    },
    transposition: {
      name: { en: "Swapped letters", ar: "حرفان متبادلان" },
      about: { en: "Two neighbouring letters swapped.", ar: "تبديل موضعي حرفين متجاورين." }
    },
    replacement: {
      name: { en: "Neighbouring key", ar: "مفتاح مجاور" },
      about: {
        en: "One letter replaced by a key next to it on QWERTY, QWERTZ or AZERTY keyboards.",
        ar: "استبدال حرف بحرف يجاوره على لوحات المفاتيح `QWERTY` و`QWERTZ` و`AZERTY`."
      }
    },
    "double-replacement": {
      name: { en: "Doubled letter replaced", ar: "حرف مضاعف مستبدل" },
      about: {
        en: "A doubled letter replaced by a neighbouring key, both times.",
        ar: "استبدال الحرفين المتكررين معاً بمفتاح مجاور لهما."
      }
    },
    "vowel-swap": {
      name: { en: "Vowel swap", ar: "تبديل حروف العلة" },
      about: {
        en: "One vowel swapped for another, leaving the first letter alone.",
        ar: "استبدال حرف علة بآخر مع إبقاء الحرف الأول كما هو."
      }
    },
    addition: {
      name: { en: "Extra character", ar: "حرف زائد" },
      about: { en: "One extra letter or digit.", ar: "إضافة حرف أو رقم واحد." }
    },
    "add-dash": {
      name: { en: "Added hyphen", ar: "واصلة مضافة" },
      about: { en: "A hyphen added inside the name.", ar: "إضافة واصلة داخل الاسم." }
    },
    "strip-dash": {
      name: { en: "Removed hyphen", ar: "واصلة محذوفة" },
      about: { en: "A hyphen taken out of the name.", ar: "حذف الواصلة من الاسم." }
    },
    plural: {
      name: { en: "Singular and plural", ar: "المفرد والجمع" },
      about: { en: "The name made plural or singular.", ar: "تحويل الاسم إلى صيغة الجمع أو المفرد." }
    },
    misspelling: {
      name: { en: "Common misspelling", ar: "خطأ إملائي شائع" },
      about: {
        en: "Common misspellings of English words in the name, Kuwait included.",
        ar: "أخطاء إملائية شائعة في الكلمات الإنجليزية داخل الاسم بما فيها كلمة `kuwait`."
      }
    },
    homophones: {
      name: { en: "Sound alike words", ar: "كلمات متشابهة النطق" },
      about: { en: "Words that sound the same, such as buy and bye.", ar: "كلمات يتشابه نطقها مثل `buy` و`bye`." }
    },
    "numeral-swap": {
      name: { en: "Digits and words", ar: "الأرقام والكلمات" },
      about: {
        en: "Digits written as words and words written as digits.",
        ar: "كتابة الأرقام بالحروف وكتابة الكلمات بالأرقام."
      }
    },
    subdomain: {
      name: { en: "Split by a dot", ar: "اسم مقسوم بنقطة" },
      about: {
        en: "A dot put inside the name, so part of the brand becomes a subdomain.",
        ar: "إدخال نقطة داخل الاسم فيتحول جزء من العلامة إلى نطاق فرعي."
      }
    },
    "missing-dot": {
      name: { en: "Missing dot", ar: "نقطة محذوفة" },
      about: { en: "A dot left out, as in wwwexample.com.", ar: "حذف إحدى النقاط كما في `wwwexample.com`." }
    },
    "dot-to-dash": {
      name: { en: "Dot turned hyphen", ar: "نقطة صارت واصلة" },
      about: { en: "A dot turned into a hyphen, as in example-gov-kw.com.", ar: "تحويل النقطة إلى واصلة كما في `example-gov-kw.com`." }
    },
    "wrong-sld": {
      name: { en: "Other second level", ar: "مستوى ثانٍ آخر" },
      about: {
        en: "Another second level ending, such as org.kw in place of com.kw.",
        ar: "استعمال نهاية أخرى من المستوى الثاني مثل `org.kw` بدل `com.kw`."
      }
    },
    "wrong-tld": {
      name: { en: "Other ending", ar: "نهاية أخرى" },
      about: {
        en: "Another top level ending, Gulf ones included.",
        ar: "استعمال نطاق آخر من المستوى الأعلى بما فيه نطاقات دول الخليج."
      }
    },
    "add-tld": {
      name: { en: "Added country code", ar: "رمز دولة مضاف" },
      about: {
        en: "A country code added after the whole domain, as in example.com.ae.",
        ar: "إضافة رمز دولة بعد النطاق كاملاً كما في `example.com.ae`."
      }
    },
    "dynamic-dns": {
      name: { en: "Dynamic DNS", ar: "خدمات DNS الديناميكية" },
      about: { en: "The name under free dynamic DNS services.", ar: "الاسم تحت خدمات DNS الديناميكية المجانية." }
    },
    bitsquatting: {
      name: { en: "Flipped bit", ar: "بت مقلوب" },
      about: {
        en: "One bit flipped in one character, the error a faulty memory chip makes.",
        ar: "قلب بت واحد في أحد الحروف، وهو الخطأ الذي تُحدثه شريحة ذاكرة معطوبة."
      }
    }
  },

  status: {
    live: { en: "Live", ar: "نشط" },
    registered: { en: "Registered", ar: "مسجّل" },
    known: { en: "Yours", ar: "تابع لك" },
    absent: { en: "Not found", ar: "غير موجود" },
    unknown: { en: "Unknown", ar: "غير معروف" },
    unchecked: { en: "Not checked", ar: "لم يُفحص" }
  },

  statusAbout: {
    live: { en: "Answers with a web address, so a site can run on it.", ar: "له عنوان إنترنت، أي أنه قادر على تشغيل موقع." },
    registered: { en: "Exists in DNS but has no web address yet.", ar: "موجود في نظام أسماء النطاقات لكنه بلا عنوان إنترنت حتى الآن." },
    known: {
      en: "Shares name or mail servers with the domain you entered, so it most likely has the same owner.",
      ar: "يشترك مع نطاقك في خوادم الأسماء أو خوادم البريد، لذا يُرجّح أن مالكه هو المالك نفسه."
    },
    absent: { en: "Nobody has registered it.", ar: "لم يسجّله أحد بعد." },
    unknown: { en: "The DNS lookup failed, so check it again later.", ar: "تعذّر الاستعلام عنه، لذا أعد فحصه لاحقاً." },
    unchecked: { en: "On the search list but not looked up yet.", ar: "مدرج في قائمة البحث لكن لم يُستعلم عنه بعد." }
  },

  level: {
    high: { en: "High", ar: "عالية" },
    medium: { en: "Medium", ar: "متوسطة" },
    low: { en: "Low", ar: "منخفضة" },
    none: { en: "None", ar: "لا شيء" }
  },

  reason: {
    registered: { en: "exists in DNS", ar: "موجود في نظام أسماء النطاقات" },
    resolves: { en: "has a web address ({ips})", ar: "له عنوان إنترنت (`{ips}`)" },
    mail: { en: "can receive email ({mx})", ar: "يستقبل البريد الإلكتروني (`{mx}`)" },
    "known-owner": { en: "its name servers sit inside the original domain", ar: "خوادم أسمائه داخل النطاق الأصلي" },
    "known-ns": { en: "uses exactly the original's name servers", ar: "يستخدم خوادم الأسماء نفسها التي يستخدمها النطاق الأصلي" },
    "known-mx": { en: "uses one of the original's mail servers", ar: "يستخدم أحد خوادم البريد الخاصة بالنطاق الأصلي" },
    "known-list": { en: "uses a server you listed as yours", ar: "يستخدم خادماً أدرجته على أنه تابع لك" },
    lure: { en: "carries lure words: {words}", ar: "يحمل كلمات استدراج: `{words}`" },
    kuwait: { en: "points at Kuwait in the name", ar: "يشير اسمه إلى الكويت" },
    idn: { en: "uses letters from other alphabets that pass for Latin ones", ar: "يستخدم حروفاً من أبجديات أخرى تُشبه الحروف اللاتينية" },
    "risky-tld": { en: "uses a cheap ending common in scams (.{tld})", ar: "يستخدم نهاية رخيصة شائعة في الاحتيال (`.{tld}`)" },
    "free-host": { en: "sits on free hosting ({host})", ar: "مستضاف مجاناً على `{host}`" },
    "one-edit": { en: "one character away from the original", ar: "يختلف عن الأصل بحرف واحد" },
    "web-similar": { en: "its page title resembles the original's ({pct}%)", ar: "عنوان صفحته يشبه عنوان صفحة الأصل بنسبة {pct}٪" },
    "names-brand": { en: "its page names the organisation ({names})", ar: "صفحته تذكر اسم الجهة ({names})" },
    cert: { en: "has a recent TLS certificate ({date})", ar: "لديه شهادة TLS حديثة (`{date}`)" },
    "dns-error": { en: "the DNS lookup failed", ar: "تعذّر الاستعلام عنه في نظام أسماء النطاقات" },
    parked: { en: "parked with a domain parking service", ar: "موقوف لدى خدمة لركن النطاقات" },
    lame: { en: "its name servers do not answer", ar: "خوادم أسمائه لا تجيب" },
    new: { en: "registered in the last 30 days ({date})", ar: "سُجّل خلال الأيام الثلاثين الأخيرة (`{date}`)" },
    recent: { en: "registered in the last year ({date})", ar: "سُجّل خلال السنة الأخيرة (`{date}`)" },
    since: { en: "registered on {date}", ar: "مسجّل منذ `{date}`" },
    nrd: { en: "newly registered ({date})", ar: "سُجّل حديثاً (`{date}`)" },
    ct: { en: "seen in certificate logs ({date})", ar: "ظهر في سجلات شفافية الشهادات (`{date}`)" }
  },

  how: {
    "official-label": { en: "carries an official domain inside its name", ar: "يحمل نطاقاً رسمياً داخل اسمه" },
    exact: { en: "the same name on another ending", ar: "الاسم نفسه بنهاية مختلفة" },
    homoglyph: { en: "the same name in lookalike characters", ar: "الاسم نفسه بحروف متشابهة الشكل" },
    glued: { en: "the name glued to {word}", ar: "الاسم ملصوقاً بكلمة `{word}`" },
    token: { en: "the name as a separate word", ar: "الاسم ككلمة مستقلة" },
    transliteration: { en: "another Latin spelling of the name", ar: "كتابة لاتينية أخرى للاسم" },
    typo1: { en: "one character away from the name", ar: "يختلف عن الاسم بحرف واحد" },
    typo2: { en: "two characters away from the name", ar: "يختلف عن الاسم بحرفين" },
    contains: { en: "contains the name", ar: "يتضمن الاسم" },
    similar: { en: "spelled much like the name", ar: "قريب جداً من الاسم في كتابته" }
  },

  ui: {
    title: { en: "Tawash, lookalike domain finder for Kuwait", ar: "طوّاش، كاشف النطاقات الشبيهة في الكويت" },
    brand: { en: "Tawash", ar: "طوّاش" },
    tagline: {
      en: "Finds the domains made to pass for Kuwait's real ones.",
      ar: "يكشف النطاقات التي صُنعت لتبدو كأنها نطاقات الكويت الأصلية."
    },
    lede: {
      en: "Type a domain and Tawash searches for the lookalikes registered against it, from typos and swapped letters to foreign characters and Latin spellings of Arabic names, checking each one live in DNS.",
      ar: "اكتب نطاقاً فيبحث طوّاش عن النطاقات الشبيهة المسجلة التي تنتحله، من أخطاء الكتابة والحروف المبدّلة إلى الحروف الأجنبية والكتابات اللاتينية للأسماء العربية، ويتحقق من كل واحد منها مباشرة في نظام أسماء النطاقات."
    },
    label: { en: "Domain", ar: "النطاق" },
    scan: { en: "Find lookalikes", ar: "ابحث عن الشبيه" },
    stop: { en: "Stop", ar: "أوقف" },
    options: { en: "Options", ar: "خيارات" },
    techniques: { en: "Techniques", ar: "الأساليب" },
    all: { en: "All", ar: "الكل" },
    none: { en: "None", ar: "لا شيء" },
    knownNs: { en: "Your name servers", ar: "خوادم أسمائك" },
    knownMx: { en: "Your mail servers", ar: "خوادم بريدك" },
    knownHint: {
      en: "Lookalikes that use these are marked as yours. Tawash already learns them from the domain you enter.",
      ar: "تُعلَّم النطاقات الشبيهة التي تستخدمها على أنها تابعة لك، علماً أن طوّاش يستخلصها من النطاق الذي تكتبه."
    },
    exclude: { en: "Leave these out", ar: "استبعد هذه النطاقات" },
    excludeHint: { en: "One domain per line.", ar: "نطاق واحد في كل سطر." },
    invalid: { en: "That is not a domain name. Try something like example.com.", ar: "هذا ليس اسم نطاق، لذا جرّب مثلاً `example.com`." },
    noTechniques: { en: "Pick at least one technique.", ar: "اختر أسلوباً واحداً على الأقل." },
    learning: { en: "Reading the name and mail servers of {domain}", ar: "قراءة خوادم الأسماء والبريد للنطاق `{domain}`" },
    checked: { en: "Checked", ar: "فُحص" },
    exist: { en: "Exist", ar: "موجود" },
    live: { en: "Live", ar: "نشط" },
    yours: { en: "Yours", ar: "تابع لك" },
    filterFound: { en: "Exist", ar: "الموجودة" },
    filterLive: { en: "Live", ar: "النشطة" },
    filterKnown: { en: "Yours", ar: "التابعة لك" },
    filterAll: { en: "Everything searched", ar: "كل ما بُحث عنه" },
    download: { en: "Download", ar: "تنزيل" },
    why: { en: "Why", ar: "لماذا" },
    technique: { en: "Technique", ar: "الأسلوب" },
    score: { en: "Score", ar: "الدرجة" },
    original: { en: "Original", ar: "الأصل" },
    inDns: { en: "In DNS", ar: "في نظام أسماء النطاقات" },
    addresses: { en: "Addresses", ar: "العناوين" },
    nameServers: { en: "Name servers", ar: "خوادم الأسماء" },
    mailServers: { en: "Mail servers", ar: "خوادم البريد" },
    nothing: { en: "none", ar: "لا يوجد" },
    certificates: { en: "Certificates on crt.sh", ar: "الشهادات في `crt.sh`" },
    copyLink: { en: "Copy link to this scan", ar: "انسخ رابط هذا الفحص" },
    copied: { en: "Link copied.", ar: "نُسخ الرابط." },
    idle: {
      en: "Nothing checked yet. Enter a domain above to start.",
      ar: "لم يُفحص شيء بعد، لذا اكتب نطاقاً في الأعلى لتبدأ."
    },
    clean: {
      en: "None of the lookalikes exist yet. That is good news, and worth checking again next week.",
      ar: "لم يُسجَّل أي نطاق شبيه حتى الآن، وهذا خبر سار يستحق أن تعيد فحصه الأسبوع القادم."
    },
    emptyFilter: { en: "Nothing here with this filter.", ar: "لا يوجد شيء تحت هذه التصفية." },
    stopped: { en: "Stopped. The results so far are below.", ar: "توقف الفحص، والنتائج التي جُمعت حتى الآن معروضة أدناه." },
    dnsFailed: {
      en: "Google and Cloudflare both stopped answering. Wait a minute and try again.",
      ar: "توقفت خدمتا Google وCloudflare عن الإجابة، لذا انتظر دقيقة ثم أعد المحاولة."
    },
    originalMissing: {
      en: "{domain} itself does not exist in DNS, so nothing can be marked as yours.",
      ar: "النطاق `{domain}` نفسه غير موجود في نظام أسماء النطاقات، لذا لن يُعلَّم أي نطاق على أنه تابع لك."
    },
    scoreAbout: {
      en: "The score adds up the evidence listed under each lookalike. It tells you where to look first, not whether a site is a scam.",
      ar: "تجمع الدرجة الأدلة المذكورة تحت كل نطاق شبيه، فهي تخبرك من أين تبدأ ولا تحكم بأن الموقع احتيالي."
    },
    statusesTitle: { en: "What the statuses mean", ar: "معنى الحالات" },
    aboutTitle: { en: "Why the name", ar: "سبب التسمية" },
    about: {
      en: "In Kuwait's pearling days the tawash was the pearl merchant who sailed out to the diving ships and examined every pearl before he paid for it. Tawash examines domains the same way, looking for the ones made to pass for the real thing.",
      ar: "كان الطوّاش في زمن الغوص على اللؤلؤ تاجراً يبحر إلى سفن الغوص ويفحص كل لؤلؤة قبل أن يدفع ثمنها، وعلى نهجه يفحص طوّاش النطاقات بحثاً عن تلك التي صُنعت لتبدو أصلية."
    },
    privacyTitle: { en: "Privacy", ar: "الخصوصية" },
    privacy: {
      en: "Your browser asks Google Public DNS about each lookalike, or Cloudflare when Google does not answer. Nothing is sent to Tawash and nothing is stored. Lookalikes are shown as text, never as links, so nobody opens one by accident.",
      ar: "يسأل متصفحك خدمة Google Public DNS عن كل نطاق شبيه، أو خدمة Cloudflare إن لم تُجب Google، ولا يُرسَل أي شيء إلى طوّاش ولا يُخزَّن، كما تظهر النطاقات الشبيهة نصاً لا روابط كي لا يفتحها أحد بالخطأ."
    },
    cliTitle: { en: "From a terminal", ar: "من سطر الأوامر" },
    cli: {
      en: "The same engine runs as a command line tool. It also watches newly registered domains and certificate logs, which a browser cannot reach.",
      ar: "يعمل المحرك نفسه أداةً في سطر الأوامر، كما يراقب النطاقات المسجلة حديثاً وسجلات شفافية الشهادات التي لا يصل إليها المتصفح."
    },
    licence: { en: "Open source under the MIT licence.", ar: "مفتوح المصدر بترخيص MIT." },
    source: { en: "Source on GitHub", ar: "الشيفرة على GitHub" },
    progress: { en: "Scan progress", ar: "تقدّم الفحص" },
    results: { en: "Results", ar: "النتائج" }
  },

  cli: {
    nrdCount: { en: "Newly registered domains on {date}: {count}", ar: "النطاقات المسجلة حديثاً في `{date}`: {count}" },
    matches: { en: "Matches: {count}", ar: "المطابقات: {count}" },
    ctCount: { en: "Names from certificate logs: {count}", ar: "الأسماء الواردة من سجلات الشهادات: {count}" },
    ctUnreachable: {
      en: "The certificate log source could not be reached, so nothing was checked there.",
      ar: "تعذّر الوصول إلى مصدر سجلات الشهادات، لذا لم يُفحص فيه شيء."
    },
    nrdUnreachable: {
      en: "The newly registered domains list could not be downloaded, so nothing was checked there.",
      ar: "تعذّر تنزيل قائمة النطاقات المسجلة حديثاً، لذا لم يُفحص فيها شيء."
    },
    wrote: { en: "Wrote {file}", ar: "حُفظ الملف `{file}`" },
    watchlist: { en: "Watchlist: {count} brand names and {domains} official domains", ar: "قائمة المراقبة: {count} من أسماء العلامات و{domains} من النطاقات الرسمية" },
    noWatchlist: {
      en: "Give a watchlist with --asli, --keywords <file> or --keyword <word>.",
      ar: "حدّد قائمة مراقبة بالخيار `--asli` أو `--keywords` أو `--keyword`."
    },
    badDomain: { en: "Not a domain name: {input}", ar: "هذا ليس اسم نطاق: `{input}`" },
    badAlgorithm: { en: "Unknown technique: {list}", ar: "أسلوب غير معروف: `{list}`" },
    reportTitle: { en: "Tawash report", ar: "تقرير طوّاش" },
    reportFor: { en: "Lookalikes of {domain}", ar: "النطاقات الشبيهة بالنطاق `{domain}`" },
    reportWatch: { en: "Watch on {date}", ar: "المراقبة في `{date}`" },
    reportNote: {
      en: "These are candidates for a person to review, not verdicts. Do not publish them before someone has looked.",
      ar: "هذه نطاقات مرشحة ينبغي أن يراجعها شخص، وليست أحكاماً، لذا لا تنشرها قبل مراجعتها."
    },
    colScore: { en: "Score", ar: "الدرجة" },
    colStatus: { en: "Status", ar: "الحالة" },
    colDomain: { en: "Lookalike", ar: "النطاق الشبيه" },
    colHow: { en: "How", ar: "الطريقة" },
    colWhy: { en: "Why", ar: "السبب" },
    nothingFound: { en: "Nothing found.", ar: "لم يُعثر على شيء." }
  },

  plural: {
    searched: {
      en: { one: "Searched {n} possible lookalike", other: "Searched {n} possible lookalikes" },
      ar: {
        zero: "لم يُبحث عن أي نطاق شبيه",
        one: "بُحث عن نطاق شبيه محتمل واحد",
        two: "بُحث عن نطاقين شبيهين محتملين",
        few: "بُحث عن {n} نطاقات شبيهة محتملة",
        many: "بُحث عن {n} نطاقاً شبيهاً محتملاً",
        other: "بُحث عن {n} نطاق شبيه محتمل"
      }
    },
    listed: {
      en: { one: "{n} name on the search list", other: "{n} names on the search list" },
      ar: {
        zero: "لا توجد أسماء في قائمة البحث",
        one: "اسم واحد في قائمة البحث",
        two: "اسمان في قائمة البحث",
        few: "{n} أسماء في قائمة البحث",
        many: "{n} اسماً في قائمة البحث",
        other: "{n} اسم في قائمة البحث"
      }
    },
    found: {
      en: { one: "{n} lookalike exists", other: "{n} lookalikes exist" },
      ar: {
        zero: "لا يوجد أي نطاق شبيه مسجّل",
        one: "يوجد نطاق شبيه واحد مسجّل",
        two: "يوجد نطاقان شبيهان مسجّلان",
        few: "يوجد {n} نطاقات شبيهة مسجّلة",
        many: "يوجد {n} نطاقاً شبيهاً مسجّلاً",
        other: "يوجد {n} نطاق شبيه مسجّل"
      }
    }
  }
};

/*
  The command line help, row by row. The README tests read these rows too, so a
  command or option cannot exist without being documented in both languages.
*/
export const HELP = {
  intro: {
    en: "Tawash is a threat intelligence tool that finds the lookalike domains passing for Kuwait's real ones.",
    ar: "طوّاش أداة لرصد التهديدات تكشف النطاقات الشبيهة التي تنتحل نطاقات الكويت الأصلية."
  },
  sections: [
    {
      id: "commands",
      title: { en: "Commands", ar: "الأوامر" },
      rows: [
        ["scan <domain>", { en: "search for the registered lookalikes of a domain", ar: "يبحث عن النطاقات الشبيهة المسجلة لنطاق ما" }],
        ["candidates <domain>", { en: "list the names a scan searches for, without looking them up", ar: "يسرد الأسماء التي يبحث عنها الأمر `scan` دون الاستعلام عنها" }],
        ["nrd", { en: "match newly registered domains against a watchlist", ar: "يطابق النطاقات المسجلة حديثاً مع قائمة المراقبة" }],
        ["ct <keyword>", { en: "search certificate logs for names that carry a brand", ar: "يبحث في سجلات شفافية الشهادات عن أسماء تحمل علامة ما" }],
        ["watch", { en: "run nrd and ct for a watchlist and write a report", ar: "يشغّل الأمرين `nrd` و`ct` لقائمة المراقبة ويكتب تقريراً" }],
        ["algorithms", { en: "list the impersonation techniques Tawash searches for", ar: "يسرد أساليب الانتحال التي يبحث عنها طوّاش" }]
      ]
    },
    {
      id: "watchlist",
      title: { en: "Watchlist for nrd, ct and watch", ar: "قائمة المراقبة للأوامر `nrd` و`ct` و`watch`" },
      rows: [
        ["--asli", { en: "every official body in the Asli registry", ar: "كل الجهات الرسمية في سجل أصلي" }],
        ["--keywords <file>", { en: "one brand token or domain per line", ar: "اسم علامة أو نطاق واحد في كل سطر" }],
        ["--keyword <word>", { en: "a single brand token, repeatable", ar: "اسم علامة واحد ويمكن تكراره" }]
      ]
    },
    {
      id: "options",
      title: { en: "Options", ar: "الخيارات" },
      rows: [
        ["--format <f>", { en: "table, json, csv, misp, stix or md", ar: "`table` أو `json` أو `csv` أو `misp` أو `stix` أو `md`" }],
        ["--out <path>", { en: "write to a file, or a folder for watch", ar: "يكتب النتيجة في ملف أو في مجلد مع الأمر `watch`" }],
        ["--lang <en|ar>", { en: "language of statuses and reasons", ar: "لغة الحالات والأسباب" }],
        ["--algorithms <list>", { en: "comma separated techniques for scan and candidates", ar: "أساليب مفصولة بفواصل للأمرين `scan` و`candidates`" }],
        ["--all", { en: "show every lookalike, not only the ones that exist", ar: "يعرض كل النطاقات الشبيهة لا الموجودة منها فقط" }],
        ["--doh <google|cloudflare>", { en: "resolve over DNS over HTTPS", ar: "يستعلم عبر DNS فوق HTTPS" }],
        ["--resolver <ip,ip>", { en: "use these DNS servers", ar: "يستخدم خوادم DNS هذه" }],
        ["--concurrency <n>", { en: "parallel lookups, 32 by default and 8 with --doh", ar: "عدد الاستعلامات المتوازية وهو 32 افتراضياً و8 مع `--doh`" }],
        ["--known-ns <list>", { en: "name servers that are yours", ar: "خوادم الأسماء التابعة لك" }],
        ["--known-mx <list>", { en: "mail servers that are yours", ar: "خوادم البريد التابعة لك" }],
        ["--exclude <file>", { en: "domains to leave out, one per line", ar: "نطاقات تُستبعد بواقع نطاق في كل سطر" }],
        ["--web", { en: "fetch live lookalikes and compare their pages with the original", ar: "يجلب صفحات النطاقات النشطة ويقارنها بصفحة الأصل" }],
        ["--certs", { en: "look up recent certificates of live lookalikes", ar: "يبحث عن الشهادات الحديثة للنطاقات النشطة" }],
        ["--claim <text>", { en: "a name the organisation goes by, looked for on lookalike pages, repeatable", ar: "اسم تُعرف به الجهة يُبحث عنه في صفحات النطاقات الشبيهة ويمكن تكراره" }],
        ["--no-age", { en: "skip registration dates from RDAP", ar: "يتخطى تواريخ التسجيل من خدمة RDAP" }],
        ["--sweep", { en: "watch also sweeps DNS for lookalikes of every official domain", ar: "يمسح الأمر `watch` أيضاً نظام أسماء النطاقات بحثاً عن النطاقات الشبيهة بكل نطاق رسمي" }],
        ["--date <yyyy-mm-dd>", { en: "day of the newly registered list, yesterday by default", ar: "يوم قائمة النطاقات المسجلة حديثاً وهو أمس افتراضياً" }],
        ["--feed <file>", { en: "read newly registered domains from a text or zip file", ar: "يقرأ النطاقات المسجلة حديثاً من ملف نصي أو مضغوط" }],
        ["--confidence <0-4>", { en: "0 is strictest and 4 finds most, 1 by default", ar: "المستوى 0 هو الأشد و4 يجد أكثر، والافتراضي 1" }],
        ["--dns", { en: "check nrd and ct matches in DNS", ar: "يفحص مطابقات `nrd` و`ct` في نظام أسماء النطاقات" }],
        ["--ct", { en: "include certificate logs in watch", ar: "يضيف سجلات الشهادات إلى الأمر `watch`" }],
        ["--days <n>", { en: "how far back certificate logs go, 3 by default", ar: "المدة التي تعود إليها سجلات الشهادات بالأيام وهي 3 افتراضياً" }],
        ["--alert-at <score>", { en: "watch writes alert.md when a score reaches this, 50 by default", ar: "يكتب الأمر `watch` الملف `alert.md` عندما تبلغ درجة هذا الحد وهو 50 افتراضياً" }],
        ["--fail-on <score>", { en: "exit with code 3 when a score reaches this", ar: "ينهي التشغيل بالرمز 3 عندما تبلغ درجة هذا الحد" }],
        ["--version", { en: "print the version", ar: "يطبع رقم الإصدار" }],
        ["--help", { en: "print this help", ar: "يطبع هذه المساعدة" }]
      ]
    },
    {
      id: "examples",
      title: { en: "Examples", ar: "أمثلة" },
      rows: [
        ["tawash scan example.com", { en: "the lookalikes of one domain that exist today", ar: "النطاقات الشبيهة الموجودة اليوم لنطاق واحد" }],
        ["tawash scan example.gov.kw --web --format csv --out report.csv", { en: "the same, with page checks, saved for a spreadsheet", ar: "الفحص نفسه مع فحص الصفحات وحفظ النتيجة لجدول بيانات" }],
        ["tawash nrd --asli --dns", { en: "yesterday's new domains that borrow an official Kuwaiti name", ar: "نطاقات الأمس الجديدة التي تستعير اسماً رسمياً كويتياً" }],
        ["tawash watch --asli --ct --out reports", { en: "the daily watch, written to a folder", ar: "المراقبة اليومية مع حفظ التقارير في مجلد" }]
      ]
    }
  ]
};

/* Replaces {name} placeholders. Missing values become empty strings. */
export function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));
}

function lookup(path) {
  return path.split(".").reduce((node, key) => (node == null ? node : node[key]), STRINGS);
}

/* t("reason.mail", "ar", { mx }) returns the filled string, or the path when it is missing. */
export function t(path, lang = "en", vars) {
  const node = lookup(path);
  if (!node) return path;
  const text = node[lang] ?? node.en;
  return fill(text, vars);
}

const RULES = {};
function rules(lang) {
  if (!RULES[lang]) RULES[lang] = new Intl.PluralRules(lang === "ar" ? "ar" : "en");
  return RULES[lang];
}

/* plural("found", 12, "ar") picks the Arabic form a count of twelve needs. */
export function plural(key, n, lang = "en", format = (x) => String(x)) {
  const forms = STRINGS.plural[key][lang] || STRINGS.plural[key].en;
  const category = rules(lang).select(n);
  const text = forms[category] ?? forms.other;
  return fill(text, { n: format(n) });
}

export function reasonText(reason, lang = "en") {
  return t("reason." + reason.key, lang, reason);
}

export function howText(match, lang = "en") {
  return t("how." + match.how, lang, match);
}

/* Code spans written with backticks, flattened for a terminal. */
export function plainText(text) {
  return String(text).replace(/`([^`]*)`/g, "$1");
}
