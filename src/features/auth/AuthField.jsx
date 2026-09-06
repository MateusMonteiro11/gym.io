import Input, { Label } from '../../components/ui/Input'

export default function AuthField({ id, label, error, ...props }) {
  return (
    <div className="auth-field grid min-w-0 gap-[.45rem]">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} error={error} errorId={`${id}-error`} errorVariant="inline"
        className="auth-input" animate={false} whileFocus={undefined} {...props} />
    </div>
  )
}
