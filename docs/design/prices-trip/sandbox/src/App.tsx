import { useEffect, useState } from 'react'
import recommendation from '../../RECOMMENDATION.md?raw'
import { type Approach, approaches, steps } from './registry'
import { useTrip } from './shared/trip'
import { Icon } from './shared/ui'

const route = () => location.hash.replace(/^#\/?/, '')

export default function App() {
  const [at, setAt] = useState(route())
  useEffect(() => {
    const on = () => setAt(route())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const one = approaches.find((a) => a.slug === at)
  return (
    <div className="page">
      <nav className="switcher" aria-label="Ansätze">
        <span className="brand">Preise &amp; Einkaufssumme · 5 Ansätze</span>
        <a href="#/" aria-current={at === ''}>
          Nebeneinander
        </a>
        {approaches.map((a) => (
          <a key={a.slug} href={`#/${a.slug}`} aria-current={at === a.slug}>
            {a.n} · {a.title}
          </a>
        ))}
        <a href="#/empfehlung" aria-current={at === 'empfehlung'}>
          Empfehlung
        </a>
      </nav>
      {one ? <Single key={one.slug} a={one} /> : at === 'empfehlung' ? <Recommendation /> : <SideBySide />}
    </div>
  )
}

function Phone({ a }: { a: Approach }) {
  const trip = useTrip()
  return (
    <figure className="slot" data-slug={a.slug}>
      <figcaption>
        <span className="hxp hxp--honey">{a.n}</span>
        <span>
          <b>{a.title}</b>
          <code>{a.slug}</code>
        </span>
        <button className="hx hx--s" type="button" onClick={trip.reset} title="Szenario zurücksetzen">
          <Icon name="undo" />
          Zurücksetzen
        </button>
      </figcaption>
      <div className="phone">
        <a.Component trip={trip} />
      </div>
    </figure>
  )
}

function SideBySide() {
  return (
    <main>
      <Steps />
      <div className="row-of-phones">
        {approaches.map((a) => (
          <Phone key={a.slug} a={a} />
        ))}
      </div>
    </main>
  )
}

function Single({ a }: { a: Approach }) {
  return (
    <main className="single">
      <Phone a={a} />
      <aside className="notes">
        <h2>
          {a.n} · {a.title}
        </h2>
        <p>{a.idea}</p>
        <h3>Stärken</h3>
        <ul>{a.good.map((g) => <li key={g}>{g}</li>)}</ul>
        <h3>Schwächen und Fragen</h3>
        <ul>{a.bad.map((b) => <li key={b}>{b}</li>)}</ul>
        <Steps />
      </aside>
    </main>
  )
}

function Steps() {
  return (
    <section className="steps">
      <h3>Dasselbe Szenario in allen fünf (synthetische Lidl-Liste, kostenlos für alle, kein Premium)</h3>
      <ol>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
    </section>
  )
}

/** RECOMMENDATION.md with just enough Markdown: headings, bullets, paragraphs, **bold** and `code`. */
function Recommendation() {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
      part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
    )
  return (
    <main className="notes doc">
      {recommendation.split(/\n\n+/).map((block, i) => {
        if (block.startsWith('# ')) return <h1 key={i}>{inline(block.slice(2))}</h1>
        if (block.startsWith('## ')) return <h2 key={i}>{inline(block.slice(3))}</h2>
        if (/^(- |\d+\. )/.test(block))
          return (
            <ul key={i}>
              {block.split(/\n(?=- |\d+\. )/).map((li) => (
                <li key={li}>{inline(li.replace(/^(- |\d+\. )/, ''))}</li>
              ))}
            </ul>
          )
        return <p key={i}>{inline(block)}</p>
      })}
    </main>
  )
}
