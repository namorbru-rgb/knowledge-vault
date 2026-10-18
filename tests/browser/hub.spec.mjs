import { test,expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const uid='00000000-0000-4000-8000-000000000001', pid='00000000-0000-4000-8000-000000000011'
const user={ id:uid,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString() }
const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})).toString('base64url')}.synthetic`
test('mobile personal login, module navigation and recurring health entry without external data',async ({page}) => {
  let rows=[]
  await page.route('https://**/*',async route => {
    const url=new URL(route.request().url())
    if (!url.hostname.endsWith('.supabase.co')) return route.abort()
    const method=route.request().method()
    let data=[]
    if (url.pathname==='/auth/v1/token') data={access_token:jwt,token_type:'bearer',expires_in:3600,refresh_token:'synthetic-refresh',user}
    else if (url.pathname==='/auth/v1/user') data=user
    else if (url.pathname==='/rest/v1/kv_persons') data=[{id:pid,user_id:uid,name:'Synthetic profile',fh_kind:'self'}]
    else if (url.pathname==='/rest/v1/rpc/fh_selectable_profiles')
      data=[{id:pid,profile_owner_id:uid,name:'Synthetic profile',fh_kind:'self'}]
    else if (url.pathname==='/rest/v1/rpc/fh_create_for_person') {
      const body=route.request().postDataJSON()
      const row={
        id:randomUUID(),person_id:body.p_person,owner_id:uid,kind:body.p_kind,
        title:body.p_title,occurred_at:body.p_at,intensity:body.p_intensity,
        details:body.p_details||{},created_at:new Date().toISOString(),
      }
      rows.unshift(row)
      data=row.id
    }
    else if (url.pathname==='/rest/v1/fh_resources') {
      if (method==='POST') { const body=route.request().postDataJSON();const row={...body,id:randomUUID(),created_at:new Date().toISOString()};rows.unshift(row);data=row }
      else data=rows
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  await page.goto('/knowledge-vault/')
  await expect(page.getByRole('heading',{name:'Family Hub',exact:true})).toBeVisible()
  await page.getByLabel('E-Mail',{exact:true}).fill('synthetic@example.invalid')
  await page.getByLabel('Passwort',{exact:true}).fill('synthetic-password')
  await page.getByRole('button',{name:'Anmelden',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Dein Family Hub'})).toBeVisible()
  const tiles = page.locator('.hub-tile')
  await expect(tiles).toHaveCount(4)
  const first = await tiles.nth(0).boundingBox(), second = await tiles.nth(1).boundingBox()
  expect(first.y).toBe(second.y)
  expect(second.x).toBeGreaterThan(first.x)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('navigation',{name:'Hauptnavigation'})).toBeVisible()
  await page.screenshot({path:'test-results/mobile-hub.png',fullPage:true,animations:'disabled'})
  await page.getByRole('button',{name:'Menü öffnen'}).click()
  await page.screenshot({path:'test-results/mobile-menu.png',fullPage:true,animations:'disabled'})
  await page.getByRole('button',{name:'Menü schliessen'}).click()
  await page.getByRole('button',{name:'Dunkelmodus',exact:true}).first().click()
  await page.screenshot({path:'test-results/mobile-hub-dark.png',fullPage:true,animations:'disabled'})
  await page.getByRole('button',{name:'Hellmodus',exact:true}).first().click()
  await page.setViewportSize({width:1440,height:1000})
  await page.screenshot({path:'test-results/desktop-hub.png',fullPage:true,animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  await page.locator('main').getByRole('link',{name:/Gesundheit/}).click()
  await expect(page.getByRole('heading',{name:'Gesundheit',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Beschwerde speichern',exact:true}).click()
  await expect(page.getByRole('heading',{name:/Kopfschmerzen/})).toBeVisible()
  expect(rows).toHaveLength(1)
  expect(rows[0].owner_id).toBe(uid)
  expect(rows[0].intensity).toBe(5)
  await page.getByRole('button',{name:'Menü öffnen'}).click()
  await page.getByRole('link',{name:'Dokumente',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Privater Dokumententresor'})).toBeVisible()
  await expect(page.getByText('Noch keine Dokumente.',{exact:true})).toBeVisible()
  await page.screenshot({path:'test-results/mobile-documents.png',fullPage:true,animations:'disabled'})
  await page.getByRole('button',{name:'Menü öffnen'}).click()
  await page.locator('aside').getByRole('link',{name:'Knowledge',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Knowledge',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Menü öffnen'}).click()
  await page.getByRole('button',{name:'Abmelden',exact:true}).click()
  await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible()
})
