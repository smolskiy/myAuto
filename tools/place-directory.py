"""
Справочник СТО по городам: сырая выгрузка поиска Яндекс Карт → `src/domain/directory/<город>.json`.

Сырая выгрузка — JSON-массив организаций, собранный со страниц поиска Яндекс Карт («автосервис», «шиномонтаж»,
«кузовной ремонт», «автоэлектрик») по окну города: {id, t: название, a: адрес, loc: населённый пункт,
p: телефоны, c: рубрики, r: рейтинг, rc: число оценок, s: seoname}. В справочник идут открытые организации
города с рубрикой ремонта или шин; популярные (по числу оценок) — первыми.

    python tools/place-directory.py <сырая выгрузка.json> 2026-09-26
"""

import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'src' / 'domain' / 'directory'

CITIES = {
    'rostov': 'Ростов-на-Дону',
    'evpatoria': 'Евпатория',
}

# Рубрики Яндекса, с которыми организация — СТО или шины.
REPAIR = {
    'автосервис, автотехцентр', 'кузовной ремонт', 'ремонт двигателей', 'автодиагностика', 'покраска автомобилей',
    'автокондиционеры', 'заправка автокондиционеров', 'ремонт акпп', 'ремонт мкпп', 'экспресс-пункт замены масла',
    'ремонт автоэлектрики', 'развал-схождение', 'ремонт грузовых автомобилей', 'установка гбо',
    'ремонт стартеров и генераторов', 'ремонт выхлопных систем', 'ремонт электрооборудования', 'автосвет',
    'ремонт турбин', 'ремонт карданных валов', 'антикоррозийная обработка', 'ремонт рулевых реек',
    'ремонт климатических систем',
}
TIRES = {'шиномонтаж', 'шины и диски'}


def clean_address(address: str, city: str) -> str:
    a = re.sub(r'\s+', ' ', address or '').strip()
    a = re.sub(rf',\s*{re.escape(city)}$', '', a)
    # «Республика Крым, Евпатория, Товарная улица» → «Товарная улица».
    a = re.sub(rf'^(?:[^,]*,\s*)*?{re.escape(city)},\s*', '', a)
    # Точного адреса нет — только регион.
    return '' if a in (city, 'Республика Крым', 'Ростовская область') else a


def phones(org: dict) -> str:
    seen = []
    for p in org.get('p') or []:
        if p not in seen:
            seen.append(p)
    return '; '.join(seen[:2])


def main(raw_path: str, updated: str) -> None:
    raw = json.loads(Path(raw_path).read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    for key, city in CITIES.items():
        rows = {}
        for org in raw:
            cats = [c.lower() for c in org.get('c') or []]
            if org.get('loc') != city or not any(c in REPAIR or c in TIRES for c in cats):
                continue
            name = re.sub(r'\s+', ' ', org['t']).strip()
            address = clean_address(org.get('a', ''), city)
            kind = 't' if cats and cats[0] in TIRES else 's'
            row = [name, address, phones(org), kind, org['id'], org.get('s') or '']
            dup = (name.lower(), address.lower())
            if dup not in rows or (org.get('rc') or 0) > rows[dup][0]:
                rows[dup] = (org.get('rc') or 0, row)
        places = [row for _, row in sorted(rows.values(), key=lambda x: (-x[0], x[1][0]))]
        data = {'city': city, 'updated': updated, 'source': 'Яндекс Карты', 'places': places}
        path = OUT / f'{key}.json'
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
        tires = sum(1 for p in places if p[3] == 't')
        print(f'{key}: {len(places)} ({tires} шины), {path.stat().st_size // 1024} КБ')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
