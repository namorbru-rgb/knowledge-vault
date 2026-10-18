import { test, expect } from '@playwright/test'
const roman='00000000-0000-4000-8000-000000000001'
const spouse='00000000-0000-4000-8000-000000000002'
const family='00000000-0000-4000-8000-000000000003'
const user={id:roman,aud:'authenticated',role:'authenticated',email:'viewer@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
const payload=Buffer.from(JSON.stringify({sub:roman,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')
const jwt='synthetic.'+payload+'.synthetic'
test('request video access without receiving private records before consent',async({page})=>{
  let pending=[],created=0
  await page.route('https://**/*',async route=>{
    const uri=new URL(route.request().url()),method=route.request().method()
    if(!uri.hostname.endsWith('.supabase.co'))return route.abort()
    let data=[]
    if(uri.pathname==='/auth/v1/token')data={access_token:jwt,token_type:'bearer',refresh_token:'test-refresh',expires_in:3600,user}
    else if(uri.pathname==='/auth/v1/user')data=user
    else if(uri.pathname==='/rest/v1/fh_members')data=[
      {family_id:family,user_id:roman,display_name:'Roman',role:'admin'},
      {family_id:family,user_id:spouse,display_name:'Katarina',role:'member'}]
    else if(uri.pathname==='/rest/v1/fh_video_share_requests'){
      if(method==='POST'){pending=[route.request().postDataJSON()];created++}
      data=pending
    }
    else if(uri.pathname==='/rest/v1/rpc/fh_knowledge_videos')data=[]
    else if(uri.pathname==='/rest/v1/rpc/fh_knowledge_feed')data=[]
    else if(uri.pathname==='/functions/v1/family-admin')data={allowed:false}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  await page.goto('/knowledge-vault/')
  await page.getByLabel('E-Mail',{exact:true}).fill(user.email)
  await page.getByLabel('Passwort',{exact:true}).fill('synthetic-placeholder')
  await page.getByRole('button',{name:'Anmelden',exact:true}).click()
  await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('link',{name:'Knowledge'}).click()
  await page.getByRole('link',{name:'Videos',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Familienvideos'})).toBeVisible()
  const section=page.getByRole('region',{name:'Videofreigaben verwalten'})
  await section.getByRole('button',{name:'Freigabe anfragen'}).click()
  await expect(section.getByText('Deine Zugriffsanfrage wartet auf Bestätigung.')).toBeVisible()
  await expect(page.getByText('Ferienvideo der Familie')).toHaveCount(0)
  expect(created).toBe(1)
  expect(pending[0]).toEqual({owner_id:spouse,requester_id:roman})
})
