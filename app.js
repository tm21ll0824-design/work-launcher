const c = window.WORK_LAUNCHER_CONFIG,
    s = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_PUBLISHABLE_KEY),
    $ = i => document.getElementById(i),
    esc = v => String(v ?? '').replace(/[&<>'"]/g, x => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    } [x]));
let user = null,
    notes = [],
    todos = [],
    editing = null;
const groups = [
    ['沟通协作', [
        ['Google Chat', 'https://chat.google.com', 'Ch', '#3e8f7c'],
        ['雅澄日历', 'https://calendar.google.com', '日历', '#4e76a8'],
        ['雅澄主号', 'https://mail.google.com/mail/u/0/', '主号', '#b5791e'],
        ['雅澄日报', 'https://mail.google.com/mail/u/1/', '日报', '#b15c48'],
        ['Google 地图', 'https://maps.google.com', '地图', '#3e8f7c'],
        ['雅澄主号-云盘', 'https://drive.google.com/drive/u/0/my-drive', '云1', '#4e76a8'],
        ['雅澄日报-云盘', 'https://drive.google.com/drive/u/1/my-drive', '云2', '#4e76a8']
    ]],
    ['业务后台', [
        ['Transfeero', 'https://control.transfeero.com/upcoming_rides', 'TF', '#b5791e'],
        ['KKday', 'https://scm.kkday.com/v2/zh-tw/auth/login', 'KK', '#b5791e'],
        ['Blacklane', 'https://partner.blacklane.com/offers/', 'BL', '#b5791e'],
        ['Get-E', 'https://app.portal.get-e.com/portal/login', 'GE', '#b5791e']
    ]],
    ['财务与凭证', [
        ['freee 请求書', 'https://accounts.secure.freee.co.jp/login/invoice', '帳', '#b15c48'],
        ['ETC 利用照会', 'https://www.etc-meisai.jp/', 'ETC', '#b15c48']
    ]],
    ['AI 工具', [
        ['ChatGPT', 'https://chatgpt.com', 'GPT', '#4e76a8']
    ]]
];

function tools() {
    let q = $('tool-search').value.toLowerCase();
    $('tool-panels').innerHTML = '';
    groups.forEach(g => {
        let a = g[1].filter(x => x[0].toLowerCase().includes(q));
        if (!a.length) return;
        let d = document.createElement('div');
        d.className = 'group';
        d.innerHTML = `<div class="group-title">${g[0]} · ${a.length} 项</div><div class="grid"></div>`;
        a.forEach(x => {
            let e = document.createElement('a');
            e.className = 'tile';
            e.href = x[1];
            e.innerHTML = `<span class="badge" style="background:${x[3]}">${x[2]}</span>${x[0]}`;
            d.querySelector('.grid').appendChild(e)
        });
        $('tool-panels').appendChild(d)
    })
}
$('tool-search').oninput = tools;
tools();

/* tab navigation: home / cal / map / flight / task / note — switches which section is visible, no page reload */
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-section').forEach(sec => sec.classList.toggle('hidden', sec.id !== `tab-${btn.dataset.tab}`));
    }
});

$('login-form').onsubmit = async e => {
    e.preventDefault();
    let {
        error
    } = await s.auth.signInWithPassword({
        email: $('login-email').value.trim(),
        password: $('login-password').value
    });
    $('login-message').textContent = error ? error.message : ''
};
$('logout-btn').onclick = () => s.auth.signOut();
s.auth.onAuthStateChange((_e, x) => enter(x));
s.auth.getSession().then(({
    data
}) => enter(data.session));
async function enter(x) {
    user = x?.user || null;
    $('auth-screen').classList.toggle('hidden', !!user);
    $('app').classList.toggle('hidden', !user);
    if (user) await Promise.all([loadNotes(), loadTodos(), loadFlights()])
}
async function loadNotes() {
    let {
        data,
        error
    } = await s.from('notes').select('*').order('pinned', {
        ascending: false
    }).order('updated_at', {
        ascending: false
    });
    if (error) return alert(error.message);
    notes = data || [];
    renderNotes();
    $('sync-state').textContent = '已同步'
}
async function loadTodos() {
    let {
        data,
        error
    } = await s.from('todos').select('*').order('created_at', {
        ascending: false
    });
    if (error) return alert(error.message);
    todos = data || [];
    renderTodos()
}

function renderTodos() {
    let p = $('todo-pending'),
        d = $('todo-done');
    p.innerHTML = d.innerHTML = '';
    $('task-ratio').textContent = `${todos.filter(x=>x.done).length}/${todos.length}`;
    todos.forEach(t => {
        let r = document.createElement('div');
        r.className = 'todo-row' + (t.done ? ' done' : '');
        r.innerHTML = `<input type="checkbox" ${t.done?'checked':''}><span>${esc(t.text)}</span><button class="icon-btn">×</button>`;
        r.querySelector('input').onchange = async e => {
            await s.from('todos').update({
                done: e.target.checked,
                updated_at: new Date().toISOString()
            }).eq('id', t.id);
            loadTodos()
        };
        r.querySelector('button').onclick = async () => {
            if (confirm('删除任务？')) {
                await s.from('todos').delete().eq('id', t.id);
                loadTodos()
            }
        };
        (t.done ? d : p).appendChild(r)
    });
    if (!p.children.length) p.textContent = '暂无未完成任务';
    if (!d.children.length) d.textContent = '暂无已完成任务'
}
async function addTodo() {
    let text = $('todo-input').value.trim();
    if (!text) return;
    let {
        error
    } = await s.from('todos').insert({
        user_id: user.id,
        text
    });
    if (error) return alert(error.message);
    $('todo-input').value = '';
    loadTodos()
}
$('todo-add').onclick = addTodo;
$('todo-input').onkeydown = e => {
    if (e.key === 'Enter') addTodo()
};

function renderNotes() {
    let q = $('note-search').value.toLowerCase(),
        cat = $('note-filter').value,
        a = notes.filter(n => (!cat || n.category === cat) && (!q || `${n.title} ${n.category} ${n.content}`.toLowerCase().includes(q)));
    $('note-count').textContent = `${notes.length} 条`;
    $('note-list').innerHTML = '';
    if (!a.length) {
        $('note-list').textContent = '暂无 Note';
        return
    }
    a.forEach(n => {
        let e = document.createElement('article');
        e.className = 'note-card' + (n.pinned ? ' pinned' : '');
        e.innerHTML = `<div class="note-head"><div class="note-title">${esc(n.title)}</div><span class="tag">${esc(n.category)}</span></div><div class="note-body">${esc(n.content)}</div><div class="note-actions"><button data-a="copy">复制</button><button data-a="edit">编辑</button><button data-a="pin">${n.pinned?'取消置顶':'置顶'}</button><button data-a="del">删除</button></div>`;
        e.querySelector('[data-a=copy]').onclick = () => navigator.clipboard.writeText(n.content);
        e.querySelector('[data-a=edit]').onclick = () => openEdit(n);
        e.querySelector('[data-a=pin]').onclick = async () => {
            await s.from('notes').update({
                pinned: !n.pinned,
                updated_at: new Date().toISOString()
            }).eq('id', n.id);
            loadNotes()
        };
        e.querySelector('[data-a=del]').onclick = async () => {
            if (confirm(`删除「${n.title}」？`)) {
                await s.from('notes').delete().eq('id', n.id);
                loadNotes()
            }
        };
        $('note-list').appendChild(e)
    })
}
$('note-search').oninput = renderNotes;
$('note-filter').onchange = renderNotes;

function openEdit(n) {
    editing = n?.id || null;
    $('note-title').value = n?.title || '';
    $('note-category').value = n?.category || '司机资料';
    $('note-content').value = n?.content || '';
    $('note-pinned').checked = !!n?.pinned;
    $('note-editor').classList.remove('hidden')
}
$('note-add').onclick = () => openEdit();
$('note-cancel').onclick = () => {
    $('note-editor').classList.add('hidden');
    editing = null
};
$('note-save').onclick = async () => {
    let p = {
        user_id: user.id,
        title: $('note-title').value.trim(),
        category: $('note-category').value,
        content: $('note-content').value.trim(),
        pinned: $('note-pinned').checked,
        updated_at: new Date().toISOString()
    };
    if (!p.title || !p.content) return alert('请填写标题和内容');
    let r = editing ? await s.from('notes').update(p).eq('id', editing) : await s.from('notes').insert(p);
    if (r.error) return alert(r.error.message);
    $('note-editor').classList.add('hidden');
    editing = null;
    loadNotes()
};
$('migrate-btn').onclick = async () => {
    let ns = JSON.parse(localStorage.getItem('launcher_knowledge_notes') || '[]'),
        ts = JSON.parse(localStorage.getItem('launcher_todos') || '[]');
    if (!ns.length && !ts.length) return alert('当前浏览器没有旧版数据');
    if (!confirm(`上传 ${ns.length} 条 Note、${ts.length} 条任务？`)) return;
    if (ns.length) {
        let {
            error
        } = await s.from('notes').insert(ns.map(n => ({
            user_id: user.id,
            title: n.title || '未命名',
            category: n.category || '临时备忘',
            content: n.content || '',
            pinned: !!n.pinned
        })));
        if (error) return alert(error.message)
    }
    if (ts.length) {
        let {
            error
        } = await s.from('todos').insert(ts.filter(t => t.text).map(t => ({
            user_id: user.id,
            text: t.text,
            done: !!t.done
        })));
        if (error) return alert(error.message)
    }
    await Promise.all([loadNotes(), loadTodos()]);
    alert('旧数据已上传')
};

function tick() {
    let n = new Date(),
        p = x => String(x).padStart(2, '0');
    $('clock').textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
    $('date').textContent = `${n.getFullYear()}.${p(n.getMonth()+1)}.${p(n.getDate())}`
}
tick();
setInterval(tick, 1000);
let wx = JSON.parse(localStorage.getItem('launcher_wx_location') || 'null');
async function weather() {
    if (!wx) return;
    try {
        let r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${wx.lat}&longitude=${wx.lon}&current=temperature_2m&timezone=auto`),
            j = await r.json();
        $('wx-temp').textContent = `${Math.round(j.current.temperature_2m)}°`;
        $('wx-desc').textContent = wx.name
    } catch {
        $('wx-desc').textContent = '获取失败'
    }
}
$('wx-card').onclick = async () => {
    let name = prompt('输入城市，例如 Tokyo', wx?.name || '');
    if (!name) return;
    let r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh`),
        j = await r.json();
    if (!j.results?.length) return alert('未找到城市');
    let x = j.results[0];
    wx = {
        name: x.name,
        lat: x.latitude,
        lon: x.longitude
    };
    localStorage.setItem('launcher_wx_location', JSON.stringify(wx));
    weather()
};
weather();

/* google maps search — no API key needed, uses the classic output=embed iframe trick */
$('map-go').onclick = () => {
    let q = $('map-search').value.trim();
    if (!q) return;
    $('map-embed').src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`
};
$('map-search').onkeydown = e => {
    if (e.key === 'Enter') $('map-go').click()
};

/* flight watch: quick batch lookup (opens flightradar24, reuses same tab per flight) + saved per-user queries in Supabase */
$('flight-open').onclick = () => {
    let codes = $('flight-batch').value.split(/[\s,，、]+/).map(x => x.trim()).filter(Boolean);
    codes.forEach(code => window.open(`https://www.flightradar24.com/data/flights/${code.toLowerCase()}`, `flt_${code}`, 'noopener'))
};
async function loadFlights() {
    let {
        data,
        error
    } = await s.from('flights').select('*').order('flight_date', {
        ascending: true
    });
    if (error) return;
    let el = $('flight-list');
    el.innerHTML = '';
    if (!data.length) {
        el.textContent = '暂无保存的航班';
        return
    }
    data.forEach(f => {
        let r = document.createElement('div');
        r.className = 'todo-row';
        r.innerHTML = `<span><b>${esc(f.flight_no)}</b> · ${f.flight_date}${f.note?' · '+esc(f.note):''}</span><button class="icon-btn" data-a="view">查看</button><button class="icon-btn" data-a="del">×</button>`;
        r.querySelector('[data-a=view]').onclick = () => window.open(`https://www.flightradar24.com/data/flights/${f.flight_no.toLowerCase()}`, `flt_${f.flight_no}`, 'noopener');
        r.querySelector('[data-a=del]').onclick = async () => {
            if (confirm(`删除「${f.flight_no} · ${f.flight_date}」？`)) {
                await s.from('flights').delete().eq('id', f.id);
                loadFlights()
            }
        };
        el.appendChild(r)
    })
}
$('flight-save').onclick = async () => {
    let flight_no = $('flight-no').value.trim().toUpperCase(),
        flight_date = $('flight-date').value,
        note = $('flight-note').value.trim();
    if (!flight_no || !flight_date) return alert('请填写航班号和日期');
    let {
        error
    } = await s.from('flights').insert({
        user_id: user.id,
        flight_no,
        flight_date,
        note
    });
    if (error) return alert(error.message);
    $('flight-no').value = '';
    $('flight-note').value = '';
    loadFlights()
};