import { NavLink, Outlet } from 'react-router'

/** Временная оболочка волны 0. Волна 2 заменит навигацию на BottomTabBar из ui/. */
export default function AppShell() {
  return (
    <div>
      <main>
        <Outlet />
      </main>
      <nav aria-label="Основная навигация">
        <NavLink to="/">Главная</NavLink> <NavLink to="/journal">Журнал</NavLink>{' '}
        <NavLink to="/record/new/service">+</NavLink> <NavLink to="/reminders">ТО</NavLink>{' '}
        <NavLink to="/more">Ещё</NavLink>
      </nav>
    </div>
  )
}
