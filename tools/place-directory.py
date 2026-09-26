"""
Справочник СТО и АЗС по городам: сырые выгрузки поиска Яндекс Карт → `src/domain/directory/<город>.json`.

Сырая выгрузка — JSON-массив организаций, собранный со страниц поиска Яндекс Карт («автосервис», «шиномонтаж»,
«кузовной ремонт», «автоэлектрик», «АЗС», «АГЗС», «заправка») по окну города: {id, t: название, a: адрес,
loc: населённый пункт, p: телефоны, c: рубрики, r: рейтинг, rc: число оценок, s: seoname, ch: сеть}. В справочник
идут открытые организации города с рубрикой ремонта, шин или заправки; популярные (по числу оценок) — первыми.
Заправка сети называется сетью («EcoOil» → «Eco Oil»): так её узнают и так она сходится с подсказкой сети.

    python tools/place-directory.py 2026-09-26 <выгрузка СТО.json> <выгрузка АЗС.json> ...
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
FUEL = {'азс', 'агнс, агзс, агнкс'}

# Имя сети у Яндекса → как её пишут сами (и как в `domain/fuelBrands.ts`).
CHAIN_NAMES = {'Атан': 'АТАН'}


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


def kind_of(cats: list[str]) -> str | None:
    """'f' — заправка, 't' — шины, 's' — СТО; главная рубрика — первая."""
    first = cats[0] if cats else ''
    if first in FUEL:
        return 'f'
    if first in TIRES:
        return 't'
    if any(c in REPAIR or c in TIRES for c in cats):
        return 's'
    if any(c in FUEL for c in cats):
        return 'f'
    return None


def main(updated: str, raw_paths: list[str]) -> None:
    raw = {}
    for path in raw_paths:
        for org in json.loads(Path(path).read_text(encoding='utf-8')):
            raw[org['id']] = org
    OUT.mkdir(parents=True, exist_ok=True)
    for key, city in CITIES.items():
        rows = {}
        for org in raw.values():
            cats = [c.lower() for c in org.get('c') or []]
            kind = kind_of(cats)
            if org.get('loc') != city or kind is None:
                continue
            chain = org.get('ch')
            name = re.sub(r'\s+', ' ', CHAIN_NAMES.get(chain, chain) if kind == 'f' and chain else org['t']).strip()
            address = clean_address(org.get('a', ''), city)
            row = [name, address, phones(org), kind, org['id'], org.get('s') or '']
            dup = (name.lower(), address.lower())
            if dup not in rows or (org.get('rc') or 0) > rows[dup][0]:
                rows[dup] = (org.get('rc') or 0, row)
        places = [row for _, row in sorted(rows.values(), key=lambda x: (-x[0], x[1][0]))]
        data = {'city': city, 'updated': updated, 'source': 'Яндекс Карты', 'places': places}
        path = OUT / f'{key}.json'
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
        tires = sum(1 for p in places if p[3] == 't')
        fuel = sum(1 for p in places if p[3] == 'f')
        print(f'{key}: {len(places)} ({tires} шины, {fuel} АЗС), {path.stat().st_size // 1024} КБ')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
