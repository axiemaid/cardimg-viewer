/* CARDIMG Viewer — Client logic with routing */

const API = window.CARDIMG_API || 'http://localhost:3014'
let allCards = []
let allSets = []
let activeTab = 'uploads'

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
  // Brand click → home
  document.getElementById('brand-link').addEventListener('click', e => {
    e.preventDefault()
    navigate('/')
  })

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab
      navigate(tab === 'uploads' ? '/' : '/cards')
    })
  })

  document.addEventListener('click', e => {
    if (e.target.closest('.back-link')) {
      e.preventDefault()
      window.history.back()
    }
  })

  // Initial route
  loadStats()
  handleRoute()
})

// --- Routing ---

window.addEventListener('popstate', handleRoute)

function handleRoute() {
  const path = window.location.pathname

  // /cardimg/:txid — upload detail page
  if (path.startsWith('/cardimg/')) {
    const txid = path.replace('/cardimg/', '')
    showUploadPage(txid)
    return
  }

  // /card/:txid — card detail page
  if (path.startsWith('/card/')) {
    const txid = path.replace('/card/', '')
    showCardPage(txid)
    return
  }

  // /cards — cards tab
  if (path === '/cards') {
    showGallery('cards')
    return
  }

  // / — uploads tab (default)
  showGallery('uploads')
}

function navigate(path) {
  window.history.pushState({}, '', path)
  handleRoute()
  window.scrollTo(0, 0)
}

function showGallery(tab) {
  activeTab = tab
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === (tab === 'cards' ? 'cards' : 'uploads'))
  })

  document.getElementById('gallery-view').style.display = ''
  document.getElementById('upload-page').style.display = 'none'
  document.getElementById('card-page').style.display = 'none'

  const gallery = document.getElementById('gallery')
  const setsView = document.getElementById('sets-view')

  if (tab === 'uploads') {
    gallery.style.display = ''
    gallery.classList.add('active')
    setsView.style.display = 'none'
    setsView.classList.remove('active')
    if (allCards.length === 0) loadCards()
  } else {
    gallery.style.display = 'none'
    gallery.classList.remove('active')
    setsView.style.display = ''
    setsView.classList.add('active')
    if (allSets.length === 0) loadSets()
  }
}

function showUploadPage(txid) {
  document.getElementById('gallery-view').style.display = 'none'
  document.getElementById('card-page').style.display = 'none'
  document.getElementById('upload-page').style.display = ''
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'))
  renderUploadPage(txid)
}

function showCardPage(txid) {
  document.getElementById('gallery-view').style.display = 'none'
  document.getElementById('upload-page').style.display = 'none'
  document.getElementById('card-page').style.display = ''
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'))
  renderCardPage(txid)
}

// --- Stats ---

async function loadStats() {
  try {
    const res = await fetch(`${API}/stats`)
    const data = await res.json()
    document.getElementById('stat-count').textContent = data.totalImages.toLocaleString()
    document.getElementById('stat-size').textContent = formatBytes(data.totalBytes)

    if (data.sets) {
      // could update a badge here if re-added
    }
  } catch (e) {
    // silent fail
  }
}

// --- Uploads Gallery ---

async function loadCards(isRefresh) {
  const grid = document.getElementById('grid')
  const loading = document.getElementById('loading')
  const empty = document.getElementById('empty')

  if (isRefresh) {
  }

  try {
    const res = await fetch(`${API}/list`)
    const cards = await res.json()

    cards.sort((a, b) => {
      const aUnc = !a.blockHeight
      const bUnc = !b.blockHeight
      if (aUnc && !bUnc) return -1
      if (!aUnc && bUnc) return 1
      if (aUnc && bUnc) return 0
      return (b.blockHeight || 0) - (a.blockHeight || 0)
    })

    allCards = cards

    loading.style.display = 'none'

    if (cards.length === 0) {
      empty.style.display = 'flex'
      grid.style.display = 'none'
      return
    }

    empty.style.display = 'none'
    grid.style.display = 'grid'
    grid.innerHTML = ''

    cards.forEach((card, i) => {
      grid.appendChild(createCardElement(card, i))
    })

    loadStats()
  } catch (e) {
    loading.innerHTML = `<p style="color:#ef4444">Failed to load: ${e.message}</p>`
  } finally {
  }
}

function createCardElement(card, index) {
  const el = document.createElement('div')
  el.className = 'card'
  el.dataset.hash = card.hash

  const isUnconfirmed = !card.blockHeight

  el.innerHTML = `
    <div class="card-image-wrap" style="position:relative">
      <img class="card-image loading" alt="Upload ${shortHash(card.txid)}" />
      ${isUnconfirmed ? '<span class="card-badge unconfirmed">unconfirmed</span>' : ''}
    </div>
    <div class="card-info">
      <div class="card-txid" title="${card.txid}">${shortHash(card.txid)}</div>
      <div class="card-size">${formatBytes(card.size)}</div>
    </div>
  `

  const img = el.querySelector('img')
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        img.src = `${API}/thumb/${card.hash}`
        img.onload = () => img.classList.remove('loading')
        img.onerror = () => {
          img.classList.remove('loading')
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="%231c1c22"/><text x="100" y="140" text-anchor="middle" fill="%235a5a66" font-size="14">Failed to load</text></svg>'
        }
        observer.unobserve(el)
      }
    })
  }, { rootMargin: '200px' })

  observer.observe(el)
  el.addEventListener('click', () => navigate(`/cardimg/${card.txid}`))
  return el
}

// --- Upload Detail Page ---

async function renderUploadPage(txid) {
  const img = document.getElementById('upload-image')
  const meta = document.getElementById('upload-meta')

  // Update page header
  const h1 = document.querySelector('#upload-page .page-header h1')
  h1.innerHTML = '<span class="header-protocol">CARDIMG</span> <span class="header-txid">' + txid + '</span>'

  img.src = ''
  meta.innerHTML = '<div class="spinner"></div>'

  // Find in allCards first, otherwise fetch from API
  let card = allCards.find(c => c.txid === txid)

  if (!card) {
    try {
      const res = await fetch(`${API}/tx/${txid}`)
      if (!res.ok) throw new Error('Not found')
      // /tx/:txid returns raw image bytes — we need metadata
      // Try finding by hash from /list
      const listRes = await fetch(`${API}/list`)
      const list = await listRes.json()
      card = list.find(c => c.txid === txid)
    } catch (e) {
      meta.innerHTML = `<p style="color:#ef4444">Failed to load: ${e.message}</p>`
      return
    }
  }

  if (!card) {
    // Not in index — show what we can from txid
    // Show thumbnail immediately, upgrade to full image when loaded
    img.src = `${API}/thumb/tx/${txid}`
    const fullImg = new Image()
    fullImg.onload = () => { img.src = fullImg.src }
    fullImg.src = `${API}/tx/${txid}`
    meta.innerHTML = `
      <h3>TxID</h3>
      <div class="meta-value">${txid}</div>
      <a href="https://whatsonchain.com/tx/${txid}" target="_blank" rel="noopener">View on WhatsOnChain →</a>

      <h3>Status</h3>
      <p>Not in local index. Image fetched from chain.</p>

      <h3>Direct Link</h3>
      <a href="${API}/tx/${txid}" target="_blank" rel="noopener">Open raw image →</a>
    `
    return
  }

  // Show thumbnail immediately (cached/fast), then upgrade to full image
  img.src = `${API}/thumb/${card.hash}`
  const fullImg = new Image()
  fullImg.onload = () => { img.src = fullImg.src }
  fullImg.src = `${API}/img/${card.hash}`

  const isUnconfirmed = !card.blockHeight

  // Fetch card associations
  let cardsetHtml = ''
  try {
    const res = await fetch(`${API}/card/${card.hash}/sets`)
    const data = await res.json()
    if (data.cardsets && data.cardsets.length > 0) {
      const refs = data.cardsets.map(s => `
        <div class="cardset-ref-item" onclick="navigate('/card/${s.cardsetTxid}')">
          <span>${shortHash(s.cardsetTxid)}</span>
          <span class="role">${s.role} of ${s.totalMembers}</span>
        </div>
      `).join('')
      cardsetHtml = `
        <div class="cardset-refs">
          <h3>Appears in ${data.cardsets.length} card${data.cardsets.length > 1 ? 's' : ''}</h3>
          ${refs}
        </div>
      `
    }
  } catch (e) {
    // silent
  }

  meta.innerHTML = `
    <h3>TxID</h3>
    <div class="meta-value">${card.txid}</div>
    <a href="https://whatsonchain.com/tx/${card.txid}" target="_blank" rel="noopener">View on WhatsOnChain →</a>

    <h3>Block</h3>
    <p>${isUnconfirmed ? '<span style="color:#fbbf24">Unconfirmed (mempool)</span>' : card.blockHeight}</p>

    <h3>Image Size</h3>
    <p>${formatBytes(card.size)}</p>

    <h3>Direct Link</h3>
    <a href="${API}/img/${card.hash}" target="_blank" rel="noopener">Open raw image →</a>

    ${cardsetHtml}
  `
}

// --- Cards Gallery ---

async function loadSets(isRefresh) {
  const grid = document.getElementById('sets-grid')
  const loading = document.getElementById('sets-loading')
  const empty = document.getElementById('sets-empty')

  if (isRefresh) {
  }

  try {
    const res = await fetch(`${API}/sets/list`)
    const sets = await res.json()

    sets.sort((a, b) => {
      const aUnc = !a.blockHeight
      const bUnc = !b.blockHeight
      if (aUnc && !bUnc) return -1
      if (!aUnc && bUnc) return 1
      if (aUnc && bUnc) return 0
      return (b.blockHeight || 0) - (a.blockHeight || 0)
    })

    allSets = sets

    loading.style.display = 'none'

    if (sets.length === 0) {
      empty.style.display = 'flex'
      grid.style.display = 'none'
      return
    }

    empty.style.display = 'none'
    grid.style.display = 'grid'
    grid.innerHTML = ''

    sets.forEach(set => {
      grid.appendChild(createSetCard(set))
    })

    loadStats()
  } catch (e) {
    loading.innerHTML = `<p style="color:#ef4444">Failed to load: ${e.message}</p>`
  } finally {
  }
}

function createSetCard(set) {
  const el = document.createElement('div')
  el.className = 'set-card'
  el.style.position = 'relative'

  const isUnconfirmed = !set.blockHeight

  const thumbSlots = set.txids.slice(0, 4).map(txid => {
    return `<div class="set-thumb-slot" data-txid="${txid}"><div class="set-placeholder">…</div></div>`
  }).join('')

  el.innerHTML = `
    <div class="set-card-images">${thumbSlots}</div>
    <div class="set-card-info">
      <div class="set-card-txid" title="${set.cardsetTxid}">${shortHash(set.cardsetTxid)}</div>
      <div class="set-card-members">${set.memberCount} uploads</div>
    </div>
    ${isUnconfirmed ? '<span class="set-card-badge" style="color:#fbbf24">unconfirmed</span>' : ''}
  `

  const slots = el.querySelectorAll('.set-thumb-slot')
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        slots.forEach(slot => {
          const txid = slot.dataset.txid
          const img = document.createElement('img')
          img.alt = 'Upload ' + shortHash(txid)
          img.onload = () => {
            slot.innerHTML = ''
            slot.appendChild(img)
          }
          img.onerror = () => {
            slot.querySelector('.set-placeholder').textContent = 'N/A'
          }
          img.src = `${API}/thumb/tx/${txid}`
        })
        observer.unobserve(el)
      }
    })
  }, { rootMargin: '200px' })

  observer.observe(el)
  el.addEventListener('click', () => navigate(`/card/${set.cardsetTxid}`))
  return el
}

// --- Card Detail Page ---

async function renderCardPage(txid) {
  const txidEl = document.getElementById('card-detail-txid')
  const membersEl = document.getElementById('card-detail-members')

  // Update page header
  const h1 = document.querySelector('#card-page .page-header h1')
  h1.innerHTML = '<span class="header-protocol">CARDSET</span> <span class="header-txid">' + txid + '</span>'

  txidEl.innerHTML = ''
  membersEl.innerHTML = '<div class="spinner"></div>'

  try {
    const res = await fetch(`${API}/sets/${txid}`)
    if (!res.ok) throw new Error('Card not found')
    const set = await res.json()

    txidEl.innerHTML = `<a href="https://whatsonchain.com/tx/${set.cardsetTxid}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">${set.cardsetTxid}</a>`

    membersEl.innerHTML = ''

    set.members.forEach(member => {
      const memberEl = document.createElement('div')
      memberEl.className = 'set-member'

      if (member.hash) {
        memberEl.innerHTML = `
          <img src="${API}/thumb/${member.hash}" alt="Upload ${shortHash(member.txid)}" />
          <div class="set-member-role">${member.role}</div>
          <div class="set-member-txid">${shortHash(member.txid)}</div>
        `
        memberEl.querySelector('img').addEventListener('click', () => navigate(`/cardimg/${member.txid}`))
      } else {
        memberEl.innerHTML = `
          <img src="${API}/thumb/tx/${member.txid}" alt="Upload ${shortHash(member.txid)}" />
          <div class="set-member-role">${member.role}</div>
          <div class="set-member-txid">${shortHash(member.txid)}</div>
        `
        memberEl.querySelector('img').addEventListener('error', e => {
          e.target.style.display = 'none'
          const ph = document.createElement('div')
          ph.className = 'set-member-placeholder'
          ph.textContent = 'Not found'
          memberEl.insertBefore(ph, memberEl.firstChild)
        })
        memberEl.querySelector('img').addEventListener('click', () => navigate(`/cardimg/${member.txid}`))
      }

      membersEl.appendChild(memberEl)
    })
  } catch (e) {
    membersEl.innerHTML = `<p style="color:#ef4444">Failed to load: ${e.message}</p>`
  }
}

// --- Utils ---

function shortHash(hash) {
  if (!hash) return ''
  return hash.slice(0, 6) + '...' + hash.slice(-6)
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}
