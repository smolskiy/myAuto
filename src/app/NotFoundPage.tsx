import { IconHome, IconMapQuestion } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { Page } from '../features/common'
import { Button, EmptyState } from '../ui'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <Page title="Страница не найдена" back>
      <EmptyState
        icon={<IconMapQuestion />}
        title="Здесь ничего нет"
        text="Ссылка устарела или в ней опечатка."
        action={
          <Button icon={<IconHome />} onClick={() => void navigate('/')}>
            На главную
          </Button>
        }
      />
    </Page>
  )
}
