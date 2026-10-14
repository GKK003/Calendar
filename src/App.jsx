import { useEffect, useState } from 'react'
import { supabase, configured } from './supabase.js'
import Auth from './Auth.jsx'
import Setup from './Setup.jsx'
import Calendar from './Calendar.jsx'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined) // { member, space } | null

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  async function loadProfile() {
    const { data: member } = await supabase.from('members').select('*').eq('user_id', session.user.id).maybeSingle()
    if (!member) return setProfile(null)
    const { data: space } = await supabase.from('spaces').select('*').eq('id', member.space_id).single()
    setProfile({ member, space })
  }

  useEffect(() => {
    if (session) loadProfile()
    else setProfile(undefined)
    // eslint-disable-next-line
  }, [session?.user?.id])

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
  if (session === undefined || (session && profile === undefined)) return <div className="center muted">Loading…</div>
  if (!session) return <Auth />
  if (!profile) return <Setup onDone={loadProfile} />
  return <Calendar session={session} member={profile.member} space={profile.space} />
}
