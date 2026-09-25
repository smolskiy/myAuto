/** Уход со страницы приложения на чужой адрес (вход в Яндекс). Отдельный модуль — чтобы тесты могли его подменить. */
export function goToUrl(url: string): void {
  window.location.assign(url)
}
