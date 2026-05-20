/* global game, Hooks, ChatMessage */

const MODULE_ID = 'dolmenwood-ammo-tracking'
const FLAG_IS_AMMO = 'isAmmo'
const FLAG_AMMO_ITEM_ID = 'ammoItemId'

// Adds "Is Ammo" checkbox to Gear item sheet
function injectIsAmmoCheckbox(app, html) {
  const item = app.document ?? app.item
  if (!item || item.type !== 'Item') return

  const el = html instanceof HTMLElement ? html : app.element
  const gearSection = el.querySelector('.item-common')
  if (!gearSection) return

  const isAmmo = item.getFlag(MODULE_ID, FLAG_IS_AMMO) ?? false

  const row = document.createElement('div')
  row.className = 'form-group ammo-is-ammo-row'
  row.innerHTML = `
    <label>Is Ammo</label>
    <input type="checkbox" class="ammo-is-ammo-checkbox" ${isAmmo ? 'checked' : ''}>
  `

  gearSection.appendChild(row)

  row.querySelector('.ammo-is-ammo-checkbox').addEventListener('change', async (e) => {
    await item.setFlag(MODULE_ID, FLAG_IS_AMMO, e.target.checked)
  })
}

// Adds "Ammunition" dropdown to Weapon item sheet
function injectAmmoDropdown(app, html) {
  const item = app.document ?? app.item
  if (!item || item.type !== 'Weapon') return

  const actor = item.actor
  if (!actor) return

  const el = html instanceof HTMLElement ? html : app.element
  const weaponSection = el.querySelector('.item-weapon')
  if (!weaponSection) return

  const ammoItems = actor.items.filter(i =>
    i.type === 'Item' &&
    i.getFlag(MODULE_ID, FLAG_IS_AMMO) === true
  )

  const currentAmmoId = item.getFlag(MODULE_ID, FLAG_AMMO_ITEM_ID) ?? ''

  const options = [
    '<option value="">None</option>',
    ...ammoItems.map(a =>
      `<option value="${a.id}" ${a.id === currentAmmoId ? 'selected' : ''}>${a.name}</option>`
    )
  ].join('')

  const row = document.createElement('div')
  row.className = 'form-row ammo-selector-row'
  row.innerHTML = `
    <div class="form-field">
      <label>Ammunition</label>
      <select class="ammo-selector">${options}</select>
    </div>
  `

  weaponSection.appendChild(row)

  row.querySelector('.ammo-selector').addEventListener('change', async (e) => {
    const val = e.target.value
    if (val) {
      await item.setFlag(MODULE_ID, FLAG_AMMO_ITEM_ID, val)
    } else {
      await item.unsetFlag(MODULE_ID, FLAG_AMMO_ITEM_ID)
    }
  })
}

const sheetObservers = new WeakMap()

// Handles consuming ammo when missile weapon is fired
function setupMissileAmmoCheck(app, html) {
  const actor = app.actor
  if (!actor) return

  const el = html instanceof HTMLElement ? html : app.element

  // Disconnect any observer from a previous render of this sheet
  sheetObservers.get(app)?.disconnect()

  // Per-render state: tracks which weapon was selected in a multi-weapon menu
  const weaponSelection = { weaponId: null }

  // Reset weapon selection at the start of each new missile attack flow
  const missileBtn = el.querySelector('.combat .fa-bow-arrow.rollable')
  if (missileBtn) {
    missileBtn.addEventListener('click', () => {
      weaponSelection.weaponId = null
    })
  }

  // Track weapon chosen from the weapon selection menu (multi-weapon case)
  el.addEventListener('click', (e) => {
    const weaponItem = e.target.closest('.weapon-menu-item[data-weapon-id]')
    if (weaponItem) {
      weaponSelection.weaponId = weaponItem.dataset.weaponId
    }
  }, true)

  // Watch for the modifier panel being appended to the sheet element
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1 || !node.classList?.contains('modifier-panel')) continue
        setupAmmoRollInterception(node, actor, weaponSelection)
      }
    }
  })

  observer.observe(el, { childList: true })
  sheetObservers.set(app, observer)
}

function resolveWeapon(actor, weaponSelection) {
  if (weaponSelection.weaponId) {
    return actor.items.get(weaponSelection.weaponId) ?? null
  }
  // Single-weapon case: if only one missile weapon is equipped, use it
  const missileWeapons = actor.items.filter(i =>
    i.type === 'Weapon' &&
    i.system.equipped &&
    Array.isArray(i.system.qualities) &&
    i.system.qualities.includes('missile')
  )
  return missileWeapons.length === 1 ? missileWeapons[0] : null
}

function setupAmmoRollInterception(panel, actor, weaponSelection) {
  const weapon = resolveWeapon(actor, weaponSelection)
  if (!weapon) return

  const ammoItemId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ITEM_ID)
  if (!ammoItemId) return

  const rollBtn = panel.querySelector('.roll-btn')
  if (!rollBtn) return

  // Flag to allow the re-fired synthetic click to pass through to the system handler
  let checkPassed = false

  rollBtn.addEventListener('click', async (e) => {
    if (checkPassed) {
      checkPassed = false
      return
    }

    // Block the system's roll handler until ammo check completes
    e.stopImmediatePropagation()
    e.preventDefault()

    const ammoItem = actor.items.get(ammoItemId)

    if (!ammoItem) {
      panel.remove()
      await ChatMessage.create({
        content: `<div class="chat-card"><p><strong>Attack cancelled:</strong> Required ammunition is no longer in your inventory.</p></div>`,
        speaker: ChatMessage.getSpeaker({ actor })
      })
      return
    }

    const qty = ammoItem.system.quantity ?? 0

    if (qty <= 0) {
      panel.remove()
      await ChatMessage.create({
        content: `<div class="chat-card"><p><strong>Attack cancelled:</strong> You are out of ${ammoItem.name}!</p></div>`,
        speaker: ChatMessage.getSpeaker({ actor })
      })
      return
    }

    // Consume one ammo. The quantity field has min:1 in the schema, so on the
    // last shot we delete the item rather than trying to decrement to 0.
    if (qty > 1) {
      await ammoItem.update({ 'system.quantity': qty - 1 })
    } else {
      await actor.deleteEmbeddedDocuments('Item', [ammoItem.id])
    }

    // Re-fire the click so the system's bubble-phase handler executes the roll
    checkPassed = true
    rollBtn.click()
  }, true) // capture phase — runs before the system's bubble listener
}

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Ammo Tracking module loaded`)
})

Hooks.on('renderDolmenItemSheet', (app, html) => {
  injectIsAmmoCheckbox(app, html)
  injectAmmoDropdown(app, html)
})

Hooks.on('renderDolmenSheet', (app, html) => {
  setupMissileAmmoCheck(app, html)
})
