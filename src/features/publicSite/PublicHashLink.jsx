import { Link } from 'react-router-dom'
import { getSmoothHashState } from './hashNavigation'

export default function PublicHashLink({ state, ...props }) {
  return <Link {...props} state={getSmoothHashState(state)} />
}
