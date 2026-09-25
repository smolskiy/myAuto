import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <section>
      <h1>Страница не найдена</h1>
      <Link to="/">На главную</Link>
    </section>
  )
}
