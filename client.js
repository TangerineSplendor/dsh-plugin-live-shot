window.__ModuleLoader__.load({
  id: 'dsh-plugin-live-shot',
  factory(require) {
    const React = require('react'), h = React.createElement;
    const client = sessionStorage.getItem('dsh-shot-client') || crypto.randomUUID();
    sessionStorage.setItem('dsh-shot-client', client);
    let running = false, stopped = false, retryAt = 0, errorShown = '', delivered = new Set();
    let hidePreference = false, preferenceLoaded = false;
    let hotkeyPreference = 'Ctrl+Shift+X', shortcutProblem = '', hotkeyRegistered = false;
    let gameCompatibilityReady = false, gameCompatibilityEnabling = false;
    const preferenceState = () => ({ value: hidePreference, ready: preferenceLoaded,
      hotkey: hotkeyPreference, problem: shortcutProblem, registered: hotkeyRegistered,
      gameCompatibilityReady, gameCompatibilityEnabling });
    const preferenceListeners = new Set();
    function toast(message) {
      let el = document.getElementById('dsh-shot-toast');
      if (!el) {
        el = document.createElement('div'); el.id = 'dsh-shot-toast';
        el.style.cssText = 'position:fixed;bottom:85px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#222;color:white;padding:9px 16px;border-radius:8px;font:13px system-ui;pointer-events:none';
        document.body.appendChild(el);
      }
      el.textContent = message; el.hidden = false;
      clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 4500);
    }
    function deliver(file) {
      const input = document.querySelector('[data-composer-input="true"]');
      if (!input) return false;
      input.focus();
      const data = new DataTransfer(); data.items.add(file);
      const paste = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      if (!input.dispatchEvent(paste)) return true;
      return !input.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
    }
    async function post(op, extra = {}) {
      const response = await fetch('/api/dsh-shot/control', { method: 'POST', cache: 'no-store',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, client, focused: document.hasFocus(), ...extra }) });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); }
      catch (_) { throw new Error(response.status === 404 ? '截图 Host 接口未加载，请完整退出 DSH 后重开' : '截图服务返回异常（HTTP ' + response.status + '）'); }
      if (!response.ok) throw new Error(data.error || '截图服务不可用');
      if (typeof data.hideDsh === 'boolean') {
        hidePreference = data.hideDsh; preferenceLoaded = true;
        hotkeyPreference = data.hotkey || hotkeyPreference; shortcutProblem = data.hotkeyError || ''; hotkeyRegistered = !!data.registered;
        gameCompatibilityReady = data.gameCompatibilityReady === true;
        gameCompatibilityEnabling = data.gameCompatibilityEnabling === true;
        for (const listener of preferenceListeners) listener(preferenceState());
      }
      return data;
    }
    async function poll() {
      if (running || stopped) return;
      running = true;
      try {
        const data = await post('poll', { skipImage: Date.now() < retryAt });
        if (data.error && errorShown !== data.error) { errorShown = data.error; toast(data.error); }
        if (data.hotkeyError && errorShown !== data.hotkeyError) { errorShown = data.hotkeyError; toast(data.hotkeyError); }
        if (data.result && Date.now() >= retryAt) {
          const item = data.result;
          if (!delivered.has(item.id)) {
            const bytes = Uint8Array.from(atob(item.png), c => c.charCodeAt(0));
            if (!deliver(new File([bytes], 'shot-' + Date.now() + '.png', { type: 'image/png' }))) {
              retryAt = Date.now() + 5000;
              toast('未找到可接收图片的输入框；图片已保留，打开对话后自动重试');
              await post('failure'); return;
            }
            delivered.add(item.id);
            if (delivered.size > 100) delivered.delete(delivered.values().next().value);
            toast('截图已插入输入框');
          }
          await post('ack', { id: item.id });
        }
      } catch (e) { /* A restarting Host is retried by the next poll. */ }
      finally { running = false; }
    }
    function ShotButton() {
      const [preference, setPreference] = React.useState(preferenceState());
      const [saving, setSaving] = React.useState(false);
      const [settingsOpen, setSettingsOpen] = React.useState(false);
      const [shortcutDraft, setShortcutDraft] = React.useState(hotkeyPreference);
      const [settingsError, setSettingsError] = React.useState('');
      React.useEffect(() => {
        preferenceListeners.add(setPreference);
        setPreference(preferenceState());
        return () => preferenceListeners.delete(setPreference);
      }, []);
      const changePreference = async event => {
        const value = event.target.checked; setSaving(true);
        try { await post('settings', { hideDsh: value }); }
        catch (error) { toast(error.message); }
        finally { setSaving(false); }
      };
      const saveShortcut = async () => {
        setSaving(true); setSettingsError('');
        try { const data = await post('settings', { hotkey: shortcutDraft }); setSettingsOpen(false); toast('截图快捷键：' + data.hotkey); }
        catch (error) { setSettingsError(error.message); }
        finally { setSaving(false); }
      };
      const enableGameCompatibility = async () => {
        setSettingsError('');
        try { await post('gameCompatibility'); toast('请确认 Windows 提示，启用后即可返回游戏截图'); }
        catch (error) { setSettingsError(error.message); }
      };
      return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 3, position: 'relative' } },
        h('button', { type: 'button', title: '实时桌面截图（全局 ' + preference.hotkey + '）\nShift+点击：本次反向切换隐藏 DSH',
        'aria-label': '截图', onClick: event => {
          void post('start', event.shiftKey ? { hideDsh: !hidePreference } : {}).catch(e => toast(e.message));
        },
        style: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', width: 28, height: 28 } },
        h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 },
          h('path', { d: 'M3 7h4l2-3h6l2 3h4v13H3z' }), h('circle', { cx: 12, cy: 13, r: 4 }))),
        h('label', { title: '截图前隐藏 DSH，完成或取消后恢复；全局热键也使用此设置',
          style: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, whiteSpace: 'nowrap', cursor: 'pointer' } },
          h('input', { type: 'checkbox', checked: preference.value, disabled: saving || !preference.ready,
            onChange: changePreference, 'aria-label': '截图时隐藏 DSH', style: { margin: 0, accentColor: '#07a953' } }), '隐藏 DSH'),
        h('button', { type: 'button', 'aria-label': '截图设置', title: '设置截图快捷键',
          disabled: !preference.ready, style: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '2px 5px' },
          onClick: () => { setSettingsOpen(!settingsOpen); setShortcutDraft(preference.hotkey); setSettingsError(''); } }, '⚙'),
        settingsOpen && h('div', { role: 'dialog', 'aria-label': '截图快捷键设置',
          style: { position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, width: 285, zIndex: 1000,
            background: '#fff', color: '#222', border: '1px solid #ddd', borderRadius: 8, padding: 12, boxShadow: '0 4px 20px #0003', font: '13px system-ui' } },
          h('label', { style: { display: 'block' } }, '全局截图快捷键',
            h('input', { type: 'text', value: shortcutDraft, 'aria-label': '全局截图快捷键', placeholder: 'Ctrl+Alt+A',
              style: { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 6, padding: 6, color: '#222', background: '#fff', border: '1px solid #aaa', borderRadius: 4 },
              onChange: event => setShortcutDraft(event.target.value),
              onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); void saveShortcut(); } if (event.key === 'Escape') setSettingsOpen(false); } })),
          h('div', { style: { fontSize: 11, color: '#666', margin: '6px 0' } }, '例如 Ctrl+Alt+A、Ctrl+Shift+X、F8'),
          h('div', { style: { borderTop: '1px solid #ddd', paddingTop: 8, marginBottom: 8 } },
            h('button', { type: 'button', disabled: preference.gameCompatibilityReady || preference.gameCompatibilityEnabling,
              onClick: () => { void enableGameCompatibility(); } },
              preference.gameCompatibilityReady ? '游戏兼容已启用' : preference.gameCompatibilityEnabling ? '等待 Windows 确认…' : '启用管理员游戏兼容'),
            h('div', { style: { fontSize: 11, color: '#666', marginTop: 5 } }, '用于游戏中 Esc 无法取消选框的情况。需确认 Windows 提示；仅本次运行有效。')),
          (settingsError || preference.problem) && h('div', { role: 'alert', style: { color: '#b22', marginBottom: 6 } }, settingsError || preference.problem),
          h('div', { style: { display: 'flex', gap: 6 } },
            h('button', { type: 'button', disabled: saving, onClick: () => { void saveShortcut(); } }, '保存'),
            h('button', { type: 'button', disabled: saving, onClick: () => setShortcutDraft('Ctrl+Shift+X') }, '恢复默认'),
            h('button', { type: 'button', onClick: () => setSettingsOpen(false) }, '取消'))));
    }
    return { inject: ['slots'], apply(ctx) {
      ctx.slots.inject('conversation.input.left', () => ctx.slots.register({ name: 'conversation.input.left', id: 'dsh-shot', order: 20 }, ShotButton));
      ctx.effect(() => {
        stopped = false; void poll(); const timer = setInterval(() => { void poll(); }, 700);
        return () => { stopped = true; clearInterval(timer); document.getElementById('dsh-shot-toast')?.remove(); };
      });
    } };
  },
});
