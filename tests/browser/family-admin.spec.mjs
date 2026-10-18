import { test, expect } from '@playwright/test'
const romanId='00000000-0000-4000-8000-000000000001', memberId='00000000-0000-4000-8000-000000000002', familyId='00000000-0000-4000-8000-000000000003'
const user={id:romanId,aud:'authenticated',role:'authenticated',email:'owner@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:romanId,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.synthetic`

test('family owner resets family password without repeat login',async ({page})=>{
  const writes=[]
  await page.route('https://**/*',async route=>{
    const url=new URL(route.request().url())
    if(!url.hostname.endsWith('.supabase.co'))return route.abort()
    let data=[]
    const path=url.pathname
    if(path==='/auth/v1/token')data={access_token:jwt,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user}
    else if(path==='/auth/v1/user')data=user
    else if(path==='/functions/v1/family-admin'){
      const body=route.request().postDataJSON()
      if(body.action==='list')data={allowed:true,families:[familyId],members:[
        {family_id:familyId,user_id:romanId,display_name:'Owner',email:user.email,role:'admin'},
        {family_id:familyId,user_id:memberId,display_name:'Member',email:'member@example.invalid',role:'member'}
      ]}
      else if(body.action==='set-password'){writes.push(body);data={success:true}}
      else data={error:'Unknown action'}
    }else if(path==='/rest/v1/fh_families')data=[{id:familyId,name:'Test'}]
    else if(path==='/rest/v1/fh_members')data=[
      {family_id:familyId,user_id:romanId,display_name:'Owner',role:'admin'},
      {family_id:familyId,user_id:memberId,display_name:'Member',role:'member'}
    ]
    else if(path==='/rest/v1/kv_persons')data=[]
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  page.on('dialog',dialog=>dialog.accept())
  await page.goto('/knowledge-vault/')
  await page.getByLabel('E-Mail',{exact:true}).fill(user.email)
  await page.getByLabel('Passwort',{exact:true}).fill('test-only-placeholder')
  await page.getByRole('button',{name:'Anmelden',exact:true}).click()
  await page.getByRole('button',{name:'Menü öffnen'}).click()
  await page.locator('aside').getByRole('link',{name:/Familie & Freigaben/}).click()
  await expect(page.getByRole('heading',{name:'Meine Familie'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Face ID / Passkey'})).toHaveCount(0)
  const admin=page.getByRole('region',{name:'Benutzer & Passwörter verwalten'})
  await expect(admin).toBeVisible()
  await admin.getByRole('button',{name:'Passwort setzen'}).click()
  await admin.getByLabel('Neues Passwort (mindestens 12 Zeichen)').fill('test-only-placeholder-2')
  await admin.getByLabel('Neues Passwort wiederholen').fill('test-only-placeholder-2')
  await expect(admin.getByText('Dein eigenes Passwort zur Sicherheitsbestätigung')).toHaveCount(0)
  await admin.getByRole('button',{name:'Neues Passwort speichern'}).click()
  await expect(admin.getByText(/Passwort geändert/)).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({action:'set-password',familyId,targetUserId:memberId,confirm:true})
  expect(writes[0]).not.toHaveProperty('adminPassword')
})
