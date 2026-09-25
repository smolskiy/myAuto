/** Перезагрузка страницы — отдельным модулем, чтобы тесты могли её подменить (location.reload в jsdom не шпионится). */
export function reloadPage(): void {
  window.location.reload()
}
