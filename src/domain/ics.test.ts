import { expect, test } from 'vitest'
import { buildIcs } from './ics'

test('событие на весь день с напоминанием за день', () => {
  const ics = buildIcs(
    [
      {
        uid: 'r1',
        title: 'Замена масла; Octavia, прогноз',
        date: '2026-10-19',
        description: 'Строка 1\nСтрока 2',
      },
    ],
    new Date(Date.UTC(2026, 8, 25, 10, 0, 0)),
  )
  const lines = ics.split('\r\n')
  expect(lines[0]).toBe('BEGIN:VCALENDAR')
  expect(lines).toContain('VERSION:2.0')
  expect(lines).toContain('PRODID:-//myAuto//RU')
  expect(lines).toContain('UID:r1@myauto')
  expect(lines).toContain('DTSTAMP:20260925T100000Z')
  expect(lines).toContain('DTSTART;VALUE=DATE:20261019')
  expect(lines).toContain('DTEND;VALUE=DATE:20261020')
  expect(lines).toContain('SUMMARY:Замена масла\\; Octavia\\, прогноз')
  expect(lines).toContain('DESCRIPTION:Строка 1\\nСтрока 2')
  expect(lines).toContain('TRIGGER:-P1D')
  expect(lines.at(-2)).toBe('END:VCALENDAR')
  expect(lines.at(-1)).toBe('')
})

test('длинные строки сворачиваются по 75 байт UTF-8', () => {
  const ics = buildIcs([{ uid: 'x', title: 'Ж'.repeat(100), date: '2026-10-19' }])
  for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  expect(ics).toContain('\r\n ')
})
