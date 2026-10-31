'use client'
import messages from '../../messages/fa.json' with { type: 'json' }
import './(public)/globals.css'
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <main className="shell notice">
          <h1>{messages.common.error}</h1>
          <button type="button" className="primary" onClick={reset}>
            {messages.common.retry}
          </button>
        </main>
      </body>
    </html>
  )
}
