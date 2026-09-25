import type { InputHTMLAttributes, ReactNode } from 'react'
import { Field } from '../Field/Field'
import { InputBox } from '../Field/InputBox'

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  error?: string
}

export function TextField({ label, hint, error, required, type = 'text', ...rest }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <InputBox {...rest} type={type} />
    </Field>
  )
}
