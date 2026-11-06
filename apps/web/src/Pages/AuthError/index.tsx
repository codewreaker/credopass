import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, ChevronDown, Check, Copy } from 'lucide-react'
import { Button } from '@credopass/ui/components/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@credopass/ui/components/collapsible'
import { cn } from '@credopass/ui/lib/utils'

/**
 * Where a sign-in that never started ends up.
 *
 * Two failures land here, and the person cannot tell them apart — nor should
 * they have to:
 *
 *   · The authorize leg refused before the browser ever left (the provider is
 *     not enabled on this Supabase project). Caught by the pre-flight in
 *     `packages/lib/src/supabase/auth.ts`; without it the browser would be
 *     sitting on a page of raw JSON on supabase.co, which we cannot style,
 *     cannot intercept and cannot put a Back button on, because it is not our
 *     origin.
 *   · The callback leg came home carrying `error_description` — consent
 *     declined, a provider outage. Read by `readAuthErrorFromUrl`.
 *
 * The headline is written for whoever hit it. The verbatim payload is one
 * disclosure away, closed by default: an operator needs `error_code` to fix
 * this, and a visitor needs to not be shown a JSON blob.
 */
export default function AuthErrorPage() {
  const { title, detail, code, status, provider, raw } = useSearch({ from: '/auth/error' })
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const details = [
    ['provider', provider],
    ['error_code', code],
    ['http_status', status != null ? String(status) : undefined],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  const payload = [
    ...details.map(([k, v]) => `${k}: ${v}`),
    ...(raw ? ['', raw] : []),
  ].join('\n')

  const copy = () => {
    navigator.clipboard?.writeText(payload).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => undefined
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-elevation-3">
          <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle size={20} />
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {title ?? 'We could not sign you in'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {detail ??
              'Something went wrong starting sign-in. Nothing was submitted and no account was changed.'}
          </p>

          {(details.length > 0 || raw) && (
            <Collapsible className="mt-5">
              <CollapsibleTrigger
                className={cn(
                  'group flex w-full items-center justify-between gap-2 rounded-2xl border border-border',
                  'bg-muted/40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em]',
                  'text-muted-foreground transition-colors hover:bg-muted/70 cursor-pointer'
                )}
              >
                Technical details
                <ChevronDown
                  size={15}
                  className="transition-transform duration-200 group-data-[panel-open]:rotate-180"
                />
              </CollapsibleTrigger>

              <CollapsibleContent keepMounted className="overflow-hidden">
                <div className="mt-2 rounded-2xl border border-border bg-muted/30 p-4">
                  {details.length > 0 && (
                    <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                      {details.map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="font-mono text-muted-foreground">{key}</dt>
                          <dd className="break-all font-mono text-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {raw && (
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-background/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                      {raw}
                    </pre>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copy}
                    className="mt-3 h-8 rounded-full text-xs"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied' : 'Copy details'}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="h-11 w-full rounded-full font-semibold"
              onClick={() => navigate({ to: '/login', search: {} })}
            >
              Try signing in again
            </Button>
            <Button
              variant="ghost"
              className="h-10 w-full rounded-full text-sm text-muted-foreground"
              onClick={() => navigate({ to: '/' })}
            >
              <ArrowLeft size={15} />
              Back to start
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          If this keeps happening, send the technical details to whoever runs your CredoPass.
        </p>
      </div>
    </div>
  )
}
