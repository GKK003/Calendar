import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, formatDistanceToNowStrict, isAfter, parseISO } from 'date-fns'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Activity,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Crosshair,
  ExternalLink,
  History,
  Home,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Radio,
  Route,
  Shield,
  Siren,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from './supabase.js'
import Avatar from './Avatar.jsx'
import { mapHref } from './lib.js'
import './maps.css'

const DEFAULT_CENTERS = {
  tbilisi: [41.7151, 44.8271],
  nyc: [40.7128, -74.006],
}

const METERS = (latA, lonA, latB, lonB) => {
  const rad = (n) => (n * Math.PI) / 180
  const dLat = rad(latB - latA)
  const dLon = rad(lonB - lonA)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function ago(value) {
  if (!value) return 'No recent location'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'No recent location'
  return `${formatDistanceToNowStrict(date, { addSuffix: true })}`
}

function prettyDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '' : format(date, 'MMM d · h:mm a')
}

function openDirections(destination, origin) {
  const params = new URLSearchParams({ api: '1', destination })
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`)
  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer')
}

function markerIcon({ name, initials, color, kind = 'person' }) {
  const root = document.createElement('div')
  root.className = `maps-pin maps-pin-${kind}`
  root.style.setProperty('--pin-color', color)
  const badge = document.createElement('span')
  badge.className = 'maps-pin-badge'
  const face = document.createElement('span')
  face.textContent = initials
  badge.appendChild(face)
  root.appendChild(badge)
  const label = document.createElement('span')
  label.className = 'maps-pin-label'
  label.textContent = name
  root.appendChild(label)
  return L.divIcon({ html: root, className: '', iconSize: [92, 58], iconAnchor: [46, 49] })
}

function tooltip(name, detail) {
  const node = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = name
  node.appendChild(title)
  if (detail) {
    const sub = document.createElement('small')
    sub.textContent = detail
    node.appendChild(sub)
  }
  return node
}

function eventAddress(event) {
  return mapHref(event.place)
}

export default function Maps({ space, me, members, events, colorOf }) {
  const mapNode = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef(null)
  const didInitialFitRef = useRef(false)
  const placingRef = useRef(false)
  const sharingOnRef = useRef(Boolean(me.location_sharing))
  const lastWriteRef = useRef(null)
  const lastHistoryRef = useRef(null)
  const insideRef = useRef({})
  const [places, setPlaces] = useState([])
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])
  const [shareEnabled, setShareEnabled] = useState(Boolean(me.location_sharing))
  const [currentPoint, setCurrentPoint] = useState(() => me.location_sharing && me.location_lat != null
    ? { latitude: me.location_lat, longitude: me.location_lng, accuracy: me.location_accuracy, recorded_at: me.location_updated_at }
    : null)
  const [layers, setLayers] = useState({ people: true, places: true, trails: false })
  const [addingPlace, setAddingPlace] = useState(false)
  const [draft, setDraft] = useState(null)
  const [placeName, setPlaceName] = useState('')
  const [placeRadius, setPlaceRadius] = useState(150)
  const [sosOpen, setSosOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [centerPoint, setCenterPoint] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async () => {
    const [placeRes, alertRes, historyRes] = await Promise.all([
      supabase.from('family_places').select('*').eq('space_id', space.id).order('name'),
      supabase.from('family_alerts').select('*').eq('space_id', space.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('location_history').select('*').eq('space_id', space.id).order('recorded_at', { ascending: false }).limit(120),
    ])
    const errors = [placeRes.error, alertRes.error, historyRes.error].filter(Boolean)
    if (errors.length) {
      setNeedsSetup(errors.some((e) => e.code === 'PGRST205' || e.code === '42P01' || /column .* does not exist/i.test(e.message || '')))
      setError(errors[0].message || 'Could not load map data.')
      return
    }
    setNeedsSetup(false)
    setPlaces(placeRes.data || [])
    setAlerts(alertRes.data || [])
    setHistory(historyRes.data || [])
  }, [space.id])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel(`maps-${space.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_places', filter: `space_id=eq.${space.id}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_alerts', filter: `space_id=eq.${space.id}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'location_history', filter: `space_id=eq.${space.id}` }, loadData)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [space.id, loadData])

  useEffect(() => {
    setShareEnabled(Boolean(me.location_sharing))
    if (me.location_sharing && me.location_lat != null && me.location_lng != null) {
      setCurrentPoint({ latitude: me.location_lat, longitude: me.location_lng, accuracy: me.location_accuracy, recorded_at: me.location_updated_at })
    } else if (!me.location_sharing) setCurrentPoint(null)
  }, [me.location_sharing, me.location_lat, me.location_lng, me.location_accuracy, me.location_updated_at])

  useEffect(() => {
    sharingOnRef.current = shareEnabled
  }, [shareEnabled])

  useEffect(() => () => {
    if (!sharingOnRef.current) return
    supabase.from('members').update({
      location_sharing: false,
      location_lat: null,
      location_lng: null,
      location_accuracy: null,
      location_updated_at: null,
    }).eq('user_id', me.user_id)
  }, [me.user_id])

  const insertAlert = useCallback(async ({ kind, message, point = currentPoint, placeId = null }) => {
    const { data, error: saveError } = await supabase.from('family_alerts').insert({
      space_id: space.id,
      user_id: me.user_id,
      kind,
      message,
      place_id: placeId,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
    }).select().single()
    if (saveError) {
      setError(saveError.message)
      return false
    }
    setAlerts((items) => [data, ...items].slice(0, 30))
    setNotice('Shared with your circle.')
    setTimeout(() => setNotice(''), 3500)
    return true
  }, [currentPoint, me.user_id, space.id])

  const persistPosition = useCallback(async (position, { force = false, sharing = true } = {}) => {
    const point = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      recorded_at: new Date().toISOString(),
    }
    setCurrentPoint(point)
    const nowMs = Date.now()
    const last = lastWriteRef.current
    if (!force && last && nowMs - last.at < 15000 && METERS(last.latitude, last.longitude, point.latitude, point.longitude) < 30) return true

    lastWriteRef.current = { ...point, at: nowMs }
    const { error: updateError } = await supabase.from('members').update({
      location_lat: point.latitude,
      location_lng: point.longitude,
      location_accuracy: point.accuracy,
      location_updated_at: point.recorded_at,
      location_sharing: sharing,
    }).eq('user_id', me.user_id)
    if (updateError) {
      setError(updateError.message)
      if (/column .* does not exist|schema cache/i.test(updateError.message || '')) setNeedsSetup(true)
      return false
    }

    const previous = lastHistoryRef.current
    const shouldRecordHistory = force || !previous || nowMs - previous.at >= 60000 || METERS(previous.latitude, previous.longitude, point.latitude, point.longitude) >= 100
    if (shouldRecordHistory) {
      const { error: historyError } = await supabase.from('location_history').insert({
        space_id: space.id,
        user_id: me.user_id,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy,
      })
      if (historyError) {
        setNeedsSetup(/relation .* does not exist|schema cache/i.test(historyError.message || ''))
        setError(historyError.message)
      } else {
        lastHistoryRef.current = { ...point, at: nowMs }
      }
    }
    setError('')
    return true
  }, [me.user_id, space.id])

  const sharingProblem = useCallback((geoError) => {
    const messages = {
      1: 'Location permission was not granted. Allow location access in your browser settings to share your position.',
      2: 'Your location is unavailable right now. Try again when your device has a location signal.',
      3: 'Location lookup timed out. Try again.',
    }
    setError(messages[geoError?.code] || 'Your browser could not access location.')
    setBusy(false)
  }, [])

  const startSharing = useCallback(() => {
    setError('')
    if (!navigator.geolocation) {
      setError('This browser does not support location sharing.')
      return
    }
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setError('Location sharing requires HTTPS. Open the secure site on your phone.')
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(async (position) => {
      const saved = await persistPosition(position, { force: true, sharing: true })
      setBusy(false)
      if (saved) {
        setShareEnabled(true)
        setNotice('Live location sharing is on.')
        setTimeout(() => setNotice(''), 3500)
      }
    }, sharingProblem, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 })
  }, [persistPosition, sharingProblem])

  const stopSharing = useCallback(async () => {
    setBusy(true)
    setError('')
    const { error: stopError } = await supabase.from('members').update({
      location_sharing: false,
      location_lat: null,
      location_lng: null,
      location_accuracy: null,
      location_updated_at: null,
    }).eq('user_id', me.user_id)
    setBusy(false)
    if (stopError) {
      setError(stopError.message)
      return
    }
    setShareEnabled(false)
    setCurrentPoint(null)
    setNotice('Location sharing is off. Your saved activity stays in history.')
    setTimeout(() => setNotice(''), 4500)
  }, [me.user_id])

  useEffect(() => {
    if (!shareEnabled || !navigator.geolocation) return undefined
    const id = navigator.geolocation.watchPosition(
      (position) => persistPosition(position, { sharing: true }),
      sharingProblem,
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 25000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [shareEnabled, persistPosition, sharingProblem])

  useEffect(() => {
    if (!shareEnabled || !currentPoint || places.length === 0) return
    const key = `map-geofences-${space.id}-${me.user_id}`
    if (!Object.keys(insideRef.current).length) {
      try { insideRef.current = JSON.parse(localStorage.getItem(key) || '{}') } catch { insideRef.current = {} }
    }
    const next = { ...insideRef.current }
    for (const place of places) {
      const previous = insideRef.current[place.id]
      const distance = METERS(currentPoint.latitude, currentPoint.longitude, place.latitude, place.longitude)
      const inside = distance <= place.radius_m + (previous === true ? 30 : 0)
      if (previous !== undefined && previous !== inside) {
        const kind = inside ? 'place_enter' : 'place_exit'
        const message = inside ? `${me.display_name} arrived at ${place.name}` : `${me.display_name} left ${place.name}`
        insertAlert({ kind, message, point: currentPoint, placeId: place.id })
      }
      next[place.id] = inside
    }
    insideRef.current = next
    localStorage.setItem(key, JSON.stringify(next))
  }, [currentPoint, insertAlert, me.display_name, me.user_id, places, shareEnabled, space.id])

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined
    const center = DEFAULT_CENTERS[me.city] || DEFAULT_CENTERS.tbilisi
    const map = L.map(mapNode.current, { zoomControl: true, scrollWheelZoom: true }).setView(center, 13)
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map)
    const groups = {
      people: L.layerGroup().addTo(map),
      places: L.layerGroup().addTo(map),
      trails: L.layerGroup(),
    }
    mapRef.current = map
    layersRef.current = groups
    map.on('click', (event) => {
      if (!placingRef.current) return
      setDraft({ latitude: event.latlng.lat, longitude: event.latlng.lng })
      setPlaceName('')
      setAddingPlace(false)
    })
    const timeout = setTimeout(() => map.invalidateSize(), 100)
    return () => {
      clearTimeout(timeout)
      map.remove()
      mapRef.current = null
      layersRef.current = null
    }
  }, [me.city])

  useEffect(() => { placingRef.current = addingPlace }, [addingPlace])

  const visibleMembers = useMemo(() => members.map((member) => {
    if (member.user_id === me.user_id) {
      return {
        ...member,
        location_sharing: Boolean(shareEnabled && (currentPoint || me.location_sharing)),
        location_lat: shareEnabled ? (currentPoint?.latitude ?? member.location_lat) : null,
        location_lng: shareEnabled ? (currentPoint?.longitude ?? member.location_lng) : null,
        location_updated_at: shareEnabled ? (currentPoint?.recorded_at ?? member.location_updated_at) : null,
      }
    }
    return member
  }), [members, me.user_id, me.location_sharing, currentPoint, shareEnabled])

  useEffect(() => {
    const map = mapRef.current
    const groups = layersRef.current
    if (!map || !groups) return
    Object.values(groups).forEach((group) => group.clearLayers())
    const on = (key, enabled) => {
      if (enabled && !map.hasLayer(groups[key])) groups[key].addTo(map)
      else if (!enabled && map.hasLayer(groups[key])) map.removeLayer(groups[key])
    }
    on('people', layers.people)
    on('places', layers.places)
    on('trails', layers.trails)

    for (const person of visibleMembers) {
      if (!layers.people || !person.location_sharing || person.location_lat == null || person.location_lng == null) continue
      const isMe = person.user_id === me.user_id
      const initials = (person.display_name || '?').trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
      const marker = L.marker([person.location_lat, person.location_lng], {
        icon: markerIcon({ name: person.display_name, initials, color: colorOf(person.user_id) }),
        title: person.display_name,
      }).addTo(groups.people)
      marker.bindTooltip(tooltip(person.display_name, isMe ? 'Your live location' : `Updated ${ago(person.location_updated_at)}`), { direction: 'top', offset: [0, -26] })
    }

    if (layers.places) {
      for (const place of places) {
        L.circle([place.latitude, place.longitude], {
          radius: place.radius_m,
          color: '#4c9d75',
          weight: 2,
          fillColor: '#8bd8ae',
          fillOpacity: 0.2,
        }).addTo(groups.places)
        const marker = L.marker([place.latitude, place.longitude], {
          icon: markerIcon({ name: place.name, initials: '⌂', color: '#42936a', kind: 'place' }),
          title: place.name,
        }).addTo(groups.places)
        marker.bindTooltip(tooltip(place.name, `Place alert radius · ${place.radius_m} m`), { direction: 'top', offset: [0, -26] })
      }
    }

    if (layers.trails) {
      const grouped = history.reduce((acc, item) => ((acc[item.user_id] ||= []).push(item), acc), {})
      for (const [userId, items] of Object.entries(grouped)) {
        const points = items.slice().reverse().map((item) => [item.latitude, item.longitude])
        if (points.length > 1) L.polyline(points, { color: colorOf(userId), weight: 4, opacity: 0.68 }).addTo(groups.trails)
      }
    }
    if (!didInitialFitRef.current) {
      const points = [
        ...visibleMembers.filter((person) => person.location_sharing && person.location_lat != null && person.location_lng != null).map((person) => [person.location_lat, person.location_lng]),
        ...places.map((place) => [place.latitude, place.longitude]),
      ]
      if (points.length) {
        if (points.length === 1) map.setView(points[0], 15)
        else map.fitBounds(L.latLngBounds(points), { padding: [55, 55], maxZoom: 15 })
        didInitialFitRef.current = true
      }
    }
    if (centerPoint) {
      map.flyTo([centerPoint.latitude, centerPoint.longitude], Math.max(map.getZoom(), 15), { duration: 0.7 })
      setCenterPoint(null)
    }
  }, [visibleMembers, places, history, layers, colorOf, me.user_id, centerPoint])

  const upcoming = useMemo(() => events
    .filter((event) => event.place && isAfter(parseISO(`${event.date}T23:59:59`), new Date(now - 86400000)))
    .sort((a, b) => `${a.date}${a.start_time || ''}`.localeCompare(`${b.date}${b.start_time || ''}`))
    .slice(0, 8), [events, now])

  const historyByMember = useMemo(() => {
    const grouped = history.reduce((acc, item) => ((acc[item.user_id] ||= []).push(item), acc), {})
    return members.map((member) => ({ member, points: grouped[member.user_id] || [] }))
      .filter((entry) => entry.points.length)
      .sort((a, b) => new Date(b.points[0].recorded_at) - new Date(a.points[0].recorded_at))
  }, [history, members])

  async function savePlace(event) {
    event.preventDefault()
    if (!draft || !placeName.trim()) return
    setBusy(true)
    setError('')
    const { data, error: saveError } = await supabase.from('family_places').insert({
      space_id: space.id,
      created_by: me.user_id,
      name: placeName.trim(),
      latitude: draft.latitude,
      longitude: draft.longitude,
      radius_m: Number(placeRadius),
    }).select().single()
    setBusy(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setPlaces((items) => [...items, data].sort((a, b) => a.name.localeCompare(b.name)))
    setDraft(null)
    setPlaceName('')
    setNotice(`${data.name} added to your shared places.`)
    setTimeout(() => setNotice(''), 3500)
  }

  async function removePlace(place) {
    if (!confirm(`Remove ${place.name} from shared places?`)) return
    const { error: deleteError } = await supabase.from('family_places').delete().eq('id', place.id)
    if (deleteError) setError(deleteError.message)
    else setPlaces((items) => items.filter((item) => item.id !== place.id))
  }

  async function checkIn() {
    setBusy(true)
    await insertAlert({ kind: 'check_in', message: `${me.display_name} checked in${currentPoint && shareEnabled ? ' and shared their location' : ''}`, point: shareEnabled ? currentPoint : null })
    setBusy(false)
  }

  async function sendSos() {
    setBusy(true)
    const sent = await insertAlert({ kind: 'sos', message: `${me.display_name} sent an SOS to the circle`, point: shareEnabled ? currentPoint : null })
    setBusy(false)
    if (sent) setSosOpen(false)
  }

  async function clearHistory() {
    if (!confirm('Clear your saved location history? This cannot be undone.')) return
    const { error: deleteError } = await supabase.from('location_history').delete().eq('user_id', me.user_id)
    if (deleteError) setError(deleteError.message)
    else setHistory((items) => items.filter((item) => item.user_id !== me.user_id))
  }

  function focus(lat, lng) {
    setCenterPoint({ latitude: lat, longitude: lng })
  }

  const activeLocations = visibleMembers.filter((person) => person.location_sharing && person.location_lat != null && person.location_lng != null).length
  const ownPoint = shareEnabled && currentPoint ? currentPoint : null
  const cityCenter = DEFAULT_CENTERS[me.city] || DEFAULT_CENTERS.tbilisi

  return (
    <div className="maps-page">
      <header className="maps-head">
        <div>
          <div className="maps-eyebrow"><span className="maps-live-indicator" /> CIRCLE MAP <span>·</span> {space.name}</div>
          <h1>Family map</h1>
          <p>See shared locations, saved places, and what’s happening around your circle.</p>
        </div>
        <button
          className={`maps-share-btn${shareEnabled ? ' is-sharing' : ''}`}
          onClick={shareEnabled ? stopSharing : startSharing}
          disabled={busy}
        >
          {shareEnabled ? <Radio size={17} /> : <LocateFixed size={17} />}
          {busy ? 'Working…' : shareEnabled ? 'Stop sharing' : 'Share my location'}
        </button>
      </header>

      {needsSetup && (
        <div className="maps-setup-note">
          <CircleHelp size={18} />
          <div><strong>Finish the Maps setup</strong><span>In Supabase → SQL Editor, run <code>supabase/maps.sql</code> once, then reload this page.</span></div>
        </div>
      )}
      {error && <div className="maps-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
      {notice && <div className="maps-notice" role="status"><Check size={16} /> {notice}</div>}

      <div className="maps-summary-row">
        <div className="maps-stat"><span className="maps-stat-icon green"><Radio size={17} /></span><span><b>{activeLocations} of {members.length}</b><small>sharing live</small></span></div>
        <div className="maps-stat"><span className="maps-stat-icon lilac"><Home size={17} /></span><span><b>{places.length}</b><small>saved places</small></span></div>
        <div className="maps-stat"><span className="maps-stat-icon amber"><Activity size={17} /></span><span><b>{alerts.length}</b><small>recent circle updates</small></span></div>
        <span className="maps-summary-hint">Location sharing is always optional.</span>
      </div>

      <div className="maps-grid">
        <section className="maps-map-card card">
          <div className="maps-map-toolbar">
            <div className="maps-map-title"><span><MapPin size={17} /></span><div><strong>Live map</strong><small>{activeLocations ? `${activeLocations} shared ${activeLocations === 1 ? 'location' : 'locations'}` : 'Waiting for shared locations'}</small></div></div>
            <div className="maps-map-controls">
              <button className={layers.people ? 'on' : ''} onClick={() => setLayers((value) => ({ ...value, people: !value.people }))}><span className="legend-dot people" /> People</button>
              <button className={layers.places ? 'on' : ''} onClick={() => setLayers((value) => ({ ...value, places: !value.places }))}><span className="legend-dot places" /> Places</button>
              <button className={layers.trails ? 'on' : ''} onClick={() => setLayers((value) => ({ ...value, trails: !value.trails }))}><span className="legend-line" /> History</button>
            </div>
            <button className={`maps-add-place${addingPlace ? ' active' : ''}`} onClick={() => { setDraft(null); setAddingPlace((value) => !value) }}>
              {addingPlace ? <X size={16} /> : <Plus size={16} />}{addingPlace ? 'Cancel' : 'Add place'}
            </button>
          </div>
          {addingPlace && <div className="maps-map-hint"><Crosshair size={16} /> Click on the map to choose a place for your circle.</div>}
          <div className="maps-map-wrap">
            <div ref={mapNode} className={`maps-map${addingPlace ? ' picking' : ''}`} aria-label="Interactive family map" />
            <button className="maps-recenter" onClick={() => {
              if (ownPoint) focus(ownPoint.latitude, ownPoint.longitude)
              else focus(cityCenter[0], cityCenter[1])
            }} title={ownPoint ? 'Center on your location' : 'Center on your city'}><Crosshair size={17} /></button>
            {!activeLocations && places.length === 0 && <div className="maps-empty-overlay"><span><MapPin size={22} /></span><strong>Your circle starts here</strong><small>Share a location or add a place to put your map to work.</small></div>}
          </div>
          <div className="maps-map-foot"><span><Shield size={14} /> Only people in this circle can see shared map data. Map tile requests reveal the area you view.</span><small>© OpenStreetMap contributors</small></div>
        </section>

        <aside className="maps-side">
          <section className="maps-panel card maps-family-panel">
            <div className="maps-panel-head"><div><span className="maps-panel-kicker">YOUR CIRCLE</span><h2>People</h2></div><span className="maps-count-pill">{members.length}</span></div>
            <div className="maps-people-list">
              {visibleMembers.map((person) => {
                const sharing = Boolean(person.location_sharing && person.location_lat != null && person.location_lng != null)
                return (
                  <div className="maps-person" key={person.user_id}>
                    <div className="maps-avatar-wrap"><Avatar url={person.avatar_url} name={person.display_name} color={colorOf(person.user_id)} /><span className={`maps-presence${sharing ? ' online' : ''}`} /></div>
                    <div className="maps-person-copy"><strong>{person.display_name}{person.user_id === me.user_id ? ' · you' : ''}</strong><small>{sharing ? (person.user_id === me.user_id ? 'Sharing live location' : `Updated ${ago(person.location_updated_at)}`) : 'Location sharing paused'}</small></div>
                    {sharing && <button className="maps-icon-action" onClick={() => focus(person.location_lat, person.location_lng)} title={`Show ${person.display_name} on map`}><LocateFixed size={16} /></button>}
                    {!sharing && <span className="maps-private-icon" title="Location hidden"><Shield size={15} /></span>}
                  </div>
                )
              })}
            </div>
            <div className="maps-consent-note"><Shield size={15} /><span>Members choose when to share. Turning it off removes their live pin.</span></div>
          </section>

          <section className="maps-safety-card">
            <div className="maps-safety-title"><span><Shield size={16} /></span><div><strong>Safety check-in</strong><small>Let everyone know you’re okay.</small></div></div>
            <div className="maps-safety-actions">
              <button className="maps-checkin-btn" onClick={checkIn} disabled={busy}><CheckCircle2 size={17} /> I’m safe</button>
              <button className="maps-sos-btn" onClick={() => setSosOpen(true)} disabled={busy}><Siren size={17} /> Circle SOS</button>
            </div>
            <p><CircleHelp size={13} /> SOS alerts this shared space; it does not contact emergency services.</p>
          </section>

          <section className="maps-panel card">
            <div className="maps-panel-head"><div><span className="maps-panel-kicker">GEOFENCES</span><h2>Saved places</h2></div><button className="maps-small-add" onClick={() => { setDraft(null); setAddingPlace(true) }}><Plus size={15} /> Add</button></div>
            {places.length === 0 ? <p className="maps-empty-copy">Add a home, school, or another shared place. Circle alerts work while a member is sharing location on this page.</p> : <div className="maps-place-list">
              {places.map((place) => (
                <div className="maps-place-row" key={place.id}>
                  <button className="maps-place-main" onClick={() => focus(place.latitude, place.longitude)}><span className="maps-place-icon"><MapPin size={16} /></span><span><strong>{place.name}</strong><small>Alert radius · {place.radius_m} m</small></span></button>
                  <button className="maps-icon-action" onClick={() => openDirections(`${place.latitude},${place.longitude}`, ownPoint)} title={`Directions to ${place.name}`}><Route size={15} /></button>
                  <button className="maps-icon-action remove" onClick={() => removePlace(place)} title={`Remove ${place.name}`}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>}
          </section>

          <section className="maps-panel card">
            <div className="maps-panel-head"><div><span className="maps-panel-kicker">CIRCLE ACTIVITY</span><h2>Recent updates</h2></div><Bell size={17} className="maps-muted-icon" /></div>
            {alerts.length === 0 ? <p className="maps-empty-copy">Check-ins, SOS alerts, and place arrivals will show up here.</p> : <div className="maps-activity-list">
              {alerts.slice(0, 6).map((item) => {
                const owner = members.find((person) => person.user_id === item.user_id)
                const isSos = item.kind === 'sos'
                const isPlace = item.kind === 'place_enter' || item.kind === 'place_exit'
                return <button key={item.id} className={`maps-activity-row${isSos ? ' is-sos' : ''}`} onClick={() => item.latitude != null && focus(item.latitude, item.longitude)}>
                  <span className={`maps-activity-icon ${isSos ? 'sos' : isPlace ? 'place' : 'check'}`}>{isSos ? <Siren size={15} /> : isPlace ? <MapPin size={15} /> : <CheckCircle2 size={15} />}</span>
                  <span className="maps-activity-copy"><strong>{item.message}</strong><small>{owner?.display_name || 'Circle member'} · {ago(item.created_at)}</small></span>
                  {item.latitude != null && <ChevronRight size={15} />}
                </button>
              })}
            </div>}
          </section>
        </aside>

        <div className="maps-bottom-grid">
          <section className="maps-panel card">
            <div className="maps-panel-head"><div><span className="maps-panel-kicker">LOCATION HISTORY</span><h2>Recent trails</h2></div><History size={17} className="maps-muted-icon" /></div>
            {historyByMember.length === 0 ? <p className="maps-empty-copy">When you share your location, recent movement is saved here and on the map.</p> : <div className="maps-history-list">
              {historyByMember.flatMap(({ member: person, points }) => points.slice(0, 4).map((point, index) => (
                <button className="maps-history-row" key={point.id} onClick={() => focus(point.latitude, point.longitude)}>
                  <span className="maps-history-track" style={{ '--history-color': colorOf(person.user_id) }}><i /></span>
                  <span className="maps-history-copy"><strong>{person.display_name}{person.user_id === me.user_id ? ' · you' : ''}</strong><small>{prettyDate(point.recorded_at)} · ±{Math.round(point.accuracy || 0)} m</small></span>
                  <Navigation size={15} />
                </button>
              ))) .slice(0, 8)}
            </div>}
            {history.some((point) => point.user_id === me.user_id) && <button className="maps-clear-history" onClick={clearHistory}><Trash2 size={14} /> Clear my location history</button>}
          </section>

          <section className="maps-panel card">
            <div className="maps-panel-head"><div><span className="maps-panel-kicker">ON THE CALENDAR</span><h2>Upcoming places</h2></div><Route size={17} className="maps-muted-icon" /></div>
            {upcoming.length === 0 ? <p className="maps-empty-copy">Calendar events with a place will appear here, with a quick link for directions.</p> : <div className="maps-event-list">
              {upcoming.map((event) => (
                <div className="maps-event-row" key={event.id}>
                  <span className="maps-event-date">{format(parseISO(event.date), 'd')}<small>{format(parseISO(event.date), 'MMM')}</small></span>
                  <span className="maps-event-copy"><strong>{event.title}</strong><small><MapPin size={12} /> {event.place} · {format(parseISO(event.date), 'EEE')}</small></span>
                  <a href={eventAddress(event)} target="_blank" rel="noopener noreferrer" title="Open directions"><ExternalLink size={15} /></a>
                </div>
              ))}
            </div>}
          </section>
        </div>
      </div>

      {draft && <div className="maps-modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && setDraft(null)}>
        <form className="maps-place-dialog" onSubmit={savePlace}>
          <button type="button" className="maps-dialog-close" onClick={() => setDraft(null)} aria-label="Close"><X size={18} /></button>
          <span className="maps-dialog-icon"><MapPin size={20} /></span>
          <p className="maps-panel-kicker">NEW SHARED PLACE</p>
          <h2>Add a place</h2>
          <p className="maps-dialog-help">Choose any name you like. It can be Home, work, or somewhere else.</p>
          <p className="maps-dialog-coords">{draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}</p>
          <label>Place name<input autoFocus maxLength={60} value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="e.g. Gym, Grandma’s, school" required /></label>
          <label>Arrival alert radius<select value={placeRadius} onChange={(event) => setPlaceRadius(event.target.value)}><option value="100">100 meters</option><option value="150">150 meters</option><option value="300">300 meters</option><option value="500">500 meters</option></select></label>
          <div className="maps-dialog-actions"><button type="button" className="maps-cancel-btn" onClick={() => setDraft(null)}>Cancel</button><button type="submit" className="maps-share-btn" disabled={busy || !placeName.trim()}>{busy ? 'Saving…' : 'Save place'}</button></div>
        </form>
      </div>}

      {sosOpen && <div className="maps-modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && setSosOpen(false)}>
        <div className="maps-sos-dialog">
          <button type="button" className="maps-dialog-close" onClick={() => setSosOpen(false)} aria-label="Close"><X size={18} /></button>
          <span className="maps-sos-dialog-icon"><Siren size={22} /></span>
          <p className="maps-panel-kicker">CIRCLE SOS</p>
          <h2>Alert your circle?</h2>
          <p>Your family members will see an SOS in Maps. Your live location is included only if sharing is on.</p>
          <div className="maps-dialog-actions"><button className="maps-cancel-btn" onClick={() => setSosOpen(false)}>Cancel</button><button className="maps-sos-confirm" onClick={sendSos} disabled={busy}>{busy ? 'Sending…' : 'Send SOS'}</button></div>
        </div>
      </div>}
    </div>
  )
}
