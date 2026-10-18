import { test, expect } from '@playwright/test'
const owner='00000000-0000-4000-8000-000000000002'
const viewer='00000000-0000-4000-8000-000000000001'
const family='00000000-0000-4000-8000-000000000003'
const user={id:owner,aud:'authenticated',role:'authenticated',email:'owner@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
const payload=Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')
const jwt='synthetic.'+payload+'.synthetic'
test('owner can approve family video access without sharing notes',async({page})=>{
  let requests=[{owner_id:owner,requester_id:viewer}],grants=[]
  await page.route('https://**/*',async route=>{
    const uri=new URL(route.request().url()),method=route.request().method()
    if(!uri.hostname.endsWith('.supabase.co'))return route.abort()
    let data=[]
    if(uri.pathname==='/auth/v1/token')data={access_token:jwt,token_type:'bearer',refresh_token:'test-refresh',expires_in:3600,user}
    else if(uri.pathname==='/auth/v1/user')data=user
    else if(uri.pathname==='/rest/v1/fh_members')data=[
      {family_id:family,user_id:viewer,display_name:'Roman',role:'admin'},
      {family_id:family,user_id:owner,display_name:'Katarina',role:'member'}]
    else if(uri.pathname==='/rest/v1/fh_video_share_requests'){
      if(method==='DELETE')requests=[]
      data=requests
    }
    else if(uri.pathname==='/rest/v1/fh_video_shares'){
      if(method==='POST')grants.push(route.request().postDataJSON())
      data=grants
    }
    else if(uri.pathname==='/rest/v1/rpc/fh_knowledge_videos')data=[{
      video_id:'00000000-0000-4000-8000-000000000011',
      record_owner:owner,owner_name:'Katarina',assigned_person:null,
      title:'Reisevideo',description:'Videoarchiv',source_url:'https://example.org/video',
      thumbnail_url:null,transcript_status:'done',created_at:new Date().toISOString(),
      mine:true,total_count:499
    }]
    else if(uri.pathname==='/rest/v1/rpc/fh_knowledge_feed')data=[]
    else if(uri.pathname==='/functions/v1/family-admin')data={allowed:false}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  page.on('dialog',dialog=>dialog.accept())
  await page.goto('/knowledge-vault/')
  await page.getByLabel('E-Mail',{exact:true}).fill(user.email)
  await page.getByLabel('Passwort',{exact:true}).fill('synthetic-placeholder')
  await page.getByRole('button',{name:'Anmelden',exact:true}).click()
  await page.getByRole('button',{name:'Menü öffnen'}).click()
  await page.locator('aside').getByText('Weitere Knowledge-Funktionen').click()
  await page.locator('aside').getByRole('link',{name:'Videos',exact:true}).click()
  const incoming=page.getByRole('region',{name:'Offene Video-Freigabeanfragen'})
  await expect(incoming.getByText(/Roman fragt nach Zugriff/)).toBeVisible()
  await incoming.getByRole('button',{name:'Zugriff erlauben'}).click()
  await expect(page.getByText('Deine Videos sind jetzt für Roman freigegeben.')).toBeVisible()
  expect(grants).toEqual([{owner_id:owner,recipient_id:viewer}])
  expect(requests).toHaveLength(0)
})
