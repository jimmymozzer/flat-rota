const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const db = { names:['Jimmy','Euan'], ticks:{}, custom:[] };
  const ctx = await b.newContext({ viewport:{width:390,height:844} });
  await ctx.route('https://krpkuwjptablxyoukrkv.supabase.co/**', r => { const fn=r.request().url().split('/rpc/')[1]; const body=r.request().postDataJSON()||{};
    if(fn==='rota_state') return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(db)});
    if(fn==='rota_tick'){ if(body.p_by===null) delete db.ticks[body.p_key]; else db.ticks[body.p_key]={by:body.p_by,at:new Date().toISOString()}; }
    if(fn==='rota_custom_save'){ db.custom=db.custom.filter(c=>c.id!==body.p_id); db.custom.push({id:body.p_id,week:body.p_week,name:body.p_name,owner:body.p_owner,minutes:body.p_minutes}); }
    if(fn==='rota_custom_delete'){ db.custom=db.custom.filter(c=>c.id!==body.p_id); for (const k of Object.keys(db.ticks)) if (k.includes('_c-'+body.p_id)) delete db.ticks[k]; }
    r.fulfill({status:204,body:''}); });
  const A = await ctx.newPage(); const errs=[]; A.on('pageerror', e=>errs.push(e.message));
  await A.goto('file://' + require('path').resolve(__dirname, '../app/bundle.html') + '');
  await A.getByPlaceholder('Flat code').fill('x'); await A.getByText('Open the rota').click(); await A.waitForTimeout(800);
  await A.getByText("I'm Jimmy").click();
  // tick: sheet should appear at the bottom of the viewport
  await A.getByLabel('Tick Hoover & mop hallway').click(); await A.waitForTimeout(500);
  const sheet = A.locator('div.fixed.bottom-0');
  console.log('sheet visible:', await sheet.isVisible());
  await A.screenshot({path:'/tmp/sheet.png'});
  await sheet.getByRole('button',{name:'30',exact:true}).click(); await A.waitForTimeout(600);
  console.log('sheet after log:', await sheet.count(), 'dur keys:', Object.keys(db.ticks).filter(k=>k.includes('_dur_')));
  // add custom job
  await A.getByText('+ Add a one-off job').click();
  await A.getByPlaceholder('e.g. Clean behind the fridge').fill('Clean behind the fridge');
  await A.getByRole('button',{name:'Either of us'}).click();
  await A.getByRole('button',{name:'Add job'}).click(); await A.waitForTimeout(800);
  console.log('custom in db:', JSON.stringify(db.custom));
  console.log('custom row shown:', await A.getByText('Clean behind the fridge').count());
  await A.getByText('Clean behind the fridge').scrollIntoViewIfNeeded();
  await A.screenshot({path:'/tmp/custom.png'});
  await A.getByLabel('Tick Clean behind the fridge').click(); await A.waitForTimeout(500);
  await A.locator('div.fixed.bottom-0').getByRole('button',{name:'45',exact:true}).click(); await A.waitForTimeout(600);
  console.log('ticks:', Object.keys(db.ticks));
  await A.getByText('Fair share').click(); await A.waitForTimeout(300);
  console.log('fair:', await A.locator('p').filter({hasText:/more so far|Dead level/}).allTextContents());
  await A.getByText('This week',{exact:true}).first().click(); await A.waitForTimeout(300);
  await A.getByText('Clean behind the fridge').click(); await A.waitForTimeout(200);
  await A.getByText('Remove job').click(); await A.waitForTimeout(800);
  console.log('after remove custom:', db.custom.length, 'ticks:', Object.keys(db.ticks));
  console.log('errors', errs); await b.close();
})();
