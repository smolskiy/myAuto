import { describe, expect, test } from 'vitest'
import { mapsHref, placeUrl, telHref } from './links'

describe('placeUrl', () => {
  test('без схемы — https://', () => {
    expect(placeUrl('exist.ru/cart')).toBe('https://exist.ru/cart')
    expect(placeUrl('  sto-na-lesnoy.ru  ')).toBe('https://sto-na-lesnoy.ru')
    expect(placeUrl('exist.ru:8080/cart')).toBe('https://exist.ru:8080/cart')
  })

  test('http и https — как есть', () => {
    expect(placeUrl('http://sto.ru')).toBe('http://sto.ru')
    expect(placeUrl('HTTPS://Sto.ru/x')).toBe('HTTPS://Sto.ru/x')
  })

  test('другие схемы — без ссылки', () => {
    expect(placeUrl('javascript:alert(1)')).toBeUndefined()
    expect(placeUrl('JavaScript://%0aalert(1)')).toBeUndefined()
    expect(placeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(placeUrl('file:///C:/Windows')).toBeUndefined()
    expect(placeUrl('mailto:sto@example.ru')).toBeUndefined()
    expect(placeUrl('vbscript:msgbox')).toBeUndefined()
  })

  test('пусто — без ссылки', () => {
    expect(placeUrl(undefined)).toBeUndefined()
    expect(placeUrl('   ')).toBeUndefined()
  })
})

test('mapsHref: чужая схема в ссылке места — поиск адреса на Картах', () => {
  expect(mapsHref('Лесная, 5', 'javascript:alert(1)')).toBe(
    `https://yandex.ru/maps/?text=${encodeURIComponent('Лесная, 5')}`,
  )
  expect(mapsHref('Лесная, 5', 'sto.ru')).toBe('https://sto.ru')
})

test('telHref: только цифры и «+»', () => {
  expect(telHref('+7 (495) 123-45-67')).toBe('tel:+74951234567')
  expect(telHref('')).toBeUndefined()
})
