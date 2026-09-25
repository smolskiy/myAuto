import { IconDeviceFloppy, IconEye, IconEyeOff, IconHistory, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { repos } from '../../db/repos'
import type { CatalogItem, ItemGroup } from '../../domain/types'
import { BottomSheet, Button, NumberField, Select, TextField, useToast } from '../../ui'
import { ITEM_GROUP_LABELS, useSoftDelete } from '../common'
import { failureText } from '../garage/kit'
import { saveCatalogItem } from './catalogItems'
import styles from './catalog.module.css'

const GROUPS = (Object.keys(ITEM_GROUP_LABELS) as ItemGroup[]).map((g) => ({
  value: g,
  label: ITEM_GROUP_LABELS[g],
}))

export interface ItemSheetProps {
  open: boolean
  /** Позиция каталога; нет — новый свой узел. */
  item?: CatalogItem
  onClose(): void
}

/** Шторка позиции каталога: название (у встроенных — только чтение), группа, интервалы, скрытие или удаление. */
export function ItemSheet({ open, item, onClose }: ItemSheetProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const softDelete = useSoftDelete()
  const builtin = item?.builtin ?? false
  const [name, setName] = useState(item?.name ?? '')
  const [group, setGroup] = useState<ItemGroup>(item?.group ?? 'other')
  const [km, setKm] = useState<number | undefined>(item?.defaultIntervalKm)
  const [months, setMonths] = useState<number | undefined>(item?.defaultIntervalMonths)
  const [nameError, setNameError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const act = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
      onClose()
    } catch (e) {
      toast.show({ text: failureText(e) })
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!builtin && !name.trim()) {
      setNameError('Добавьте название')
      return
    }
    const intervals = {
      defaultIntervalKm: km && km > 0 ? Math.round(km) : undefined,
      defaultIntervalMonths: months && months > 0 ? Math.round(months) : undefined,
    }
    void act(async () => {
      if (!item) await repos.catalog.create({ name: name.trim(), group, builtin: false, ...intervals })
      else await saveCatalogItem(item, { ...(builtin ? {} : { name: name.trim() }), group, ...intervals })
    })
  }

  const setHidden = (hidden: boolean) => {
    if (!item) return
    void act(async () => {
      await saveCatalogItem(item, { hidden })
      if (hidden) {
        toast.show({
          text: 'Узел скрыт из подсказок',
          action: {
            label: 'Отменить',
            onClick: () => {
              saveCatalogItem(item, { hidden: false }).catch((e: unknown) =>
                toast.show({ text: failureText(e) }),
              )
            },
          },
        })
      }
    })
  }

  const remove = () => {
    if (!item) return
    onClose()
    void softDelete({
      remove: () => repos.catalog.remove(item.id),
      restore: () => repos.catalog.restore(item.id),
      text: 'Узел удалён',
    })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={item ? item.name : 'Новый узел'}
      footer={
        <Button block icon={<IconDeviceFloppy />} loading={busy} onClick={save}>
          Сохранить
        </Button>
      }
    >
      <div className={styles.form}>
        <TextField
          label="Название"
          required={!builtin}
          readOnly={builtin}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (nameError) setNameError(undefined)
          }}
          hint={builtin ? 'Встроенный узел — название не меняется' : undefined}
          error={nameError}
          autoComplete="off"
        />
        <Select label="Группа" value={group} options={GROUPS} onChange={setGroup} />
        <div className={styles.pair}>
          <NumberField
            label="Интервал по пробегу"
            value={km}
            onChange={setKm}
            unit="км"
            decimals={0}
            min={0}
          />
          <NumberField
            label="Интервал по времени"
            value={months}
            onChange={setMonths}
            unit="мес."
            decimals={0}
            min={0}
          />
        </div>
        <p className={styles.note}>Интервал предлагается, когда вы заводите напоминание по этому узлу.</p>
        {item && (
          <div className={styles.actions}>
            <Button
              variant="secondary"
              block
              icon={<IconHistory />}
              onClick={() => {
                onClose()
                void navigate(`/items/${item.id}`)
              }}
            >
              История замен
            </Button>
            {builtin ? (
              item.hidden ? (
                <Button variant="secondary" block icon={<IconEye />} onClick={() => setHidden(false)}>
                  Вернуть в подсказки
                </Button>
              ) : (
                <Button variant="secondary" block icon={<IconEyeOff />} onClick={() => setHidden(true)}>
                  Скрыть из подсказок
                </Button>
              )
            ) : (
              <Button variant="danger" block icon={<IconTrash />} onClick={remove}>
                Удалить
              </Button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
