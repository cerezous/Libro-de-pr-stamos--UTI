type AppleSwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  label: string
  className?: string
}

/** Interruptor estilo iOS (accesible: checkbox + estilos). */
export function AppleSwitch({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
  className = '',
}: AppleSwitchProps) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
    >
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-zinc-600'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </label>
  )
}
