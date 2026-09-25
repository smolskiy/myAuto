import { IconCopy, IconGasStation, IconReceipt, IconTool, IconTrash } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import {
  AttachmentGrid,
  Lightbox,
  LineItemRow,
  ListGroup,
  PhotoPicker,
  PullToRefresh,
  RecordRow,
  RepeatableList,
  SwipeRow,
  useToast,
  type AttachmentThumb,
} from '../../index'
import { Caption, Demo, fmt, SAMPLE_RECEIPT, Section } from '../kit'

const ROWS = [
  {
    id: 'r1',
    kind: 'fuel' as const,
    icon: <IconGasStation />,
    title: 'Заправка',
    subtitle: 'АИ-95 · Лукойл',
    amount: 2450,
    date: '9 сен',
  },
  {
    id: 'r2',
    kind: 'service' as const,
    icon: <IconTool />,
    title: 'Замена масла',
    subtitle: 'Автосервис на Ленина',
    amount: 6300,
    date: '2 сен',
  },
  {
    id: 'r3',
    kind: 'expense' as const,
    icon: <IconReceipt />,
    title: 'Парковка',
    subtitle: 'Центр',
    amount: 380,
    date: '1 сен',
  },
]

export function RichSection() {
  const toast = useToast()
  const [rows, setRows] = useState(ROWS)
  const [refreshedAt, setRefreshedAt] = useState('ещё не обновляли')
  const [items, setItems] = useState<AttachmentThumb[]>([
    { id: 'a1', url: SAMPLE_RECEIPT, kind: 'photo', name: 'чек-сервис.jpg' },
    { id: 'a2', url: null, kind: 'photo', name: 'фото-двигателя.jpg', pending: true },
    { id: 'a3', url: 'about:blank', kind: 'pdf', name: 'заказ-наряд-12345.pdf' },
  ])
  const [viewing, setViewing] = useState<AttachmentThumb | null>(null)
  const [parts, setParts] = useState([
    { id: 'p1', title: 'Масло моторное 5W-30', meta: `Castrol · 15669E · ${fmt.nb('4 л')}`, amount: 3900 },
    {
      id: 'p2',
      title: 'Масляный фильтр',
      meta: undefined as string | undefined,
      amount: undefined as number | undefined,
    },
  ])
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const remove = (id: string) => {
    const row = rows.find((r) => r.id === id)
    setRows(rows.filter((r) => r.id !== id))
    toast.show({
      text: 'Запись удалена',
      action: {
        label: 'Отменить',
        onClick: () => row && setRows((cur) => [...cur, row].sort((a, b) => a.id.localeCompare(b.id))),
      },
    })
  }

  return (
    <Section
      title="Жесты и вложения"
      lead="Свайп пальцем или мышью, «потянуть — обновить», фото и строки запчастей."
    >
      <Demo
        name="SwipeRow"
        note="Влево — удалить, вправо — повторить. С клавиатуры и для скринридера — кнопка «Действия»."
        plain
      >
        <ListGroup>
          {rows.map((r) => (
            <SwipeRow
              key={r.id}
              left={{
                label: 'Повторить',
                icon: <IconCopy />,
                tone: 'accent',
                onAction: () => toast.show({ text: `Повторить: ${r.title}` }),
              }}
              right={{ label: 'Удалить', icon: <IconTrash />, tone: 'danger', onAction: () => remove(r.id) }}
            >
              <RecordRow
                kind={r.kind}
                icon={r.icon}
                title={r.title}
                subtitle={r.subtitle}
                amount={fmt.rub(r.amount)}
                date={r.date}
              />
            </SwipeRow>
          ))}
        </ListGroup>
        {rows.length < ROWS.length && (
          <Caption>Удалённое возвращается кнопкой «Отменить» в уведомлении.</Caption>
        )}
      </Demo>

      <Demo name="PullToRefresh" note="Работает пальцем, когда страница прокручена к самому верху." plain>
        <PullToRefresh
          onRefresh={() =>
            new Promise<void>((r) =>
              setTimeout(() => {
                setRefreshedAt(
                  `обновлено в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
                )
                r()
              }, 1200),
            )
          }
        >
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface)',
            }}
          >
            <Caption>Лента журнала — {refreshedAt}</Caption>
          </div>
        </PullToRefresh>
      </Demo>

      <Demo
        name="AttachmentGrid, PhotoPicker, Lightbox"
        note="Скелетон — превью ещё грузится; «Не отправлено» — нет копии на Диске."
      >
        <AttachmentGrid
          items={items}
          onOpen={(id) => setViewing(items.find((i) => i.id === id) ?? null)}
          onRemove={(id) => setItems(items.filter((i) => i.id !== id))}
          picker={
            <PhotoPicker
              onFiles={(files) => {
                const added = files.map((f, i) => {
                  const url = URL.createObjectURL(f)
                  urls.current.push(url)
                  return {
                    id: `f-${Date.now()}-${i}`,
                    url,
                    kind: f.type === 'application/pdf' ? ('pdf' as const) : ('photo' as const),
                    name: f.name,
                    pending: true,
                  }
                })
                setItems((cur) => [...cur, ...added])
              }}
            />
          }
        />
      </Demo>

      <Demo
        name="RepeatableList и LineItemRow"
        note="Подсказка «В прошлый раз» заполняет бренд, артикул и цену одним нажатием."
        plain
      >
        <RepeatableList
          title="Запчасти"
          addLabel="Добавить запчасть"
          total={fmt.rub(parts.reduce((s, p) => s + (p.amount ?? 0), 0))}
          emptyText="Запчастей нет"
          onAdd={() =>
            setParts([
              ...parts,
              { id: `p${parts.length + 1}`, title: 'Новая запчасть', meta: undefined, amount: undefined },
            ])
          }
        >
          {parts.map((p) => (
            <LineItemRow
              key={p.id}
              title={p.title}
              meta={p.meta}
              amount={p.amount !== undefined ? fmt.rub(p.amount) : undefined}
              onEdit={() => {}}
              onRemove={() => setParts(parts.filter((x) => x.id !== p.id))}
              suggestion={
                p.id === 'p2' && !p.meta
                  ? {
                      text: `В прошлый раз: Mann W 712/95, ${fmt.rub(650)}`,
                      onApply: () =>
                        setParts(
                          parts.map((x) =>
                            x.id === 'p2'
                              ? { ...x, meta: `Mann-Filter · W 712/95 · ${fmt.nb('1 шт')}`, amount: 650 }
                              : x,
                          ),
                        ),
                    }
                  : undefined
              }
            />
          ))}
        </RepeatableList>
        <RepeatableList title="Работы" addLabel="Добавить работу" onAdd={() => {}} emptyText="Работ нет">
          {null}
        </RepeatableList>
      </Demo>

      <Lightbox
        open={viewing !== null}
        onClose={() => setViewing(null)}
        url={viewing?.url ?? null}
        name={viewing?.name ?? ''}
        kind={viewing?.kind ?? 'photo'}
        onDownload={() => {}}
      />
    </Section>
  )
}
