import { lazy, Suspense, type ComponentType } from 'react'
import { createHashRouter, createMemoryRouter, type RouteObject } from 'react-router'
import AppShell from './AppShell'
import ErrorPage from './ErrorPage'
import NotFoundPage from './NotFoundPage'

export interface AppRoute {
  path: string
  title: string
  load: () => Promise<{ default: ComponentType }>
  /** Форма или полноэкранная страница: нижней панели нет, у экрана своя шапка «Назад / Сохранить». */
  hideTabBar?: boolean
}

/** `handle` маршрута — оболочка читает его через useMatches(). */
export interface RouteHandle {
  title: string
  hideTabBar?: boolean
}

export const ROUTES: AppRoute[] = [
  { path: '/', title: 'Главная', load: () => import('../features/home/HomePage') },
  { path: '/journal', title: 'Журнал', load: () => import('../features/journal/JournalPage') },
  {
    path: '/record/new/:kind',
    title: 'Новая запись',
    load: () => import('../features/records/RecordFormPage'),
    hideTabBar: true,
  },
  {
    path: '/record/:id/edit',
    title: 'Правка записи',
    load: () => import('../features/records/RecordFormPage'),
    hideTabBar: true,
  },
  { path: '/record/:id', title: 'Запись', load: () => import('../features/records/RecordPage') },
  {
    path: '/reminders',
    title: 'ТО и напоминания',
    load: () => import('../features/reminders/RemindersPage'),
  },
  {
    path: '/reminders/new',
    title: 'Новое напоминание',
    load: () => import('../features/reminders/ReminderRulePage'),
    hideTabBar: true,
  },
  {
    path: '/reminders/:id',
    title: 'Напоминание',
    load: () => import('../features/reminders/ReminderRulePage'),
    hideTabBar: true,
  },
  {
    path: '/items/:itemId',
    title: 'История узла',
    load: () => import('../features/reminders/ItemHistoryPage'),
  },
  { path: '/more', title: 'Ещё', load: () => import('../features/more/MorePage') },
  { path: '/stats', title: 'Статистика', load: () => import('../features/stats/StatsPage') },
  { path: '/garage', title: 'Гараж', load: () => import('../features/garage/GaragePage') },
  {
    path: '/vehicle/new',
    title: 'Новая машина',
    load: () => import('../features/vehicle/VehicleFormPage'),
    hideTabBar: true,
  },
  {
    path: '/vehicle/:id/edit',
    title: 'Правка машины',
    load: () => import('../features/vehicle/VehicleFormPage'),
    hideTabBar: true,
  },
  { path: '/vehicle/:id', title: 'Машина', load: () => import('../features/vehicle/VehiclePage') },
  { path: '/documents', title: 'Документы', load: () => import('../features/documents/DocumentsPage') },
  {
    path: '/documents/new',
    title: 'Новый документ',
    load: () => import('../features/documents/DocumentPage'),
    hideTabBar: true,
  },
  { path: '/documents/:id', title: 'Документ', load: () => import('../features/documents/DocumentPage') },
  { path: '/tires', title: 'Шины', load: () => import('../features/tires/TiresPage') },
  {
    path: '/tires/new',
    title: 'Новый комплект',
    load: () => import('../features/tires/TireSetPage'),
    hideTabBar: true,
  },
  { path: '/tires/:id', title: 'Комплект шин', load: () => import('../features/tires/TireSetPage') },
  { path: '/places', title: 'Места и мастера', load: () => import('../features/places/PlacesPage') },
  {
    path: '/places/new',
    title: 'Новое место',
    load: () => import('../features/places/PlacePage'),
    hideTabBar: true,
  },
  {
    path: '/places/directory',
    title: 'Справочник СТО и АЗС',
    load: () => import('../features/places/DirectoryPage'),
  },
  { path: '/places/:id', title: 'Место', load: () => import('../features/places/PlacePage') },
  {
    path: '/masters/new',
    title: 'Новый мастер',
    load: () => import('../features/places/MasterPage'),
    hideTabBar: true,
  },
  { path: '/masters/:id', title: 'Мастер', load: () => import('../features/places/MasterPage') },
  { path: '/catalog', title: 'Узлы и расходники', load: () => import('../features/catalog/CatalogPage') },
  { path: '/settings', title: 'Настройки', load: () => import('../features/settings/SettingsPage') },
  {
    path: '/settings/sync',
    title: 'Синхронизация',
    load: () => import('../features/settings/SyncSettingsPage'),
  },
  {
    path: '/settings/data',
    title: 'Данные и выгрузки',
    load: () => import('../features/settings/DataSettingsPage'),
  },
  {
    path: '/onboarding',
    title: 'Добро пожаловать',
    load: () => import('../features/onboarding/OnboardingPage'),
    hideTabBar: true,
  },
  // Витрина компонентов — только при разработке (`npm run dev`, адрес `#/showcase`): в сборке для людей
  // ни маршрута, ни ссылок, и сам код витрины в сборку не попадает (`import.meta.env.DEV` там — false).
  ...(import.meta.env.DEV
    ? [
        {
          path: '/showcase',
          title: 'Витрина компонентов',
          load: () => import('../ui/showcase/ShowcasePage'),
          // В эскизах витрины свои нижние панели — настоящая только мешала бы.
          hideTabBar: true,
        },
      ]
    : []),
]

function toRouteObject(r: AppRoute): RouteObject {
  const Page = lazy(r.load)
  const handle: RouteHandle = { title: r.title, hideTabBar: r.hideTabBar }
  return {
    path: r.path,
    element: (
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    ),
    handle,
  }
}

function routeTree(): RouteObject[] {
  return [
    {
      element: <AppShell />,
      // Любая ошибка отрисовки (и не найденный после обновления чанк) — русская страница вместо английской.
      errorElement: <ErrorPage />,
      children: [
        ...ROUTES.map(toRouteObject),
        {
          path: '*',
          element: <NotFoundPage />,
          handle: { title: 'Страница не найдена' } satisfies RouteHandle,
        },
      ],
    },
  ]
}

export function createAppRouter(opts: { initialPath?: string } = {}) {
  return opts.initialPath
    ? createMemoryRouter(routeTree(), { initialEntries: [opts.initialPath] })
    : createHashRouter(routeTree())
}
