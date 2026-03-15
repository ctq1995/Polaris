/**
 * 开关组件
 */

import { type HTMLAttributes } from 'react';
import clsx from 'clsx';

interface SwitchProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** 是否选中 */
  checked?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 变化回调 */
  onChange?: (checked: boolean) => void;
}

export function Switch({ checked = false, disabled = false, onChange, className, ...props }: SwitchProps) {
  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        checked ? 'bg-primary' : 'bg-surface',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
      {...props}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}
