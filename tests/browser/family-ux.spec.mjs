import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('family member selects spouse and children and explicitly shares Knowledge',async ({page})=>{
  const k='00000000-0000-4000-8000-000000000011'
  const r='00000000-0000-4000-8000-000000000012'
  const fk='00000000-0000-4000-8000-000000000013'
  const fr='00000000-0000-4000-8000-000000000014'
  const fa='00000000-0000-4000-8000-000000000015'
  const fb='00000000-0000-4000-8000-000000000016'
  const fam='00000000-0000-4000-8000-000000000017'
  const user={id:k,aud:'authenticated',role:'authenticated',email:'family@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
  const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:k,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.synthetic`
  const writes=[]
  let rows=[],shares=[]
  await page.route('https://**/*',async route=>{
    const url=new URL(route.request().url())
    if(!url.hostname.endsWith('.supabase.co'))return route.abort()
    const method=route.request().method()
    let data=[]
    if(url.pathname==='/auth/v1/token')data={access_token:jwt,token_type:'bearer',expires_in:3600,refresh_token:'synthetic-refresh',user}
    else if(url.pathname==='/auth/v1/user')data=user
    else if(url.pathname==='/rest/v1/fh_members')data=[
      {family_id:fam,user_id:k,display_name:'Katarina',role:'member'},
      {family_id:fam,user_id:r,display_name:'Roman',role:'admin'},
    ]
    else if(url.pathname==='/rest/v1/rpc/fh_selectable_profiles')data=[
      {id:fk,name:'Katarina',profile_owner_id:k,fh_kind:'self'},
      {id:fr,name:'Roman',profile_owner_id:r,fh_kind:'self'},
      {id:fa,name:'Aurelia',profile_owner_id:r,fh_kind:'child'},
      {id:fb,name:'Arthur',profile_owner_id:r,fh_kind:'child'},
    ]
    else if(url.pathname==='/rest/v1/rpc/fh_create_for_person'){
      const body=route.request().postDataJSON();writes.push(body)
      rows.unshift({id:randomUUID(),owner_id:r,person_id:body.p_person,kind:body.p_kind,
        title:body.p_title,occurred_at:body.p_at,intensity:body.p_intensity,details:body.p_details})
      data=randomUUID()
    }
    else if(url.pathname==='/rest/v1/fh_resources')data=rows
    else if(url.pathname==='/rest/v1/fh_doses')data=[]
    else if(url.pathname==='/rest/v1/fh_grants')data=[]
    else if(url.pathname==='/rest/v1/rpc/fh_knowledge_feed')data=[
      {record_id:randomUUID(),record_type:'note',record_owner:r,owner_name:'Roman',
        title:'Gemeinsame Reiseerinnerung',summary:'Eintrag von Roman, den Katarina lesen darf.',
        link_url:null,created_at:new Date().toISOString(),mine:false},
    ]
    else if(url.pathname==='/rest/v1/fh_knowledge_shares') {
      if(method==='POST'){const body=route.request().postDataJSON();shares.push(body);data=null}
      else data=shares
    }
    else if(url.pathname==='/functions/v1/family-admin')data={allowed:false}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  await page.goto('/knowledge-vault/')
  await page.getByLabel('E-Mail',{exact:true}).fill(user.email)
  await page.getByLabel('Passwort',{exact:true}).fill('synthetic-password')
  await page.getByRole('button',{name:'Anmelden',exact:true}).click()
  await page.getByRole('link',{name:/Beschwerde erfassen/}).click()
  const names=page.getByRole('region',{name:'Für wen?'})
  for(const name of ['Katarina','Roman','Aurelia','Arthur'])
    await expect(names.getByRole('button',{name,exact:true})).toBeVisible()
  await names.getByRole('button',{name:'Aurelia'}).click()
  await page.getByRole('button',{name:'Husten',exact:true}).click()
  await page.getByRole('button',{name:'Beschwerde speichern'}).click()
  await expect(page.getByRole('status')).toContainText('Husten für Aurelia gespeichert')
  expect(writes).toHaveLength(1)
  expect(writes[0].p_person).toBe(fa)
  expect(writes[0].p_title).toBe('Husten')
  await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('link',{name:'Knowledge'}).click()
  await expect(page.getByText('Gemeinsame Reiseerinnerung')).toBeVisible()
  await expect(page.getByText('Eintrag von Roman, den Katarina lesen darf.')).toBeVisible()
  await page.getByText('Meine Knowledge-Einträge mit der Familie teilen').click()
  await page.getByRole('button',{name:'Wissen teilen'}).click()
  await expect(page.getByRole('button',{name:'Freigabe beenden'})).toBeVisible()
  expect(shares).toHaveLength(1)
  expect(shares[0]).toMatchObject({owner_id:k,recipient_id:r})
})
