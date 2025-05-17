import React from 'react'
import styles from './Input.module.scss'

type Props = {
  type?: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

export const Input: React.FC<Props> = (props) => {
  return (
    <input
      type={props.type || 'text'}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className={styles.input}
      placeholder={props.placeholder}
    />
  )
}
