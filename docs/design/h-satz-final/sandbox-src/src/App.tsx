import { useEffect, useState } from 'react'
import { PhoneFrame } from './PhoneFrame'
import { prototypes } from './registry'
import { Index } from './Index'

function useHash(): string {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const name = useHash().replace(/^#\/?/, '')
  const proto = prototypes.find((p) => p.name === name)
  if (!proto) return <Index />
  return (
    <PhoneFrame key={proto.name}>
      <proto.Component />
    </PhoneFrame>
  )
}
