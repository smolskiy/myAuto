/**
 * Справочник брендов запчастей, масел, шин и АКБ, популярных в РФ. Только реально существующие бренды.
 * `aliases` — как их набирают по-русски и альтернативные написания.
 */
export const PART_BRANDS: { name: string; aliases?: string[] }[] = [
  // Фильтры
  { name: 'Mann-Filter', aliases: ['mann', 'манн', 'манфильтр'] },
  { name: 'Mahle', aliases: ['мале', 'махле'] },
  { name: 'Knecht', aliases: ['кнехт'] },
  { name: 'Filtron', aliases: ['фильтрон'] },
  { name: 'Hengst', aliases: ['хенгст'] },
  { name: 'Sakura', aliases: ['сакура'] },
  { name: 'Fram', aliases: ['фрам'] },
  { name: 'Purflux', aliases: ['пурфлюкс'] },
  { name: 'UFI', aliases: ['уфи'] },
  { name: 'WIX Filters', aliases: ['wix', 'викс'] },
  { name: 'Big Filter', aliases: ['биг фильтр'] },
  // Зажигание и электрика
  { name: 'Bosch', aliases: ['бош'] },
  { name: 'NGK', aliases: ['нгк', 'ntk'] },
  { name: 'Denso', aliases: ['денсо'] },
  { name: 'Champion', aliases: ['чемпион'] },
  { name: 'Brisk', aliases: ['бриск'] },
  { name: 'Beru', aliases: ['беру'] },
  { name: 'Hella', aliases: ['хелла'] },
  { name: 'Osram', aliases: ['осрам'] },
  { name: 'Philips', aliases: ['филипс'] },
  { name: 'Valeo', aliases: ['валео'] },
  { name: 'Magneti Marelli', aliases: ['marelli', 'магнети марелли', 'марелли'] },
  { name: 'Delphi', aliases: ['дельфи'] },
  { name: 'Pierburg', aliases: ['пирбург'] },
  { name: 'Пекар', aliases: ['pekar'] },
  // Масла и жидкости
  { name: 'Motul', aliases: ['мотюль', 'мотул'] },
  { name: 'Castrol', aliases: ['кастрол'] },
  { name: 'Liqui Moly', aliases: ['ликви моли', 'liquimoly'] },
  { name: 'Shell', aliases: ['шелл', 'шел'] },
  { name: 'Mobil', aliases: ['мобил', 'мобиль'] },
  { name: 'Total', aliases: ['тотал', 'totalenergies'] },
  { name: 'Elf', aliases: ['эльф'] },
  { name: 'ZIC', aliases: ['зик'] },
  { name: 'Idemitsu', aliases: ['идемицу'] },
  { name: 'ENEOS', aliases: ['энеос', 'енеос'] },
  { name: 'Лукойл', aliases: ['lukoil', 'лукоил'] },
  { name: 'Роснефть', aliases: ['rosneft'] },
  { name: 'Газпромнефть', aliases: ['gazpromneft'] },
  { name: 'G-Energy', aliases: ['джи энерджи'] },
  { name: 'Ravenol', aliases: ['равенол'] },
  { name: 'Fuchs', aliases: ['фукс'] },
  { name: 'Valvoline', aliases: ['валволин'] },
  { name: 'Mannol', aliases: ['маннол'] },
  { name: 'Rolf', aliases: ['рольф'] },
  { name: 'Sintec', aliases: ['синтек'] },
  { name: 'Kixx', aliases: ['кикс'] },
  { name: 'Teboil', aliases: ['тебойл'] },
  { name: 'Petro-Canada', aliases: ['петро канада'] },
  { name: 'Addinol', aliases: ['аддинол'] },
  { name: 'Totachi', aliases: ['тотачи'] },
  { name: 'Hi-Gear', aliases: ['хай гир'] },
  { name: "Wynn's", aliases: ['винс'] },
  // Тормоза
  { name: 'TRW', aliases: ['трв'] },
  { name: 'Brembo', aliases: ['брембо'] },
  { name: 'ATE', aliases: ['ате'] },
  { name: 'Ferodo', aliases: ['феродо'] },
  { name: 'Textar', aliases: ['текстар'] },
  { name: 'Sangsin', aliases: ['сангсин', 'hi-q'] },
  { name: 'Nisshinbo', aliases: ['ниссинбо', 'нисшинбо'] },
  { name: 'Akebono', aliases: ['акебоно'] },
  { name: 'Jurid', aliases: ['юрид'] },
  { name: 'Pagid', aliases: ['пагид'] },
  { name: 'Remsa', aliases: ['ремса'] },
  { name: 'Mintex', aliases: ['минтекс'] },
  { name: 'Zimmermann', aliases: ['циммерман'] },
  { name: 'EBC Brakes', aliases: ['ebc'] },
  { name: 'Allied Nippon', aliases: ['аллайд ниппон'] },
  // Подвеска и рулевое
  { name: 'Sachs', aliases: ['сакс', 'закс'] },
  { name: 'KYB', aliases: ['kayaba', 'кайаба', 'каяба', 'кyb'] },
  { name: 'Monroe', aliases: ['монро'] },
  { name: 'Bilstein', aliases: ['бильштайн', 'бильштейн'] },
  { name: 'Lemförder', aliases: ['lemforder', 'лемфордер'] },
  { name: 'Febi', aliases: ['феби', 'febi bilstein'] },
  { name: 'SWAG', aliases: ['сваг'] },
  { name: 'Meyle', aliases: ['мейле', 'майле'] },
  { name: 'Ruville', aliases: ['рувиль'] },
  { name: 'Moog', aliases: ['муг'] },
  { name: 'CTR', aliases: ['цтр'] },
  { name: '555', aliases: ['sankei'] },
  { name: 'Boge', aliases: ['боге'] },
  { name: 'Sidem', aliases: ['сидем'] },
  { name: 'Tokico', aliases: ['токико'] },
  { name: 'Kilen', aliases: ['килен'] },
  { name: 'Lesjöfors', aliases: ['lesjofors'] },
  { name: 'Fenox', aliases: ['фенокс'] },
  { name: 'Optimal', aliases: ['оптимал'] },
  { name: 'Febest', aliases: ['фебест'] },
  { name: 'JP Group', aliases: ['jpgroup'] },
  { name: 'LYNXauto', aliases: ['lynx', 'линкс'] },
  // Уплотнения, подшипники, ГРМ, сцепление
  { name: 'Corteco', aliases: ['кортеко'] },
  { name: 'Elring', aliases: ['эльринг'] },
  { name: 'Victor Reinz', aliases: ['reinz', 'виктор райнц'] },
  { name: 'Gates', aliases: ['гейтс'] },
  { name: 'Contitech', aliases: ['контитех'] },
  { name: 'Dayco', aliases: ['дайко', 'дейко'] },
  { name: 'INA', aliases: ['ина'] },
  { name: 'SKF', aliases: ['скф'] },
  { name: 'FAG', aliases: ['фаг'] },
  { name: 'LuK', aliases: ['лук'] },
  { name: 'Exedy', aliases: ['экседи'] },
  { name: 'Aisin', aliases: ['айсин'] },
  { name: 'Koyo', aliases: ['койо'] },
  { name: 'NSK', aliases: ['нск'] },
  { name: 'NTN', aliases: ['нтн'] },
  { name: 'SNR', aliases: ['снр'] },
  { name: 'Timken', aliases: ['тимкен'] },
  { name: 'Bando', aliases: ['бандо'] },
  { name: 'Optibelt', aliases: ['оптибелт'] },
  { name: 'Mitsuboshi', aliases: ['мицубоши'] },
  { name: 'Hutchinson', aliases: ['хатчинсон'] },
  { name: 'GMB', aliases: ['гмб'] },
  { name: 'Hepu', aliases: ['хепу'] },
  { name: 'Graf', aliases: ['граф'] },
  { name: 'Dolz', aliases: ['дольз'] },
  { name: 'Airtex', aliases: ['эйртекс'] },
  { name: 'Metelli', aliases: ['метелли'] },
  // Охлаждение и выхлоп
  { name: 'Behr', aliases: ['бер'] },
  { name: 'Nissens', aliases: ['ниссенс'] },
  { name: 'NRF', aliases: ['нрф'] },
  { name: 'Luzar', aliases: ['лузар'] },
  { name: 'Walker', aliases: ['уокер'] },
  { name: 'Bosal', aliases: ['босал'] },
  // Универсальные поставщики
  { name: 'Blue Print', aliases: ['blueprint', 'блю принт'] },
  { name: 'Nipparts', aliases: ['нипартс'] },
  { name: 'Japanparts', aliases: ['джапанпартс'] },
  { name: 'Ashika', aliases: ['ашика'] },
  { name: 'Masuma', aliases: ['масума'] },
  { name: 'Stellox', aliases: ['стеллокс'] },
  { name: 'Patron', aliases: ['патрон'] },
  { name: 'Mapco', aliases: ['мапко'] },
  { name: 'OEM', aliases: ['оригинал', 'original', 'genuine'] },
  // Аккумуляторы
  { name: 'Varta', aliases: ['варта'] },
  { name: 'Tyumen Battery', aliases: ['тюменский', 'тюмень'] },
  { name: 'Aktex', aliases: ['актех', 'актекс'] },
  { name: 'Akom', aliases: ['аком'] },
  { name: 'Mutlu', aliases: ['мутлу'] },
  { name: 'Topla', aliases: ['топла'] },
  { name: 'Exide', aliases: ['эксайд'] },
  // Шины
  { name: 'Michelin', aliases: ['мишлен'] },
  { name: 'Nokian', aliases: ['нокиан'] },
  { name: 'Ikon', aliases: ['икон', 'ikon tyres'] },
  { name: 'Continental', aliases: ['континенталь'] },
  { name: 'Pirelli', aliases: ['пирелли'] },
  { name: 'Bridgestone', aliases: ['бриджстоун'] },
  { name: 'Yokohama', aliases: ['йокогама', 'йокохама'] },
  { name: 'Hankook', aliases: ['ханкук'] },
  { name: 'Kumho', aliases: ['кумхо'] },
  { name: 'Cordiant', aliases: ['кордиант'] },
  { name: 'Goodyear', aliases: ['гудиер', 'гудьир'] },
  { name: 'Dunlop', aliases: ['данлоп'] },
  { name: 'Toyo', aliases: ['тойо'] },
  { name: 'Nexen', aliases: ['нексен'] },
  { name: 'Gislaved', aliases: ['гиславед'] },
  { name: 'Matador', aliases: ['матадор'] },
  { name: 'Viatti', aliases: ['виатти'] },
  { name: 'Кама', aliases: ['kama'] },
  { name: 'Белшина', aliases: ['belshina'] },
  { name: 'Triangle', aliases: ['трайангл'] },
  { name: 'Sailun', aliases: ['сайлун'] },
]

/** Нормализация для сравнения: нижний регистр, ё → е, без пробелов, дефисов, апострофов и точек. */
function norm(s: string): string {
  return s.toLowerCase().replaceAll('ё', 'е').replace(/[\s\-'’.]/g, '')
}

const BRAND_KEYS = new Map(
  PART_BRANDS.map((b) => [norm(b.name), [norm(b.name), ...(b.aliases ?? []).map(norm)]] as const),
)

function matches(name: string, q: string): boolean {
  const key = norm(name)
  const keys = BRAND_KEYS.get(key) ?? [key]
  return keys.some((k) => k.startsWith(q))
}

/**
 * Подсказки бренда: сначала совпадения из своей истории (по убыванию частоты, при равенстве — порядок истории),
 * затем справочник по алфавиту. Совпадение — по началу имени или синонима. Пустой запрос — только история.
 */
export function suggestBrands(query: string, history: string[], limit = 8): string[] {
  const q = norm(query)

  const counts = new Map<string, { name: string; count: number; first: number }>()
  history.forEach((raw, index) => {
    const name = raw.trim()
    if (!name) return
    const key = norm(name)
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { name, count: 1, first: index })
  })

  const fromHistory = [...counts.values()]
    .filter((e) => q === '' || matches(e.name, q))
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map((e) => e.name)

  if (q === '') return fromHistory.slice(0, limit)

  const seen = new Set(fromHistory.map(norm))
  const fromCatalog = PART_BRANDS
    .filter((b) => !seen.has(norm(b.name)) && matches(b.name, q))
    .map((b) => b.name)
    .sort((a, b) => a.localeCompare(b))

  return [...fromHistory, ...fromCatalog].slice(0, limit)
}
