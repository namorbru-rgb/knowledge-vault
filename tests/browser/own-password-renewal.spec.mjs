import { test, expect } from '@playwright/test'
const user={
  id:'00000000-0000-4000-8000-000000000001',
  aud:'authenticated',role:'authenticated',email:'owner@example.invalid',
  app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString(),
}
const jwt=[
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),
  'synthetic'
].join('.')

test('first signed-in opening prompts for a new password without a recovery email',async ({page})=>{
  const requests=[]
  let required=true
  await page.route('https://**/*',async route=>{
    const url=new URL(route.request().url())
    if(!url.hostname.endsWith('.supabase.co')) return route.abort()
    let response=[]
    if(url.pathname==='/auth/v1/token') response={
      access_token:jwt,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user,
    }
    else if(url.pathname==='/auth/v1/user') response=user
    else if(url.pathname==='/functions/v1/family-admin'){
      const request=route.request().postDataJSON()
      requests.push(request)
      if(request.action==='own-reset-status') response={required}
      else if(request.action==='set-own-password'){required=false;response={success:true}}
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)})
  })

  await page.goto('/knowledge-vault/')
  await page.getByLabel('E-Mail',{exact:true}).fill('owner@example.invalid')
  await page.getByLabel('Passwort',{exact:true}).fill('synthetic-old-password')
  await page.getByRole('button',{name:'Anmelden',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Neues Passwort festlegen'})).toBeVisible()
  await expect(page.getByText('Du brauchst weder dein altes Passwort noch eine E-Mail.')).toBeVisible()
  await page.getByLabel('Neues Passwort (mindestens 12 Zeichen)').fill('new-generated-password-2026')
  await page.getByRole('button',{name:'Neues Passwort speichern'}).click()
  await expect(page.getByRole('heading',{name:'Dein Family Hub'})).toBeVisible()
  const mutation=requests.filter(r=>r.action==='set-own-password')
  expect(mutation).toHaveLength(1)
  expect(mutation[0]).toMatchObject({action:'set-own-password',confirm:true})
  expect(mutation[0]).not.toHaveProperty('oldPassword')
  expect(requests.some(r=>r.action==='resetPasswordForEmail')).toBe(false)
})
