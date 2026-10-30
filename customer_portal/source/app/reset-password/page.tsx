'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const hash = window.location.hash
    const hashParams = new URLSearchParams(hash ? hash.substring(1) : '')
    const accessToken = hashParams.get('access_token')
    const code = searchParams.get('code')

    if (accessToken) {
      setReady(true)
      return
    }

    if (code) {
      const supabase = createClient()
      // @supabase/ssr v0.10.x auto-exchanges PKCE code during client init,
      // so we check for an existing session first to avoid double-exchange.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true)
          return
        }
        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
          if (error) {
            setError('Reset link is invalid or has expired. Please request a new one.')
            return
          }
          setReady(true)
        })
      })
      return
    }

    setError('Invalid or missing reset token. Please request a new password reset link.')
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      await supabase.auth.signOut()
      router.push('/login?reset=success')
    }
    setLoading(false)
  }

  if (!ready) {
    return error ? (
      <div className="space-y-3">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push('/login')}
        >
          Back to Sign In
        </Button>
      </div>
    ) : (
      <p className="text-sm text-gray-500">Verifying reset link...</p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="Re-enter password"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Updating...' : 'Update Password'}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Reset Password</CardTitle>
          <p className="text-sm text-gray-500">Enter your new password</p>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-gray-500">Loading...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
