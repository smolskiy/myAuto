import { IconDeviceFloppy } from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { AppBar, Button, useToast } from '../../ui'
import { SAVE_FAILED, userMessage } from './errors'
import { useFormMode } from './formMode'
import styles from './FormPage.module.css'
import pageStyles from './Page.module.css'
import { useGoBack } from './useGoBack'

export interface FormPageProps {
  title: string
  /**
   * Проверяет и сохраняет. Итог:
   * - ничего (void) — сохранено, форма закрывается «назад»;
   * - путь — сохранено, форма заменяется этим экраном (новая запись → её карточка);
   * - `false` — не сохранено (ошибки уже показаны у полей): форма остаётся, без уведомления и перехода;
   * - исключение — не сохранено, форма остаётся; в уведомлении текст `UserError`, у любой другой ошибки —
   *   «Не получилось сохранить — попробуйте ещё раз» (сама ошибка — в консоль).
   */
  onSave(): Promise<void | string | false>
  /** По умолчанию «Сохранить». */
  saveLabel?: string
  /** Значок кнопки сохранения: по умолчанию дискета; `null` — без значка (шаг «Дальше» онбординга). */
  saveIcon?: ReactNode | null
  /** «Назад» без сохранения: сначала onCancel (выбросить вложения черновика), потом закрыть форму. */
  onCancel?(): void
  /** Без «Назад» в шапке: первому экрану первого запуска возвращаться некуда. */
  backHidden?: boolean
  /** Внешний признак занятости (например, идёт сжатие фото). */
  saving?: boolean
  children: ReactNode
}

/**
 * Каркас формы: шапка «Назад» и крупная «Сохранить» внизу, в зоне большого пальца.
 * Нижней панели при открытой форме нет на любом маршруте (оболочка прячет её по useFormMode).
 */
export function FormPage({
  title,
  onSave,
  saveLabel = 'Сохранить',
  saveIcon = <IconDeviceFloppy />,
  onCancel,
  backHidden = false,
  saving = false,
  children,
}: FormPageProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Оболочка прячет нижнюю панель на любом маршруте и ставит уведомления над кнопкой «Сохранить».
  useFormMode()

  const save = async () => {
    if (busyRef.current || saving) return
    busyRef.current = true
    setBusy(true)
    try {
      const to = await onSave()
      if (!mounted.current || to === false) return
      if (typeof to === 'string') void navigate(to, { replace: true })
      else goBack()
    } catch (e) {
      toast.show({ text: userMessage(e, SAVE_FAILED) })
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const cancel = () => {
    // Пока идёт сохранение, «Назад» молчит: иначе строка сохранится уже после ухода с формы.
    if (busyRef.current) return
    onCancel?.()
    goBack()
  }

  return (
    <>
      <AppBar title={title} onBack={backHidden ? undefined : cancel} />
      <div className={pageStyles.body}>{children}</div>
      <div className={styles.footer}>
        <Button block icon={saveIcon ?? undefined} loading={busy || saving} onClick={() => void save()}>
          {saveLabel}
        </Button>
      </div>
    </>
  )
}
