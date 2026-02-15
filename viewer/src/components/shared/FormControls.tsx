export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-gray-100">{title}</h2>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

export function FieldLabel({
  label,
  description,
  htmlFor,
}: {
  label: string;
  description: string;
  htmlFor?: string;
}) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-300">
        {label}
      </label>
      <p className="text-[12px] text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-indigo-500" : "bg-gray-700"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span
        className={`inline-block size-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
          checked ? "translate-x-5.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function SelectField({
  value,
  options,
  onChange,
  disabled,
  allowEmpty,
  id,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {allowEmpty && <option value="">未設定</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function NumberField({
  value,
  onChange,
  disabled,
  min,
  max,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      min={min}
      max={max}
      className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

export function TextField({
  value,
  onChange,
  disabled,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

export function CheckboxGroup({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: { value: string; desc: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (val: string) => {
    if (disabled) return;
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };
  return (
    <div className="space-y-1.5">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
            selected.includes(o.value)
              ? "border-indigo-500/40 bg-indigo-500/10"
              : "border-gray-700/30 bg-gray-800/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-800/80"}`}
        >
          <input
            type="checkbox"
            checked={selected.includes(o.value)}
            onChange={() => toggle(o.value)}
            disabled={disabled}
            className="accent-indigo-500"
          />
          <div>
            <span className="text-sm text-gray-200 font-medium">{o.value}</span>
            <span className="text-xs text-gray-500 ml-2">{o.desc}</span>
          </div>
        </label>
      ))}
    </div>
  );
}

export function SourceCard({
  title,
  description,
  enabled,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          <p className="text-[12px] text-gray-500">{description}</p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} disabled={disabled} />
      </div>
      {children}
    </div>
  );
}
