type Props = {
  label: string
  value: string
  bad?: boolean
  unit?: string
  placeholder?: string
  title?: string
  onChange: (v: string) => void
}

/** A text field for a number, optionally with an SI suffix ("4k7"); validation lives in parseState. */
export default function ValueField({ label, value, bad, unit, placeholder, title, onChange }: Props) {
  return (
    <label className="field" title={title}>
      <span>
        {label}
        {unit ? <span className="unit"> ({unit})</span> : null}
      </span>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        className={bad ? 'bad' : undefined}
        aria-invalid={bad ?? false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
