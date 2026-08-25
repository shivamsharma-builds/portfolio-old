    else if (remote) { await deleteMedia(current[field]); values[field]=isRemote(remote)?remote:null; values[urlField]=isRemote(remote)?remote:''; }
    else values[field]=current[field] || null;
  }
  const resume=form.get('resume_file'); const resumeUpload=await uploadFile(resume,'resume'); const remoteResume=f.resume_url||'';
  if (resumeUpload) { await deleteMedia(current.resume_file); values.resume_file=resumeUpload; values.resume_url=''; }
  else if (remoteResume) { await deleteMedia(current.resume_file); values.resume_file=isRemote(remoteResume)?remoteResume:null; values.resume_url=isRemote(remoteResume)?remoteResume:''; }
  else values.resume_file=current.resume_file || null;
  await saveRow('site_content',1,values); return json({ok:true});
}

async function handleEntity(request, table, fileField, folder, requiredField, extra = {}) {
  requireAuth(request); const form=await request.formData(); const f=fieldMap(form); const id=f.id ? Number(f.id) : null;
  if (!String(f[requiredField]||'').trim()) throw Object.assign(new Error(`${requiredField === 'institution' ? 'Institution' : requiredField[0].toUpperCase()+requiredField.slice(1)} is required.`),{status:400});
  let current={}; if(id){const [[row]]=await db.query(`SELECT * FROM \`${table}\` WHERE id=? LIMIT 1`,[id]);if(!row) throw Object.assign(new Error(`${table} entry not found.`),{status:404});current=row;}
  const file=form.get(fileField); const uploaded=await uploadFile(file,folder); const old=f[`existing_${fileField}`] || current[fileField] || '';
  if(uploaded){await deleteMedia(old); f[fileField]=uploaded;} else f[fileField]=old;
  Object.assign(f,extra);
  if (table === 'experiences') f.role = String(f.title || f.role || '').trim();
  delete f.id; delete f[`existing_${fileField}`];
  await saveRow(table,id,f); return json({ok:true});
}

async function handleProject(request) {
  requireAuth(request);
  const form = await request.formData();
  const f = fieldMap(form);
  const id = f.id ? Number(f.id) : null;
  if (!String(f.title || '').trim()) throw Object.assign(new Error('Project title is required.'), {status:400});

  let current = {};
  if (id) {
    const [[row]] = await db.query('SELECT * FROM projects WHERE id=? LIMIT 1', [id]);
    if (!row) throw Object.assign(new Error('Project entry not found.'), {status:404});
    current = row;
  }

  // Project icon and project image are independent uploads.
  const icon = await uploadFile(form.get('icon_file'), 'projects/icons');
  const image = await uploadFile(form.get('image_file'), 'projects/images');

  if (icon) {
    await deleteMedia(f.existing_icon_file || current.icon_file || '');
    f.icon_file = icon;
    f.icon_url = '';
  } else {
    f.icon_file = current.icon_file || '';
  }

  if (image) {
    await deleteMedia(f.existing_image_url || current.image_url || '');
    f.image_url = image;
  } else if (f.image_url && isRemote(f.image_url)) {
    await deleteMedia(current.image_url || '');
  } else {
    f.image_url = current.image_url || '';
  }

  delete f.id;
  delete f.existing_icon_file;
  delete f.existing_image_url;
  delete f.image_file;

  // Keep optional project fields valid for both INSERT and UPDATE.
  for (const key of ['description','icon_url','image_url','project_url','github_url','project_file','sort_order']) {
    if (f[key] === undefined) f[key] = key === 'sort_order' ? 0 : '';
  }

  const savedId = await saveRow('projects', id, f);
  return json({ok:true, id: Number(savedId || id || 0)});
}

async function main(request) {
  await readySchema();
  const url=new URL(request.url); let path=url.pathname.replace(/\/+$/,'');
  path=path.replace(/^\/\.netlify\/functions\/api/,'').replace(/^\/api/,'') || '/';
  const method=request.method.toUpperCase();
  if (path === '/media' || path.startsWith('/media/')) {
    if(method!=='GET') return json({error:'Method not allowed'},405);
    const key=decodeURIComponent(path.replace(/^\/media\//,'')); if(!key) return text('Not found',404);
    const metadata=await uploads.getMetadata(key); if(!metadata) return text('Not found',404);
    const body=await uploads.get(key,{type:'arrayBuffer'}); if(body==null) return text('Not found',404);
    return new Response(body,{headers:{'content-type':metadata.metadata?.contentType||'application/octet-stream','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}});
  }
  if(path==='/session' && method==='GET') return json({authenticated:!!sessionEmail(request),email:sessionEmail(request)});
  if(path==='/login' && method==='POST') {
    const {email,password}=await request.json();
    const [rows]=await db.query('SELECT * FROM admins WHERE email=? LIMIT 1',[email]);
    if(!rows.length || !(await bcrypt.compare(password,rows[0].password_hash))) return json({error:'Invalid email or password'},401);
    return json({ok:true,redirect:'/admin.html'},200,{'set-cookie':cookieHeader(createSession(rows[0].email),SESSION_TTL/1000)});
  }
  if(path==='/logout' && method==='POST') return json({ok:true,redirect:'/admin.html'},200,{'set-cookie':cookieHeader('',0)});
  if(path==='/public' && method==='GET') return json(await publicData(),200,{'cache-control':'public,max-age=30,stale-while-revalidate=300'});
  if(path==='/admin/data' && method==='GET'){requireAuth(request);return json(await adminData());}
  if(path==='/admin/site' && method==='POST') return handleSite(request);
  if(path==='/admin/site-image' && method==='DELETE') return json({error:'Use /api/admin/site-image/:field'},400);
  const siteDelete=path.match(/^\/admin\/site-image\/([^/]+)$/); if(siteDelete && method==='DELETE') { requireAuth(request); const field=siteDelete[1]; if(!['profile_image','hero_image','about_image'].includes(field)) return json({error:'Invalid image field.'},400); const site=await getSite(); await deleteMedia(site[field]); await saveRow('site_content',1,{[field]:null,[`${field}_url`]:''}); return json({ok:true}); }
  const entity=path.match(/^\/admin\/(skills|projects|experiences|certificates|education)(?:\/(\d+))?$/);
  if(entity){
    const table=entity[1], id=entity[2] ? Number(entity[2]) : null;
    if(method==='DELETE'){requireAuth(request); const [[row]]=await db.query(`SELECT * FROM \`${table}\` WHERE id=? LIMIT 1`,[id]); if(!row)return json({error:'Entry not found.'},404); for(const field of ['icon_file','logo_image','certificate_image','project_file','image_url']) if(row[field]) await deleteMedia(row[field]); await db.query(`DELETE FROM \`${table}\` WHERE id=?`,[id]); return json({ok:true});}
    if(method==='POST'){
      if(table==='skills') return handleEntity(request,table,'icon_file','skills','title');
      if(table==='projects') return handleProject(request);
      if(table==='experiences') return handleEntity(request,table,'logo_image','experiences','title');
      if(table==='certificates') return handleEntity(request,table,'certificate_image','certificates','title');
      if(table==='education') return handleEntity(request,table,'logo_image','education','institution');
    }
  }
  return json({error:'Not found'},404);
}

export default async (request) => {
  try { return await main(request); }
  catch (error) { console.error('API error',error); return json({error:error.message || 'Server error'},error.status || 500); }
};


export const config = { path: ['/api/*','/api','/.netlify/functions/api/*'] };
