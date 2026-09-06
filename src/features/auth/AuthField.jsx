import Input, { Label } from '../../components/ui/Input'

export default function AuthField({ id, label, error, ...props }) {
  return (
    <div className="auth-field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} error={error} errorId={`${id}-error`} errorVariant="inline"
        className="auth-input" animate={false} whileFocus={undefined} {...props} />
    </div>
  )
}
