import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useCatalog } from '../../db/hooks'
import type { CatalogItem, ItemGroup } from '../../domain/types'
import { Badge, Icon, ListGroup, ListItem, Switch } from '../../ui'
import { ITEM_GROUP_LABELS, Page } from '../common'
import { intervalText } from './catalogItems'
import { ItemSheet } from './ItemSheet'

const GROUPS = Object.keys(ITEM_GROUP_LABELS) as ItemGroup[]

/** Шторка открыта для позиции (или для нового узла); `key` сбрасывает поля при каждом открытии. */
interface SheetState {
  key: number
  item?: CatalogItem
}

/** Каталог узлов и расходников: интервалы по умолчанию, свои позиции, скрытие встроенных из подсказок. */
export default function CatalogPage() {
  const [showHidden, setShowHidden] = useState(false)
  const items = useCatalog({ includeHidden: showHidden })
  const [sheet, setSheet] = useState<SheetState>({ key: 0 })
  const [open, setOpen] = useState(false)

  const openSheet = (item?: CatalogItem) => {
    setSheet((s) => ({ key: s.key + 1, item }))
    setOpen(true)
  }

  return (
    <Page title="Узлы и расходники" back="/more">
      <ListGroup footer="Скрытые узлы не предлагаются в записях и напоминаниях; история замен по ним остаётся.">
        <ListItem
          leading={<Icon icon={IconPlus} tone="accent" circle />}
          title="Добавить свой узел"
          onClick={() => openSheet()}
        />
        <Switch label="Показывать скрытые" checked={showHidden} onChange={setShowHidden} />
      </ListGroup>
      {items &&
        GROUPS.map((group) => {
          const rows = items.filter((i) => i.group === group)
          if (rows.length === 0) return null
          return (
            <ListGroup key={group} title={ITEM_GROUP_LABELS[group]}>
              {rows.map((i) => (
                <ListItem
                  key={i.id}
                  title={i.name}
                  subtitle={intervalText(i)}
                  trailing={i.hidden ? <Badge>скрыт</Badge> : undefined}
                  chevron
                  onClick={() => openSheet(i)}
                />
              ))}
            </ListGroup>
          )
        })}
      <ItemSheet key={sheet.key} open={open} item={sheet.item} onClose={() => setOpen(false)} />
    </Page>
  )
}
