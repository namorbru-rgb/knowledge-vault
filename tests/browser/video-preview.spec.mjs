import { test, expect } from '@playwright/test'

test('video list offers an explicit preview fallback for Facebook links', async ({page})=>{
 const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'owner@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
 const jwt='synthetic.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic'
 let requests=0
 await page.route('https://**/*',async route=>{
  const url=new URL(route.request().url())
  if(!url.hostname.endsWith('.supabase.co'))return route.abort()
  let data=[]
  if(url.pathname==='/auth/v1/token')data={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,user}
  else if(url.pathname==='/auth/v1/user')data=user
  else if(url.pathname==='/rest/v1/fh_members')data=[{family_id:'00000000-0000-4000-8000-000000000002',user_id:user.id,display_name:'Roman',role:'admin'}]
  else if(url.pathname==='/rest/v1/rpc/fh_knowledge_videos')data=[{
    video_id:'00000000-0000-4000-8000-000000000003',record_owner:user.id,
    owner_name:'Roman',assigned_person:null,title:'https://www.facebook.com/share/v/test/',
    description:'',source_url:'https://www.facebook.com/share/v/test/',
    thumbnail_url:null,transcript_status:'pending',created_at:new Date().toISOString(),mine:true,total_count:1,
  }]
  else if(url.pathname==='/functions/v1/video-preview'){requests++;data={results:[{id:'00000000-0000-4000-8000-000000000003',status:'unavailable'}]}}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
 })
 await page.goto('/knowledge-vault/')
 await page.getByLabel('E-Mail',{exact:true}).fill(user.email)
 await page.getByLabel('Passwort',{exact:true}).fill('placeholder')
 await page.getByRole('button',{name:'Anmelden',exact:true}).click()
 await page.getByRole('button',{name:'Menü öffnen'}).click()
 await page.locator('aside').getByText('Weitere Knowledge-Funktionen').click()
 await page.locator('aside').getByRole('link',{name:'Videos',exact:true}).click()
 await expect(page.getByText('Keine Vorschau')).toBeVisible()
 await page.getByRole('button',{name:'Vorschaubilder nachladen (8 Videos)'}).click()
 await expect(page.getByText(/konnten vom Anbieter nicht abgerufen/)).toBeVisible()
 expect(requests).toBe(1)
 await page.getByRole('button',{name:'Facebook-Vorschau versuchen'}).click()
 await expect(page.getByTitle(/Facebook-Vorschau/)).toHaveAttribute('src',/facebook.com\/plugins\/video.php/)
})
