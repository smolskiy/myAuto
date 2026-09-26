import { describe, expect, test } from 'vitest'
import {
  directoryCityName,
  isDirectoryCity,
  isKnownPlace,
  parseDirectory,
  placeFromDirectory,
  searchDirectory,
  type DirectoryFile,
} from './placeDirectory'

const FILE: DirectoryFile = {
  city: 'Ростов-на-Дону',
  updated: '2026-09-26',
  source: 'Яндекс Карты',
  places: [
    ['ПихтинАвто', 'ул. Нансена, 156А', '+7 (863) 200-77-88', 's', '61146006378', 'pikhtinavto'],
    [
      'Шинный Дом',
      'ул. Нансена, 219',
      '+7 (928) 104-20-20; +7 (928) 610-83-00',
      't',
      '61932704143',
      'shinny_dom',
    ],
    ['Ёлка-Сервис', 'Ёлочная ул., 1', '', 's', '42', ''],
    ['Автосервис', '', '+7 (900) 000-00-00', 's', '43', 'avtoservis'],
    ['Роснефть', 'Привокзальная площадь, 3', '8 (800) 775-75-88', 'f', '1023684618', 'rosneft'],
  ],
}

describe('parseDirectory', () => {
  test('строки файла → места: телефоны списком, вид, ссылка на карточку Яндекс Карт', () => {
    const [first, second, third] = parseDirectory(FILE)
    expect(first).toEqual({
      id: '61146006378',
      name: 'ПихтинАвто',
      address: 'ул. Нансена, 156А',
      phones: ['+7 (863) 200-77-88'],
      kind: 'service',
      url: 'https://yandex.ru/maps/org/pikhtinavto/61146006378/',
    })
    expect(second?.kind).toBe('tire')
    expect(second?.phones).toEqual(['+7 (928) 104-20-20', '+7 (928) 610-83-00'])
    // Без телефона — пустой список; без seoname ссылка всё равно ведёт на организацию.
    expect(third?.phones).toEqual([])
    expect(third?.url).toBe('https://yandex.ru/maps/org/org/42/')
  })
})

describe('searchDirectory', () => {
  const places = parseDirectory(FILE)

  test('каждое слово — в названии или адресе, в любом порядке; регистр и «ё» не важны', () => {
    expect(searchDirectory(places, 'нансена').map((p) => p.name)).toEqual(['ПихтинАвто', 'Шинный Дом'])
    expect(searchDirectory(places, '219 нансена').map((p) => p.name)).toEqual(['Шинный Дом'])
    expect(searchDirectory(places, 'елка').map((p) => p.name)).toEqual(['Ёлка-Сервис'])
  })

  test('совпадение в названии — выше совпадения только в адресе', () => {
    const list = parseDirectory({
      ...FILE,
      places: [
        ['Гараж', 'ул. Шинная, 1', '', 's', '1', ''],
        ['Шинный центр', 'ул. Садовая, 2', '', 't', '2', ''],
      ],
    })
    expect(searchDirectory(list, 'шин').map((p) => p.name)).toEqual(['Шинный центр', 'Гараж'])
  })

  test('пустой запрос — всё в порядке файла; `limit` обрезает', () => {
    expect(searchDirectory(places, '  ')).toHaveLength(5)
    expect(searchDirectory(places, '', 2).map((p) => p.name)).toEqual(['ПихтинАвто', 'Шинный Дом'])
  })

  test('вид: только шины, только АЗС', () => {
    expect(searchDirectory(places, '', undefined, 'tire').map((p) => p.name)).toEqual(['Шинный Дом'])
    expect(searchDirectory(places, '', undefined, 'fuel').map((p) => p.name)).toEqual(['Роснефть'])
  })
})

describe('isKnownPlace', () => {
  const [pikhtin] = parseDirectory(FILE)

  test('своё место с той же ссылкой или тем же названием и адресом — уже есть', () => {
    expect(
      isKnownPlace(pikhtin!, [
        { name: 'Другое', url: 'https://yandex.ru/maps/org/pikhtinavto/61146006378/' },
      ]),
    ).toBe(true)
    expect(isKnownPlace(pikhtin!, [{ name: 'пихтинавто ', address: 'ул. Нансена, 156А' }])).toBe(true)
  })

  test('то же название по другому адресу — другое место', () => {
    expect(isKnownPlace(pikhtin!, [{ name: 'ПихтинАвто', address: 'ул. Малиновского, 13А/1' }])).toBe(false)
  })
})

describe('placeFromDirectory', () => {
  const [pikhtin, shinny, , noAddress] = parseDirectory(FILE)

  test('черновик своего места: название, адрес, первый телефон, ссылка, вид справочника', () => {
    expect(placeFromDirectory(pikhtin!)).toEqual({
      kind: 'service',
      name: 'ПихтинАвто',
      address: 'ул. Нансена, 156А',
      phone: '+7 (863) 200-77-88',
      url: 'https://yandex.ru/maps/org/pikhtinavto/61146006378/',
    })
    expect(placeFromDirectory(shinny!).kind).toBe('tire')
  })

  test('вид места можно задать; пустой адрес — без адреса', () => {
    expect(placeFromDirectory(shinny!, 'service').kind).toBe('service')
    expect(placeFromDirectory(noAddress!).address).toBeUndefined()
  })
})

describe('города', () => {
  test('id города и его название', () => {
    expect(isDirectoryCity('rostov')).toBe(true)
    expect(isDirectoryCity('moscow')).toBe(false)
    expect(isDirectoryCity(null)).toBe(false)
    expect(directoryCityName('evpatoria')).toBe('Евпатория')
  })
})
