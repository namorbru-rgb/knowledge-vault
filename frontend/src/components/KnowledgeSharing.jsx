import { useEffect, useState } from 'react'
import { supabase as sb } from '../lib/supabase'

export default function KnowledgeSharing() {
  const [me,setMe]=useState('')
  const [targets,setTargets]=useState([])
  const [shared,setShared]=useState(new Set())
  const [received,setReceived]=useState(new Set())
  const [busy,setBusy]=useState('')
  const [error,setError]=useState('')

  async function load(){
    const {data:{user},error:authError}=await sb.auth.getUser()
    if(authError||!user)throw new Error('Bitte zuerst anmelden.')
    setMe(user.id)
    const [members,shares]=await Promise.all([
      sb.from('fh_members').select('user_id,display_name,family_id').order('display_name'),
      sb.from('kv_mcp_shares').select('owner_id,recipient_id')
    ])
    if(members.error)throw members.error
    if(shares.error)throw shares.error
    const mine=new Set((members.data||[]).filter(m=>m.user_id===user.id).map(m=>m.family_id))
    const otherMembers=(members.data||[]).filter(m=>mine.has(m.family_id)&&m.user_id!==user.id)
    setTargets([...new Map(otherMembers.map(m=>[m.user_id,m])).values()])
    setShared(new Set((shares.data||[]).filter(s=>s.owner_id===user.id).map(s=>s.recipient_id)))
    setReceived(new Set((shares.data||[]).filter(s=>s.recipient_id===user.id).map(s=>s.owner_id)))
  }
  useEffect(()=>{load().catch(e=>setError(e.message))},[])
  async function toggle(id){
    setBusy(id);setError('')
    try{
      if(shared.has(id)){
        const {error}=await sb.from('kv_mcp_shares').delete().eq('owner_id',me).eq('recipient_id',id)
        if(error)throw error
      }else{
        const {error}=await sb.from('kv_mcp_shares').insert({owner_id:me,recipient_id:id})
        if(error)throw error
      }
      await load()
    }catch(e){setError(e.message)}finally{setBusy('')}
  }
  return <section className="hub-card space-y-3">
    <h2 className="text-lg font-semibold">Knowledge für KI und Familie</h2>
    <p className="text-sm text-muted">Dein ChatGPT kann dein eigenes Knowledge mit deinem Login lesen.
      Hier bestimmst du zusätzlich, ob ein anderes Familienkonto deine gesamte Knowledge-Bibliothek
      (Videos, Links, Fotos, Notizen, verfügbare Transkripte) lesen darf. Das gilt auch für dessen ChatGPT.</p>
    <p className="text-sm text-muted"><strong>Nicht enthalten:</strong> Gesundheitsdaten,
      Medikamente, private Dokumente oder Unternehmensdaten. Die Freigabe kann hier jederzeit zurückgenommen werden.</p>
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    {!targets.length?<p className="text-sm text-muted">Noch kein anderes Familienkonto verknüpft.</p>:
      <div className="space-y-2">
        {targets.map(t=><div key={t.user_id} className="flex items-center justify-between gap-3 border border-line rounded-lg p-3">
          <div>
            <p className="font-medium">{t.display_name}</p>
            <p className="text-xs text-muted">{shared.has(t.user_id)?'Darf mein Knowledge lesen':'Mein Knowledge ist nicht freigegeben'}</p>
            {received.has(t.user_id)&&<p className="text-xs text-muted">Diese Person hat ihr Knowledge mit mir geteilt.</p>}
          </div>
          <button disabled={Boolean(busy)} onClick={()=>toggle(t.user_id)}
            className="hub-button text-sm shrink-0">{busy===t.user_id?'Bitte warten…':shared.has(t.user_id)?'Freigabe aufheben':'Knowledge freigeben'}</button>
        </div>)}
      </div>}
    <p className="text-xs text-muted">Freigabe gilt nur für bereits gespeicherte und künftig hinzugefügte Knowledge-Einträge.
      Sie erlaubt ausschliesslich Lesen; die andere Person kann deine Daten nicht ändern.</p>
  </section>
}
