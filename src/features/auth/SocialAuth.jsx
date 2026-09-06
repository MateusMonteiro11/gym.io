import ActionLoading from '../../components/ui/ActionLoading'

export default function SocialAuth({ loading, disabled, onClick }) {
  return (
    <>
      <button type="button" className="auth-google" disabled={disabled} onClick={onClick}>
        {loading ? <ActionLoading label="Conectando..." /> : <>
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.652 32.657 29.359 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.079 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955c0-1.341-.138-2.651-.389-3.917z" />
                        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.967 12 24 12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.079 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                        <path fill="#4CAF50" d="M24 44c5.193 0 9.91-1.987 13.454-5.215l-6.21-5.243C29.197 35.091 26.761 36 24 36c-5.338 0-9.616-3.329-11.286-8.009l-6.522 5.025C9.499 39.556 16.227 44 24 44z" />
                        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.599 4.657-5.903 8-11.303 8-2.76 0-5.306-.995-7.286-2.652l-6.522 5.025C12.39 41.402 17.768 44 24 44c11.045 0 20-8.955 20-20 0-1.341-.138-2.651-.389-3.917z" />
                      </svg>
          Continuar com Google
        </>}
      </button>
      <div className="auth-divider"><span>ou</span></div>
    </>
  )
}
