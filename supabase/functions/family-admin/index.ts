import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

// Only the explicitly designated family owner can use these account operations.
// Admin identities are resolved by immutable auth.users.id, never client metadata.
const SUPERADMIN_ID = 'f89abea0-888f-4fed-954d-aedb2dcdbab2'
const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const origins = new Set(['https://namorbru-rgb.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  }
  if (origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  if (Number(req.headers.get('content-length') || 0) > 4096) return reply({ error: 'Request too large' }, 413)

  try {
    const raw = await req.text()
    if (raw.length > 4096) return reply({ error: 'Request too large' }, 413)
    const input = JSON.parse(raw)
    const bearer = req.headers.get('authorization') || ''
    if (!bearer.startsWith('Bearer ') || req.headers.has('x-api-key')) return reply({ error: 'Anmeldung erforderlich.' }, 401)

    // Verifies the real Auth user and an active, non-revoked session.
    const { data: verified, error: verifyError } = await service.auth.getUser(bearer.slice(7))
    const user = verified.user
    if (verifyError || !user) return reply({ error: 'Anmeldung erforderlich.' }, 401)
    if (user.id !== SUPERADMIN_ID) return reply({ error: 'Keine Berechtigung.' }, 403)

    const personal = createClient(url, anonKey, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: active, error: sessionError } = await personal.rpc('fh_session_active')
    if (sessionError || !active) return reply({ error: 'Bitte neu anmelden.' }, 401)

    const { data: adminFamilies, error: adminFamilyError } = await service
      .from('fh_members').select('family_id,role').eq('user_id', user.id).eq('role', 'admin')
    if (adminFamilyError || !adminFamilies?.length) return reply({ error: 'Keine Familienadministration.' }, 403)
    const allowedFamilies = new Set(adminFamilies.map(m => m.family_id as string))

    const { action } = input
    if (action === 'list') {
      const { data: all, error } = await service
        .from('fh_members').select('family_id,user_id,display_name,role')
        .in('family_id', [...allowedFamilies]).limit(50)
      if (error) throw error
      const ids = [...new Set((all || []).map(m => m.user_id as string))]
      const accounts = await Promise.all(ids.map(async id => {
        const { data, error } = await service.auth.admin.getUserById(id)
        return { id, email: error ? null : data.user?.email || null }
      }))
      return reply({ allowed: true, families: [...allowedFamilies], members: (all || []).map(m => ({
        ...m, email: accounts.find(a => a.id === m.user_id)?.email || null,
      })) })
    }

    const familyId = String(input.familyId || '')
    if (!uuidPattern.test(familyId) || !allowedFamilies.has(familyId)) return reply({ error: 'Familie nicht freigegeben.' }, 403)

    // Strongly re-authenticate the operator before a privileged write.
    // The operator password is neither persisted nor included in any log.
    const adminPassword = input.adminPassword
    if (typeof adminPassword !== 'string' || !adminPassword || adminPassword.length > 256 || !user.email)
      return reply({ error: 'Eigenes Passwort zur Bestätigung eingeben.' }, 400)
    const checkClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: check, error: checkError } = await checkClient.auth.signInWithPassword({
      email: user.email, password: adminPassword,
    })
    if (checkError || check.user?.id !== user.id) return reply({ error: 'Dein eigenes Passwort stimmt nicht.' }, 403)
    await checkClient.auth.signOut({ scope: 'local' }).catch(() => {})

    if (action === 'set-password') {
      const targetId = String(input.targetUserId || '')
      const password = input.password
      if (!uuidPattern.test(targetId) || targetId === user.id) return reply({ error: 'Ungültiges Zielkonto.' }, 400)
      if (typeof password !== 'string' || password.length < 12 || password.length > 128)
        return reply({ error: 'Das neue Passwort braucht 12 bis 128 Zeichen.' }, 400)
      const { data: membership, error: memberError } = await service
        .from('fh_members').select('user_id').eq('family_id', familyId).eq('user_id', targetId).maybeSingle()
      if (memberError || !membership) return reply({ error: 'Konto ist nicht Mitglied dieser Familie.' }, 403)
      const { error: resetError } = await service.auth.admin.updateUserById(targetId, { password })
      if (resetError) return reply({ error: 'Passwort konnte nicht geändert werden.' }, 500)
      const { error: auditError } = await service.from('fh_audit').insert({
        actor_id: user.id, owner_id: targetId, action: 'superadmin_password_changed',
      })
      if (auditError) return reply({ success: true, auditWarning: true })
      return reply({ success: true })
    }

    if (action === 'create-account') {
      const name = String(input.name || '').trim()
      const email = String(input.email || '').trim().toLowerCase()
      const password = input.password
      if (name.length < 1 || name.length > 120 || !emailPattern.test(email) || email.length > 254 ||
          typeof password !== 'string' || password.length < 12 || password.length > 128)
        return reply({ error: 'Name, gültige E-Mail und Passwort mit mindestens 12 Zeichen erforderlich.' }, 400)
      const { data: created, error: creationError } = await service.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (creationError || !created.user) return reply({ error: 'Konto konnte nicht angelegt werden; E-Mail möglicherweise bereits vergeben.' }, 409)
      const { error: memberError } = await service.from('fh_members').insert({
        family_id: familyId, user_id: created.user.id, display_name: name, role: 'member',
      })
      if (memberError) {
        await service.auth.admin.deleteUser(created.user.id)
        return reply({ error: 'Familienzuordnung fehlgeschlagen; Neuanlage rückgängig gemacht.' }, 500)
      }
      const { error: auditError } = await service.from('fh_audit').insert({
        actor_id: user.id, owner_id: created.user.id, action: 'superadmin_account_created',
      })
      return reply({ success: true, auditWarning: !!auditError }, 201)
    }
    return reply({ error: 'Unbekannte Aktion.' }, 400)
  } catch {
    // Fail closed. Never leak credentials, Supabase admin errors or health data.
    return reply({ error: 'Verwaltung momentan nicht verfügbar.' }, 500)
  }
})
