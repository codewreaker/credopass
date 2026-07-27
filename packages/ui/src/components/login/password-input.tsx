import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '../input'
import { cn } from '../../lib/utils'

export type PasswordInputProps = React.ComponentProps<typeof Input>

/**
 * A password field with a reveal toggle.
 *
 * The toggle is `aria-pressed` rather than a checkbox so screen readers
 * announce the state, and it is excluded from the tab order's happy path by
 * sitting after the input — tabbing from the field goes to the next field, not
 * to the eye.
 *
 * Revealing flips `type` to `text`, which browsers refuse to autofill or offer
 * to save. That is the correct trade: the person asked to see what they typed.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [revealed, setRevealed] = React.useState(false)
    const Icon = revealed ? EyeOff : Eye

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={revealed ? 'text' : 'password'}
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          title={revealed ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
        >
          <Icon size={15} />
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'

export default PasswordInput
