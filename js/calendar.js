import { showError } from './feedback.js';
// Display dates are local calendar dates; never parse YYYY-MM-DD as UTC.
const $ = id => document.getElementById(id);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Boise', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const part = name => today.find(p => p.type === name).value;
const todayKey = `${part('year')}-${part('month')}-${part('day')}`;
let year = +part('year'), month = +part('month') - 1, selected = +part('day'), filter = 'all';
let events = [], wards = [], lastFocus;
const key = day => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const dateLabel = date => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
const timeLabel = time => { const [h, m] = time.split(':'); return `${+h % 12 || 12}:${m} ${+h < 12 ? 'AM' : 'PM'}`; };
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wardFor = event => wards.find(w => w.id === event.calendarId);
const onDate = date => events.filter(e => e.date === date && (filter === 'all' || wardFor(e).name === filter)).sort((a,b) => a.startTime.localeCompare(b.startTime));

function render() {
  $('monthTitle').textContent = new Intl.DateTimeFormat('en-US', {month:'long', year:'numeric'}).format(new Date(year, month, 1));
  $('dateTitle').textContent = dateLabel(key(selected));
  const grid = $('calendarDays');
  grid.replaceChildren();
  for (let i = 0; i < new Date(year, month, 1).getDay(); i++) grid.insertAdjacentHTML('beforeend', '<div class="day empty"></div>');
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
    const date = key(day);
    const markers = [...new Set(onDate(date).map(e => e.calendarId))].slice(0,6);
    const button = document.createElement('button');
    button.className = `day ${day === selected ? 'selected' : ''} ${date === todayKey ? 'today' : ''}`;
    button.setAttribute('aria-label', dateLabel(date));
    button.setAttribute('aria-pressed', String(day === selected));
    button.innerHTML = `<span class="number">${day}</span><span class="dots">${markers.map(id => `<i class="dot" style="background:${wards.find(w => w.id === id).color}"></i>`).join('')}</span>`;
    button.onclick = () => { selected = day; render(); };
    grid.append(button);
  }
  const list = onDate(key(selected));
  $('count').textContent = `${list.length} ${list.length === 1 ? 'event' : 'events'}`;
  $('events').replaceChildren();
  if (!list.length) $('events').innerHTML = '<article class="event" style="--c:#cbd4cc"><div class="event-main"><h3>Nothing scheduled yet</h3><div class="meta">Choose another day or calendar.</div></div></article>';
  for (const event of list) {
    const ward = wardFor(event), card = document.createElement('article');
    card.className = 'event'; card.tabIndex = 0; card.setAttribute('role', 'button'); card.style.setProperty('--c', ward.color);
    card.innerHTML = `<div class="time">${timeLabel(event.startTime)}</div><div class="event-main"><h3>${escapeHTML(event.title)}</h3><div class="meta"><span class="pill">${escapeHTML(ward.name)}</span><span>${escapeHTML(event.place)}</span></div></div><span class="chevron">›</span>`;
    card.onclick = () => openModal(event);
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(event); } };
    $('events').append(card);
  }
}

function openModal(event) {
  lastFocus = document.activeElement;
  const ward = wardFor(event);
  for (const [id, value] of Object.entries({modalTitle:event.title, detailEvent:event.title, detailDate:dateLabel(event.date), detailTime:`${timeLabel(event.startTime)} – ${timeLabel(event.endTime)}`, detailPlace:event.place, detailDescription:event.description})) $(id).textContent = value;
  $('modalWard').style.setProperty('--event-color', ward.color);
  $('modalWard').querySelector('span').textContent = ward.name;
  $('eventModal').classList.add('open'); $('eventModal').setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden'; $('closeModal').focus();
}
function closeModal() {
  $('eventModal').classList.remove('open'); $('eventModal').setAttribute('aria-hidden','true');
  document.body.style.overflow = ''; lastFocus?.focus();
}
$('closeModal').onclick = closeModal;
$('eventModal').onclick = e => { if(e.target === $('eventModal')) closeModal(); };
document.addEventListener('keydown', e => { if (!$('eventModal').classList.contains('open')) return; if(e.key === 'Escape') closeModal(); if(e.key === 'Tab') { e.preventDefault(); $('closeModal').focus(); } });
function changeMonth(delta) { const date = new Date(year, month + delta, 1); year = date.getFullYear(); month = date.getMonth(); selected = 1; render(); }
$('prev').onclick = () => changeMonth(-1);
$('next').onclick = () => changeMonth(1);
document.querySelectorAll('.filter').forEach(button => button.onclick = () => {
  if(button.id === 'todayBtn') { year = +part('year'); month = +part('month') - 1; selected = +part('day'); filter = 'all'; }
  else filter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach(b => { const active = b.dataset.filter === filter; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); }); render();
});

try {
  let eventResponse = await fetch('/api/events');
  if (eventResponse.status === 404 || (eventResponse.ok && !eventResponse.headers.get('content-type')?.includes('application/json'))) eventResponse = await fetch('data/events.json');
  const responses = [await fetch('data/wards.json'), eventResponse];
  if(responses.some(r => !r.ok)) throw new Error('Calendar data could not be loaded');
  const [wardData, eventData] = await Promise.all(responses.map(r => r.json()));
  wards = wardData;
  const ids = new Set();
  for(const event of eventData.events) {
    if(!event.id || ids.has(event.id) || !wards.some(w => w.id === event.calendarId) || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.endTime) || event.endTime <= event.startTime || typeof event.title !== 'string' || typeof event.place !== 'string' || typeof event.description !== 'string') throw new Error('Invalid event data');
    ids.add(event.id);
  }
  events = eventData.events; render();
} catch(error) {
  console.error(error); render(); $('count').textContent = '';
  $('events').textContent = 'The calendar could not load. Please refresh or try again later.';
  showError('The calendar could not load. Please refresh or try again later.');
}
