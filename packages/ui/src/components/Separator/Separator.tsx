import styles from './Separator.scss'
import cn from 'classnames'

export namespace Separator {
  export type Props = {
    size: 'small' | 'medium' | 'large'
  }
}

export const Separator: React.FC<Separator.Props> = (props) => {
  return (
    <div
      className={cn({
        [styles['separator--small']]: props.size == 'small',
        [styles['separator--medium']]: props.size == 'medium',
        [styles['separator--large']]: props.size == 'large'
      })}
    />
  )
}
