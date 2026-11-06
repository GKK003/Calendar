import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, configured } from './supabase.js'
import Auth from './Auth.jsx'
import Setup from './Setup.jsx'
import Calendar from './Calendar.jsx'

function StatusCard({ title, message, onRetry }) {
  return (
    <div className="center">
      <div className="card narrow" role="alert">
        <h1>{title}</h1>
        <p className="muted">{message}</p>
        <button className="btn primary" onClick={onRetry}>Try again</button>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [authError, setAuthError] = useState('')
  const [profileError, setProfileError] = useState('')
  const profileRequest = useRef(0)

  useEffect(() => {
    if (!configured) return undefined
    let active = true
    let authChanged = false
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authChanged = true
      profileRequest.current += 1
      setAuthError('')
      setSession(nextSession)
    })
    supabase.auth.getSession().then(({ data: result, error }) => {
      if (!active || authChanged) return
      if (error) setAuthError(error.message)
      else setSession(result.session)
    }).catch((error) => {
      if (active && !authChanged) setAuthError(error.message || 'Could not restore your session.')
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const loadProfile = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) return
    const request = ++profileRequest.current
    setProfile((current) => current?.member?.user_id === userId ? current : undefined)
    setProfileError('')
    try {
      const { data: member, error: memberError } = await supabase
        .from('members').select('*').eq('user_id', userId).maybeSingle()
      if (request !== profileRequest.current) return
      if (memberError) throw memberError
      if (!member) {
        setProfile(null)
        return
      }
      const { data: space, error: spaceError } = await supabase
        .from('spaces').select('*').eq('id', member.space_id).single()
      if (request !== profileRequest.current) return
      if (spaceError) throw spaceError
      setProfile({ member, space })
    } catch (error) {
      if (request !== profileRequest.current) return
      setProfileError(error.message || 'Could not load your calendar. Check your connection and try again.')
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (session) {
      loadProfile()
    } else {
      profileRequest.current += 1
      setProfile(undefined)
      setProfileError('')
    }
  }, [session?.user?.id, loadProfile])

  async function retryAuth() {
    setAuthError('')
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      setSession(data.session)
    } catch (error) {
      setAuthError(error.message || 'Could not restore your session.')
    }
  }

  if (!configured) {
    return (
      <div className="center">
        <div className="card narrow">
          <h1>Almost there</h1>
          <p className="muted">Create a file named <code>.env</code> next to <code>package.json</code> with your Supabase URL and anon key (see <code>.env.example</code>), then restart <code>npm run dev</code>.</p>
        </div>
      </div>
    )
  }
  if (authError) return <StatusCard title="Can't connect" message={authError} onRetry={retryAuth} />
  if (profileError) return <StatusCard title="Couldn't load your calendar" message={profileError} onRetry={loadProfile} />
  if (session === undefined || (session && profile === undefined)) return <div className="center muted" role="status">Loading your calendar…</div>
  if (!session) return <Auth />
  if (!profile) return <Setup onDone={loadProfile} />
  return <Calendar session={session} member={profile.member} space={profile.space} onProfileChange={loadProfile} />
}
