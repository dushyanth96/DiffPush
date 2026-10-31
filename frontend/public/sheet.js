/* Static A2Z sheet page: search, filters, progress markers, sticky topic
 * counts, and "continue where I left off".
 *
 * The page is prerendered HTML (no React). Progress lives in the same
 * localStorage contract the app uses, so guest solves show up here instantly
 * and the app picks up anything this page marks. No network, no tracking.
 */
(function () {
  'use strict'

  var TRACKER_KEY = 'builtdiff:tracker:v1'
  var STATUS_KEY = 'builtdiff:status'

  function readState() {
    try {
      var raw = localStorage.getItem(TRACKER_KEY)
      if (!raw) return null
      var parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return null
      return parsed
    } catch (e) {
      return null
    }
  }

  function lastOpened() {
    try {
      var raw = JSON.parse(localStorage.getItem(STATUS_KEY) || 'null')
      return raw && typeof raw.slug === 'string' ? raw.slug : null
    } catch (e) {
      return null
    }
  }

  function init() {
    var tools = document.getElementById('sheet-tools')
    if (!tools) return

    var rows = Array.prototype.slice.call(document.querySelectorAll('.problem-list li[data-id]'))
    var sections = Array.prototype.slice.call(document.querySelectorAll('section.topic'))
    var state = readState()
    var solvedMap = (state && state.solvedMap) || {}
    var starred = {}
    var due = {}

    ;((state && state.starredIds) || []).forEach(function (id) { starred[id] = true })
    ;((state && state.reviewQueue) || []).forEach(function (id) {
      var box = state && state.boxState && state.boxState[id]
      if (!box || !box.nextDue || box.nextDue <= Date.now()) due[id] = true
    })

    var solvedCount = Object.keys(solvedMap).length
    var last = lastOpened()
    var firstUnsolved = null
    var lastRow = null

    rows.forEach(function (row) {
      var id = row.getAttribute('data-id')
      var titleLink = row.querySelector('a')
      if (solvedMap[id]) row.classList.add('is-solved')
      else if (!firstUnsolved) firstUnsolved = { id: id, title: titleLink ? titleLink.textContent.trim() : id }
      if (starred[id]) row.classList.add('is-starred')
      if (due[id]) row.classList.add('is-due')
      if (last && id === last && !solvedMap[id]) lastRow = { id: id, title: titleLink ? titleLink.textContent.trim() : id }
    })

    // Continue: last opened unsolved → first unsolved on the page.
    var target = lastRow || firstUnsolved
    var continueLink = document.getElementById('sheet-continue')
    if (continueLink) {
      if (target) {
        continueLink.href = '/solve/' + target.id
        continueLink.textContent = (solvedCount > 0 ? 'Continue: ' : 'Start with: ') + target.title + ' →'
      } else {
        continueLink.href = '/dashboard'
        continueLink.textContent = 'All 369 solved — open the tracker →'
      }
    }

    var progress = document.getElementById('sheet-progress')
    if (progress) {
      progress.innerHTML = solvedCount > 0
        ? '<strong>' + solvedCount + ' / ' + rows.length + '</strong> solved on this device · progress stays in this browser — <a href="/dashboard">back it up</a>'
        : 'Progress is saved in this browser only — <a href="/dashboard">open the tracker</a> to back it up.'
    }

    function updateTopicCounts() {
      var perTopic = {}
      rows.forEach(function (row) {
        if (!row.classList.contains('is-solved')) return
        var section = row.closest('section.topic')
        if (!section) return
        var key = section.getAttribute('data-topic')
        perTopic[key] = (perTopic[key] || 0) + 1
      })
      sections.forEach(function (section) {
        var key = section.getAttribute('data-topic')
        var n = perTopic[key] || 0
        var total = section.querySelectorAll('.problem-list li[data-id]').length
        section.querySelectorAll('[data-topic-count]').forEach(function (el) {
          el.textContent = n + '/' + total
        })
        var navEl = document.querySelector('[data-topic-link="' + key + '"] [data-topic-count]')
        if (navEl) navEl.textContent = n + '/' + total
        section.classList.toggle('is-complete', n === total && total > 0)
        var navLink = document.querySelector('[data-topic-link="' + key + '"]')
        if (navLink) navLink.classList.toggle('is-complete', n === total && total > 0)
      })
    }

    var status = 'all'
    var diff = null

    function applyFilters() {
      var q = (document.getElementById('sheet-q').value || '').trim().toLowerCase()
      var visibleBySection = {}
      var visibleTotal = 0

      rows.forEach(function (row) {
        var id = row.getAttribute('data-id')
        var haystack = row.getAttribute('data-title') || ''
        var rowDiff = row.getAttribute('data-diff')
        var ok = true
        if (q && haystack.indexOf(q) === -1) ok = false
        if (ok && diff && rowDiff !== diff) ok = false
        if (ok && status === 'solved' && !solvedMap[id]) ok = false
        if (ok && status === 'unsolved' && solvedMap[id]) ok = false
        if (ok && status === 'starred' && !starred[id]) ok = false
        if (ok && status === 'due' && !due[id]) ok = false

        row.hidden = !ok
        if (ok) {
          var section = row.closest('section.topic')
          var key = section ? section.getAttribute('data-topic') : '_'
          visibleBySection[key] = (visibleBySection[key] || 0) + 1
          visibleTotal += 1
        }
      })

      sections.forEach(function (section) {
        var key = section.getAttribute('data-topic')
        var count = visibleBySection[key] || 0
        section.hidden = count === 0
        var empty = section.querySelector('[data-topic-empty]')
        if (empty) empty.hidden = count !== 0
      })

      var nav = document.getElementById('topic-nav')
      if (nav) nav.hidden = visibleTotal === 0

      var heading = document.querySelector('#sheet-tools ~ h2')
      if (heading && rows.length) {
        heading.textContent = visibleTotal === rows.length
          ? 'Browse all ' + rows.length + ' problems by topic'
          : visibleTotal === 1
            ? '1 problem matches'
            : visibleTotal + ' problems match'
      }

      var empty = document.getElementById('sheet-empty')
      if (empty) empty.hidden = visibleTotal !== 0
    }

    var q = document.getElementById('sheet-q')
    if (q) {
      q.addEventListener('input', applyFilters)
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { q.value = ''; applyFilters() }
      })
    }

    Array.prototype.forEach.call(tools.querySelectorAll('[data-status]'), function (btn) {
      btn.addEventListener('click', function () {
        status = btn.getAttribute('data-status')
        Array.prototype.forEach.call(tools.querySelectorAll('[data-status]'), function (b) {
          b.classList.toggle('is-active', b === btn)
        })
        applyFilters()
      })
    })

    Array.prototype.forEach.call(tools.querySelectorAll('[data-diff]'), function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-diff')
        diff = diff === value ? null : value
        Array.prototype.forEach.call(tools.querySelectorAll('[data-diff]'), function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-diff') === diff)
        })
        applyFilters()
      })
    })

    var reset = document.getElementById('sheet-reset')
    if (reset) {
      reset.addEventListener('click', function () {
        if (q) q.value = ''
        status = 'all'
        diff = null
        Array.prototype.forEach.call(tools.querySelectorAll('[data-status]'), function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-status') === 'all')
        })
        Array.prototype.forEach.call(tools.querySelectorAll('[data-diff]'), function (b) {
          b.classList.remove('is-active')
        })
        applyFilters()
        if (q) q.focus()
      })
    }

    updateTopicCounts()
    applyFilters()

    // Keep the sticky nav from covering an anchored topic heading.
    document.documentElement.style.setProperty('--sheet-nav-h', '0px')
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
