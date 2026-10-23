export const DEFAULT_HOTKEY = 'Ctrl+Shift+X';
export function normalizeHotkey(input) {
  if (typeof input !== 'string' || input.length > 80) throw new Error('请输入有效的快捷键');
  const tokens = input.split('+').map(s => s.trim()).filter(Boolean);
  const aliases = { ctrl: 'Ctrl', control: 'Ctrl', commandorcontrol: 'Ctrl', alt: 'Alt', shift: 'Shift', win: 'Super', meta: 'Super', super: 'Super' };
  const modifiers = new Set(); let key;
  for (const token of tokens) {
    const modifier = aliases[token.toLowerCase()];
    if (modifier) { if (modifiers.has(modifier)) throw new Error('快捷键包含重复修饰键'); modifiers.add(modifier); }
    else {
      if (key) throw new Error('快捷键只能包含一个主键');
      if (/^[a-z0-9]$/i.test(token)) key = token.toUpperCase();
      else if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(token)) key = token.toUpperCase();
      else if (/^PrintScreen$/i.test(token)) key = 'PrintScreen';
      else throw new Error('主键支持字母、数字、F1–F24 或 PrintScreen');
    }
  }
  if (!key || (/^[A-Z0-9]$/.test(key) && !['Ctrl', 'Alt', 'Super'].some(v => modifiers.has(v)))) throw new Error('字母或数字快捷键须搭配 Ctrl、Alt 或 Win');
  return [...['Ctrl', 'Alt', 'Shift', 'Super'].filter(v => modifiers.has(v)), key].join('+');
}
