import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@credopass/ui/components/card'

export function AuthCardShell({ children }: { children: ReactNode }) {
  return (
    <Card className="glass gradient-border relative w-full max-w-md border-white/5 shadow-2xl shadow-black/40">
      <CardHeader className="items-center gap-2 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <span className="text-lg font-semibold">C</span>
        </div>
        <CardTitle className="text-xl">Welcome to Credopass</CardTitle>
        <CardDescription>
          Sign in to your account, or continue as a guest
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
