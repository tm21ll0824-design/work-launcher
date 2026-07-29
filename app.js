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
        ['Get-E', 'https://app.portal.get-e.com/portal/login', 'GE', '#b5791e'],
        ['公司系统', 'https://hire-management-system-production.up.railway.app/login.html', '系统', '#b5791e'],
        ['公司官网', 'https://kasumi-hire.co.jp/', '官网', '#b5791e']
    ]],
    ['财务与凭证', [
        ['freee 请求書', 'https://accounts.secure.freee.co.jp/login/invoice', '帳', '#b15c48'],
        ['ETC 利用照会', 'https://www.etc-meisai.jp/', 'ETC', '#b15c48'],
        ['Square 收款', 'https://app.squareup.com/', 'SQ', '#b15c48']
    ]],
    ['AI 工具', [
        ['ChatGPT', 'https://chatgpt.com', 'GPT', '#4e76a8'],
        ['Claude', 'https://claude.ai', 'Cl', '#b5791e'],
        ['DeepL 翻译', 'https://www.deepl.com/translator', '译', '#3e8f7c']
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
            e.target = `tool_${x[0]}`;
            e.rel = 'noopener';
            e.innerHTML = `<span class="badge" style="background:${x[3]}">${x[2]}</span>${x[0]}`;
            d.querySelector('.grid').appendChild(e)
        });
        $('tool-panels').appendChild(d)
    })
}
$('tool-search').oninput = tools;
tools();
$('tools-toggle').onclick = () => {
    let open = $('tools-collapse').classList.toggle('hidden') === false;
    $('tools-toggle').textContent = (open ? '快捷工具 ▴' : '快捷工具 ▾')
};

/* tab navigation: home / cal / map / flight / task / note — switches which section is visible, no page reload */
function goTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.toggle('hidden', sec.id !== `tab-${tab}`))
}
document.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => goTab(btn.dataset.tab));
document.querySelectorAll('.tab-link').forEach(link => link.onclick = () => goTab(link.dataset.goto));


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
        r.innerHTML = `<input type="checkbox" ${t.done?'checked':''}><span>${esc(t.text)}</span><button class="icon-btn icon-btn-sq" data-a="edit">✎</button><button class="icon-btn icon-btn-sq" data-a="del">×</button>`;
        r.querySelector('input').onchange = async e => {
            await s.from('todos').update({
                done: e.target.checked,
                updated_at: new Date().toISOString()
            }).eq('id', t.id);
            loadTodos()
        };
        r.querySelector('[data-a=edit]').onclick = async () => {
            let text = prompt('修改任务内容', t.text);
            if (text === null || !text.trim()) return;
            await s.from('todos').update({
                text: text.trim(),
                updated_at: new Date().toISOString()
            }).eq('id', t.id);
            loadTodos()
        };
        r.querySelector('[data-a=del]').onclick = async () => {
            if (confirm('删除任务？')) {
                await s.from('todos').delete().eq('id', t.id);
                loadTodos()
            }
        };
        (t.done ? d : p).appendChild(r)
    });
    if (!p.children.length) p.textContent = '暂无未完成任务';
    if (!d.children.length) d.textContent = '暂无已完成任务';
    renderHomeTasks()
}
function renderHomeTasks() {
    let el = $('home-tasks');
    if (!el) return;
    let pending = todos.filter(t => !t.done).slice(0, 6);
    el.innerHTML = '';
    if (!pending.length) {
        el.innerHTML = '<div class="home-empty">暂无未完成任务</div>';
        return
    }
    pending.forEach(t => {
        let r = document.createElement('div');
        r.className = 'home-row';
        r.innerHTML = `<input type="checkbox"><span style="flex:1">${esc(t.text)}</span>`;
        r.querySelector('input').onchange = async e => {
            await s.from('todos').update({
                done: e.target.checked,
                updated_at: new Date().toISOString()
            }).eq('id', t.id);
            loadTodos()
        };
        el.appendChild(r)
    })
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
    });
    renderHomeNotes()
}
function renderHomeNotes() {
    let el = $('home-notes');
    if (!el) return;
    let pinned = notes.filter(n => n.pinned).slice(0, 6);
    el.innerHTML = '';
    if (!pinned.length) {
        el.innerHTML = '<div class="home-empty">还没有置顶的信息，去信息库把常用的钉上来</div>';
        return
    }
    pinned.forEach(n => {
        let r = document.createElement('div');
        r.className = 'home-row';
        r.innerHTML = `<span style="flex:1"><b>${esc(n.title)}</b> <span class="tag">${esc(n.category)}</span></span><button class="icon-btn">复制</button>`;
        r.querySelector('button').onclick = () => navigator.clipboard.writeText(n.content);
        el.appendChild(r)
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
if (!wx) autoLocateWeather();

async function autoLocateWeather() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async pos => {
            let {
                latitude,
                longitude
            } = pos.coords, name = '当前位置';
            try {
                let r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`),
                    j = await r.json();
                name = j.city || j.locality || name
            } catch {}
            wx = {
                name,
                lat: latitude,
                lon: longitude
            };
            localStorage.setItem('launcher_wx_location', JSON.stringify(wx));
            weather()
        }, () => ipLocateWeather(), {
            timeout: 5000
        })
    } else {
        ipLocateWeather()
    }
}
async function ipLocateWeather() {
    try {
        let r = await fetch('https://ipapi.co/json/'),
            j = await r.json();
        if (j.latitude && j.longitude) {
            wx = {
                name: j.city || j.country_name || '未知位置',
                lat: j.latitude,
                lon: j.longitude
            };
            localStorage.setItem('launcher_wx_location', JSON.stringify(wx));
            weather()
        } else {
            $('wx-desc').textContent = '定位失败，点击设置城市'
        }
    } catch {
        $('wx-desc').textContent = '定位失败，点击设置城市'
    }
}

/* google calendar — agenda restricted to one selected day (default today) via dates= param */
function ymd(d) {
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
}
const CAL_SRC_PARAMS = "wkst=1&ctz=Asia%2FTokyo&showPrint=0&src=eWFjaGVuZ2d1b2ppMDAxQGdtYWlsLmNvbQ&src=MGFmNzkyMjdmZTAyMTYwZDQ5ZjczY2U1MDg3ZTFkMDI4ZjVmOWUzZjVkNzcyMjNmNzI2ZTlkMWJjNzkyYTJhYkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=YmU0ZWFiNDVlYjI4NjI2Y2NhYzU1YWI1YTMwNDg4MTg1OTEzYTg0OGVkNzI2MTI1ODVmNmI5NjQ3OGRkYWQ5ZEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=M2E2YjA1ZmJkMzY3NTJmMWNkZDIxMzNkNTIwZjc4YzVlNTkzODcwYjYxZTY1YWY2YWQ4ZjdkNTRjODU4MWEwNUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=MzNlYmEyYjRhOGYxOGEzNDZmMGQyM2Y0MWQxMGE5NzQ1YTQxZDY2MDc5NTNiZGM1OWRiMDk0MTEwODMyM2Q2NEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=NTI1NWYyNTAwYWNmNTM1YTI5MWRhNDUwOGUwNDU1YWUxMzY5OGY1MWY0ZWFmZjFlZWE4NWUxOTUyODAzMDU2Y0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=OWQ4YmZkNzM4YjMyYzcxNjIyYzFkYzg0YTIyN2JkNzA2MTVmZGYyNjZiZGJkN2YwZWUxZmJkNDViMzQyM2E2Y0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=NTVlNzVhNWNhYjk5MmZiNGE1ODkxZmM5NjNiMGQ5MjM3YTVkNzJjNjExMjg1NGQ1YzcyNDg3NjhmMTJjOTE0NEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=M2I4NmY0YTFmZDdhNWFhMTM0YTUwYTFiMTQyNTg5NmMxZTNkMzc2NDJhNGIyNjRmMjVmOTg1OWI5NzVhZWYxN0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=NGIwOWU4YzI4MTlkMmI1NjRhMWNlYjAwYjkzNDdkZmZjNDgyM2Q4ZDNiN2JlMDliOTU3MjMyZjYzYzg4MzJmYUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=OTNkMTg3YTgyMWE3MzkxNDFiZDY2NTE3OTViNzEwZTAzNjM0ZDYxMGE4NWJhZjZjNTJiYTZmOTRiZDRhY2ExOEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=ZmI0NjNhNDYyYzRiYjIzZmUwYTgxYWY2ZTNhZTA1ZDc3NmQ0YzY4MmVhN2E3YjQ4YTk0ZmY1MDhlN2QyMjBlOUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=Yzg4MTQ5MjI3YWU1OGFkMDdiNTY3ZmI3Y2I0YzU1MDFlZTM2Y2FiODcxZGY5MGNjOTc2NWQzMzBhM2ZmNDdmN0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=YjllNzViNjJlMzc5NTAyN2IyY2ZhNmVhNjYxMzUxNzdiODMwODFhN2MxODZhZDMyNzNiYTI5ZjNjYTE1ZmI1YkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=YTMyMTNmMWU1MDUyZWQyNjgxM2ExZDJkM2QzNjMyNDBmNzFlZDUzZmIyZDNjYzMxZDI2MDM3MThmNzJhMjI2ZEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=YmY2YmE4ZDJmZDUzMTM5N2ZhYWQxNmY0ZjY1ZGJmZDY5YTgyMTNkNDhmYzljMTkzOTBlY2E3MDA1NGYzNzA3NUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=MDYzNjM0OWRmMTdlODQzZDU3YWI1ZWJmY2FlZWU0MGMwY2I2ZTVjYWI4MTU5OTVkYTRhNzQ1ZGFkMDFjYzFkZkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=NmRiY2ZkYWZlNWM5ZTBlOTkzZTQyYTJjMDFhYzUyOTVkNGJiMGFmZTc0NGQ1NThlNzBlODlhZjE2MWVmN2FiM0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=MTg2ZDI5MTYwOGE4NGJhMjllNDQ0NmZkODI4YWRjOThmYmVkOWRjZTgxYWM3MjE0ZGNjZTRhZDdhNWZjYmMxM0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=YjNmZmQ5MzFhOWRlNTAwZTg5MjhlZTE1OTg3NmEzOGEwMGY5MDkwOGRiYzBhYmUyYjIzMjU5MmVjZjZkZDNhYUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&color=%23db8ed0&color=%23d50000&color=%238e24aa&color=%230b8043&color=%236bf626&color=%23f6e826&color=%23f6a626&color=%237cb342&color=%23039be5&color=%23f6bf26&color=%23d81b60&color=%23ef6c00&color=%23e67c73&color=%23616161&color=%23030009&color=%239efff5&color=%233f51b5&color=%23795548&color=%23a98be0&color=%237986cb";
function loadCalendarDay(dateStr) {
    let d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    let next = new Date(d);
    next.setDate(next.getDate() + 1);
    let mode = $('cal-mode').value || 'AGENDA';
    $('cal-embed').src = `https://calendar.google.com/calendar/embed?${CAL_SRC_PARAMS}&mode=${mode}&dates=${ymd(d)}/${ymd(next)}&showTitle=0&showTabs=0&showCalendars=0&showTz=0`;
    $('cal-date').value = d.toISOString().slice(0, 10)
}
loadCalendarDay();
$('cal-date').onchange = () => loadCalendarDay($('cal-date').value);
$('cal-mode').onchange = () => loadCalendarDay($('cal-date').value);
$('cal-today').onclick = () => loadCalendarDay();

/* google maps search — no API key needed, uses the classic output=embed iframe trick */
$('map-go').onclick = () => {
    let q = $('map-search').value.trim();
    if (!q) return;
    $('map-embed').src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    $('map-open-link').style.display = 'none'
};
$('map-search').onkeydown = e => {
    if (e.key === 'Enter') $('map-go').click()
};
$('map-route').onclick = () => {
    let from = $('map-from').value.trim(),
        to = $('map-to').value.trim();
    if (!from || !to) return alert('请填写起点和终点');
    $('map-embed').src = `https://www.google.com/maps?saddr=${encodeURIComponent(from)}&daddr=${encodeURIComponent(to)}&output=embed`;
    $('map-open-link').href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`;
    $('map-open-link').style.display = 'block'
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
        r.innerHTML = `<span><b>${esc(f.flight_no)}</b> · ${f.flight_date}${f.note?' · '+esc(f.note):''}</span><button class="icon-btn" data-a="view">查看</button><button class="icon-btn icon-btn-sq" data-a="del">×</button>`;
        r.querySelector('[data-a=view]').onclick = () => window.open(`https://www.flightradar24.com/data/flights/${f.flight_no.toLowerCase()}`, `flt_${f.flight_no}`, 'noopener');
        r.querySelector('[data-a=del]').onclick = async () => {
            if (confirm(`删除「${f.flight_no} · ${f.flight_date}」？`)) {
                await s.from('flights').delete().eq('id', f.id);
                loadFlights()
            }
        };
        el.appendChild(r)
    });
    renderHomeFlights(data)
}
function renderHomeFlights(all) {
    let el = $('home-flights');
    if (!el) return;
    let todayStr = new Date().toISOString().slice(0, 10);
    let today = (all || []).filter(f => f.flight_date === todayStr);
    el.innerHTML = '';
    if (!today.length) {
        el.innerHTML = '<div class="home-empty">今天没有保存的航班</div>';
        return
    }
    today.forEach(f => {
        let r = document.createElement('div');
        r.className = 'home-row';
        r.innerHTML = `<span style="flex:1"><b>${esc(f.flight_no)}</b>${f.note?' · '+esc(f.note):''}</span><button class="icon-btn">查看</button>`;
        r.querySelector('button').onclick = () => window.open(`https://www.flightradar24.com/data/flights/${f.flight_no.toLowerCase()}`, `flt_${f.flight_no}`, 'noopener');
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