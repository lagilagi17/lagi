'use strict';
// Entry gate + tab navigation.
// NOTE: the entry password is a simple client-side lock (no server involved).
// Anyone can read it in this file — it only keeps casual visitors out.
(() => {
  const PASS = '1492';
  const GATE_KEY = 'hanq-gate-ok';
  const TAB_KEY = 'hanq-tab';
  const root = document.documentElement;

  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* optional */ } },
    remove(key) { try { sessionStorage.removeItem(key); } catch { /* optional */ } },
  };
  const local = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* optional */ } },
  };

  // Runs in <head> before the body renders, so an unlocked session never flashes the gate.
  if (session.get(GATE_KEY) === '1') root.classList.add('unlocked');

  function init() {
    const gate = document.getElementById('gate');
    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-input');
    const error = document.getElementById('gate-error');
    const tabs = Array.from(document.querySelectorAll('[role="tab"][data-tab]'));
    let current = null;

    const battleScripts = Array.from(document.getElementById('battle-scripts').content.querySelectorAll('script[src]'));
    const loadingPanel = document.createElement('div');
    const loadingMessage = document.createElement('p');
    const retry = document.createElement('button');
    loadingMessage.setAttribute('role', 'status');
    retry.type = 'button';
    retry.className = 'button';
    retry.textContent = '다시 시도';
    loadingPanel.append(loadingMessage, retry);
    let nextBattleScript = 0;
    let loadingBattle = false;
    const wantsBattle = () => (current === 'battle' || current === 'openworld') && root.classList.contains('unlocked');

    async function loadBattle() {
      if (!wantsBattle() || nextBattleScript === battleScripts.length) return;
      document.getElementById(current).append(loadingPanel);
      if (loadingBattle) return;
      loadingBattle = true;
      retry.hidden = true;
      loadingMessage.textContent = '전장을 불러오는 중…';
      // Fetch in parallel, execute in dependency order. A failed dependency can
      // be retried without registering successful modules or game listeners twice.
      const preloads = battleScripts.slice(nextBattleScript).map(source => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = source.getAttribute('src');
        document.head.append(link);
        return link;
      });
      try {
        while (nextBattleScript < battleScripts.length && wantsBattle()) {
          const src = battleScripts[nextBattleScript].getAttribute('src');
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.onload = resolve;
            script.onerror = () => { script.remove(); reject(new Error(src)); };
            script.src = src;
            document.head.append(script);
          });
          nextBattleScript++;
        }
        if (nextBattleScript === battleScripts.length) {
          loadingPanel.remove();
          // Storage may be disabled. Reconcile the pane with the actual tab if
          // the arcade's saved-tab fallback mounted it in the other section.
          const pane = document.getElementById('pane-royale');
          if (wantsBattle() && pane && pane.parentElement.id !== current) {
            document.dispatchEvent(new CustomEvent('hanq:tab', {detail:current}));
          }
        }
      } catch {
        loadingMessage.textContent = '전장을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.';
        retry.hidden = false;
      } finally {
        loadingBattle = false;
        for (const link of preloads) link.remove();
      }
    }
    retry.addEventListener('click', loadBattle);
    document.addEventListener('hanq:unlock', loadBattle);

    // On a narrow screen the tab bar scrolls sideways: keep the chosen tab in view (without moving the page)
    function revealTab(tab) {
      const bar = tab.parentElement;
      if (!bar || bar.scrollWidth <= bar.clientWidth + 1) return;
      const b = bar.getBoundingClientRect(), t = tab.getBoundingClientRect();
      if (t.left < b.left) bar.scrollLeft += t.left - b.left - 8;
      else if (t.right > b.right) bar.scrollLeft += t.right - b.right + 8;
    }
    function selectTab(name, focus = false) {
      if (!tabs.some(tab => tab.dataset.tab === name)) name = 'calculator';
      for (const tab of tabs) {
        const selected = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        document.getElementById(tab.dataset.tab).hidden = !selected;
        if (selected && focus) tab.focus({ preventScroll: true });
        if (selected) { revealTab(tab); requestAnimationFrame(() => revealTab(tab)); }
      }
      if (current !== name) {
        if (current !== null && window.scrollY > 0) window.scrollTo({ top: 0 });
        current = name;
        local.set(TAB_KEY, name);
        document.dispatchEvent(new CustomEvent('hanq:tab', { detail: name }));
        loadBattle();
      }
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab.dataset.tab));
      tab.addEventListener('keydown', event => {
        let next = null;
        if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
        else if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
        else if (event.key === 'Home') next = tabs[0];
        else if (event.key === 'End') next = tabs[tabs.length - 1];
        if (next) { event.preventDefault(); selectTab(next.dataset.tab, true); }
      });
    });
    selectTab(local.get(TAB_KEY) || 'calculator');

    // Game picker inside the mini game tab.
    const picks = Array.from(document.querySelectorAll('.game-pick[data-game]'));
    let currentGame = null;
    function selectGame(name) {
      if (!picks.some(pick => pick.dataset.game === name)) name = picks[0].dataset.game;
      for (const pick of picks) {
        const selected = pick.dataset.game === name;
        pick.setAttribute('aria-pressed', String(selected));
        document.getElementById('pane-' + pick.dataset.game).hidden = !selected;
      }
      if (currentGame !== name) {
        currentGame = name;
        local.set('hanq-game', name);
        document.dispatchEvent(new CustomEvent('hanq:game', { detail: name }));
      }
    }
    picks.forEach(pick => pick.addEventListener('click', () => {
      selectGame(pick.dataset.game);
      try { pick.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch { /* optional */ }
    }));
    if (picks.length) selectGame(local.get('hanq-game') || 'jelly');

    function unlock() {
      session.set(GATE_KEY, '1');
      error.textContent = '';
      root.classList.add('revealing');
      const finish = () => {
        root.classList.remove('revealing');
        root.classList.add('unlocked');
        input.value = '';
        document.dispatchEvent(new CustomEvent('hanq:unlock'));
      };
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) finish(); else setTimeout(finish, 520);
    }
    function lock() {
      session.remove(GATE_KEY);
      root.classList.remove('unlocked', 'revealing');
      document.dispatchEvent(new CustomEvent('hanq:lock'));
      input.value = '';
      error.textContent = '';
      setTimeout(() => input.focus(), 30);
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      const value = input.value.trim();
      if (value === PASS) { unlock(); return; }
      error.textContent = value ? '비밀번호가 맞지 않아요.' : '비밀번호를 입력해 주세요.';
      form.classList.remove('shake');
      void form.offsetWidth; // restart the animation
      form.classList.add('shake');
      input.select();
    });
    input.addEventListener('input', () => { error.textContent = ''; });
    document.getElementById('lock-button').addEventListener('click', lock);

    if (!root.classList.contains('unlocked')) input.focus();
    gate.removeAttribute('hidden');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
