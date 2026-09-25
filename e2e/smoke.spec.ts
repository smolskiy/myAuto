import { expect, test, type Page } from '@playwright/test'

/**
 * Машина прямо в базе приложения: онбординг (волна 2b) ещё не умеет её добавлять. Базу создаёт само приложение
 * (Dexie, схема и версия) — ждём её появления, потом кладём строку и перезагружаем, чтобы живые запросы её увидели.
 */
async function seedVehicle(page: Page) {
  await page.goto('./#/settings') // настройки открываются и без машин — без редиректа
  await page.waitForFunction(async () => (await indexedDB.databases()).some((d) => d.name === 'myauto'))
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('myauto')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('vehicles', 'readwrite')
          tx.objectStore('vehicles').put({
            id: 'e2e-vehicle',
            createdAt: 1,
            updatedAt: 1,
            name: 'Октавия',
            make: 'Skoda',
            model: 'Octavia',
            archived: false,
            fluids: [],
            order: 0,
          })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
}

test('первый запуск: чистый профиль попадает на онбординг', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toHaveCount(0)
})

test('с машиной: главная открывается и нижняя панель ведёт в журнал и обратно', async ({ page }) => {
  await seedVehicle(page)
  await page.goto('./')
  await page.reload()
  const tabs = page.getByRole('navigation', { name: 'Основная навигация' })
  // Заголовок главной — название приложения; экран узнаём по адресу, вкладке панели и заголовку вкладки.
  const expectHome = async () => {
    // Корень без хеша (первый заход) и `#/` (после перехода по панели) — один и тот же маршрут `/`.
    await expect(page).toHaveURL(/\/(#\/)?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Мой авто' })).toBeVisible()
    await expect(tabs.getByRole('link', { name: 'Главная' })).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveTitle('Главная — Мой авто')
  }
  await expectHome()
  await tabs.getByRole('link', { name: 'Журнал' }).click()
  await expect(page).toHaveURL(/#\/journal$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Журнал' })).toBeVisible()
  await tabs.getByRole('link', { name: 'Главная' }).click()
  await expectHome()
})

test('глубокая ссылка открывается напрямую', async ({ page }) => {
  // Настройки открываются и без машин (синхронизация, загрузка копии) — редиректа нет.
  await page.goto('./#/settings/sync')
  await expect(page.getByRole('heading', { level: 1, name: 'Синхронизация' })).toBeVisible()
})
